// ============================================================================
// FILE: backend/core/services/pm_predictive_service.go
// Deskripsi: AI untuk Predictive Report dari laporan Preventive Maintenance
//            (fitur "Buat Laporan" engineer, dibuka dari Arsip Dokumen).
//            - ExtractReadings: membaca angka display alat ukur, data nameplate, dan
//              kondisi visual dari foto kartu laporan (model vision Gemini gratis).
//            - Analyze: menulis narasi analisis per equipment dan ringkasan eksekutif.
//            Status, batas acuan, tren, dan proyeksi dihitung deterministik di frontend
//            dari angka yang sudah dikonfirmasi engineer; AI hanya menjelaskan data itu.
// ============================================================================

package services

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/gariiriana/DwimitraSystem/backend/core/config"
)

var ErrPMPredictiveNotConfigured = errors.New("API key AI (NVIDIA_NIM_API_KEYS) belum dipasang di server")

const (
	PMExtractMaxItems = 8
	pmExtractTimeout  = 40 * time.Second
	pmAnalyzeTimeout  = 35 * time.Second
)

// PMExtractItem adalah satu kartu foto laporan PM yang akan dibaca.
type PMExtractItem struct {
	Index       int    `json:"index"`
	Label       string `json:"label"`    // label kartu di laporan, mis. "R-S"
	Kind        string `json:"kind"`     // measurement | nameplate | visual
	Expected    string `json:"expected"` // parameter yang dicari, mis. "Tegangan fasa-fasa R-S (V AC)"
	Unit        string `json:"unit"`     // satuan yang diharapkan, mis. "V"
	ImageBase64 string `json:"imageBase64"`
}

type PMExtractRequest struct {
	UnitType  string          `json:"unitType"`
	UnitLabel string          `json:"unitLabel"`
	Items     []PMExtractItem `json:"items"`
}

type PMNameplate struct {
	Brand        string   `json:"brand,omitempty"`
	Model        string   `json:"model,omitempty"`
	Serial       string   `json:"serial,omitempty"`
	RatedVoltage *float64 `json:"ratedVoltage"`
	RatedCurrent *float64 `json:"ratedCurrent"`
	RatedPowerKW *float64 `json:"ratedPowerKw"`
	Phase        *float64 `json:"phase"`
	FrequencyHz  *float64 `json:"frequencyHz"`
	Notes        string   `json:"notes,omitempty"`
}

type PMExtractResult struct {
	Index       int          `json:"index"`
	Value       *float64     `json:"value"`
	Unit        string       `json:"unit,omitempty"`
	Raw         string       `json:"raw,omitempty"`
	Confidence  string       `json:"confidence"`
	Condition   string       `json:"condition,omitempty"`
	Observation string       `json:"observation,omitempty"`
	Nameplate   *PMNameplate `json:"nameplate,omitempty"`
}

// PMAnalyzeRequest: Context berisi data terstruktur yang sudah dikonfirmasi engineer
// (dibangun frontend); diteruskan apa adanya ke AI sebagai DATA.
type PMAnalyzeRequest struct {
	Mode    string          `json:"mode"` // section | summary
	Context json.RawMessage `json:"context"`
}

type PMSectionAnalysis struct {
	Kondisi        string   `json:"kondisi"`
	AnalisisTren   string   `json:"analisisTren"`
	PrediksiRisiko string   `json:"prediksiRisiko"`
	Rekomendasi    []string `json:"rekomendasi"`
}

type PMSummaryAnalysis struct {
	Ringkasan string   `json:"ringkasan"`
	Prioritas []string `json:"prioritas"`
}

type IPMPredictiveService interface {
	ExtractReadings(ctx context.Context, req PMExtractRequest) ([]PMExtractResult, error)
	AnalyzeSection(ctx context.Context, data json.RawMessage) (*PMSectionAnalysis, error)
	AnalyzeSummary(ctx context.Context, data json.RawMessage) (*PMSummaryAnalysis, error)
}

type pmCompleter interface {
	CompleteMessages(ctx context.Context, messages []map[string]interface{}) (string, error)
}

type pmPredictiveService struct {
	vision   pmCompleter // baca foto: thinking rendah agar 6-8 foto selesai dalam batas waktu Vercel
	analysis pmCompleter // narasi engineering: thinking sedang
}

