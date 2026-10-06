// FaceService: verifikasi wajah (2FA) untuk akun bersama. Sebelumnya ditulis sebagai Cloud
// Functions (face-auth.ts), tetapi project Firebase memakai paket Spark yang tidak bisa
// menjalankan Cloud Functions, jadi dipindahkan ke backend Go ini.
//
// Data wajah (face_profiles, face_audit, face_rate) hanya diakses lewat backend ini;
// firestore.rules menutup koleksi itu untuk client. Lihat scanning.md.
package services

import (
	"context"
	"crypto/subtle"
	"fmt"
	"math"
	"net/http"
	"os"
	"regexp"
	"sort"
	"strings"
	"sync"
	"time"
	"unicode/utf8"

	"cloud.google.com/go/firestore"
	firebaseAuth "firebase.google.com/go/v4/auth"
	"github.com/gariiriana/DwimitraSystem/backend/core/middlewares"
	"github.com/gariiriana/DwimitraSystem/backend/pkg/logger"
)

const (
	faceDescriptorLength = 128
	// Jarak Euclidean face-api (ResNet 128-D). Login asli Gari di tes 6 Okt 2026: 0.20-0.32.
	// Batas 0.5 sempat menganggap Gari mirip Rifal (orang berbeda), jadi diketatkan. Model
	// ini (turunan dlib) dikenal lebih mudah tertukar pada wajah Asia.
	faceMatchThreshold = 0.42
	// Batas longgar khusus PERINGATAN ke QC (tidak pernah dipakai untuk login).
	faceLookalikeThreshold = 0.55
	// Frame-frame probe dalam satu scan harus berasal dari wajah yang sama.
	faceProbeConsistency = 0.45

	faceSessionSeconds    = 12 * 60 * 60
	faceBreakGlassSeconds = 2 * 60 * 60
	faceRateWindow        = 15 * time.Minute
	faceMaxVerify         = 10
	faceMaxBreakGlass     = 5
	faceMaxScanIssues     = 20
	faceMaxPendingAccount = 10
	faceMaxPhotoChars     = 80_000
	faceMaxSamples        = 16 // setelah digabung dari beberapa perangkat (dokumen < 1 MB)
	faceMaxPhotos         = 6
	faceEnrollSamples     = 4 // sampel pendaftaran pertama selalu dipertahankan
	faceMaxRejectedListed = 200

	faceProfilesCol = "face_profiles"
	faceAuditCol    = "face_audit"
	faceRateCol     = "face_rate"
)

// Kendala teknis scan yang dilaporkan aplikasi (kamera/model), agar perangkat yang
// bermasalah terlihat di log audit Pusat Biometrik.
var faceScanIssues = map[string]bool{
	"camera_denied": true, "camera_missing": true, "camera_busy": true, "camera_unsupported": true,
	"model_load": true, "detect_error": true, "timeout": true,
}

var (
	faceIDPattern   = regexp.MustCompile(`^[A-Za-z0-9]{1,40}$`)
	nonAlnumPattern = regexp.MustCompile(`[^A-Za-z0-9]`)
)

// FaceError: kesalahan yang pesannya aman ditampilkan ke user, beserta status HTTP-nya.
type FaceError struct {
	Status  int
	Message string
}

func (e *FaceError) Error() string { return e.Message }

func faceErr(status int, msg string) *FaceError { return &FaceError{Status: status, Message: msg} }

// FaceCaller: pemanggil yang sudah login (password), dari ID token Firebase.
type FaceCaller struct {
	UID   string
	Email string // huruf kecil
	Token *firebaseAuth.Token
	IP    string
}

type faceDescriptor struct {
	V []float64 `firestore:"v"`
}

type faceProfile struct {
	// Akun tempat pengajuan dibuat (informasi untuk QC, tidak membatasi login).
	AccountUID   string           `firestore:"accountUid"`
	AccountEmail string           `firestore:"accountEmail"`
	Name         string           `firestore:"name"`
	Company      string           `firestore:"company"`
	Status       string           `firestore:"status"` // pending | approved | rejected
	Descriptors  []faceDescriptor `firestore:"descriptors"`
	Photos       []string         `firestore:"photos"`
	Device       string           `firestore:"device"`
	Consent      bool             `firestore:"consent"`
	RequestedAt  time.Time        `firestore:"requestedAt"`
	ReviewedBy   string           `firestore:"reviewedBy"`
	ReviewedAt   time.Time        `firestore:"reviewedAt"`
	RejectReason string           `firestore:"rejectReason"`
	// Wajah lain (aktif atau menunggu) yang mirip saat pendaftaran (hanya untuk QC).
	PossibleDuplicateOf string `firestore:"possibleDuplicateOf"`
	PossibleDuplicateID string `firestore:"possibleDuplicateId"`
}

type faceProfileDoc struct {
	ID string
	P  faceProfile
}

