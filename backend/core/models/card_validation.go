package models

// CardAnalyzeRequest represents the input to analyze a single documentation card photo.
type CardAnalyzeRequest struct {
	PhotoBase64 string `json:"photo_base64"` // base64-encoded image data (without data:image prefix)
	Description string `json:"description"`  // e.g. "grounding measurement", "DPM voltage"
	Category    string `json:"category"`     // "grounding", "thermal", "power_meter", "visual_inspection"
}

// CardAnalyzeResponse is the output returned by the card analyzer.
type CardAnalyzeResponse struct {
	Parameter string `json:"parameter"` // the extracted parameter value (e.g. "0.35 Ohm", "45.2 C")
}