// pmPredictiveModels: model Gemini gratis terkuat dulu, lalu model vision yang dipakai fitur AI lain.
func pmPredictiveModels(baseURL string) []string {
	candidates := config.EnvStringSlice("PM_PREDICTIVE_MODELS", nil)
	if len(candidates) == 0 {
		if isGeminiEndpoint(baseURL) {
			candidates = []string{"models/gemini-3-flash-preview", "models/gemini-3.5-flash"}
		} else {
			candidates = []string{"meta/llama-3.2-90b-vision-instruct"}
		}
	}
	candidates = append(candidates, config.EnvString("NVIDIA_NIM_VISION_MODEL", config.EnvString("NVIDIA_NIM_MODEL", "")))

	seen := make(map[string]bool, len(candidates))
	models := make([]string, 0, len(candidates))
	for _, m := range candidates {
		if m = strings.TrimSpace(m); m != "" && !seen[m] {
			seen[m] = true
			models = append(models, m)
		}
	}
	return models
}

// NewPMPredictiveService memakai endpoint dan pool API key yang sama dengan AI service.
func NewPMPredictiveService(ai IAIService) IPMPredictiveService {
	keys := aiAPIKeys(ai)
	baseURL := config.EnvString("NVIDIA_NIM_BASE_URL", "https://integrate.api.nvidia.com/v1/chat/completions")
	models := pmPredictiveModels(baseURL)
	if len(keys) == 0 || len(models) == 0 {
		return &pmPredictiveService{}
	}
	newClient := func(effort string, timeout time.Duration) *mopChatClient {
		return &mopChatClient{
			baseURL:        baseURL,
			apiKeys:        keys,
			models:         models,
			httpClient:     &http.Client{},
			cooldown:       make(map[mopRoute]time.Time),
			logName:        "pm_predictive",
			maxTokens:      8192,
			effort:         effort,
			attemptTimeout: timeout,
		}
	}
	return &pmPredictiveService{
		vision:   newClient("low", pmExtractTimeout),
		analysis: newClient("medium", pmAnalyzeTimeout),
	}
}

// ─── Baca foto ───────────────────────────────────────────────────────────────

const pmExtractSystem = `Anda adalah teknisi instrumentasi senior yang membaca foto dokumentasi preventive maintenance fasilitas data center.
Tugas Anda HANYA mencatat apa yang benar-benar terlihat di foto. Jangan menebak, jangan menyesuaikan angka agar terlihat normal.
Jawab hanya dengan JSON valid tanpa markdown.`

const pmExtractRules = `ATURAN JENIS "measurement" (angka alat ukur):
1. Baca angka utama pada layar/skala alat ukur (clamp meter, thermo-hygrometer, anemometer, sound level meter, vibration meter, pressure gauge).
2. Layar 7-segmen: perhatikan titik desimal dengan sangat teliti ("226.0" berbeda dengan "2260"). Bila titik desimal atau digit tidak jelas, turunkan confidence.
3. Pressure gauge jarum: baca posisi jarum terhadap skala; bila skala ganda, pakai skala bar.
4. unit = satuan yang tampil di layar/skala (V, mV, A, mA, m/s, °C, °F, %RH, dB, mm/s, in/s, g, bar, psi, kPa). Jangan mengonversi satuan.
5. Bila layar menampilkan beberapa angka, ambil yang sesuai "dicari". Tulis angka lain di raw.
6. Bila tidak ada alat ukur, layar mati, "OL", atau angka tidak terbaca: value null, confidence "rendah", jelaskan singkat di observation.
7. raw = teks persis di layar (mis. "226.0 V~", "OL", "0.42 in/s").
8. confidence: "tinggi" (semua digit & titik desimal jelas), "sedang" (ada sedikit keraguan), "rendah" (tidak yakin).

ATURAN JENIS "nameplate": salin data pelat nama ke objek nameplate: brand, model, serial, ratedVoltage (V), ratedCurrent (A, arus nominal/FLA motor fan), ratedPowerKw (kW; W boleh dikonversi ke kW), phase (1 atau 3), frequencyHz. Field yang tidak terbaca = null. Bila tegangan berupa rentang (mis. 380-415V), isi ratedVoltage dengan nilai tengah rentang dan tulis rentang lengkap di notes.

ATURAN JENIS "visual": nilai kondisi fisik yang terlihat (kebersihan coil/filter, debu, kerak, korosi, kebocoran). condition salah satu: "baik" | "perlu perhatian" | "buruk" | "tidak jelas". observation = 1 kalimat faktual bahasa Indonesia.

FORMAT JAWABAN (JSON saja):
{"items":[
 {"index":1,"value":226.0,"unit":"V","raw":"226.0 V~","confidence":"tinggi","observation":""},
 {"index":17,"nameplate":{"brand":"...","model":"...","serial":null,"ratedVoltage":380,"ratedCurrent":1.2,"ratedPowerKw":0.37,"phase":3,"frequencyHz":50,"notes":""},"confidence":"sedang"},
 {"index":18,"condition":"baik","observation":"Sirip coil evaporator tampak bersih tanpa debu menempel.","confidence":"tinggi"}
]}
Setiap index yang dikirim WAJIB muncul tepat satu kali.`

