package services

import (
	"context"
	"strings"
	"sync"
	"testing"

	"github.com/gariiriana/utt-report-maintenance/backend/core/models"
)

// ═══════════════════════════════════════════════════════════════════════════════
// AI Agent Pipeline — 45 Tests
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Partition Logic ─────────────────────────────────────────────────────────

func TestPartitionPhotos(t *testing.T) {
	svc := &aiService{}

	t.Run("groups_all_four_categories", func(t *testing.T) {
		photos := []models.ATSPhotoInput{
			{Category: "grounding", Label: "g1"},
			{Category: "thermal", Label: "t1"},
			{Category: "power_meter", Label: "p1"},
			{Category: "visual_inspection", Label: "v1"},
		}
		groups := svc.partitionPhotos(photos)
		if len(groups["grounding"]) != 1 {
			t.Errorf("grounding: got %d, want 1", len(groups["grounding"]))
		}
		if len(groups["thermal"]) != 1 {
			t.Errorf("thermal: got %d, want 1", len(groups["thermal"]))
		}
		if len(groups["power_meter"]) != 1 {
			t.Errorf("power_meter: got %d, want 1", len(groups["power_meter"]))
		}
		if len(groups["visual_inspection"]) != 1 {
			t.Errorf("visual_inspection: got %d, want 1", len(groups["visual_inspection"]))
		}
	})

	t.Run("empty_input_returns_empty_groups", func(t *testing.T) {
		groups := svc.partitionPhotos(nil)
		for cat, photos := range groups {
			if len(photos) != 0 {
				t.Errorf("%s should be empty, got %d", cat, len(photos))
			}
		}
	})

	t.Run("single_category_only", func(t *testing.T) {
		photos := []models.ATSPhotoInput{
			{Category: "grounding", Label: "g1"},
			{Category: "grounding", Label: "g2"},
			{Category: "grounding", Label: "g3"},
		}
		groups := svc.partitionPhotos(photos)
		if len(groups["grounding"]) != 3 {
			t.Errorf("grounding: got %d, want 3", len(groups["grounding"]))
		}
		if len(groups["thermal"]) != 0 {
			t.Errorf("thermal should be 0, got %d", len(groups["thermal"]))
		}
	})

	t.Run("unknown_category_falls_back_to_visual", func(t *testing.T) {
		photos := []models.ATSPhotoInput{
			{Category: "unknown_category", Label: "mystery"},
			{Category: "some_other", Label: "other"},
		}
		groups := svc.partitionPhotos(photos)
		if len(groups["visual_inspection"]) != 2 {
			t.Errorf("visual_inspection fallback: got %d, want 2", len(groups["visual_inspection"]))
		}
	})

	t.Run("mixed_categories_distribution", func(t *testing.T) {
		photos := []models.ATSPhotoInput{
			{Category: "grounding", Label: "g1"},
			{Category: "grounding", Label: "g2"},
			{Category: "thermal", Label: "t1"},
			{Category: "thermal", Label: "t2"},
			{Category: "thermal", Label: "t3"},
			{Category: "power_meter", Label: "p1"},
			{Category: "power_meter", Label: "p2"},
			{Category: "power_meter", Label: "p3"},
			{Category: "power_meter", Label: "p4"},
			{Category: "power_meter", Label: "p5"},
			{Category: "power_meter", Label: "p6"},
			{Category: "power_meter", Label: "p7"},
			{Category: "power_meter", Label: "p8"},
			{Category: "visual_inspection", Label: "v1"},
			{Category: "visual_inspection", Label: "v2"},
			{Category: "visual_inspection", Label: "v3"},
			{Category: "visual_inspection", Label: "v4"},
			{Category: "visual_inspection", Label: "v5"},
			{Category: "visual_inspection", Label: "v6"},
		}
		groups := svc.partitionPhotos(photos)
		if len(groups["grounding"]) != 2 {
			t.Errorf("grounding: got %d, want 2", len(groups["grounding"]))
		}
		if len(groups["thermal"]) != 3 {
			t.Errorf("thermal: got %d, want 3", len(groups["thermal"]))
		}
		if len(groups["power_meter"]) != 8 {
			t.Errorf("power_meter: got %d, want 8", len(groups["power_meter"]))
		}
		if len(groups["visual_inspection"]) != 6 {
			t.Errorf("visual_inspection: got %d, want 6", len(groups["visual_inspection"]))
		}
	})

	t.Run("preserves_labels", func(t *testing.T) {
		photos := []models.ATSPhotoInput{
			{Category: "grounding", Label: "Earth Clamp 0.34 ohm"},
		}
		groups := svc.partitionPhotos(photos)
		if groups["grounding"][0].Label != "Earth Clamp 0.34 ohm" {
			t.Errorf("Label not preserved: %q", groups["grounding"][0].Label)
		}
	})

	t.Run("preserves_base64_data", func(t *testing.T) {
		photos := []models.ATSPhotoInput{
			{Category: "thermal", Base64: "iVBORw0KGgo=", Label: "test"},
		}
		groups := svc.partitionPhotos(photos)
		if groups["thermal"][0].Base64 != "iVBORw0KGgo=" {
			t.Error("Base64 data not preserved")
		}
	})
}

