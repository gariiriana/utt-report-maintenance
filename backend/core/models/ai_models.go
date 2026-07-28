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

// ─── AI Service Report FCU (Fan Coil Unit) ──────────────────────────────────

// FCUPhotoInput represents a single photo input for FCU AI analysis.
type FCUPhotoInput struct {
	Base64    string `json:"base64"`    // base64-encoded image data
	Category  string `json:"category"`  // "visual_inspection", "cleaning", "measurement", "analysis"
	Label     string `json:"label"`     // label/description from engineer
	Parameter string `json:"parameter"` // user-provided parameter value
}

// FCUAnalyzeRequest is the HTTP request body for AI FCU report generation.
type FCUAnalyzeRequest struct {
	Photos     []FCUPhotoInput `json:"photos"`
	ReportData *FCUReportData  `json:"report_data,omitempty"`
}

// FCUInspectionItem represents one row in Visual Inspection or Cleaning table.
type FCUInspectionItem struct {
	No        string `json:"no"`        // "a", "b", "c", ...
	Activity  string `json:"activity"`  // Description of activity
	Parameter string `json:"parameter"` // Expected parameter / value
	Condition string `json:"condition"` // "Good" or "Not good"
	Remarks   string `json:"remarks"`   // Additional remarks
}

// FCUVoltageCurrentData holds Voltage & Current Measurement values for FCU.
type FCUVoltageCurrentData struct {
	VoltageRN string `json:"voltage_rn"`
	VoltageSN string `json:"voltage_sn"`
	VoltageTN string `json:"voltage_tn"`
	VoltageRS string `json:"voltage_rs"`
	VoltageST string `json:"voltage_st"`
	VoltageTR string `json:"voltage_tr"`
	CurrentR  string `json:"current_r"`
	CurrentS  string `json:"current_s"`
	CurrentT  string `json:"current_t"`
	Condition string `json:"condition"` // "Good" or "Not good"
	Remarks   string `json:"remarks"`
}

// FCUVibrationNoiseData holds Vibration & Noise Measurement values.
type FCUVibrationNoiseData struct {
	Vibration string `json:"vibration"` // Standard <= 2.5
	Noise     string `json:"noise"`     // Standard <= 65 dB
	Condition string `json:"condition"` // "Good" or "Not good"
	Remarks   string `json:"remarks"`
}

// FCUTempHumidityData holds Temperature & Humidity Measurement values.
type FCUTempHumidityData struct {
	Temp      string `json:"temp"`      // Standard <= +-25°C
	RH        string `json:"rh"`        // Standard <= +-60%
	Condition string `json:"condition"` // "Good" or "Not good"
	Remarks   string `json:"remarks"`
}

// FCUPipePressureData holds Supply & Return Pipe Pressure Measurement values.
type FCUPipePressureData struct {
	Supply    string `json:"supply"`     // Standard 2.5 - 4 Bar
	ReturnVal string `json:"return_val"` // Standard 2.5 - 4 Bar
	Condition string `json:"condition"`  // "Good" or "Not good"
	Remarks   string `json:"remarks"`
}

// FCUAirFlowData holds Output Air Flow Measurement values.
type FCUAirFlowData struct {
	AirFlow   string `json:"air_flow"`  // Standard 2.0 - 8.0 m/s
	Condition string `json:"condition"` // "Good" or "Not good"
	Remarks   string `json:"remarks"`
}

// FCUOperationStatusData holds Normal/Abnormal operation info for FCU.
type FCUOperationStatusData struct {
	IsNormal      bool   `json:"is_normal"`
	Remark        string `json:"remark"`
	FaultSymptom  string `json:"fault_symptom"`
	FaultAnalysis string `json:"fault_analysis"`
	WorkDone      string `json:"work_done"`
	FaultPartSN   string `json:"fault_part_sn"`
	FaultPartName string `json:"fault_part_name"`
}

// FCUReportData is the full structured AI-generated FCU service report.
type FCUReportData struct {
	VisualInspection []FCUInspectionItem    `json:"visual_inspection"`
	Cleaning         []FCUInspectionItem    `json:"cleaning"`
	VoltageCurrent   FCUVoltageCurrentData  `json:"voltage_current"`
	VibrationNoise   FCUVibrationNoiseData  `json:"vibration_noise"`
	TempHumidity     FCUTempHumidityData    `json:"temp_humidity"`
	PipePressure     FCUPipePressureData    `json:"pipe_pressure"`
	AirFlow          FCUAirFlowData         `json:"air_flow"`
	OperationStatus  FCUOperationStatusData `json:"operation_status"`
}

// PJUPhotoInput represents a single uploaded photo with description for PJU AI analysis.
type PJUPhotoInput struct {
	Base64    string `json:"base64"`
	Category  string `json:"category,omitempty"`
	Label     string `json:"label"`
	Parameter string `json:"parameter,omitempty"`
}

// PJUAnalyzeRequest is the request body for POST /api/ai/pju-report.
type PJUAnalyzeRequest struct {
	Photos     []PJUPhotoInput `json:"photos"`
	ReportData *PJUReportData  `json:"report_data,omitempty"`
}

