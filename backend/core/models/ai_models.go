package models

// ─── AI Service Report ATS ─────────────────────────────────────────────────

// ATSPhotoInput represents a single photo input for AI analysis.
type ATSPhotoInput struct {
	Base64    string `json:"base64"`    // base64-encoded image data (without data:image prefix)
	Category  string `json:"category"`  // "visual_inspection", "power_meter", "thermal", "grounding"
	Label     string `json:"label"`     // optional label/description from engineer
	Parameter string `json:"parameter"` // optional user-provided parameter value
}

// ATSAnalyzeRequest is the HTTP request body for AI ATS report generation.
type ATSAnalyzeRequest struct {
	Photos     []ATSPhotoInput `json:"photos"`
	ReportData *ATSReportData  `json:"report_data,omitempty"`
}

// ATSReportData is the full structured AI-generated service report.
type ATSReportData struct {
	VisualInspection    []VisualInspectionItem `json:"visual_inspection"`
	PowerMeterRecording PowerMeterData         `json:"power_meter_recording"`
	VoltageCurrent      VoltageCurrentData     `json:"voltage_current"`
	ThermalMeasurement  ThermalData            `json:"thermal_measurement"`
	GroundingResistance GroundingData          `json:"grounding_resistance"`
	OperationStatus     OperationStatusData    `json:"operation_status"`
}

// VisualInspectionItem represents one row in the Visual Inspection & Check table.
type VisualInspectionItem struct {
	No        string `json:"no"`        // "a", "b", "c", ...
	Activity  string `json:"activity"`  // Description of the inspection activity
	Parameter string `json:"parameter"` // What was observed
	Condition string `json:"condition"` // "Good" or "Not Good"
	Remarks   string `json:"remarks"`   // Additional remarks
}

// PowerMeterData holds Digital Power Meter Recording values.
type PowerMeterData struct {
	RS   PowerMeterRow `json:"rs"`
	ST   PowerMeterRow `json:"st"`
	TR   PowerMeterRow `json:"tr"`
	RN   PowerMeterRow `json:"rn"`
	SN   PowerMeterRow `json:"sn"`
	TN   PowerMeterRow `json:"tn"`
	N    PowerMeterRow `json:"n"`
	KW   string        `json:"kw"`
	KVA  string        `json:"kva"`
	KVAR string        `json:"kvar"`
	CosP string        `json:"cos_p"`
	R    string        `json:"r_ampere"`
	S    string        `json:"s_ampere"`
	T    string        `json:"t_ampere"`
	N2   string        `json:"n_ampere"`
}

// PowerMeterRow holds voltage result for a specific wire pair.
type PowerMeterRow struct {
	Voltage string `json:"voltage"`
	Remarks string `json:"remarks"`
}

// VoltageCurrentData holds Voltage & Current Measurement values.
type VoltageCurrentData struct {
	VoltageRS string `json:"voltage_rs"`
	VoltageST string `json:"voltage_st"`
	VoltageTR string `json:"voltage_tr"`
	VoltageRN string `json:"voltage_rn"`
	VoltageSN string `json:"voltage_sn"`
	VoltageTN string `json:"voltage_tn"`
	VoltageNG string `json:"voltage_ng"`
	AmpereR   string `json:"ampere_r"`
	AmpereS   string `json:"ampere_s"`
	AmpereT   string `json:"ampere_t"`
	Remarks   string `json:"remarks"`
}

// ThermalData holds Thermal Measurement values.
type ThermalData struct {
	ResultTemperature string `json:"result_temperature"` // °C
	Standard          string `json:"standard"`           // "40°C"
	Remarks           string `json:"remarks"`
}

// GroundingData holds Grounding Resistance Measurement values.
type GroundingData struct {
	ResultOhm string `json:"result_ohm"` // Ω
	Standard  string `json:"standard"`   // "<5 Ω"
	Remarks   string `json:"remarks"`
}

// OperationStatusData holds Normal/Abnormal operation info.
type OperationStatusData struct {
	IsNormal      bool   `json:"is_normal"`
	Remark        string `json:"remark"`
	FaultSymptom  string `json:"fault_symptom"`
	FaultAnalysis string `json:"fault_analysis"`
	WorkDone      string `json:"work_done"`
	FaultPartSN   string `json:"fault_part_sn"`
	FaultPartName string `json:"fault_part_name"`
}

// ChatMessage represents a single message in a chat history.
type ChatMessage struct {
	Role        string `json:"role"`    // "system", "user", "assistant"
	Content     string `json:"content"`
	ImageBase64 string `json:"image_base64,omitempty"`
}

// AIChatRequest represents the body of the AI chat room API request.
type AIChatRequest struct {
	
	Messages []ChatMessage `json:"messages"`
}
