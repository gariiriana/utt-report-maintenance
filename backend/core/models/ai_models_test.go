package models

import (
	"encoding/json"
	"strings"
	"testing"
)

// ═══════════════════════════════════════════════════════════════════════════════
// Model Serialization — 20 Tests
// ═══════════════════════════════════════════════════════════════════════════════

func TestATSPhotoInput(t *testing.T) {
	t.Run("marshal_produces_correct_json", func(t *testing.T) {
		input := ATSPhotoInput{Base64: "abc123", Category: "grounding", Label: "Test Label"}
		data, err := json.Marshal(input)
		if err != nil {
			t.Fatalf("Marshal failed: %v", err)
		}
		s := string(data)
		if !strings.Contains(s, `"base64":"abc123"`) {
			t.Errorf("Marshal missing base64 field: %s", s)
		}
		if !strings.Contains(s, `"category":"grounding"`) {
			t.Errorf("Marshal missing category field: %s", s)
		}
	})

	t.Run("unmarshal_from_valid_json", func(t *testing.T) {
		raw := `{"base64":"xyz","category":"thermal","label":"Suhu Panel"}`
		var p ATSPhotoInput
		if err := json.Unmarshal([]byte(raw), &p); err != nil {
			t.Fatalf("Unmarshal failed: %v", err)
		}
		if p.Base64 != "xyz" || p.Category != "thermal" || p.Label != "Suhu Panel" {
			t.Errorf("Unmarshal got %+v", p)
		}
	})

	t.Run("empty_fields_produce_empty_strings", func(t *testing.T) {
		var p ATSPhotoInput
		data, _ := json.Marshal(p)
		s := string(data)
		if !strings.Contains(s, `"base64":""`) {
			t.Errorf("Empty base64 not marshaled correctly: %s", s)
		}
	})

	t.Run("special_chars_in_label", func(t *testing.T) {
		p := ATSPhotoInput{Label: `Measurement R-S "voltage" & current`}
		data, err := json.Marshal(p)
		if err != nil {
			t.Fatalf("Marshal special chars failed: %v", err)
		}
		var decoded ATSPhotoInput
		if err := json.Unmarshal(data, &decoded); err != nil {
			t.Fatalf("Unmarshal special chars failed: %v", err)
		}
		if decoded.Label != p.Label {
			t.Errorf("Label mismatch: got %q, want %q", decoded.Label, p.Label)
		}
	})

	t.Run("unicode_in_label", func(t *testing.T) {
		p := ATSPhotoInput{Label: "Suhu Terminal R → 32.5°C"}
		data, err := json.Marshal(p)
		if err != nil {
			t.Fatalf("Marshal unicode failed: %v", err)
		}
		var decoded ATSPhotoInput
		json.Unmarshal(data, &decoded)
		if decoded.Label != p.Label {
			t.Errorf("Unicode label mismatch: got %q, want %q", decoded.Label, p.Label)
		}
	})
}

func TestATSAnalyzeRequest(t *testing.T) {
	t.Run("unmarshal_single_photo", func(t *testing.T) {
		raw := `{"photos":[{"base64":"data","category":"grounding","label":"test"}]}`
		var req ATSAnalyzeRequest
		if err := json.Unmarshal([]byte(raw), &req); err != nil {
			t.Fatalf("Unmarshal failed: %v", err)
		}
		if len(req.Photos) != 1 {
			t.Errorf("Expected 1 photo, got %d", len(req.Photos))
		}
	})

	t.Run("unmarshal_multiple_photos", func(t *testing.T) {
		raw := `{"photos":[
			{"base64":"a","category":"grounding","label":"g1"},
			{"base64":"b","category":"thermal","label":"t1"},
			{"base64":"c","category":"power_meter","label":"p1"}
		]}`
		var req ATSAnalyzeRequest
		if err := json.Unmarshal([]byte(raw), &req); err != nil {
			t.Fatalf("Unmarshal failed: %v", err)
		}
		if len(req.Photos) != 3 {
			t.Errorf("Expected 3 photos, got %d", len(req.Photos))
		}
	})
}