func buildPMExtractMessages(req PMExtractRequest) []map[string]interface{} {
	parts := []map[string]interface{}{{
		"type": "text",
		"text": fmt.Sprintf("Unit: %s — %s.\n%s\n\nFoto-foto berikut dari satu laporan PM. Baca setiap foto sesuai jenis dan parameter yang dicari.",
			strings.TrimSpace(req.UnitType), strings.TrimSpace(req.UnitLabel), pmExtractRules),
	}}
	for _, it := range req.Items {
		desc := fmt.Sprintf("FOTO index=%d | label kartu: %q | jenis: %s", it.Index, it.Label, it.Kind)
		if it.Expected != "" {
			desc += fmt.Sprintf(" | dicari: %s", it.Expected)
		}
		if it.Unit != "" {
			desc += fmt.Sprintf(" | satuan yang diharapkan: %s", it.Unit)
		}
		parts = append(parts,
			map[string]interface{}{"type": "text", "text": desc},
			map[string]interface{}{"type": "image_url", "image_url": map[string]interface{}{"url": toImageDataURL(it.ImageBase64)}},
		)
	}
	return []map[string]interface{}{
		{"role": "system", "content": pmExtractSystem},
		{"role": "user", "content": parts},
	}
}

func toImageDataURL(b64 string) string {
	b64 = strings.TrimSpace(b64)
	if strings.HasPrefix(b64, "data:image") {
		return b64
	}
	mime := "image/jpeg"
	if strings.HasPrefix(b64, "iVBOR") {
		mime = "image/png"
	}
	return "data:" + mime + ";base64," + b64
}

func (s *pmPredictiveService) ExtractReadings(ctx context.Context, req PMExtractRequest) ([]PMExtractResult, error) {
	if s.vision == nil {
		return nil, ErrPMPredictiveNotConfigured
	}
	reply, err := s.vision.CompleteMessages(ctx, buildPMExtractMessages(req))
	if err != nil {
		return nil, err
	}
	return parsePMExtractReply(reply, req.Items)
}

// parsePMExtractReply menormalkan jawaban AI: angka boleh berupa string ("226,0 V"),
// index yang tidak diminta dibuang, dan index yang hilang diisi null agar engineer
// tetap mengisi manual.
func parsePMExtractReply(reply string, items []PMExtractItem) ([]PMExtractResult, error) {
	var raw struct {
		Items []map[string]interface{} `json:"items"`
	}
	if err := json.Unmarshal([]byte(extractJSONObject(reply)), &raw); err != nil {
		return nil, fmt.Errorf("jawaban AI bukan JSON yang valid: %w", err)
	}

	byIndex := make(map[int]map[string]interface{}, len(raw.Items))
	for _, it := range raw.Items {
		if idx, ok := toFloat(it["index"]); ok {
			byIndex[int(idx)] = it
		}
	}

	results := make([]PMExtractResult, 0, len(items))
	for _, want := range items {
		got, ok := byIndex[want.Index]
		if !ok {
			results = append(results, PMExtractResult{Index: want.Index, Confidence: "rendah", Observation: "AI tidak mengembalikan hasil untuk foto ini."})
			continue
		}
		r := PMExtractResult{
			Index:       want.Index,
			Unit:        clip(toString(got["unit"]), 20),
			Raw:         clip(toString(got["raw"]), 120),
			Confidence:  normalizeConfidence(toString(got["confidence"])),
			Condition:   normalizeCondition(toString(got["condition"])),
			Observation: clip(toString(got["observation"]), 400),
		}
		if v, ok := toFloat(got["value"]); ok {
			r.Value = &v
		}
		if np, ok := got["nameplate"].(map[string]interface{}); ok {
			r.Nameplate = &PMNameplate{
				Brand:        clip(toString(np["brand"]), 80),
				Model:        clip(toString(np["model"]), 80),
				Serial:       clip(toString(np["serial"]), 80),
				RatedVoltage: floatPtr(np["ratedVoltage"]),
				RatedCurrent: floatPtr(np["ratedCurrent"]),
				RatedPowerKW: floatPtr(np["ratedPowerKw"]),
				Phase:        floatPtr(np["phase"]),
				FrequencyHz:  floatPtr(np["frequencyHz"]),
				Notes:        clip(toString(np["notes"]), 300),
			}
		}
		results = append(results, r)
	}
	return results, nil
}

