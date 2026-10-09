// ============================================================================
// FILE: backend/core/services/mop_translate_service.go
// Deskripsi: Penerjemah dokumen MOP (Method of Procedure) EN -> ID memakai
//            layanan AI gratis yang sama dengan fitur AI lain (lihat
//            mop_translate_client.go). Mutu dijaga dengan glosarium istilah
//            baku, konteks dokumen, dan pemeriksaan otomatis per baris
//            (mop_translate_quality.go). Baris yang tidak lolos diterjemahkan
//            ulang sekali; yang masih bermasalah dikirim dengan peringatan agar
//            dicek manusia di layar review.
// ============================================================================

package services

import (
	"context"
	"errors"
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"time"
)

// ErrMOPTranslateNotConfigured: belum ada API key AI di server.
var ErrMOPTranslateNotConfigured = errors.New("API key AI (NVIDIA_NIM_API_KEYS) belum dipasang di server")

const mopNoTranslationWarning = "AI menilai baris ini tidak perlu diterjemahkan (nama/kode/tipe). Isi manual bila tetap perlu baris Indonesia."

const (
	// Dokumen yang lebih panjang hanya dikirim sebagian (sekitar segmen yang diterjemahkan)
	// agar tidak menghabiskan kuota token tier gratis.
	mopContextMaxChars = 40000
	// Sisa waktu minimal agar putaran perbaikan masih dijalankan.
	mopRepairMinBudget = 15 * time.Second
)