// PJUInspectionItem represents a row in Visual Inspection or Cleaning table for PJU.
type PJUInspectionItem struct {
	No        string `json:"no"`
	Activity  string `json:"activity"`
	Parameter string `json:"parameter"`
	Condition string `json:"condition"` // "Good", "Not Good", or "Not Applied"
	Remarks   string `json:"remarks"`
}

// PJUMeasurementItem represents a row in Measurement table for PJU.
type PJUMeasurementItem struct {
	No        string `json:"no"`
	Activity  string `json:"activity"`
	Parameter string `json:"parameter"`
	Condition string `json:"condition"` // "Good" or "Not Good"
	Remarks   string `json:"remarks"`
}

// PJUTestItem represents a row in Test table for PJU.
type PJUTestItem struct {
	No        string `json:"no"`
	Activity  string `json:"activity"`
	Parameter string `json:"parameter"`
	Condition string `json:"condition"` // "Good" or "Not Good"
	Remarks   string `json:"remarks"`
}

// PJUOperationStatusData holds Normal/Abnormal operation info for PJU.
type PJUOperationStatusData struct {
	IsNormal      bool   `json:"is_normal"`
	Remark        string `json:"remark"`
	FaultSymptom  string `json:"fault_symptom"`
	FaultAnalysis string `json:"fault_analysis"`
	WorkDone      string `json:"work_done"`
	FaultPartSN   string `json:"fault_part_sn"`
	FaultPartName string `json:"fault_part_name"`
}

// PJUReportData is the full structured AI-generated PJU service report.
type PJUReportData struct {
	VisualInspection []PJUInspectionItem    `json:"visual_inspection"`
	Cleaning         []PJUInspectionItem    `json:"cleaning"`
	Measurement      []PJUMeasurementItem   `json:"measurement"`
	Test             []PJUTestItem          `json:"test"`
	OperationStatus  PJUOperationStatusData `json:"operation_status"`
}

// PDUPhotoInput represents a single photo metadata item for PDU Service Report.
type PDUPhotoInput struct {
	Category  string `json:"category"`
	Label     string `json:"label"`
	Parameter string `json:"parameter"`
}

// PDUAnalyzeRequest represents request payload for PDU analysis.
type PDUAnalyzeRequest struct {
	Photos       []PDUPhotoInput `json:"photos"`
	ExistingData *PDUReportData  `json:"existing_data,omitempty"`
}

type PDUInspectionItem struct {
	No        int    `json:"no"`
	Activity  string `json:"activity"`
	Parameter string `json:"parameter"`
	Condition string `json:"condition"` // "Good", "Not Good"
	Remarks   string `json:"remarks"`
}

type PDUCleaningItem struct {
	No        int    `json:"no"`
	Activity  string `json:"activity"`
	Parameter string `json:"parameter"`
	Condition string `json:"condition"`
	Remarks   string `json:"remarks"`
}

type PDUDPMRecording struct {
	RAmpere   string `json:"r_ampere"`
	SAmpere   string `json:"s_ampere"`
	TAmpere   string `json:"t_ampere"`
	NAmpere   string `json:"n_ampere"`
	KW        string `json:"kw"`
	KVA       string `json:"kva"`
	KVAR      string `json:"kvar"`
	CosP      string `json:"cos_p"`
	VoltageRS string `json:"voltage_rs"`
	VoltageST string `json:"voltage_st"`
	VoltageTR string `json:"voltage_tr"`
	VoltageRN string `json:"voltage_rn"`
	VoltageSN string `json:"voltage_sn"`
	VoltageTN string `json:"voltage_tn"`
	VoltageNG string `json:"voltage_ng"`
	Remarks   string `json:"remarks"`
}

type PDUISOTransTemp struct {
	RTemp    string `json:"r_temp"`
	STemp    string `json:"s_temp"`
	TTemp    string `json:"t_temp"`
	Standard string `json:"standard"`
	Remarks  string `json:"remarks"`
}

type PDUVoltageAmpere struct {
	VoltageRS string `json:"voltage_rs"`
	VoltageST string `json:"voltage_st"`
	VoltageTR string `json:"voltage_tr"`
	VoltageRN string `json:"voltage_rn"`
	VoltageSN string `json:"voltage_sn"`
	VoltageTN string `json:"voltage_tn"`
	VoltageNG string `json:"voltage_ng"`
	CurrentR  string `json:"current_r"`
	CurrentS  string `json:"current_s"`
	CurrentT  string `json:"current_t"`
	CurrentN  string `json:"current_n"`
	Remarks   string `json:"remarks"`
}

type PDUThermalItem struct {
	Breaker    string `json:"breaker"`
	ResultTemp string `json:"result_temp"`
	Standard   string `json:"standard"`
	Remarks    string `json:"remarks"`
}

type PDUGroundingItem struct {
	Wire     string `json:"wire"`
	Result   string `json:"result"`
	Standard string `json:"standard"`
	Remarks  string `json:"remarks"`
}

