package services

import (
	"context"
	"encoding/json"
	"strings"
	"testing"
)

func TestParsePMExtractReply_NormalizesValues(t *testing.T) {
	items := []PMExtractItem{
		{Index: 1, Kind: "measurement"},
		{Index: 2, Kind: "measurement"},
		{Index: 17, Kind: "nameplate"},
		{Index: 18, Kind: "visual"},
		{Index: 5, Kind: "measurement"},
	}
	reply := "```json\n" + `{"items":[
		{"index":1,"value":226.0,"unit":"V","raw":"226.0 V~","confidence":"high"},
		{"index":"2","value":"2,4 A","unit":"A","confidence":"sedang"},
		{"index":17,"nameplate":{"brand":"Daikin","ratedVoltage":"380-415V","ratedCurrent":1.2,"phase":3},"confidence":"tinggi"},
		{"index":18,"condition":"Good","observation":"Coil bersih","confidence":"tinggi"},
		{"index":99,"value":1}
	]}` + "\n```"

	got, err := parsePMExtractReply(reply, items)
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != len(items) {
		t.Fatalf("got %d results, want %d (unrequested index must be dropped)", len(got), len(items))
	}
	if got[0].Value == nil || *got[0].Value != 226.0 || got[0].Confidence != "tinggi" {
		t.Fatalf("item 1 = %+v", got[0])
	}
	if got[1].Value == nil || *got[1].Value != 2.4 {
		t.Fatalf("comma decimal string not parsed: %+v", got[1])
	}
	np := got[2].Nameplate
	if np == nil || np.Brand != "Daikin" || np.RatedVoltage == nil || *np.RatedVoltage != 380 || np.Phase == nil || *np.Phase != 3 {
		t.Fatalf("nameplate = %+v", np)
	}
	if got[3].Condition != "baik" {
		t.Fatalf("condition = %q, want baik", got[3].Condition)
	}
	if got[4].Value != nil || got[4].Confidence != "rendah" {
		t.Fatalf("missing index must come back empty with low confidence: %+v", got[4])
	}
}

func TestParsePMExtractReply_InvalidJSON(t *testing.T) {
	if _, err := parsePMExtractReply("maaf, saya tidak bisa", []PMExtractItem{{Index: 1}}); err == nil {
		t.Fatal("expected an error for a non-JSON reply")
	}
}

func TestCleanList_KeepsLeadingNumbersInText(t *testing.T) {
	got := cleanList([]string{"- Bersihkan filter", "2. Cek fan belt", "24 jam pertama pantau arus", "  ", "• Kencangkan terminal"}, 10, 100)
	want := []string{"Bersihkan filter", "Cek fan belt", "24 jam pertama pantau arus", "Kencangkan terminal"}
	if strings.Join(got, "|") != strings.Join(want, "|") {
		t.Fatalf("got %q, want %q", got, want)
	}
}

func TestBuildPMExtractMessages_SendsEveryImage(t *testing.T) {
	msgs := buildPMExtractMessages(PMExtractRequest{UnitType: "FCU", UnitLabel: "FCU-01", Items: []PMExtractItem{
		{Index: 1, Label: "R-S", Kind: "measurement", Expected: "Tegangan R-S", Unit: "V", ImageBase64: "/9j/AAA"},
		{Index: 2, Label: "Nameplate", Kind: "nameplate", ImageBase64: "data:image/png;base64,iVBOR"},
	}})
	parts, ok := msgs[1]["content"].([]map[string]interface{})
	if !ok {
		t.Fatalf("user content must be multimodal parts, got %T", msgs[1]["content"])
	}
	var urls []string
	for _, p := range parts {
		if p["type"] == "image_url" {
			urls = append(urls, p["image_url"].(map[string]interface{})["url"].(string))
		}
	}
	if len(urls) != 2 || urls[0] != "data:image/jpeg;base64,/9j/AAA" || urls[1] != "data:image/png;base64,iVBOR" {
		t.Fatalf("image urls = %q", urls)
	}
}

type fakePMCompleter struct{ reply string }

func (f fakePMCompleter) CompleteMessages(context.Context, []map[string]interface{}) (string, error) {
	return f.reply, nil
}

func TestAnalyzeSection_RequiresKondisi(t *testing.T) {
	s := &pmPredictiveService{analysis: fakePMCompleter{reply: `{"kondisi":"","rekomendasi":[]}`}}
	if _, err := s.AnalyzeSection(context.Background(), json.RawMessage(`{}`)); err == nil {
		t.Fatal("expected error when the model leaves kondisi empty")
	}

	s = &pmPredictiveService{analysis: fakePMCompleter{reply: `Berikut: {"kondisi":"Normal.","analisisTren":"Baseline.","prediksiRisiko":"-","rekomendasi":["1. Cek filter"]}`}}
	got, err := s.AnalyzeSection(context.Background(), json.RawMessage(`{}`))
	if err != nil || got.Kondisi != "Normal." || len(got.Rekomendasi) != 1 || got.Rekomendasi[0] != "Cek filter" {
		t.Fatalf("got %+v, err %v", got, err)
	}
}