// ─── System Prompts ──────────────────────────────────────────────────────────

func TestBuildCategorySystemPrompt(t *testing.T) {
	svc := &aiService{}

	tests := []struct {
		category string
		mustContain string
	}{
		{"grounding", "EARTH CLAMP TESTER"},
		{"thermal", "THERMAL IMAGER"},
		{"power_meter", "ELECTRICAL MEASUREMENT"},
		{"visual_inspection", "visual inspection"},
		{"unknown", "precision instrument reader"},
	}

	for _, tt := range tests {
		t.Run(tt.category, func(t *testing.T) {
			prompt := svc.buildCategorySystemPrompt(tt.category)
			if !strings.Contains(prompt, tt.mustContain) {
				t.Errorf("System prompt for %q missing %q", tt.category, tt.mustContain)
			}
		})
	}
}

// ─── Category Prompts ────────────────────────────────────────────────────────

func TestBuildCategoryPrompt(t *testing.T) {
	svc := &aiService{}

	t.Run("grounding_contains_ohm_schema", func(t *testing.T) {
		photos := []models.ATSPhotoInput{{Category: "grounding", Label: "test"}}
		prompt := svc.buildCategoryPrompt("grounding", photos)
		if !strings.Contains(prompt, "result_ohm") {
			t.Error("Grounding prompt missing result_ohm field")
		}
		if !strings.Contains(prompt, "<5 Ω") {
			t.Error("Grounding prompt missing standard")
		}
	})

	t.Run("thermal_contains_temperature_schema", func(t *testing.T) {
		photos := []models.ATSPhotoInput{{Category: "thermal", Label: "test"}}
		prompt := svc.buildCategoryPrompt("thermal", photos)
		if !strings.Contains(prompt, "result_temperature") {
			t.Error("Thermal prompt missing result_temperature field")
		}
		if !strings.Contains(prompt, "40°C") {
			t.Error("Thermal prompt missing standard")
		}
	})

	t.Run("power_meter_contains_voltage_schema", func(t *testing.T) {
		photos := []models.ATSPhotoInput{
			{Category: "power_meter", Label: "Voltage R-S"},
			{Category: "power_meter", Label: "Voltage S-T"},
		}
		prompt := svc.buildCategoryPrompt("power_meter", photos)
		if !strings.Contains(prompt, "voltage_rs") {
			t.Error("Power meter prompt missing voltage_rs")
		}
		if !strings.Contains(prompt, "Photo 1: Voltage R-S") {
			t.Error("Power meter prompt missing photo descriptions")
		}
	})

	t.Run("power_meter_without_descriptions", func(t *testing.T) {
		photos := []models.ATSPhotoInput{
			{Category: "power_meter", Label: ""},
		}
		prompt := svc.buildCategoryPrompt("power_meter", photos)
		if !strings.Contains(prompt, "Unknown measurement") {
			t.Error("Should use 'Unknown measurement' for empty labels")
		}
	})

	t.Run("visual_inspection_contains_all_items", func(t *testing.T) {
		photos := []models.ATSPhotoInput{{Category: "visual_inspection"}}
		prompt := svc.buildCategoryPrompt("visual_inspection", photos)
		// Check all 16 items are present
		for _, letter := range []string{"\"a\"", "\"b\"", "\"c\"", "\"d\"", "\"e\"", "\"f\"", "\"g\"", "\"h\"", "\"i\"", "\"j\"", "\"k\"", "\"l\"", "\"m\"", "\"n\"", "\"o\"", "\"p\""} {
			if !strings.Contains(prompt, letter) {
				t.Errorf("Visual inspection prompt missing item %s", letter)
			}
		}
	})

	t.Run("unknown_category_returns_generic", func(t *testing.T) {
		prompt := svc.buildCategoryPrompt("xyz", nil)
		if !strings.Contains(prompt, "Analyze") {
			t.Error("Unknown category should have generic prompt")
		}
	})

	t.Run("prompt_includes_photo_count", func(t *testing.T) {
		photos := make([]models.ATSPhotoInput, 5)
		for i := range photos {
			photos[i] = models.ATSPhotoInput{Category: "grounding", Label: "test"}
		}
		prompt := svc.buildCategoryPrompt("grounding", photos)
		if !strings.Contains(prompt, "5") {
			t.Error("Prompt should include photo count")
		}
	})
}