const mopTranslateRules = `Anda adalah penerjemah teknis senior bidang MEP (mekanikal, elektrikal, plumbing) dan operasi fasilitas data center. Anda menerjemahkan dokumen MOP (Method of Procedure) PT Dwimitra Ekatama Mandiri untuk NeutraDC Cikarang dari bahasa Inggris ke bahasa Indonesia.

Terjemahan dicetak miring tepat di bawah setiap baris Inggris dan dibaca teknisi lapangan saat bekerja. Karena itu terjemahan harus:
- akurat dan lengkap: semua langkah, angka, satuan, kode, syarat, dan peringatan ada; tidak ada yang ditambah, dikurangi, diringkas, atau ditafsirkan;
- bahasa Indonesia baku teknis yang alami (EYD), bukan terjemahan kata per kata;
- TIDAK campur aduk. Semua kata umum bahasa Inggris (the, and, of, with, before, after, ensure, check, remove, install, clean, open, close, dan sebagainya) wajib diterjemahkan. Yang boleh tetap berbahasa Inggris hanya istilah lapangan pada daftar istilah, nama diri, merek, tipe, kode, dan singkatan.

ATURAN
1. Langkah kerja ditulis sebagai kalimat perintah yang diawali kata kerja perintah: "Ensure ..." -> "Pastikan ...", "Verify ..." -> "Verifikasi ...", "Check/Inspect ..." -> "Periksa ...", "Record ..." -> "Catat ...", "Coordinate ..." -> "Koordinasikan ...", "Step onto ..." -> "Naiki ...", "Report to ..." -> "Laporkan kepada ...".
2. Hasil yang diharapkan ditulis sebagai pernyataan kondisi: "... is isolated" -> "... telah terisolasi", "... remains stable" -> "... tetap stabil".
3. Pertahankan persis: semua angka (titik desimal tetap titik: "0.8" tetap "0.8"), satuan (°C, bar, A, V, kW, mm, ", %), kode/tag peralatan (CT-02, UPS-01, MN-CT-LIANGCHI-03), nomor dokumen, tanggal, merek, model, standar (EN 361), dan singkatan (PTW, LOTO, MOP, TBM, BMS, MCC, NPT, PVC, PTFE, N+1). Singkatan ditulis sama, tidak diterjemahkan, kecuali PPE -> APD.
4. Pertahankan penanda di awal teks: "1.", "a.", "b." tetap di awal. "Section 3 – X" -> "Bagian 3 – <terjemahan X>". Pada label bertitik dua, label diterjemahkan, titik dua tetap, dan isinya diterjemahkan bila berupa kalimat atau dibiarkan bila berupa nama/kode/nomor. Garis isian "____" tetap ada di posisinya.
5. Teks yang seluruhnya berupa nama orang, nama perusahaan/lokasi, merek/tipe/kode, tanggal, atau nama jabatan (Supervisor, Engineer, Chief Engineer, Facility Manager, Operation Manager) TIDAK diterjemahkan: tulis index-nya saja tanpa teks. Judul dokumen referensi (mis. "Technical Manual & Piping Diagram") tetap diterjemahkan.
6. Teks yang seluruhnya huruf kapital (judul) diterjemahkan dan tetap ditulis dengan huruf kapital.
7. Gunakan istilah yang sama secara konsisten di seluruh dokumen sesuai daftar istilah.

DAFTAR ISTILAH (Inggris -> Indonesia)
Method of Procedure -> Metode Prosedur Kerja
Section -> Bagian | Document Overview -> Ikhtisar Dokumen | Document Information -> Informasi Dokumen
Document Title / Purpose / Number -> Judul / Tujuan / Nomor Dokumen | Work Location -> Lokasi Pekerjaan
Equipment -> Peralatan | Sparepart -> Suku Cadang | Serial Number -> Nomor Seri | Manufacturer -> Pabrikan | Qty -> Jumlah
Schedule / Work Information -> Jadwal / Informasi Pekerjaan | Execution Date -> Tanggal Pelaksanaan | Executed by -> Dilaksanakan oleh
Reference Ticket Number -> Nomor Tiket Referensi | Job Title -> Jabatan | Name -> Nama | Signature -> Tanda Tangan | Date -> Tanggal
Affected Equipment / System -> Peralatan / Sistem Terdampak | Referenced Document / Attachment -> Dokumen Referensi / Lampiran
Environmental, Health & Safety -> Lingkungan, Kesehatan & Keselamatan | Requirements -> Persyaratan | Prerequisites -> Prasyarat
Time -> Waktu | Initial -> Paraf | Maintenance Period -> Periode Pemeliharaan
Preventive Maintenance -> Pemeliharaan Preventif | Corrective Maintenance -> Pemeliharaan Korektif
Work Instruction / Procedures -> Instruksi Kerja / Prosedur | Action -> Tindakan | Expected Outcome -> Hasil yang Diharapkan
Back Out Procedures -> Prosedur Pemulihan (Back Out) | Approval -> Persetujuan | Additional Information -> Informasi Tambahan
Author -> Penyusun | Date of Creation -> Tanggal Pembuatan | Revision Number -> Nomor Revisi
Measuring Instrument -> Alat Ukur | Brand -> Merek | Calibration Date -> Tanggal Kalibrasi
Toolbox Meeting (TBM) -> Toolbox Meeting (TBM) | Permit to Work (PTW) -> Izin Kerja (PTW) | Lockout/Tagout (LOTO) -> Lockout/Tagout (LOTO)
locked out (LOTO) -> dikunci dan diberi tag (LOTO) | Personal Protective Equipment (PPE) -> Alat Pelindung Diri (APD)
safety helmet / safety boots / safety goggles / gloves / dust mask -> helm keselamatan / sepatu keselamatan / kacamata keselamatan / sarung tangan / masker debu
energized / de-energized -> bertegangan / tidak bertegangan | isolate / isolation -> mengisolasi / isolasi
valve -> katup (butterfly valve -> katup butterfly) | circuit breaker -> circuit breaker | pump -> pompa
commissioning -> komisioning | handover -> serah terima | redundancy -> redundansi | standby -> standby
temperature -> temperatur | pressure -> tekanan | flow -> aliran | leak -> kebocoran | torque -> torsi | tighten -> kencangkan
thread -> ulir | male / female thread -> ulir luar (male) / ulir dalam (female) | socket -> soket | branch (pipe) -> cabang
pipe wrench -> kunci pipa | strap wrench -> kunci strap | thread seal tape -> seal tape ulir | fill pack -> fill pack
condenser water -> air kondensor | flush -> bilas | scale (kerak mineral) -> kerak | debris -> kotoran/serpihan
zero <sesuatu> (zero dry spots, zero thermal spikes) -> tanpa <sesuatu> (tanpa titik kering, tanpa lonjakan termal)
Tetap dalam bahasa Inggris: chiller, cooling tower, chilled water, nozzle, header, basin, fill media, sump, drain, breaker, panel, Full Body Harness, lanyard, lifeline, fall arrest, logsheet, Control Room, Chiller Plant, BMS Operator, Facility Manager, Chief Engineer, Supervisor, Engineer.

CONTOH
Permintaan:
[0] METHOD OF PROCEDURE
[1] Section 6 – Environmental, Health & Safety
[2] Document Purpose : Technical Procedure for Replacement of Genset Fuel Filter
[3] Ensure that the PTW has been approved
[4] c. Turn off the UPS-01 input breaker and apply LOTO at the LVMDP panel.
[5] b. Chilled water supply temperature remains stable between 7°C and 9°C.
[6] Wear safety helmet, safety shoes and insulated gloves (Class 0) when working near energized panels.
[7] Record the date and time of the vendor's arrival: ______ / ______
[8] Expected Outcome
[9] Chief Engineer
[10] Wahyudi Mursal 03/09/2026
[11] 4. If abnormal vibration is observed, stop the work immediately and report to the Facility Manager.
Jawaban:
[0] METODE PROSEDUR KERJA
[1] Bagian 6 – Lingkungan, Kesehatan & Keselamatan
[2] Tujuan Dokumen : Prosedur Teknis Penggantian Filter Bahan Bakar Genset
[3] Pastikan PTW telah disetujui
[4] c. Matikan breaker input UPS-01 dan pasang LOTO pada panel LVMDP.
[5] b. Temperatur suplai chilled water tetap stabil antara 7°C dan 9°C.
[6] Gunakan helm keselamatan, sepatu keselamatan, dan sarung tangan berinsulasi (Class 0) saat bekerja di dekat panel bertegangan.
[7] Catat tanggal dan waktu kedatangan vendor: ______ / ______
[8] Hasil yang Diharapkan
[9]
[10]
[11] 4. Jika terdeteksi getaran abnormal, segera hentikan pekerjaan dan laporkan kepada Facility Manager.

FORMAT JAWABAN
Satu baris per segmen yang diminta, urut sesuai permintaan, dengan format: [index] terjemahan
Tanpa pembuka, penutup, penjelasan, markdown, atau baris kosong. Segmen yang tidak diterjemahkan (aturan 5) ditulis "[index]" saja.`

