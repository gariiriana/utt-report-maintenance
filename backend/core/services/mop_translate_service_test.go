package services

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/gariiriana/DwimitraSystem/backend/core/config"
)

func TestParseMOPTranslations_LinesAndFiltering(t *testing.T) {
	reply := "Berikut hasilnya:\n[3] Bagian 1 – Ikhtisar Dokumen \n[9] tidak diminta\n**[4]**\n[5] Ensure the PTW\n[5] Pastikan PTW telah disetujui"
	got := parseMOPTranslations(reply, []int{3, 4, 5, 6})
	if len(got) != 3 {
		t.Fatalf("expected 3 answers, got %d: %+v", len(got), got)
	}
	if got[3] != "Bagian 1 – Ikhtisar Dokumen" {
		t.Fatalf("unexpected answer for 3: %q", got[3])
	}
	// "[index]" tanpa teks = sengaja tidak diterjemahkan.
	if text, ok := got[4]; !ok || text != "" {
		t.Fatalf("expected explicit empty answer for 4, got %q (present=%v)", text, ok)
	}
	// Jawaban terakhir menang.
	if got[5] != "Pastikan PTW telah disetujui" {
		t.Fatalf("expected the last answer for 5, got %q", got[5])
	}
	if _, ok := got[6]; ok {
		t.Fatal("index 6 was not answered and must be missing")
	}
}

func TestCheckMOPTranslation(t *testing.T) {
	cases := []struct {
		name, source, translation, wantText string
		wantIssue                           bool
	}{
		{"good step", "a. Close the manual butterfly valve on the condenser water inlet pipe feeding the CT-02 upper basin and lock the handwheel.",
			"a. Tutup katup butterfly manual pada pipa inlet air kondensor yang menyuplai basin atas CT-02 dan kunci handwheel-nya.", "", false},
		{"hybrid", "a. Close the manual butterfly valve on the condenser water inlet pipe feeding the CT-02 upper basin.",
			"a. Tutup the manual butterfly valve on the pipa inlet CT-02 upper basin.", "", true},
		{"untranslated", "Ensure that all tools and materials are available in good condition.",
			"Ensure that all tools and materials are available in good condition.", "", true},
		{"name may stay empty", "Budiman 11/08/2026", "", "", false},
		{"identical name becomes empty", "Chief Engineer", "Chief Engineer", "", false},
		{"header must be translated", "Expected Outcome", "", "", true},
		{"number changed", "b. Verify data center condenser water supply temperature is stable between 29°C and 31°C.",
			"b. Verifikasi temperatur suplai air kondensor data center stabil antara 28°C dan 31°C.", "", true},
		{"decimal comma accepted", "c. Start the pump and monitor header pressure (nominal 0.8 - 1.2 bar).",
			"c. Jalankan pompa dan pantau tekanan header (nominal 0,8 - 1,2 bar).", "", false},
		{"abbreviation dropped", "Apply LOTO padlock on the CT-02 fan motor circuit breaker at the MCC.",
			"Pasang gembok pada circuit breaker motor kipas CT-02 di panel kontrol motor.", "", true},
		{"PPE as APD", "Wear the required PPE before entering the plant room.",
			"Gunakan APD yang dipersyaratkan sebelum memasuki ruang plant.", "", false},
		{"list marker restored", "d. Record inlet and outlet water temperatures on the plant logsheet.",
			"Catat temperatur air inlet dan outlet pada logsheet plant.", "d. Catat temperatur air inlet dan outlet pada logsheet plant.", false},
		{"section prefix", "Section 7 – Prerequisites", "Seksi 7 – Prasyarat", "", true},
		{"truncated", "Wear safety goggles, chemical-resistant nitrile gloves, and dust masks to protect against scale particles and water treatment chemicals.",
			"Gunakan kacamata keselamatan.", "", true},
		{"blank line kept", "Record the date and time of the vendor’s arrival: ______________ / __________________",
			"Catat tanggal dan waktu kedatangan vendor:", "", true},
		{"all caps title", "METHOD OF PROCEDURE", "METODE PROSEDUR KERJA", "", false},
	}
	for _, c := range cases {
		text, issue := checkMOPTranslation(c.source, c.translation)
		if (issue != "") != c.wantIssue {
			t.Errorf("%s: issue=%q, wantIssue=%v (text %q)", c.name, issue, c.wantIssue, text)
		}
		if c.wantText != "" && text != c.wantText {
			t.Errorf("%s: text=%q, want %q", c.name, text, c.wantText)
		}
	}
}

// fakeCompleter mengembalikan jawaban berurutan dan mencatat permintaan yang diterima.
type fakeCompleter struct {
	replies []string
	prompts []string
}

func (f *fakeCompleter) Complete(_ context.Context, _, user string) (string, error) {
	f.prompts = append(f.prompts, user)
	if len(f.replies) == 0 {
		return "", errors.New("no more replies")
	}
	reply := f.replies[0]
	f.replies = f.replies[1:]
	return reply, nil
}