type faceMatch struct {
	faceProfileDoc
	Score float64
}

// ─── Hasil untuk frontend (frontend/types/faceAuthTypes.ts) ────────────────────

type FaceEnrollmentState struct {
	ID           string `json:"id"`
	Name         string `json:"name"`
	Company      string `json:"company"`
	Status       string `json:"status"`
	RejectReason string `json:"rejectReason"`
}

type FaceVerifyResult struct {
	Matched   bool   `json:"matched"`
	Token     string `json:"token,omitempty"`
	Person    string `json:"person,omitempty"`
	FaceUntil int64  `json:"faceUntil,omitempty"`
}

type FaceEnrollResult struct {
	AlreadyRegistered bool   `json:"alreadyRegistered"`
	ID                string `json:"id,omitempty"`
}

type FaceAdminProfile struct {
	ID                  string   `json:"id"`
	AccountEmail        string   `json:"accountEmail"`
	Name                string   `json:"name"`
	Company             string   `json:"company"`
	Status              string   `json:"status"`
	Photos              []string `json:"photos"`
	Device              string   `json:"device"`
	RequestedAt         *int64   `json:"requestedAt"`
	ReviewedBy          string   `json:"reviewedBy"`
	ReviewedAt          *int64   `json:"reviewedAt"`
	RejectReason        string   `json:"rejectReason"`
	PossibleDuplicateOf string   `json:"possibleDuplicateOf"`
	PossibleDuplicateID string   `json:"possibleDuplicateId"`
}

type FaceAuditEntry struct {
	ID            string   `json:"id"`
	Type          string   `json:"type"`
	AccountEmail  string   `json:"accountEmail"`
	Person        string   `json:"person"`
	NearestPerson string   `json:"nearestPerson"`
	Distance      *float64 `json:"distance"`
	Device        string   `json:"device"`
	Issue         string   `json:"issue"`
	Detail        string   `json:"detail"`
	By            string   `json:"by"`
	IP            string   `json:"ip"`
	At            *int64   `json:"at"`
}

// FaceEnrollInput: data pendaftaran wajah dari aplikasi.
type FaceEnrollInput struct {
	Name        string      `json:"name"`
	Company     string      `json:"company"`
	Descriptors [][]float64 `json:"descriptors"`
	Photos      []string    `json:"photos"`
	Consent     bool        `json:"consent"`
	Device      string      `json:"device"`
}

type FaceService struct {
	fs   *firestore.Client
	auth *firebaseAuth.Client
}