var mopAnswerLineRe = regexp.MustCompile(`^\s*\**\[(\d+)\]\**\s?(.*)$`)

// MOPTranslation adalah hasil terjemahan satu segmen. Warning terisi bila hasilnya
// masih gagal pemeriksaan otomatis dan perlu dicek manusia.
type MOPTranslation struct {
	Index   int    `json:"index"`
	Text    string `json:"text"`
	Warning string `json:"warning,omitempty"`
}

type IMOPTranslateService interface {
	Translate(ctx context.Context, title string, segments []string, indices []int) ([]MOPTranslation, error)
}

type mopTranslateService struct {
	llm mopCompleter
}

// NewMOPTranslateService memakai endpoint dan pool API key yang sama dengan AI service.
func NewMOPTranslateService(ai IAIService) IMOPTranslateService {
	client := newMOPChatClient(aiAPIKeys(ai))
	if client == nil {
		return &mopTranslateService{}
	}
	return &mopTranslateService{llm: client}
}

// buildMOPDocumentContext menyusun isi dokumen sebagai konteks. Dokumen panjang dipotong
// menjadi jendela di sekitar segmen yang sedang diterjemahkan.
func buildMOPDocumentContext(title string, segments []string, indices []int) string {
	lo, hi := 0, len(segments)-1
	total := 0
	for _, s := range segments {
		total += len(s) + 8
	}
	if total > mopContextMaxChars && len(indices) > 0 {
		lo, hi = indices[0], indices[0]
		for _, i := range indices {
			lo, hi = min(lo, i), max(hi, i)
		}
		used := 0
		for i := lo; i <= hi; i++ {
			used += len(segments[i]) + 8
		}
		for grew := true; grew && used < mopContextMaxChars; {
			grew = false
			if lo > 0 {
				lo--
				used += len(segments[lo]) + 8
				grew = true
			}
			if hi < len(segments)-1 && used < mopContextMaxChars {
				hi++
				used += len(segments[hi]) + 8
				grew = true
			}
		}
	}

	var b strings.Builder
	b.WriteString("Judul dokumen: ")
	b.WriteString(title)
	b.WriteString("\n\nIsi dokumen sebagai konteks (jangan diterjemahkan seluruhnya; [index] teks):\n")
	if lo > 0 {
		b.WriteString("...\n")
	}
	for i := lo; i <= hi; i++ {
		fmt.Fprintf(&b, "[%d] %s\n", i, segments[i])
	}
	if hi < len(segments)-1 {
		b.WriteString("...\n")
	}
	return b.String()
}

func buildMOPTranslateRequest(segments []string, indices []int) string {
	var b strings.Builder
	b.WriteString("\nTerjemahkan ")
	b.WriteString(strconv.Itoa(len(indices)))
	b.WriteString(" segmen berikut ke bahasa Indonesia:\n")
	for _, i := range indices {
		fmt.Fprintf(&b, "[%d] %s\n", i, segments[i])
	}
	b.WriteString("\nJawab tepat satu baris per segmen dengan format \"[index] terjemahan\", urut seperti daftar di atas, tanpa teks lain.")
	return b.String()
}

type mopRepairItem struct {
	index    int
	previous string
	issue    string
}