// ─── Narasi analisis ─────────────────────────────────────────────────────────

const pmAnalysisPersona = `Anda adalah Senior Reliability & Predictive Maintenance Engineer (CMRP) untuk fasilitas data center Tier III NeutraDC Cikarang (PT Dwimitra Ekatama Mandiri). Anda menulis laporan Predictive Maintenance dari hasil preventive maintenance berkala.

DATA yang Anda terima sudah final:
- Angka pengukuran sudah dikonfirmasi engineer lapangan.
- Status tiap parameter, batas acuan, perubahan dari periode sebelumnya, laju tren per kuartal, dan proyeksi waktu mencapai batas SUDAH DIHITUNG sistem. Jangan menghitung ulang, jangan mengubah status, jangan membuat batas baru.

ATURAN INTEGRITAS:
1. Gunakan hanya angka, tanggal, dan batas yang ada di DATA. Dilarang mengarang nilai, merk, part number, jam operasi, atau riwayat kerusakan.
2. Bila parameter hanya punya 1 titik data, sebut sebagai pengukuran baseline dan nyatakan tren belum dapat dihitung.
3. Proyeksi waktu hanya boleh dikutip dari field "proyeksi" beserta tingkat keyakinannya. Bila tidak ada proyeksi, jangan membuat perkiraan tanggal.
4. Bedakan fakta (dari data) dan kemungkinan penyebab (pakai kata "kemungkinan", "indikasi", "perlu diverifikasi").
5. Bila status Normal dan tren stabil, tulis ringkas dan jangan dibesar-besarkan.
6. Bahasa Indonesia teknis yang baku dan formal. Jangan memakai singkatan SLA. Tanpa markdown, tanpa simbol bullet di dalam teks.`

const pmSectionTask = `TUGAS: tulis bagian laporan untuk SATU equipment di DATA.
Rekomendasi harus spesifik untuk komponen equipment ini, dapat dikerjakan teknisi, dan menyebut waktu pelaksanaan (mis. "pada PM berikutnya", "dalam 2 minggu").

FORMAT (JSON saja):
{"kondisi":"2-4 kalimat kondisi saat ini; sebut angka kunci dan statusnya",
 "analisisTren":"2-4 kalimat perubahan terhadap periode sebelumnya, arah dan laju tren; atau pernyataan baseline",
 "prediksiRisiko":"2-4 kalimat kapan diperkirakan menyentuh batas (kutip proyeksi) dan mode kegagalan yang mungkin terjadi bila dibiarkan",
 "rekomendasi":["2-5 butir tindakan"]}`

const pmSummaryTask = `TUGAS: tulis ringkasan eksekutif untuk seluruh unit berdasarkan hasil per equipment di DATA, untuk dibaca manajemen fasilitas.

FORMAT (JSON saja):
{"ringkasan":"3-5 kalimat: kondisi umum unit, equipment yang perlu perhatian beserta alasannya, dan proyeksi terdekat bila ada",
 "prioritas":["1-4 tindakan, urut dari yang paling mendesak"]}`

func buildPMAnalysisMessages(task string, data json.RawMessage) []map[string]interface{} {
	return []map[string]interface{}{
		{"role": "system", "content": pmAnalysisPersona},
		{"role": "user", "content": task + "\n\nDATA:\n" + string(data)},
	}
}