func TestMOPTranslate_RepairsFlaggedLines(t *testing.T) {
	segments := []string{
		"Section 7 – Prerequisites",
		"Ensure that the PTW has been approved",
		"Supervisor",
		"Expected Outcome",
	}
	llm := &fakeCompleter{replies: []string{
		"[0] Bagian 7 – Prasyarat\n[1] Ensure that the PTW telah disetujui\n[2]",
		"[1] Pastikan PTW telah disetujui\n[3] Hasil yang Diharapkan",
	}}
	svc := &mopTranslateService{llm: llm}

	ctx, cancel := context.WithTimeout(context.Background(), time.Minute)
	defer cancel()
	got, err := svc.Translate(ctx, "MOP", segments, []int{0, 1, 2, 3})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	want := []MOPTranslation{
		{Index: 0, Text: "Bagian 7 – Prasyarat"},
		{Index: 1, Text: "Pastikan PTW telah disetujui"},
		{Index: 2, Text: ""},
		{Index: 3, Text: "Hasil yang Diharapkan"},
	}
	if len(got) != len(want) {
		t.Fatalf("got %+v, want %+v", got, want)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("result %d = %+v, want %+v", i, got[i], want[i])
		}
	}
	if len(llm.prompts) != 2 || !strings.Contains(llm.prompts[1], "Masalah:") {
		t.Fatalf("expected a repair request after the first answer, prompts: %q", llm.prompts)
	}
}

func TestMOPTranslate_KeepsWarningWhenRepairFails(t *testing.T) {
	segments := []string{"Ensure that the PTW has been approved", "Expected Outcome"}
	llm := &fakeCompleter{replies: []string{
		"[0] Ensure that the PTW telah disetujui",
		"[0] Ensure the PTW telah disetujui by supervisor",
	}}
	svc := &mopTranslateService{llm: llm}

	ctx, cancel := context.WithTimeout(context.Background(), time.Minute)
	defer cancel()
	got, err := svc.Translate(ctx, "MOP", segments, []int{0, 1})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	// Index 0 dikirim dengan peringatan; index 1 tidak pernah dijawab sehingga dianggap gagal.
	if len(got) != 1 || got[0].Index != 0 || got[0].Warning == "" {
		t.Fatalf("expected only index 0 with a warning, got %+v", got)
	}
}

func TestMOPTranslate_NotConfigured(t *testing.T) {
	svc := &mopTranslateService{}
	if _, err := svc.Translate(context.Background(), "t", []string{"a"}, []int{0}); !errors.Is(err, ErrMOPTranslateNotConfigured) {
		t.Fatalf("expected ErrMOPTranslateNotConfigured, got %v", err)
	}
}

func TestBuildMOPDocumentContext_WindowsLongDocuments(t *testing.T) {
	segments := make([]string, 400)
	for i := range segments {
		segments[i] = strings.Repeat("x", 200)
	}
	ctx := buildMOPDocumentContext("T", segments, []int{200, 201})
	if len(ctx) > mopContextMaxChars+1000 {
		t.Fatalf("context too long: %d chars", len(ctx))
	}
	if !strings.Contains(ctx, "[200] ") || !strings.Contains(ctx, "[201] ") || strings.Contains(ctx, "[0] ") {
		t.Fatal("context window must surround the requested segments")
	}
}

func TestIsModelUnavailable(t *testing.T) {
	if !isModelUnavailable(404, "models/x is not found") {
		t.Fatal("404 must mark the model unavailable")
	}
	if !isModelUnavailable(429, `Quota exceeded ... limit: 0, model: gemini-pro`) {
		t.Fatal("zero free-tier quota must mark the model unavailable")
	}
	if isModelUnavailable(429, `"retryDelay": "12s"`) {
		t.Fatal("a normal rate limit must not skip the model")
	}
	if got := rateLimitWait(`"retryDelay": "12s"`, 1); got < 12*time.Second || got > 13*time.Second {
		t.Fatalf("unexpected wait %v", got)
	}
}

// TestMOPTranslateLive menerjemahkan dokumen sungguhan memakai API key AI di .env.local.
// Hanya jalan bila MOP_LIVE_SEGMENTS menunjuk file JSON {"title": "...", "segments": [...]};
// hasil ditulis ke MOP_LIVE_OUT.
func TestMOPTranslateLive(t *testing.T) {
	input := os.Getenv("MOP_LIVE_SEGMENTS")
	if input == "" {
		t.Skip("set MOP_LIVE_SEGMENTS to run the live translation test")
	}
	config.MustLoadDotEnv("../../../.env.local")

	raw, err := os.ReadFile(input)
	if err != nil {
		t.Fatal(err)
	}
	var doc struct {
		Title    string   `json:"title"`
		Segments []string `json:"segments"`
	}
	if err := json.Unmarshal(raw, &doc); err != nil {
		t.Fatal(err)
	}

	svc := NewMOPTranslateService(NewAIService(nil))
	const batch = 25
	var all []MOPTranslation
	for start := 0; start < len(doc.Segments); start += batch {
		var indices []int
		for i := start; i < min(start+batch, len(doc.Segments)); i++ {
			indices = append(indices, i)
		}
		ctx, cancel := context.WithTimeout(context.Background(), 55*time.Second)
		began := time.Now()
		got, err := svc.Translate(ctx, doc.Title, doc.Segments, indices)
		cancel()
		if err != nil {
			t.Fatalf("batch %d: %v", start, err)
		}
		t.Logf("batch %d: %d/%d answered in %v", start, len(got), len(indices), time.Since(began).Round(time.Millisecond))
		all = append(all, got...)
	}
	if client, ok := svc.(*mopTranslateService).llm.(*mopChatClient); ok {
		t.Logf("model: %s", client.models[client.modelIndex.Load()])
	}

	out, _ := json.MarshalIndent(all, "", " ")
	if path := os.Getenv("MOP_LIVE_OUT"); path != "" {
		if err := os.WriteFile(path, out, 0o644); err != nil {
			t.Fatal(err)
		}
	}
}