func buildMOPRepairRequest(segments []string, items []mopRepairItem) string {
	var b strings.Builder
	b.WriteString("\nTerjemahan sebelumnya untuk segmen berikut bermasalah. Terjemahkan ulang dengan benar sesuai ATURAN dan DAFTAR ISTILAH, perhatikan catatan masalahnya:\n")
	for _, it := range items {
		fmt.Fprintf(&b, "[%d] %s\n", it.index, segments[it.index])
		if it.previous != "" {
			fmt.Fprintf(&b, "    Terjemahan sebelumnya: %s\n", it.previous)
		}
		fmt.Fprintf(&b, "    Masalah: %s\n", it.issue)
	}
	b.WriteString("\nJawab tepat satu baris per segmen dengan format \"[index] terjemahan\", urut seperti daftar di atas, tanpa teks lain.")
	return b.String()
}

// parseMOPTranslations membaca baris "[index] terjemahan" dan menyaring index yang diminta.
// Bila sebuah index muncul lebih dari sekali, jawaban terakhir yang dipakai (model kadang
// menyalin teks Inggris dulu sebelum menjawab).
func parseMOPTranslations(reply string, indices []int) map[int]string {
	wanted := make(map[int]bool, len(indices))
	for _, i := range indices {
		wanted[i] = true
	}
	result := make(map[int]string)
	for _, line := range strings.Split(reply, "\n") {
		m := mopAnswerLineRe.FindStringSubmatch(line)
		if m == nil {
			continue
		}
		idx, err := strconv.Atoi(m[1])
		if err != nil || !wanted[idx] {
			continue
		}
		result[idx] = strings.TrimSpace(m[2])
	}
	return result
}

func remainingTime(ctx context.Context) time.Duration {
	if deadline, ok := ctx.Deadline(); ok {
		return time.Until(deadline)
	}
	return time.Hour
}

func (s *mopTranslateService) Translate(ctx context.Context, title string, segments []string, indices []int) ([]MOPTranslation, error) {
	if s.llm == nil {
		return nil, ErrMOPTranslateNotConfigured
	}

	docContext := buildMOPDocumentContext(title, segments, indices)
	reply, err := s.llm.Complete(ctx, mopTranslateRules, docContext+buildMOPTranslateRequest(segments, indices))
	if err != nil {
		return nil, err
	}
	answers := parseMOPTranslations(reply, indices)

	results := make(map[int]MOPTranslation, len(indices))
	var repairs []mopRepairItem
	for _, i := range indices {
		answer, ok := answers[i]
		if !ok {
			repairs = append(repairs, mopRepairItem{index: i, issue: "Tidak ada jawaban untuk segmen ini"})
			continue
		}
		text, issue := checkMOPTranslation(segments[i], answer)
		if issue == "" {
			results[i] = MOPTranslation{Index: i, Text: text}
			continue
		}
		repairs = append(repairs, mopRepairItem{index: i, previous: text, issue: issue})
	}

	// Satu putaran perbaikan untuk baris yang gagal pemeriksaan, bila waktu masih cukup.
	if len(repairs) > 0 && remainingTime(ctx) >= mopRepairMinBudget {
		repairIndices := make([]int, len(repairs))
		for k, it := range repairs {
			repairIndices[k] = it.index
		}
		if reply, err := s.llm.Complete(ctx, mopTranslateRules, docContext+buildMOPRepairRequest(segments, repairs)); err == nil {
			fixed := parseMOPTranslations(reply, repairIndices)
			for k, it := range repairs {
				answer, ok := fixed[it.index]
				if !ok {
					continue
				}
				text, issue := checkMOPTranslation(segments[it.index], answer)
				switch {
				case issue == "":
					results[it.index] = MOPTranslation{Index: it.index, Text: text}
				case text != "":
					repairs[k] = mopRepairItem{index: it.index, previous: text, issue: issue}
				case it.previous == "":
					// AI tetap menilai baris ini tidak perlu diterjemahkan (kosong/sama dengan teks
					// Inggris). Diterjemahkan ulang pun hasilnya sama, jadi dikirim tanpa baris ID
					// dengan peringatan agar dicek, bukan dianggap gagal.
					results[it.index] = MOPTranslation{Index: it.index, Warning: mopNoTranslationWarning}
				}
			}
		}
	}

	// Yang masih bermasalah dikirim dengan peringatan; yang tetap kosong dianggap gagal
	// (tidak dikirim) agar bisa diterjemahkan ulang atau diisi manual.
	for _, it := range repairs {
		if _, done := results[it.index]; !done && it.previous != "" {
			results[it.index] = MOPTranslation{Index: it.index, Text: it.previous, Warning: it.issue}
		}
	}

	ordered := make([]MOPTranslation, 0, len(results))
	for _, i := range indices {
		if t, ok := results[i]; ok {
			ordered = append(ordered, t)
		}
	}
	return ordered, nil
}