// ─── Round-Robin API Key ─────────────────────────────────────────────────────

func TestGetNextAPIKey(t *testing.T) {
	t.Run("single_key_always_returns_same", func(t *testing.T) {
		svc := &aiService{apiKeys: []string{"key-A"}}
		for i := 0; i < 10; i++ {
			got := svc.getNextAPIKey()
			if got != "key-A" {
				t.Errorf("iteration %d: got %q, want key-A", i, got)
			}
		}
	})

	t.Run("multiple_keys_round_robin", func(t *testing.T) {
		svc := &aiService{apiKeys: []string{"key-A", "key-B", "key-C"}}
		seen := map[string]int{}
		for i := 0; i < 9; i++ {
			key := svc.getNextAPIKey()
			seen[key]++
		}
		// Each key should be used 3 times
		for _, k := range []string{"key-A", "key-B", "key-C"} {
			if seen[k] != 3 {
				t.Errorf("key %s used %d times, want 3", k, seen[k])
			}
		}
	})

	t.Run("empty_keys_returns_empty_string", func(t *testing.T) {
		svc := &aiService{apiKeys: nil}
		got := svc.getNextAPIKey()
		if got != "" {
			t.Errorf("Empty keys should return empty string, got %q", got)
		}
	})

	t.Run("concurrent_access_no_panic", func(t *testing.T) {
		svc := &aiService{apiKeys: []string{"k1", "k2", "k3"}}
		var wg sync.WaitGroup
		for i := 0; i < 100; i++ {
			wg.Add(1)
			go func() {
				defer wg.Done()
				key := svc.getNextAPIKey()
				if key == "" {
					t.Error("Got empty key in concurrent access")
				}
			}()
		}
		wg.Wait()
	})
}

// ─── JSON Response Parsing ───────────────────────────────────────────────────

