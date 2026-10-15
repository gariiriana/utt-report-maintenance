package controllers

import (
	"strings"
	"testing"

	"github.com/gariiriana/DwimitraSystem/backend/core/services"
)

func TestValidatePMExtractRequest(t *testing.T) {
	ok := services.PMExtractItem{Index: 1, Kind: "measurement", ImageBase64: "abc"}
	cases := []struct {
		name  string
		items []services.PMExtractItem
		want  string
	}{
		{"valid", []services.PMExtractItem{ok}, ""},
		{"empty", nil, "Jumlah foto"},
		{"too many", make([]services.PMExtractItem, services.PMExtractMaxItems+1), "Jumlah foto"},
		{"duplicate index", []services.PMExtractItem{ok, ok}, "ganda"},
		{"unknown kind", []services.PMExtractItem{{Index: 1, Kind: "x", ImageBase64: "a"}}, "Jenis foto"},
		{"no image", []services.PMExtractItem{{Index: 1, Kind: "visual"}}, "kosong"},
		{"huge image", []services.PMExtractItem{{Index: 1, Kind: "visual", ImageBase64: strings.Repeat("a", pmExtractMaxImage+1)}}, "terlalu besar"},
	}
	for _, tc := range cases {
		got := validatePMExtractRequest(services.PMExtractRequest{Items: tc.items})
		if (tc.want == "" && got != "") || (tc.want != "" && !strings.Contains(got, tc.want)) {
			t.Errorf("%s: got %q, want contains %q", tc.name, got, tc.want)
		}
	}
}