func NewFaceService(fs *firestore.Client, auth *firebaseAuth.Client) *FaceService {
	return &FaceService{fs: fs, auth: auth}
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

func millisOrNil(t time.Time) *int64 {
	if t.IsZero() {
		return nil
	}
	ms := t.UnixMilli()
	return &ms
}

func round4(n float64) float64 { return math.Round(n*10000) / 10000 }

func truncate(s string, max int) string {
	if utf8.RuneCountInString(s) <= max {
		return s
	}
	return string([]rune(s)[:max])
}

// cleanDevice: keterangan perangkat dari aplikasi (hanya informasi untuk QC, bukan keamanan).
func cleanDevice(s string) string { return truncate(s, 120) }

func normalizeText(s string) string { return strings.Join(strings.Fields(s), " ") }

func checkDescriptors(ds [][]float64, min, max int) error {
	if len(ds) < min || len(ds) > max {
		return faceErr(http.StatusBadRequest, fmt.Sprintf("Jumlah sampel wajah harus %d-%d.", min, max))
	}
	for _, d := range ds {
		if len(d) != faceDescriptorLength {
			return faceErr(http.StatusBadRequest, "Data sampel wajah tidak valid.")
		}
		for _, n := range d {
			if math.IsNaN(n) || math.IsInf(n, 0) || math.Abs(n) >= 2 {
				return faceErr(http.StatusBadRequest, "Data sampel wajah tidak valid.")
			}
		}
	}
	return nil
}

func faceDistance(a, b []float64) float64 {
	sum := 0.0
	for i := range a {
		d := a[i] - b[i]
		sum += d * d
	}
	return math.Sqrt(sum)
}

func assertConsistent(probes [][]float64) error {
	for i := range probes {
		for j := i + 1; j < len(probes); j++ {
			if faceDistance(probes[i], probes[j]) > faceProbeConsistency {
				return faceErr(http.StatusBadRequest, "Sampel wajah tidak konsisten. Pastikan hanya satu orang di depan kamera.")
			}
		}
	}
	return nil
}

func storedVectors(p faceProfile) [][]float64 {
	out := make([][]float64, 0, len(p.Descriptors))
	for _, d := range p.Descriptors {
		if len(d.V) == faceDescriptorLength {
			out = append(out, d.V)
		}
	}
	return out
}

// bestMatch: profil dianggap cocok jika mayoritas probe DAN rata-rata jaraknya < threshold
// terhadap sampel tersimpan profil itu. threshold +Inf = profil terdekat (untuk log audit).
func bestMatch(probes [][]float64, profiles []faceProfileDoc, threshold float64) *faceMatch {
	var best *faceMatch
	for _, p := range profiles {
		stored := storedVectors(p.P)
		if len(stored) == 0 || len(probes) == 0 {
			continue
		}
		hits, sum := 0, 0.0
		for _, probe := range probes {
			min := math.Inf(1)
			for _, s := range stored {
				if d := faceDistance(probe, s); d < min {
					min = d
				}
			}
			if min < threshold {
				hits++
			}
			sum += min
		}
		score := sum / float64(len(probes))
		if hits*2 <= len(probes) || score >= threshold {
			continue
		}
		if best == nil || score < best.Score {
			best = &faceMatch{faceProfileDoc: p, Score: score}
		}
	}
	return best
}

// Cache daftar wajah aktif per instance (hemat kuota baca Firestore paket Spark): scan
// login beruntun cukup membaca ulang semua profil paling sering tiap faceApprovedTTL.
// Dikosongkan saat QC menyetujui/menggabung/menghapus wajah di instance yang sama.
const faceApprovedTTL = 30 * time.Second

var (
	approvedMu    sync.Mutex
	approvedCache []faceProfileDoc
	approvedAt    time.Time
)

func invalidateApproved() {
	approvedMu.Lock()
	approvedCache, approvedAt = nil, time.Time{}
	approvedMu.Unlock()
}

func (s *FaceService) approvedProfilesCached(ctx context.Context) ([]faceProfileDoc, error) {
	approvedMu.Lock()
	if approvedCache != nil && time.Since(approvedAt) < faceApprovedTTL {
		list := approvedCache
		approvedMu.Unlock()
		return list, nil
	}
	approvedMu.Unlock()
	list, err := s.profilesByStatus(ctx, "approved", 0)
	if err != nil {
		return nil, err
	}
	approvedMu.Lock()
	approvedCache, approvedAt = list, time.Now()
	approvedMu.Unlock()
	return list, nil
}

func (s *FaceService) profilesByStatus(ctx context.Context, status string, limit int) ([]faceProfileDoc, error) {
	q := s.fs.Collection(faceProfilesCol).Where("status", "==", status)
	if limit > 0 {
		q = q.Limit(limit)
	}
	snaps, err := q.Documents(ctx).GetAll()
	if err != nil {
		return nil, err
	}
	out := make([]faceProfileDoc, 0, len(snaps))
	for _, snap := range snaps {
		var p faceProfile
		if err := snap.DataTo(&p); err != nil {
			logger.Warn("face profile decode failed", "id", snap.Ref.ID, "error", err)
			continue
		}
		out = append(out, faceProfileDoc{ID: snap.Ref.ID, P: p})
	}
	return out, nil
}

// getProfile: (nil, nil) jika dokumen tidak ada.
func (s *FaceService) getProfile(ctx context.Context, id string) (*faceProfile, error) {
	snap, err := s.fs.Collection(faceProfilesCol).Doc(id).Get(ctx)
	if snap != nil && !snap.Exists() {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	var p faceProfile
	if err := snap.DataTo(&p); err != nil {
		return nil, err
	}
	return &p, nil
}

func (s *FaceService) audit(ctx context.Context, c FaceCaller, entry map[string]interface{}) {
	entry["ip"] = c.IP
	entry["at"] = firestore.ServerTimestamp
	if _, _, err := s.fs.Collection(faceAuditCol).Add(ctx, entry); err != nil {
		logger.Error("face audit write failed", "error", err)
	}
}

// rateKey: kunci rate limit per akun + IP. Akun dipakai bersama, jadi kunci per akun saja
// memungkinkan mantan karyawan mengunci scan rekan-rekannya dari rumah.
func rateKey(c FaceCaller) string {
	ip := nonAlnumPattern.ReplaceAllString(c.IP, "-")
	if ip == "" {
		ip = "unknown"
	}
	return c.UID + "_" + ip
}

func toInt64(v interface{}) int64 {
	switch n := v.(type) {
	case int64:
		return n
	case float64:
		return int64(n)
	}
	return 0
}

// reserveAttempt: reservasi satu percobaan secara atomik (transaksi), sehingga request
// paralel tidak bisa melewati batas. Percobaan yang berhasil mereset lewat clearAttempts.
func (s *FaceService) reserveAttempt(ctx context.Context, key, field string, max int) error {
	ref := s.fs.Collection(faceRateCol).Doc(key)
	return s.fs.RunTransaction(ctx, func(ctx context.Context, tx *firestore.Transaction) error {
		data := map[string]interface{}{}
		snap, err := tx.Get(ref)
		if snap != nil && snap.Exists() {
			data = snap.Data()
		} else if err != nil && (snap == nil || snap.Exists()) {
			return err
		}
		now := time.Now().UnixMilli()
		windowStart := toInt64(data[field+"Start"])
		fresh := now-windowStart >= faceRateWindow.Milliseconds()
		count := int64(0)
		if !fresh {
			count = toInt64(data[field])
		}
		if count >= int64(max) {
			return faceErr(http.StatusTooManyRequests, "Terlalu banyak percobaan gagal. Coba lagi 15 menit lagi.")
		}
		start := windowStart
		if fresh {
			start = now
		}
		return tx.Set(ref, map[string]interface{}{field: count + 1, field + "Start": start}, firestore.MergeAll)
	})
}

func (s *FaceService) clearAttempts(ctx context.Context, key, field string) {
	if _, err := s.fs.Collection(faceRateCol).Doc(key).Set(ctx, map[string]interface{}{field: 0}, firestore.MergeAll); err != nil {
		logger.Warn("face rate reset failed", "error", err)
	}
}

func (s *FaceService) isReviewer(ctx context.Context, c FaceCaller) (bool, error) {
	if c.Email == "qcdme@dme.com" {
		return true, nil
	}
	snap, err := s.fs.Collection("users").Doc(c.UID).Get(ctx)
	if snap != nil && !snap.Exists() {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	role, _ := snap.Data()["role"].(string)
	return role == "admin" || role == "qc_dme", nil
}

// requireReviewer: QC DME / admin dengan sesi wajah yang sah (qcdme dikecualikan dari scan).
func (s *FaceService) requireReviewer(ctx context.Context, c FaceCaller) error {
	ok, err := s.isReviewer(ctx, c)
	if err != nil {
		return err
	}
	if !ok {
		return faceErr(http.StatusForbidden, "Hanya QC DME atau admin yang dapat mengelola data wajah.")
	}
	if !middlewares.HasValidFaceSession(ctx, s.fs, c.Token) {
		return faceErr(http.StatusForbidden, "Verifikasi wajah Anda dulu sebelum mengelola data wajah.")
	}
	return nil
}

func (s *FaceService) mintFaceToken(ctx context.Context, uid string, until int64, person, faceID string) (string, error) {
	return s.auth.CustomTokenWithClaims(ctx, uid, map[string]interface{}{
		"faceUntil":  until,
		"facePerson": person,
		"faceId":     faceID,
	})
}

// ─── User endpoints ───────────────────────────────────────────────────────────

// State: status pengajuan wajah yang pernah dibuat dari perangkat ini (ID disimpan di perangkat).
func (s *FaceService) State(ctx context.Context, ids []string) ([]FaceEnrollmentState, error) {
	out := []FaceEnrollmentState{}
	seen := map[string]bool{}
	for _, id := range ids {
		if len(out) >= 10 || seen[id] || !faceIDPattern.MatchString(id) {
			continue
		}
		seen[id] = true
		p, err := s.getProfile(ctx, id)
		if err != nil {
			return nil, err
		}
		if p == nil {
			continue
		}
		out = append(out, FaceEnrollmentState{ID: id, Name: p.Name, Company: p.Company, Status: p.Status, RejectReason: p.RejectReason})
	}
	return out, nil
}

// Verify: cocokkan wajah dengan SEMUA wajah yang disetujui (lintas akun), lalu terbitkan
// custom token untuk uid yang sama berisi faceUntil + facePerson + faceId.
func (s *FaceService) Verify(ctx context.Context, c FaceCaller, descriptors [][]float64, device string) (*FaceVerifyResult, error) {
	key := rateKey(c)
	if err := s.reserveAttempt(ctx, key, "verifyAttempts", faceMaxVerify); err != nil {
		return nil, err
	}
	if err := checkDescriptors(descriptors, 3, 5); err != nil {
		return nil, err
	}
	if err := assertConsistent(descriptors); err != nil {
		return nil, err
	}
	device = cleanDevice(device)

	profiles, err := s.approvedProfilesCached(ctx)
	if err != nil {
		return nil, err
	}
	match := bestMatch(descriptors, profiles, faceMatchThreshold)
	if match == nil {
		// Wajah terdekat dicatat (hanya terlihat QC) untuk memantau wajah mirip yang nyaris lolos.
		entry := map[string]interface{}{"type": "verify_failed", "accountUid": c.UID, "accountEmail": c.Email, "device": device, "nearestPerson": "", "distance": nil}
		if near := bestMatch(descriptors, profiles, math.Inf(1)); near != nil {
			entry["nearestPerson"] = near.P.Name
			entry["distance"] = round4(near.Score)
		}
		s.audit(ctx, c, entry)
		return &FaceVerifyResult{Matched: false}, nil
	}

	s.clearAttempts(ctx, key, "verifyAttempts")
	until := time.Now().Unix() + faceSessionSeconds
	token, err := s.mintFaceToken(ctx, c.UID, until, match.P.Name, match.ID)
	if err != nil {
		return nil, fmt.Errorf("mint face token: %w", err)
	}
	s.audit(ctx, c, map[string]interface{}{
		"type": "verify_success", "accountUid": c.UID, "accountEmail": c.Email, "device": device,
		"person": match.P.Name, "profileId": match.ID, "distance": round4(match.Score),
	})
	return &FaceVerifyResult{Matched: true, Token: token, Person: match.P.Name, FaceUntil: until}, nil
}

// CheckSession: dipanggil aplikasi berkala. reason "expired" = 12 jam habis (cukup scan
// ulang), "revoked" = wajahnya dihapus QC. Memakai jam server.
func (s *FaceService) CheckSession(ctx context.Context, c FaceCaller) (map[string]interface{}, error) {
	state, err := middlewares.FaceSessionState(ctx, s.fs, c.Token)
	if err != nil {
		return nil, err
	}
	reason := state
	if state == middlewares.FaceSessionActive {
		reason = ""
	}
	return map[string]interface{}{"valid": state == middlewares.FaceSessionActive, "reason": reason}, nil
}

// Enroll: ajukan pendaftaran wajah (sekali per orang, berlaku di semua akun). Status awal pending.
func (s *FaceService) Enroll(ctx context.Context, c FaceCaller, in FaceEnrollInput) (*FaceEnrollResult, error) {
	name := normalizeText(in.Name)
	if n := utf8.RuneCountInString(name); n < 3 || n > 80 {
		return nil, faceErr(http.StatusBadRequest, "Nama lengkap wajib diisi (3-80 karakter).")
	}
	company := normalizeText(in.Company)
	if n := utf8.RuneCountInString(company); n < 2 || n > 80 {
		return nil, faceErr(http.StatusBadRequest, "Nama perusahaan wajib diisi (2-80 karakter).")
	}
	if !in.Consent {
		return nil, faceErr(http.StatusBadRequest, "Persetujuan penyimpanan data wajah wajib dicentang.")
	}
	if err := checkDescriptors(in.Descriptors, 3, 5); err != nil {
		return nil, err
	}
	if len(in.Photos) < 1 || len(in.Photos) > 5 {
		return nil, faceErr(http.StatusBadRequest, "Foto wajah tidak valid.")
	}
	for _, p := range in.Photos {
		if !strings.HasPrefix(p, "data:image/jpeg;base64,") || len(p) > faceMaxPhotoChars {
			return nil, faceErr(http.StatusBadRequest, "Foto wajah tidak valid.")
		}
	}

	probes := in.Descriptors
	if len(probes) > 3 {
		probes = probes[:3]
	}
	approved, err := s.approvedProfilesCached(ctx)
	if err != nil {
		return nil, err
	}
	// Wajah yang sudah aktif (dari akun mana pun) tidak perlu didaftarkan ulang. Nama pemilik
	// profil TIDAK dikembalikan: jika pencocokan keliru, nama orang lain bocor.
	if existing := bestMatch(probes, approved, faceMatchThreshold); existing != nil {
		s.audit(ctx, c, map[string]interface{}{
			"type": "enroll_already_registered", "accountUid": c.UID, "accountEmail": c.Email,
			"person": name, "matchedPerson": existing.P.Name, "profileId": existing.ID, "distance": round4(existing.Score),
		})
		return &FaceEnrollResult{AlreadyRegistered: true}, nil
	}

	// Mirip wajah lain (aktif atau menunggu) pada batas longgar: tetap buat pengajuan baru
	// (jangan pernah menampilkan data orang lain ke pendaftar), dan tandai untuk ditinjau QC.
	pending, err := s.profilesByStatus(ctx, "pending", 0)
	if err != nil {
		return nil, err
	}
	mine := 0
	for _, p := range pending {
		if p.P.AccountUID == c.UID {
			mine++
		}
	}
	if mine >= faceMaxPendingAccount {
		return nil, faceErr(http.StatusTooManyRequests, "Terlalu banyak pengajuan menunggu untuk akun ini. Hubungi QC DME.")
	}
	candidates := append(append([]faceProfileDoc{}, approved...), pending...)
	lookalike := bestMatch(probes, candidates, faceLookalikeThreshold)
	dupName, dupID := "", ""
	if lookalike != nil {
		dupName, dupID = lookalike.P.Name, lookalike.ID
	}

	descriptors := make([]map[string]interface{}, len(in.Descriptors))
	for i, d := range in.Descriptors {
		descriptors[i] = map[string]interface{}{"v": d}
	}
	ref, _, err := s.fs.Collection(faceProfilesCol).Add(ctx, map[string]interface{}{
		"accountUid":          c.UID,
		"accountEmail":        c.Email,
		"name":                name,
		"company":             company,
		"status":              "pending",
		"descriptors":         descriptors,
		"photos":              in.Photos,
		"device":              truncate(in.Device, 200),
		"consent":             true,
		"possibleDuplicateOf": dupName,
		"possibleDuplicateId": dupID,
		"requestedAt":         firestore.ServerTimestamp,
	})
	if err != nil {
		return nil, err
	}
	s.audit(ctx, c, map[string]interface{}{
		"type": "enroll_requested", "accountUid": c.UID, "accountEmail": c.Email, "person": name, "company": company, "profileId": ref.ID,
	})
	return &FaceEnrollResult{AlreadyRegistered: false, ID: ref.ID}, nil
}

// ReportScanIssue: laporan kendala teknis dari aplikasi. Tidak memengaruhi akses; hanya agar
// QC/Gari tahu perangkat mana yang bermasalah tanpa menunggu laporan dari lapangan.
func (s *FaceService) ReportScanIssue(ctx context.Context, c FaceCaller, issue, device, detail string) error {
	if !faceScanIssues[issue] {
		return faceErr(http.StatusBadRequest, "Jenis kendala tidak dikenal.")
	}
	if err := s.reserveAttempt(ctx, rateKey(c), "scanIssues", faceMaxScanIssues); err != nil {
		return err
	}
	s.audit(ctx, c, map[string]interface{}{
		"type": "scan_issue", "issue": issue, "accountUid": c.UID, "accountEmail": c.Email,
		"device": cleanDevice(device), "detail": truncate(detail, 200),
	})
	return nil
}

// BreakGlass: akses darurat QC DME / admin bila kamera rusak atau wajah reviewer hilang.
// Kode disimpan di env FACE_BREAKGLASS_CODE (Vercel), hanya Gari yang memegang.
func (s *FaceService) BreakGlass(ctx context.Context, c FaceCaller, code string) (*FaceVerifyResult, error) {
	ok, err := s.isReviewer(ctx, c)
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, faceErr(http.StatusForbidden, "Akses darurat hanya untuk akun QC DME atau admin.")
	}
	key := rateKey(c)
	if err := s.reserveAttempt(ctx, key, "breakGlassAttempts", faceMaxBreakGlass); err != nil {
		return nil, err
	}

	expected := []byte(os.Getenv("FACE_BREAKGLASS_CODE"))
	given := []byte(code)
	valid := len(expected) >= 12 && len(given) == len(expected) && subtle.ConstantTimeCompare(given, expected) == 1
	if !valid {
		s.audit(ctx, c, map[string]interface{}{"type": "break_glass_failed", "accountUid": c.UID, "accountEmail": c.Email})
		return nil, faceErr(http.StatusForbidden, "Kode darurat salah.")
	}

	s.clearAttempts(ctx, key, "breakGlassAttempts")
	until := time.Now().Unix() + faceBreakGlassSeconds
	token, err := s.mintFaceToken(ctx, c.UID, until, "AKSES DARURAT", "break-glass")
	if err != nil {
		return nil, fmt.Errorf("mint break-glass token: %w", err)
	}
	s.audit(ctx, c, map[string]interface{}{"type": "break_glass_used", "accountUid": c.UID, "accountEmail": c.Email})
	return &FaceVerifyResult{Matched: true, Token: token, Person: "AKSES DARURAT", FaceUntil: until}, nil
}

// ─── Reviewer endpoints (QC DME / admin) ────────────────────────────────────────

// AdminList: pending & approved diambil SEMUA (wajah aktif lama harus tetap bisa dihapus QC);
// hanya riwayat ditolak yang dibatasi. Diurutkan terbaru di atas.
func (s *FaceService) AdminList(ctx context.Context, c FaceCaller) ([]FaceAdminProfile, error) {
	if err := s.requireReviewer(ctx, c); err != nil {
		return nil, err
	}
	var all []faceProfileDoc
	for _, q := range []struct {
		status string
		limit  int
	}{{"pending", 0}, {"approved", 0}, {"rejected", faceMaxRejectedListed}} {
		docs, err := s.profilesByStatus(ctx, q.status, q.limit)
		if err != nil {
			return nil, err
		}
		all = append(all, docs...)
	}
	out := make([]FaceAdminProfile, 0, len(all))
	for _, d := range all {
		photos := d.P.Photos
		if photos == nil {
			photos = []string{}
		}
		out = append(out, FaceAdminProfile{
			ID: d.ID, AccountEmail: d.P.AccountEmail, Name: d.P.Name, Company: d.P.Company, Status: d.P.Status,
			Photos: photos, Device: d.P.Device, RequestedAt: millisOrNil(d.P.RequestedAt),
			ReviewedBy: d.P.ReviewedBy, ReviewedAt: millisOrNil(d.P.ReviewedAt), RejectReason: d.P.RejectReason,
			PossibleDuplicateOf: d.P.PossibleDuplicateOf, PossibleDuplicateID: d.P.PossibleDuplicateID,
		})
	}
	sort.SliceStable(out, func(i, j int) bool {
		var a, b int64
		if out[i].RequestedAt != nil {
			a = *out[i].RequestedAt
		}
		if out[j].RequestedAt != nil {
			b = *out[j].RequestedAt
		}
		return a > b
	})
	return out, nil
}

func (s *FaceService) AdminAudit(ctx context.Context, c FaceCaller) ([]FaceAuditEntry, error) {
	if err := s.requireReviewer(ctx, c); err != nil {
		return nil, err
	}
	snaps, err := s.fs.Collection(faceAuditCol).OrderBy("at", firestore.Desc).Limit(200).Documents(ctx).GetAll()
	if err != nil {
		return nil, err
	}
	str := func(m map[string]interface{}, k string) string { v, _ := m[k].(string); return v }
	out := make([]FaceAuditEntry, 0, len(snaps))
	for _, snap := range snaps {
		e := snap.Data()
		entry := FaceAuditEntry{
			ID: snap.Ref.ID, Type: str(e, "type"), AccountEmail: str(e, "accountEmail"), Person: str(e, "person"),
			NearestPerson: str(e, "nearestPerson"), Device: str(e, "device"), Issue: str(e, "issue"),
			Detail: str(e, "detail"), By: str(e, "by"), IP: str(e, "ip"),
		}
		switch d := e["distance"].(type) {
		case float64:
			entry.Distance = &d
		case int64:
			f := float64(d)
			entry.Distance = &f
		}
		if at, ok := e["at"].(time.Time); ok {
			entry.At = millisOrNil(at)
		}
		out = append(out, entry)
	}
	return out, nil
}

func (s *FaceService) AdminReview(ctx context.Context, c FaceCaller, id string, approve bool, reason string) error {
	if err := s.requireReviewer(ctx, c); err != nil {
		return err
	}
	if id == "" {
		return faceErr(http.StatusBadRequest, "ID pengajuan wajib diisi.")
	}
	p, err := s.getProfile(ctx, id)
	if err != nil {
		return err
	}
	if p == nil {
		return faceErr(http.StatusNotFound, "Pengajuan tidak ditemukan.")
	}
	if p.Status != "pending" {
		return faceErr(http.StatusConflict, "Pengajuan ini sudah diproses.")
	}

	// Cegah satu orang punya dua profil aktif (mis. pengajuan paralel): kalau terjadi,
	// menghapus satu profil saat resign tidak mencabut aksesnya sepenuhnya.
	if approve {
		approved, err := s.profilesByStatus(ctx, "approved", 0)
		if err != nil {
			return err
		}
		if dup := bestMatch(storedVectors(*p), approved, faceMatchThreshold); dup != nil {
			return faceErr(http.StatusConflict, fmt.Sprintf("Wajah ini sudah aktif atas nama %q. Tolak pengajuan ini.", dup.P.Name))
		}
	}

	ref := s.fs.Collection(faceProfilesCol).Doc(id)
	updates := []firestore.Update{
		{Path: "reviewedBy", Value: c.Email},
		{Path: "reviewedAt", Value: firestore.ServerTimestamp},
	}
	if approve {
		updates = append(updates, firestore.Update{Path: "status", Value: "approved"})
	} else {
		// Data biometrik pengajuan yang ditolak langsung dihapus (UU PDP).
		updates = append(updates,
			firestore.Update{Path: "status", Value: "rejected"},
			firestore.Update{Path: "rejectReason", Value: truncate(reason, 300)},
			firestore.Update{Path: "descriptors", Value: []interface{}{}},
			firestore.Update{Path: "photos", Value: []interface{}{}},
		)
	}
	if _, err := ref.Update(ctx, updates); err != nil {
		return err
	}
	invalidateApproved()
	middlewares.InvalidateFaceStatus(id)
	auditType := "enroll_rejected"
	if approve {
		auditType = "enroll_approved"
	}
	s.audit(ctx, c, map[string]interface{}{
		"type": auditType, "accountUid": p.AccountUID, "accountEmail": p.AccountEmail, "person": p.Name, "profileId": id, "by": c.Email,
	})
	return nil
}

// mergeKeepingFirst: gabungkan dua daftar; elemen awal (sampel pendaftaran) dipertahankan,
// sisanya yang terbaru.
func mergeKeepingFirst[T any](current, added []T, max, keepFirst int) []T {
	all := append(append([]T{}, current...), added...)
	if len(all) <= max {
		return all
	}
	head := keepFirst
	if head > max {
		head = max
	}
	rest := all[head:]
	return append(append([]T{}, all[:head]...), rest[len(rest)-(max-head):]...)
}

// AdminMerge: gabungkan pengajuan ke wajah aktif orang yang SAMA, misalnya daftar ulang dari
// laptop karena kamera laptop berbeda jauh dengan kamera HP saat daftar pertama. Sampelnya
// ditambahkan ke profil aktif lalu pengajuannya dihapus: satu orang tetap satu profil,
// sehingga hapus wajah saat resign mencabut aksesnya dari semua perangkat.
func (s *FaceService) AdminMerge(ctx context.Context, c FaceCaller, id, intoID string) error {
	if err := s.requireReviewer(ctx, c); err != nil {
		return err
	}
	if id == "" || intoID == "" || id == intoID {
		return faceErr(http.StatusBadRequest, "Pengajuan dan wajah tujuan wajib diisi.")
	}
	pendingRef := s.fs.Collection(faceProfilesCol).Doc(id)
	targetRef := s.fs.Collection(faceProfilesCol).Doc(intoID)
	var pending, target faceProfile

	err := s.fs.RunTransaction(ctx, func(ctx context.Context, tx *firestore.Transaction) error {
		pSnap, pErr := tx.Get(pendingRef)
		tSnap, tErr := tx.Get(targetRef)
		if (pSnap != nil && !pSnap.Exists()) || (tSnap != nil && !tSnap.Exists()) {
			return faceErr(http.StatusNotFound, "Pengajuan atau wajah tujuan tidak ditemukan.")
		}
		if pErr != nil {
			return pErr
		}
		if tErr != nil {
			return tErr
		}
		if err := pSnap.DataTo(&pending); err != nil {
			return err
		}
		if err := tSnap.DataTo(&target); err != nil {
			return err
		}
		if pending.Status != "pending" {
			return faceErr(http.StatusConflict, "Pengajuan ini sudah diproses.")
		}
		if target.Status != "approved" {
			return faceErr(http.StatusConflict, "Wajah tujuan tidak aktif.")
		}
		// Pengaman salah klik: hanya wajah yang memang mirip yang boleh digabung.
		if bestMatch(storedVectors(pending), []faceProfileDoc{{ID: intoID, P: target}}, faceLookalikeThreshold) == nil {
			return faceErr(http.StatusConflict, fmt.Sprintf("Wajahnya tidak cukup mirip dengan %q. Setujui sebagai wajah terpisah atau tolak.", target.Name))
		}

		descriptors := mergeKeepingFirst(target.Descriptors, pending.Descriptors, faceMaxSamples, faceEnrollSamples)
		descMaps := make([]map[string]interface{}, len(descriptors))
		for i, d := range descriptors {
			descMaps[i] = map[string]interface{}{"v": d.V}
		}
		var devices []string
		for _, d := range []string{target.Device, pending.Device} {
			if d != "" && !strings.Contains(strings.Join(devices, " + "), d) {
				devices = append(devices, d)
			}
		}
		if err := tx.Update(targetRef, []firestore.Update{
			{Path: "descriptors", Value: descMaps},
			{Path: "photos", Value: mergeKeepingFirst(target.Photos, pending.Photos, faceMaxPhotos, 2)},
			{Path: "device", Value: truncate(strings.Join(devices, " + "), 200)},
		}); err != nil {
			return err
		}
		return tx.Delete(pendingRef)
	})
	if err != nil {
		return err
	}
	invalidateApproved()
	s.audit(ctx, c, map[string]interface{}{
		"type": "enroll_merged", "accountUid": pending.AccountUID, "accountEmail": pending.AccountEmail,
		"person": target.Name, "mergedName": pending.Name, "device": pending.Device, "profileId": intoID, "by": c.Email,
	})
	return nil
}

// AdminDelete: hapus wajah (misal personel resign). Foto & data biometrik dihapus permanen.
// Akses orang itu langsung berakhir tanpa mengganggu rekan di akun yang sama: rules dan
// middleware mengecek face_profiles/{faceId} pada setiap akses, dan aplikasi memanggil
// /api/face/check-session berkala lalu mengeluarkan perangkatnya.
func (s *FaceService) AdminDelete(ctx context.Context, c FaceCaller, id string) error {
	if err := s.requireReviewer(ctx, c); err != nil {
		return err
	}
	if id == "" {
		return faceErr(http.StatusBadRequest, "ID wajah wajib diisi.")
	}
	p, err := s.getProfile(ctx, id)
	if err != nil {
		return err
	}
	if p == nil {
		return faceErr(http.StatusNotFound, "Data wajah tidak ditemukan.")
	}
	if _, err := s.fs.Collection(faceProfilesCol).Doc(id).Delete(ctx); err != nil {
		return err
	}
	invalidateApproved()
	middlewares.InvalidateFaceStatus(id)
	s.audit(ctx, c, map[string]interface{}{
		"type": "face_deleted", "accountUid": p.AccountUID, "accountEmail": p.AccountEmail, "person": p.Name, "profileId": id, "by": c.Email,
	})
	return nil
}