func TestVisualInspectionItem(t *testing.T) {
	t.Run("roundtrip_marshal_unmarshal", func(t *testing.T) {
		item := VisualInspectionItem{
			No: "a", Activity: "Check panel", Parameter: "Good Condition",
			Condition: "Good", Remarks: "",
		}
		data, _ := json.Marshal(item)
		var decoded VisualInspectionItem
		json.Unmarshal(data, &decoded)
		if decoded.Condition != "Good" || decoded.No != "a" {
			t.Errorf("Roundtrip failed: %+v", decoded)
		}
	})

	t.Run("condition_not_good", func(t *testing.T) {
		raw := `{"no":"e","activity":"test","parameter":"p","condition":"Not Good","remarks":"Corrosion found"}`
		var item VisualInspectionItem
		json.Unmarshal([]byte(raw), &item)
		if item.Condition != "Not Good" || item.Remarks != "Corrosion found" {
			t.Errorf("Not Good condition: %+v", item)
		}
	})
}

func TestPowerMeterData(t *testing.T) {
	t.Run("marshal_with_values", func(t *testing.T) {
		pm := PowerMeterData{
			RS: PowerMeterRow{Voltage: "390.1", Remarks: ""},
			ST: PowerMeterRow{Voltage: "391.2", Remarks: ""},
			KW: "12.5", KVA: "15.0",
		}
		data, err := json.Marshal(pm)
		if err != nil {
			t.Fatalf("Marshal failed: %v", err)
		}
		s := string(data)
		if !strings.Contains(s, `"390.1"`) || !strings.Contains(s, `"391.2"`) {
			t.Errorf("Voltage values missing: %s", s)
		}
	})

	t.Run("unmarshal_empty_values", func(t *testing.T) {
		raw := `{"rs":{"voltage":"","remarks":""},"st":{"voltage":"","remarks":""},"tr":{"voltage":"","remarks":""},"rn":{"voltage":"","remarks":""},"sn":{"voltage":"","remarks":""},"tn":{"voltage":"","remarks":""},"n":{"voltage":"","remarks":""},"kw":"","kva":"","kvar":"","cos_p":"","r_ampere":"","s_ampere":"","t_ampere":"","n_ampere":""}`
		var pm PowerMeterData
		if err := json.Unmarshal([]byte(raw), &pm); err != nil {
			t.Fatalf("Unmarshal empty failed: %v", err)
		}
		if pm.RS.Voltage != "" {
			t.Errorf("Expected empty voltage, got %q", pm.RS.Voltage)
		}
	})
}

func TestThermalData(t *testing.T) {
	t.Run("marshal_unmarshal", func(t *testing.T) {
		td := ThermalData{ResultTemperature: "32.5", Standard: "40°C", Remarks: "Normal"}
		data, _ := json.Marshal(td)
		var decoded ThermalData
		json.Unmarshal(data, &decoded)
		if decoded.ResultTemperature != "32.5" || decoded.Standard != "40°C" {
			t.Errorf("ThermalData roundtrip: %+v", decoded)
		}
	})
}

func TestGroundingData(t *testing.T) {
	t.Run("marshal_unmarshal", func(t *testing.T) {
		gd := GroundingData{ResultOhm: "0.34", Standard: "<5 Ω", Remarks: "Within standard"}
		data, _ := json.Marshal(gd)
		var decoded GroundingData
		json.Unmarshal(data, &decoded)
		if decoded.ResultOhm != "0.34" || decoded.Standard != "<5 Ω" {
			t.Errorf("GroundingData roundtrip: %+v", decoded)
		}
	})
}