type PDUNoiseItem struct {
	Measurement string `json:"measurement"`
	Result      string `json:"result"`
	Standard    string `json:"standard"`
	Remarks     string `json:"remarks"`
}

type PDUAnalysisRemark struct {
	IsNormal      bool   `json:"is_normal"`
	IsAbnormal    bool   `json:"is_abnormal"`
	RemarkText    string `json:"remark_text"`
	FaultSymptom  string `json:"fault_symptom"`
	FaultAnalysis string `json:"fault_analysis"`
	WorkDone      string `json:"work_done"`
	FaultPartSN   string `json:"fault_part_sn"`
	FaultPartName string `json:"fault_part_name"`
}

type PDUReportData struct {
	InspectionChecking  []PDUInspectionItem `json:"inspection_checking"`
	Cleaning            []PDUCleaningItem   `json:"cleaning"`
	DPMRecording        PDUDPMRecording     `json:"dpm_recording"`
	ISOTransTemp        PDUISOTransTemp     `json:"iso_trans_temp"`
	VoltageAmpere       PDUVoltageAmpere    `json:"voltage_ampere"`
	ThermalMeasurement PDUThermalItem      `json:"thermal_measurement"`
	GroundingResistance PDUGroundingItem    `json:"grounding_resistance"`
	NoiseMeasurement    PDUNoiseItem        `json:"noise_measurement"`
	AnalysisRemark      PDUAnalysisRemark   `json:"analysis_remark"`
}

// ─── AI Service Report CT (Cooling Tower) ───────────────────────────────────

type CTPhotoInput struct {
	Base64    string `json:"base64"`
	Category  string `json:"category"`
	Label     string `json:"label"`
	Parameter string `json:"parameter"`
}

type CTAnalyzeRequest struct {
	Photos       []CTPhotoInput `json:"photos"`
	ExistingData any            `json:"existing_data,omitempty"`
}

// ─── AI Service Report Generator (Genset) ───────────────────────────────────

type GeneratorPhotoInput struct {
	Base64    string `json:"base64"`
	Category  string `json:"category"`
	Label     string `json:"label"`
	Parameter string `json:"parameter"`
}

type GeneratorAnalyzeRequest struct {
	Photos       []GeneratorPhotoInput `json:"photos"`
	ExistingData any                   `json:"existing_data,omitempty"`
}

// ─── AI Service Report Trafo (Transformator) ─────────────────────────────

type TrafoPhotoInput struct {
	Base64    string `json:"base64"`
	Category  string `json:"category"`
	Label     string `json:"label"`
	Parameter string `json:"parameter"`
}

type TrafoAnalyzeRequest struct {
	Photos       []TrafoPhotoInput `json:"photos"`
	ExistingData any               `json:"existing_data,omitempty"`
}

// ─── AI Service Report AC Split Wall ─────────────────────────────────────

type ACSplitPhotoInput struct {
	Base64    string `json:"base64"`
	Category  string `json:"category"`
	Label     string `json:"label"`
	Parameter string `json:"parameter"`
}

type ACSplitAnalyzeRequest struct {
	Photos       []ACSplitPhotoInput `json:"photos"`
	ExistingData any                 `json:"existing_data,omitempty"`
}

// ─── AI Service Report Panel Busduct ─────────────────────────────────────

type BusductPhotoInput struct {
	Base64    string `json:"base64"`
	Category  string `json:"category"`
	Label     string `json:"label"`
	Parameter string `json:"parameter"`
}

type BusductAnalyzeRequest struct {
	Photos       []BusductPhotoInput `json:"photos"`
	ExistingData any                 `json:"existing_data,omitempty"`
}

// ─── AI Service Report Dock Leveler ─────────────────────────────────────

type DocklevelerPhotoInput struct {
	Base64    string `json:"base64"`
	Category  string `json:"category"`
	Label     string `json:"label"`
	Parameter string `json:"parameter"`
}

type DocklevelerAnalyzeRequest struct {
	Photos       []DocklevelerPhotoInput `json:"photos"`
	ExistingData any                     `json:"existing_data,omitempty"`
}

// ─── AI Service Report Door ─────────────────────────────────────────────

type DoorPhotoInput struct {
	Base64    string `json:"base64"`
	Category  string `json:"category"`
	Label     string `json:"label"`
	Parameter string `json:"parameter"`
}

type DoorAnalyzeRequest struct {
	Photos       []DoorPhotoInput `json:"photos"`
	ExistingData any              `json:"existing_data,omitempty"`
}

type CapacitorbankPhotoInput struct {
	Base64 string `json:"base64"`
	Label  string `json:"label"`
}

type CapacitorbankAnalyzeRequest struct {
	Photos       []CapacitorbankPhotoInput `json:"photos"`
	ExistingData any                      `json:"existing_data,omitempty"`
}

type LdbrdbPhotoInput struct {
	Base64 string `json:"base64"`
	Label  string `json:"label"`
}

type LdbrdbAnalyzeRequest struct {
	Photos       []LdbrdbPhotoInput `json:"photos"`
	ExistingData any                `json:"existing_data,omitempty"`
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