func TestParseJSONResponse(t *testing.T) {
	svc := &aiService{}

	t.Run("valid_json", func(t *testing.T) {
		content := `{"visual_inspection":[],"power_meter_recording":{"rs":{"voltage":"390.1","remarks":""},"st":{"voltage":"","remarks":""},"tr":{"voltage":"","remarks":""},"rn":{"voltage":"","remarks":""},"sn":{"voltage":"","remarks":""},"tn":{"voltage":"","remarks":""},"n":{"voltage":"","remarks":""},"kw":"","kva":"","kvar":"","cos_p":"","r_ampere":"","s_ampere":"","t_ampere":"","n_ampere":""},"voltage_current":{"voltage_rs":"390.1","voltage_st":"","voltage_tr":"","voltage_rn":"","voltage_sn":"","voltage_tn":"","voltage_ng":"","ampere_r":"","ampere_s":"","ampere_t":"","remarks":""},"thermal_measurement":{"result_temperature":"28.5","standard":"40°C","remarks":""},"grounding_resistance":{"result_ohm":"0.34","standard":"<5 Ω","remarks":""},"operation_status":{"is_normal":true,"remark":"","fault_symptom":"","fault_analysis":"","work_done":"","fault_part_sn":"","fault_part_name":""}}`
		result, err := svc.parseJSONResponse(content)
		if err != nil {
			t.Fatalf("Parse valid JSON failed: %v", err)
		}
		if result.GroundingResistance.ResultOhm != "0.34" {
			t.Errorf("Grounding = %q, want 0.34", result.GroundingResistance.ResultOhm)
		}
		if result.ThermalMeasurement.ResultTemperature != "28.5" {
			t.Errorf("Thermal = %q, want 28.5", result.ThermalMeasurement.ResultTemperature)
		}
	})

	t.Run("json_with_markdown_fences", func(t *testing.T) {
		content := "```json\n{\"visual_inspection\":[],\"power_meter_recording\":{\"rs\":{\"voltage\":\"\",\"remarks\":\"\"},\"st\":{\"voltage\":\"\",\"remarks\":\"\"},\"tr\":{\"voltage\":\"\",\"remarks\":\"\"},\"rn\":{\"voltage\":\"\",\"remarks\":\"\"},\"sn\":{\"voltage\":\"\",\"remarks\":\"\"},\"tn\":{\"voltage\":\"\",\"remarks\":\"\"},\"n\":{\"voltage\":\"\",\"remarks\":\"\"},\"kw\":\"\",\"kva\":\"\",\"kvar\":\"\",\"cos_p\":\"\",\"r_ampere\":\"\",\"s_ampere\":\"\",\"t_ampere\":\"\",\"n_ampere\":\"\"},\"voltage_current\":{\"voltage_rs\":\"\",\"voltage_st\":\"\",\"voltage_tr\":\"\",\"voltage_rn\":\"\",\"voltage_sn\":\"\",\"voltage_tn\":\"\",\"voltage_ng\":\"\",\"ampere_r\":\"\",\"ampere_s\":\"\",\"ampere_t\":\"\",\"remarks\":\"\"},\"thermal_measurement\":{\"result_temperature\":\"\",\"standard\":\"\",\"remarks\":\"\"},\"grounding_resistance\":{\"result_ohm\":\"\",\"standard\":\"\",\"remarks\":\"\"},\"operation_status\":{\"is_normal\":true,\"remark\":\"\",\"fault_symptom\":\"\",\"fault_analysis\":\"\",\"work_done\":\"\",\"fault_part_sn\":\"\",\"fault_part_name\":\"\"}}\n```"
		result, err := svc.parseJSONResponse(content)
		if err != nil {
			t.Fatalf("Should handle markdown fences: %v", err)
		}
		if result == nil {
			t.Error("Result should not be nil")
		}
	})

	t.Run("json_with_think_tags", func(t *testing.T) {
		content := "<think>\nLet me analyze the data...\nThe grounding value is 0.34 ohm.\n</think>\n{\"visual_inspection\":[],\"power_meter_recording\":{\"rs\":{\"voltage\":\"\",\"remarks\":\"\"},\"st\":{\"voltage\":\"\",\"remarks\":\"\"},\"tr\":{\"voltage\":\"\",\"remarks\":\"\"},\"rn\":{\"voltage\":\"\",\"remarks\":\"\"},\"sn\":{\"voltage\":\"\",\"remarks\":\"\"},\"tn\":{\"voltage\":\"\",\"remarks\":\"\"},\"n\":{\"voltage\":\"\",\"remarks\":\"\"},\"kw\":\"\",\"kva\":\"\",\"kvar\":\"\",\"cos_p\":\"\",\"r_ampere\":\"\",\"s_ampere\":\"\",\"t_ampere\":\"\",\"n_ampere\":\"\"},\"voltage_current\":{\"voltage_rs\":\"\",\"voltage_st\":\"\",\"voltage_tr\":\"\",\"voltage_rn\":\"\",\"voltage_sn\":\"\",\"voltage_tn\":\"\",\"voltage_ng\":\"\",\"ampere_r\":\"\",\"ampere_s\":\"\",\"ampere_t\":\"\",\"remarks\":\"\"},\"thermal_measurement\":{\"result_temperature\":\"28.5\",\"standard\":\"40°C\",\"remarks\":\"\"},\"grounding_resistance\":{\"result_ohm\":\"0.34\",\"standard\":\"<5 Ω\",\"remarks\":\"\"},\"operation_status\":{\"is_normal\":true,\"remark\":\"\",\"fault_symptom\":\"\",\"fault_analysis\":\"\",\"work_done\":\"\",\"fault_part_sn\":\"\",\"fault_part_name\":\"\"}}"
		result, err := svc.parseJSONResponse(content)
		if err != nil {
			t.Fatalf("Should handle think tags: %v", err)
		}
		if result.GroundingResistance.ResultOhm != "0.34" {
			t.Errorf("Think tags: grounding = %q, want 0.34", result.GroundingResistance.ResultOhm)
		}
	})

	t.Run("empty_content_fails", func(t *testing.T) {
		_, err := svc.parseJSONResponse("")
		if err == nil {
			t.Error("Empty content should fail")
		}
	})

	t.Run("invalid_json_fails", func(t *testing.T) {
		_, err := svc.parseJSONResponse("this is not json at all")
		if err == nil {
			t.Error("Invalid JSON should fail")
		}
	})

	t.Run("whitespace_handling", func(t *testing.T) {
		content := "   \n\n  {\"visual_inspection\":[],\"power_meter_recording\":{\"rs\":{\"voltage\":\"\",\"remarks\":\"\"},\"st\":{\"voltage\":\"\",\"remarks\":\"\"},\"tr\":{\"voltage\":\"\",\"remarks\":\"\"},\"rn\":{\"voltage\":\"\",\"remarks\":\"\"},\"sn\":{\"voltage\":\"\",\"remarks\":\"\"},\"tn\":{\"voltage\":\"\",\"remarks\":\"\"},\"n\":{\"voltage\":\"\",\"remarks\":\"\"},\"kw\":\"\",\"kva\":\"\",\"kvar\":\"\",\"cos_p\":\"\",\"r_ampere\":\"\",\"s_ampere\":\"\",\"t_ampere\":\"\",\"n_ampere\":\"\"},\"voltage_current\":{\"voltage_rs\":\"\",\"voltage_st\":\"\",\"voltage_tr\":\"\",\"voltage_rn\":\"\",\"voltage_sn\":\"\",\"voltage_tn\":\"\",\"voltage_ng\":\"\",\"ampere_r\":\"\",\"ampere_s\":\"\",\"ampere_t\":\"\",\"remarks\":\"\"},\"thermal_measurement\":{\"result_temperature\":\"\",\"standard\":\"\",\"remarks\":\"\"},\"grounding_resistance\":{\"result_ohm\":\"\",\"standard\":\"\",\"remarks\":\"\"},\"operation_status\":{\"is_normal\":true,\"remark\":\"\",\"fault_symptom\":\"\",\"fault_analysis\":\"\",\"work_done\":\"\",\"fault_part_sn\":\"\",\"fault_part_name\":\"\"}}   \n\n"
		_, err := svc.parseJSONResponse(content)
		if err != nil {
			t.Fatalf("Should handle whitespace: %v", err)
		}
	})

	t.Run("triple_backticks_only", func(t *testing.T) {
		content := "```\n{\"visual_inspection\":[],\"power_meter_recording\":{\"rs\":{\"voltage\":\"\",\"remarks\":\"\"},\"st\":{\"voltage\":\"\",\"remarks\":\"\"},\"tr\":{\"voltage\":\"\",\"remarks\":\"\"},\"rn\":{\"voltage\":\"\",\"remarks\":\"\"},\"sn\":{\"voltage\":\"\",\"remarks\":\"\"},\"tn\":{\"voltage\":\"\",\"remarks\":\"\"},\"n\":{\"voltage\":\"\",\"remarks\":\"\"},\"kw\":\"\",\"kva\":\"\",\"kvar\":\"\",\"cos_p\":\"\",\"r_ampere\":\"\",\"s_ampere\":\"\",\"t_ampere\":\"\",\"n_ampere\":\"\"},\"voltage_current\":{\"voltage_rs\":\"\",\"voltage_st\":\"\",\"voltage_tr\":\"\",\"voltage_rn\":\"\",\"voltage_sn\":\"\",\"voltage_tn\":\"\",\"voltage_ng\":\"\",\"ampere_r\":\"\",\"ampere_s\":\"\",\"ampere_t\":\"\",\"remarks\":\"\"},\"thermal_measurement\":{\"result_temperature\":\"\",\"standard\":\"\",\"remarks\":\"\"},\"grounding_resistance\":{\"result_ohm\":\"\",\"standard\":\"\",\"remarks\":\"\"},\"operation_status\":{\"is_normal\":true,\"remark\":\"\",\"fault_symptom\":\"\",\"fault_analysis\":\"\",\"work_done\":\"\",\"fault_part_sn\":\"\",\"fault_part_name\":\"\"}}\n```"
		_, err := svc.parseJSONResponse(content)
		if err != nil {
			t.Fatalf("Should handle triple backticks: %v", err)
		}
	})

	t.Run("preserves_measurement_precision", func(t *testing.T) {
		content := `{"visual_inspection":[],"power_meter_recording":{"rs":{"voltage":"390.123","remarks":""},"st":{"voltage":"","remarks":""},"tr":{"voltage":"","remarks":""},"rn":{"voltage":"","remarks":""},"sn":{"voltage":"","remarks":""},"tn":{"voltage":"","remarks":""},"n":{"voltage":"","remarks":""},"kw":"","kva":"","kvar":"","cos_p":"","r_ampere":"","s_ampere":"","t_ampere":"","n_ampere":""},"voltage_current":{"voltage_rs":"","voltage_st":"","voltage_tr":"","voltage_rn":"","voltage_sn":"","voltage_tn":"","voltage_ng":"","ampere_r":"","ampere_s":"","ampere_t":"","remarks":""},"thermal_measurement":{"result_temperature":"","standard":"","remarks":""},"grounding_resistance":{"result_ohm":"0.3456","standard":"","remarks":""},"operation_status":{"is_normal":true,"remark":"","fault_symptom":"","fault_analysis":"","work_done":"","fault_part_sn":"","fault_part_name":""}}`
		result, _ := svc.parseJSONResponse(content)
		if result.PowerMeterRecording.RS.Voltage != "390.123" {
			t.Errorf("Precision lost: got %q", result.PowerMeterRecording.RS.Voltage)
		}
		if result.GroundingResistance.ResultOhm != "0.3456" {
			t.Errorf("Precision lost: got %q", result.GroundingResistance.ResultOhm)
		}
	})
}