func (s *pmPredictiveService) AnalyzeSection(ctx context.Context, data json.RawMessage) (*PMSectionAnalysis, error) {
	if s.analysis == nil {
		return nil, ErrPMPredictiveNotConfigured
	}
	reply, err := s.analysis.CompleteMessages(ctx, buildPMAnalysisMessages(pmSectionTask, data))
	if err != nil {
		return nil, err
	}
	var out PMSectionAnalysis
	if err := json.Unmarshal([]byte(extractJSONObject(reply)), &out); err != nil {
		return nil, fmt.Errorf("jawaban AI bukan JSON yang valid: %w", err)
	}
	out.Kondisi = clip(strings.TrimSpace(out.Kondisi), 2000)
	out.AnalisisTren = clip(strings.TrimSpace(out.AnalisisTren), 2000)
	out.PrediksiRisiko = clip(strings.TrimSpace(out.PrediksiRisiko), 2000)
	out.Rekomendasi = cleanList(out.Rekomendasi, 6, 500)
	if out.Kondisi == "" {
		return nil, errors.New("AI tidak menulis bagian kondisi")
	}
	return &out, nil
}

func (s *pmPredictiveService) AnalyzeSummary(ctx context.Context, data json.RawMessage) (*PMSummaryAnalysis, error) {
	if s.analysis == nil {
		return nil, ErrPMPredictiveNotConfigured
	}
	reply, err := s.analysis.CompleteMessages(ctx, buildPMAnalysisMessages(pmSummaryTask, data))
	if err != nil {
		return nil, err
	}
	var out PMSummaryAnalysis
	if err := json.Unmarshal([]byte(extractJSONObject(reply)), &out); err != nil {
		return nil, fmt.Errorf("jawaban AI bukan JSON yang valid: %w", err)
	}
	out.Ringkasan = clip(strings.TrimSpace(out.Ringkasan), 2500)
	out.Prioritas = cleanList(out.Prioritas, 5, 400)
	if out.Ringkasan == "" {
		return nil, errors.New("AI tidak menulis ringkasan")
	}
	return &out, nil
}

// ─── Helper normalisasi ──────────────────────────────────────────────────────

// extractJSONObject mengambil objek JSON terluar dari jawaban model (membuang
// pagar ```json atau teks pengantar).
func extractJSONObject(s string) string {
	start := strings.Index(s, "{")
	end := strings.LastIndex(s, "}")
	if start == -1 || end <= start {
		return strings.TrimSpace(s)
	}
	return s[start : end+1]
}

var pmNumberRe = regexp.MustCompile(`-?\d+(?:[.,]\d+)?`)

// toFloat menerima angka JSON atau string seperti "226,0 V" / "1.2A".
func toFloat(v interface{}) (float64, bool) {
	switch n := v.(type) {
	case float64:
		return n, !math.IsNaN(n) && !math.IsInf(n, 0)
	case string:
		m := pmNumberRe.FindString(n)
		if m == "" {
			return 0, false
		}
		f, err := strconv.ParseFloat(strings.Replace(m, ",", ".", 1), 64)
		return f, err == nil
	}
	return 0, false
}

func floatPtr(v interface{}) *float64 {
	if f, ok := toFloat(v); ok {
		return &f
	}
	return nil
}

func toString(v interface{}) string {
	switch s := v.(type) {
	case string:
		return strings.TrimSpace(s)
	case float64:
		return strconv.FormatFloat(s, 'f', -1, 64)
	}
	return ""
}

func clip(s string, max int) string {
	r := []rune(s)
	if len(r) <= max {
		return s
	}
	return string(r[:max])
}

var pmBulletRe = regexp.MustCompile(`^\s*(?:[-•*]|\d+[.)])\s+`)

func cleanList(items []string, maxItems, maxLen int) []string {
	out := make([]string, 0, len(items))
	for _, it := range items {
		if it = strings.TrimSpace(pmBulletRe.ReplaceAllString(it, "")); it != "" {
			out = append(out, clip(it, maxLen))
		}
		if len(out) == maxItems {
			break
		}
	}
	return out
}

func normalizeConfidence(s string) string {
	switch strings.ToLower(s) {
	case "tinggi", "high":
		return "tinggi"
	case "sedang", "medium":
		return "sedang"
	}
	return "rendah"
}

func normalizeCondition(s string) string {
	switch strings.ToLower(s) {
	case "baik", "good":
		return "baik"
	case "perlu perhatian", "attention", "fair":
		return "perlu perhatian"
	case "buruk", "bad", "poor":
		return "buruk"
	case "tidak jelas", "unclear":
		return "tidak jelas"
	}
	return ""
}