func TestOperationStatusData(t *testing.T) {
	t.Run("is_normal_true", func(t *testing.T) {
		raw := `{"is_normal":true,"remark":"","fault_symptom":"","fault_analysis":"","work_done":"","fault_part_sn":"","fault_part_name":""}`
		var os OperationStatusData
		json.Unmarshal([]byte(raw), &os)
		if !os.IsNormal {
			t.Error("Expected is_normal=true")
		}
	})

	t.Run("is_normal_false_with_fault", func(t *testing.T) {
		raw := `{"is_normal":false,"remark":"Anomaly detected","fault_symptom":"High temperature","fault_analysis":"Loose connection","work_done":"Retightened","fault_part_sn":"","fault_part_name":""}`
		var os OperationStatusData
		json.Unmarshal([]byte(raw), &os)
		if os.IsNormal {
			t.Error("Expected is_normal=false")
		}
		if os.FaultSymptom != "High temperature" {
			t.Errorf("FaultSymptom = %q", os.FaultSymptom)
		}
	})
}

func TestATSReportData(t *testing.T) {
	t.Run("full_roundtrip", func(t *testing.T) {
		report := ATSReportData{
			VisualInspection: []VisualInspectionItem{
				{No: "a", Activity: "Check", Parameter: "Good", Condition: "Good", Remarks: ""},
			},
			PowerMeterRecording: PowerMeterData{RS: PowerMeterRow{Voltage: "390"}},
			VoltageCurrent:      VoltageCurrentData{VoltageRS: "390.1"},
			ThermalMeasurement:  ThermalData{ResultTemperature: "28.5"},
			GroundingResistance: GroundingData{ResultOhm: "0.34"},
			OperationStatus:     OperationStatusData{IsNormal: true},
		}
		data, err := json.Marshal(report)
		if err != nil {
			t.Fatalf("Marshal failed: %v", err)
		}
		var decoded ATSReportData
		if err := json.Unmarshal(data, &decoded); err != nil {
			t.Fatalf("Unmarshal failed: %v", err)
		}
		if decoded.GroundingResistance.ResultOhm != "0.34" {
			t.Errorf("Grounding mismatch: %s", decoded.GroundingResistance.ResultOhm)
		}
		if decoded.VoltageCurrent.VoltageRS != "390.1" {
			t.Errorf("Voltage mismatch: %s", decoded.VoltageCurrent.VoltageRS)
		}
	})

	t.Run("ignores_extra_fields", func(t *testing.T) {
		raw := `{"visual_inspection":[],"power_meter_recording":{},"voltage_current":{},"thermal_measurement":{},"grounding_resistance":{},"operation_status":{},"extra_field":"should_be_ignored"}`
		var report ATSReportData
		err := json.Unmarshal([]byte(raw), &report)
		if err != nil {
			t.Fatalf("Should ignore extra fields: %v", err)
		}
	})

	t.Run("empty_nested_objects", func(t *testing.T) {
		raw := `{"visual_inspection":[],"power_meter_recording":{"rs":{"voltage":"","remarks":""},"st":{"voltage":"","remarks":""},"tr":{"voltage":"","remarks":""},"rn":{"voltage":"","remarks":""},"sn":{"voltage":"","remarks":""},"tn":{"voltage":"","remarks":""},"n":{"voltage":"","remarks":""},"kw":"","kva":"","kvar":"","cos_p":"","r_ampere":"","s_ampere":"","t_ampere":"","n_ampere":""},"voltage_current":{"voltage_rs":"","voltage_st":"","voltage_tr":"","voltage_rn":"","voltage_sn":"","voltage_tn":"","voltage_ng":"","ampere_r":"","ampere_s":"","ampere_t":"","remarks":""},"thermal_measurement":{"result_temperature":"","standard":"","remarks":""},"grounding_resistance":{"result_ohm":"","standard":"","remarks":""},"operation_status":{"is_normal":false,"remark":"","fault_symptom":"","fault_analysis":"","work_done":"","fault_part_sn":"","fault_part_name":""}}`
		var report ATSReportData
		if err := json.Unmarshal([]byte(raw), &report); err != nil {
			t.Fatalf("Empty nested unmarshal failed: %v", err)
		}
	})
}