// ─── Service Constructor ─────────────────────────────────────────────────────

func TestAnalyzeATSPhotos_NoKeysError(t *testing.T) {
	svc := &aiService{apiKeys: nil}
	_, err := svc.AnalyzeATSPhotos(context.TODO(), []models.ATSPhotoInput{{Category: "grounding"}}, nil)
	if err == nil {
		t.Error("Should fail with no API keys")
	}
	if !strings.Contains(err.Error(), "no NVIDIA NIM API keys") {
		t.Errorf("Wrong error message: %v", err)
	}
}

// ─── Error Recovery & Edge Cases ─────────────────────────────────────────────

func TestPartitionPhotos_EdgeCases(t *testing.T) {
	svc := &aiService{}

	t.Run("large_batch_19_photos", func(t *testing.T) {
		photos := make([]models.ATSPhotoInput, 19)
		categories := []string{"grounding", "grounding", "thermal", "thermal", "thermal",
			"power_meter", "power_meter", "power_meter", "power_meter", "power_meter",
			"power_meter", "power_meter", "power_meter",
			"visual_inspection", "visual_inspection", "visual_inspection",
			"visual_inspection", "visual_inspection", "visual_inspection"}
		for i := range photos {
			photos[i] = models.ATSPhotoInput{Category: categories[i], Label: "test"}
		}
		groups := svc.partitionPhotos(photos)
		total := 0
		for _, g := range groups {
			total += len(g)
		}
		if total != 19 {
			t.Errorf("Total photos = %d, want 19", total)
		}
	})

	t.Run("all_unknown_categories", func(t *testing.T) {
		photos := []models.ATSPhotoInput{
			{Category: "unknown1"},
			{Category: "unknown2"},
			{Category: "xyz"},
		}
		groups := svc.partitionPhotos(photos)
		if len(groups["visual_inspection"]) != 3 {
			t.Errorf("All unknowns should go to visual_inspection, got %d", len(groups["visual_inspection"]))
		}
	})

	t.Run("empty_category_string", func(t *testing.T) {
		photos := []models.ATSPhotoInput{{Category: ""}}
		groups := svc.partitionPhotos(photos)
		if len(groups["visual_inspection"]) != 1 {
			t.Error("Empty category should fallback to visual_inspection")
		}
	})
}

// ─── Concurrency & Load Handling ─────────────────────────────────────────────

func TestGetNextAPIKey_HeavyLoad(t *testing.T) {
	svc := &aiService{apiKeys: []string{"k1", "k2", "k3", "k4"}}
	counts := sync.Map{}

	var wg sync.WaitGroup
	for i := 0; i < 1000; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			key := svc.getNextAPIKey()
			val, _ := counts.LoadOrStore(key, new(int))
			ptr := val.(*int)
			*ptr++
		}()
	}
	wg.Wait()

	// All keys should be used (at least some distribution)
	for _, k := range svc.apiKeys {
		val, ok := counts.Load(k)
		if !ok {
			t.Errorf("Key %q was never used in 1000 calls", k)
		} else {
			count := *(val.(*int))
			if count == 0 {
				t.Errorf("Key %q count = 0", k)
			}
		}
	}
}
