package services

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strings"
	"sync/atomic"
	"time"

	"github.com/gariiriana/utt-report-maintenance/backend/core/config"
	"github.com/gariiriana/utt-report-maintenance/backend/core/models"
)

// IAIService defines the contract for AI analysis operations.
type IAIService interface {
	AnalyzeATSPhotos(ctx context.Context, photos []models.ATSPhotoInput, existingData *models.ATSReportData) (*models.ATSReportData, error)
	Chat(ctx context.Context, messages []models.ChatMessage) (string, error)
}

// ─── AI AGENT SERVICE ────────────────────────────────────────────────────────

type aiService struct {
	apiKeys        []string // Pool of API keys for round-robin
	keyIndex       uint64   // Atomic counter for round-robin
	baseURL        string
	visionModel    string // Stage 2: multimodal vision model
	reasoningModel string // Stage 3: text-only reasoning model
}

// NewAIService creates a new AI service with multi-key and multi-model support.
func NewAIService() IAIService {
	svc := &aiService{
		baseURL:        config.EnvString("NVIDIA_NIM_BASE_URL", "https://integrate.api.nvidia.com/v1/chat/completions"),
		visionModel:    config.EnvString("NVIDIA_NIM_VISION_MODEL", config.EnvString("NVIDIA_NIM_MODEL", "moonshotai/kimi-k2.6")),
		reasoningModel: config.EnvString("NVIDIA_NIM_REASONING_MODEL", config.EnvString("NVIDIA_NIM_MODEL", "z-ai/glm-5.1")),
	}

	// Load API keys: prefer multi-key pool, fallback to single key
	multiKeys := config.EnvString("NVIDIA_NIM_API_KEYS", "")
	if multiKeys != "" {
		for _, k := range strings.Split(multiKeys, ",") {
			k = strings.TrimSpace(k)
			if k != "" {
				svc.apiKeys = append(svc.apiKeys, k)
			}
		}
	}
	if len(svc.apiKeys) == 0 {
		singleKey := config.EnvString("NVIDIA_NIM_API_KEY", "")
		if singleKey != "" {
			svc.apiKeys = []string{singleKey}
		}
	}

	slog.Info("AI Agent pipeline initialized",
		slog.Int("api_keys", len(svc.apiKeys)),
		slog.String("vision_model", svc.visionModel),
		slog.String("reasoning_model", svc.reasoningModel),
	)

	return svc
}

// getNextAPIKey returns the next API key in round-robin fashion.
func (s *aiService) getNextAPIKey() string {
	if len(s.apiKeys) == 0 {
		return ""
	}
	idx := atomic.AddUint64(&s.keyIndex, 1)
	return s.apiKeys[idx%uint64(len(s.apiKeys))]
}

// ═══════════════════════════════════════════════════════════════════════════════
// PIPELINE ORCHESTRATOR
// ═══════════════════════════════════════════════════════════════════════════════

// AnalyzeATSPhotos implements the optimized text-based AI Agent pipeline.
func (s *aiService) AnalyzeATSPhotos(ctx context.Context, photos []models.ATSPhotoInput, existingData *models.ATSReportData) (*models.ATSReportData, error) {
	if len(s.apiKeys) == 0 {
		return nil, fmt.Errorf("no NVIDIA NIM API keys configured (set NVIDIA_NIM_API_KEYS or NVIDIA_NIM_API_KEY)")
	}

	pipelineStart := time.Now()
	slog.Info("AGENT Pipeline started (Text-based parameters)",
		slog.Int("total_photos", len(photos)),
		slog.Int("api_keys", len(s.apiKeys)),
	)

	// Format all engineer descriptions and parameters
	var sb strings.Builder
	for idx, p := range photos {
		sb.WriteString(fmt.Sprintf("Item %d:\n", idx+1))
		sb.WriteString(fmt.Sprintf("- Category: %s\n", p.Category))
		sb.WriteString(fmt.Sprintf("- Description/Label: %s\n", p.Label))
		sb.WriteString(fmt.Sprintf("- Parameter Value/Catatan: %s\n\n", p.Parameter))
	}
	itemsText := sb.String()

	var existingDataText string
	if existingData != nil {
		dataBytes, _ := json.MarshalIndent(existingData, "", "  ")
		existingDataText = fmt.Sprintf("\nEXISTING MEASUREMENT DATA (DO NOT OVERWRITE OR MUTATE THESE MEASUREMENT VALUES, ONLY POPULATE/IMPROVE REMARKS IN INDONESIAN):\n%s\n", string(dataBytes))
	}

	prompt := fmt.Sprintf(`You are a precision consolidation AI agent for electrical maintenance reports.
We have a list of items where the maintenance engineer has already written down the parameter values and notes.
%s
Your ONLY job is to compile a complete, structured JSON report matching the schema below.
For each item:
1. Parse the parameter values provided by the engineer and assign them to the correct fields in the schema.
2. Generate professional, precise, and contextual REMARKS (in Indonesian) for each field/item:
   - For grounding: set grounding_resistance.result_ohm. If it is < 5 ohm, write a remark like "Nilai tahanan grounding memenuhi standar (< 5 Ohm)". If >= 5 ohm, write a warning.
   - For thermal: set thermal_measurement.result_temperature. If it is < 40°C, write a remark like "Suhu terminal normal dan aman". If >= 40°C, write a warning about a potential hotspot.
   - For power_meter: map voltages and currents to power_meter_recording AND voltage_current. Write remarks confirming they are balanced and within safe limits.
   - For visual_inspection: map the checklist items (a to p). Write remarks based on the description and parameter condition (e.g., "Kondisi fisik bersih dan terawat"). Ensure all 16 items (a to p) are present in the final list with their exact activity names.
3. Set operation_status.is_normal = true unless there is an anomaly (e.g. grounding >= 5 ohm, temperature >= 40°C, or a visual item condition is "Not Good").
4. Output ONLY valid JSON matching the exact schema below. Do not output markdown code fences, do not output explanations, just the JSON.

ENGINEER'S LOGS AND VALUES:
%s

OUTPUT JSON STRUCTURE:
{
  "visual_inspection": [
    {"no": "a", "activity": "Inspection unsafe action and unsafe condition before start activity maintenance", "parameter": "Good Condition", "condition": "Good", "remarks": ""},
    {"no": "b", "activity": "Take a photo before action activity to indicate the initial condition of the equipment panel", "parameter": "Information before activity clear", "condition": "Good", "remarks": ""},
    {"no": "c", "activity": "Check cable grounding to act know voltage in body panel. Measurement current and resistance using claim earth. Ensure grounding good connection", "parameter": "Tight & Good connection", "condition": "Good", "remarks": ""},
    {"no": "d", "activity": "Inspection of support levelness used water pass to analysis positioning support panel", "parameter": "Horizontally aligned, not tilted", "condition": "Good", "remarks": ""},
    {"no": "e", "activity": "Check and inspection visual of panels for paint damage and signs of corrosion", "parameter": "No peeling, No fading & No cracking", "condition": "Good", "remarks": ""},
    {"no": "f", "activity": "Check function of enclosure (cover panel, doors, form covers, automatic shutters, screws, keys). Cleaning using vacuum cleaner", "parameter": "Physical condition intact, no cracks or dents", "condition": "Good", "remarks": ""},
    {"no": "g", "activity": "Inspection visual and check function of power meters/controller compare with actual measurement, ensure by visual termination good connection", "parameter": "the display is lit up and clearly legible.", "condition": "Good", "remarks": ""},
    {"no": "h", "activity": "Check lamp and indicator function by visual", "parameter": "Not loose, not burnt", "condition": "Good", "remarks": ""},
    {"no": "i", "activity": "Inspection of control wiring, relays, power supply units, timers, etc.", "parameter": "There are no chipped, burnt, or worn wires.", "condition": "Good", "remarks": ""},
    {"no": "j", "activity": "Inspection and check visual of auxiliary connections, ensure termination good connection using thermal imager", "parameter": "No looseness, no rust or corrosion.", "condition": "Good", "remarks": ""},
    {"no": "k", "activity": "Inspection electronic surge protection is installed, control circuit fuse rating, and continuity", "parameter": "No rust", "condition": "Good", "remarks": ""},
    {"no": "l", "activity": "Check condition connection cabel using thermal imager if the found anomali like a hot spot indeed connection.", "parameter": "No hotspots found, stable temperature, good connection", "condition": "Good", "remarks": ""},
    {"no": "m", "activity": "Cleaning panel ATS used vacuum cleaner and apply sanpoliy to finish it", "parameter": "Clean", "condition": "Good", "remarks": ""},
    {"no": "n", "activity": "Inspection visual busbar and isolators, make sure condition isolator from cracking, signs of heating with thermal imager. Cleaning using vacuum cleaner", "parameter": "No rust or oxidation on the surface.", "condition": "Good", "remarks": ""},
    {"no": "o", "activity": "Inspection visual of CT connections and make sure good connection no miss connection. Cleaning using vacuum cleaner", "parameter": "Good connection", "condition": "Good", "remarks": ""},
    {"no": "p", "activity": "Inspection visual from downstream power connections (connecting pads, cable mechanical strength)", "parameter": "Good connection", "condition": "Good", "remarks": ""}
  ],
  "power_meter_recording": {
    "rs": {"voltage": "", "remarks": ""},
    "st": {"voltage": "", "remarks": ""},
    "tr": {"voltage": "", "remarks": ""},
    "rn": {"voltage": "", "remarks": ""},
    "sn": {"voltage": "", "remarks": ""},
    "tn": {"voltage": "", "remarks": ""},
    "n":  {"voltage": "", "remarks": ""},
    "kw": "", "kva": "", "kvar": "", "cos_p": "",
    "r_ampere": "", "s_ampere": "", "t_ampere": "", "n_ampere": ""
  },
  "voltage_current": {
    "voltage_rs": "", "voltage_st": "", "voltage_tr": "",
    "voltage_rn": "", "voltage_sn": "", "voltage_tn": "", "voltage_ng": "",
    "ampere_r": "", "ampere_s": "", "ampere_t": "",
    "remarks": ""
  },
  "thermal_measurement": {
    "result_temperature": "", "standard": "40°C", "remarks": ""
  },
  "grounding_resistance": {
    "result_ohm": "", "standard": "<5 Ω", "remarks": ""
  },
  "operation_status": {
    "is_normal": true,
    "remark": "",
    "fault_symptom": "",
    "fault_analysis": "",
    "work_done": "",
    "fault_part_sn": "",
    "fault_part_name": ""
  }
}

RULES:
- Output ONLY the JSON object. No markdown code fences. No explanation text.
- If existing_data is provided, preserve all measurement values exactly as provided in existing_data. Do not alter voltages, currents, temperatures, grounding resistance, or visual inspection conditions. Only update or fill in the remarks fields using Indonesian.
- For visual_inspection: keep the exact activity texts shown above, only update condition and remarks based on data`, existingDataText, itemsText)

	messages := []map[string]interface{}{
		{
			"role":    "system",
			"content": "You are a precision data consolidation agent for electrical maintenance reports. Your job is to parse engineer logs, map parameters, and write Indonesian remarks into a validated JSON report. Output ONLY valid JSON, no markdown.",
		},
		{
			"role":    "user",
			"content": prompt,
		},
	}

	apiKey := s.getNextAPIKey()
	respContent, err := s.callNVIDIA(ctx, apiKey, s.reasoningModel, messages, 0.2, 16384, 90*time.Second, nil)
	if err != nil {
		return nil, fmt.Errorf("deepseek reasoning api call failed: %w", err)
	}

	reportData, err := s.parseJSONResponse(respContent)
	if err != nil {
		return nil, fmt.Errorf("failed to parse AI JSON response: %w", err)
	}

	slog.Info("AGENT Pipeline complete (Text-based parameter mode)",
		slog.Duration("total_duration", time.Since(pipelineStart)),
	)

	return reportData, nil
}

// ═══════════════════════════════════════════════════════════════════════════════
// STAGE 1: PARTITION
// ═══════════════════════════════════════════════════════════════════════════════

func (s *aiService) partitionPhotos(photos []models.ATSPhotoInput) map[string][]models.ATSPhotoInput {
	groups := map[string][]models.ATSPhotoInput{
		"grounding":         {},
		"thermal":           {},
		"power_meter":       {},
		"visual_inspection": {},
	}
	for _, p := range photos {
		cat := p.Category
		if _, ok := groups[cat]; !ok {
			cat = "visual_inspection" // fallback unknown categories
		}
		groups[cat] = append(groups[cat], p)
	}
	return groups
}

// ═══════════════════════════════════════════════════════════════════════════════
// STAGE 2: PER-CATEGORY VISION ANALYSIS
// ═══════════════════════════════════════════════════════════════════════════════

func (s *aiService) analyzeCategory(ctx context.Context, apiKey, category string, photos []models.ATSPhotoInput) (string, error) {
	// Build multimodal content array with images
	var content []map[string]interface{}

	// Category-specific focused prompt
	prompt := s.buildCategoryPrompt(category, photos)
	content = append(content, map[string]interface{}{
		"type": "text",
		"text": prompt,
	})

	// Attach each photo with its engineer label BEFORE the image
	for i, photo := range photos {
		mimeType := "image/jpeg"
		if strings.HasPrefix(photo.Base64, "iVBOR") {
			mimeType = "image/png"
		}
		imageURL := fmt.Sprintf("data:%s;base64,%s", mimeType, photo.Base64)

		label := photo.Label
		if label == "" {
			label = photo.Category
		}

		// Label text BEFORE image (multimodal best practice)
		content = append(content, map[string]interface{}{
			"type": "text",
			"text": fmt.Sprintf("--- PHOTO %d of %d ---\nEngineer Description: %s", i+1, len(photos), label),
		})
		content = append(content, map[string]interface{}{
			"type":      "image_url",
			"image_url": map[string]interface{}{"url": imageURL},
		})
	}

	messages := []map[string]interface{}{
		{
			"role":    "system",
			"content": s.buildCategorySystemPrompt(category),
		},
		{
			"role":    "user",
			"content": content,
		},
	}

	return s.callNVIDIA(ctx, apiKey, s.visionModel, messages, 0.0, 4096, 60*time.Second, nil)
}

// buildCategorySystemPrompt returns a hyper-focused system prompt per category.
func (s *aiService) buildCategorySystemPrompt(category string) string {
	switch category {
	case "grounding":
		return `You are a precision instrument display reader specializing in EARTH CLAMP TESTER / grounding meter readings.
Your ONLY job is to read the exact Ω (ohm) value from the LCD display of the grounding meter in the photo.
Rules:
- Read EVERY digit precisely, including decimal points
- If the engineer's description mentions a value (e.g. "0.34 ohm"), cross-verify with the photo
- NEVER guess or hallucinate values. If you see "0.34" on the display, output "0.34"
- Output ONLY valid JSON, no markdown, no explanation`

	case "thermal":
		return `You are a precision instrument display reader specializing in THERMAL IMAGER readings.
Your ONLY job is to read the exact temperature (°C) from the thermal camera display/photo.
Rules:
- Read the temperature value precisely, including decimal points
- Look for the MAIN temperature reading on the display (usually the largest number)
- If the engineer's description mentions a temperature, cross-verify with the photo
- NEVER guess or hallucinate values
- Output ONLY valid JSON, no markdown, no explanation`

	case "power_meter":
		return `You are a precision instrument display reader specializing in ELECTRICAL MEASUREMENT INSTRUMENTS.
Your ONLY job is to read exact voltage (V), current (A), power (kW/kVA/kVAR), and power factor values from clamp meters and digital power meters.
Rules:
- Read EVERY digit precisely, including decimal points
- For clamp meters (e.g. Fluke, Kyoritsu): read the LARGE MAIN DIGITS on the LCD
- For built-in digital power meters (DPM): read each displayed parameter value
- Match each photo's engineer description to determine which measurement it is (R-S, S-T, T-R, R-N, S-N, T-N, N-G, Ampere R/S/T)
- NEVER guess standard nominal values (like 398.5, 230.2). Read the ACTUAL digits shown
- If you see "390.1", write "390.1" — NOT "398.5" or any other value
- Output ONLY valid JSON, no markdown, no explanation`

	case "visual_inspection":
		return `You are an expert electrical engineer performing a visual inspection of an ATS (Automatic Transfer Switch) panel.
Your job is to assess the physical condition of panel components from photos.
Rules:
- Evaluate each inspection item based on what you see in the photos
- Set condition to "Good" if the component appears normal, or "Not Good" if issues are found
- Add specific observations in remarks if any issues are noted
- Output ONLY valid JSON, no markdown, no explanation`

	default:
		return "You are a precision instrument reader. Read exact values from instrument displays. Output ONLY valid JSON."
	}
}

// buildCategoryPrompt returns the focused user prompt with mini-schema per category.
func (s *aiService) buildCategoryPrompt(category string, photos []models.ATSPhotoInput) string {
	switch category {
	case "grounding":
		return fmt.Sprintf(`Analyze these %d grounding measurement photos. Read the EXACT ohm (Ω) value from each earth clamp tester display.

Respond with ONLY this JSON:
{
  "result_ohm": "<exact ohm value from display, e.g. 0.34>",
  "standard": "<5 Ω",
  "remarks": "<any observation>"
}`, len(photos))

	case "thermal":
		return fmt.Sprintf(`Analyze these %d thermal imager photos. Read the EXACT temperature (°C) from each thermal display.

If multiple thermal photos show different locations, report the HIGHEST temperature found.

Respond with ONLY this JSON:
{
  "result_temperature": "<highest temperature in °C, e.g. 32.1>",
  "standard": "40°C",
  "remarks": "<list all measured locations and their temperatures>"
}`, len(photos))

	case "power_meter":
		var descs []string
		for i, p := range photos {
			label := p.Label
			if label == "" {
				label = "Unknown measurement"
			}
			descs = append(descs, fmt.Sprintf("Photo %d: %s", i+1, label))
		}

		return fmt.Sprintf(`Analyze these %d electrical measurement photos. Each photo shows a clamp meter or digital power meter display.

The photos and their engineer descriptions:
%s

For each photo, read the EXACT number from the instrument LCD display. Match each reading to the correct field based on the engineer's description.

CRITICAL: Read the ACTUAL digits shown on each display. Do NOT substitute standard nominal values.

Respond with ONLY this JSON:
{
  "power_meter_recording": {
    "rs": {"voltage": "", "remarks": ""},
    "st": {"voltage": "", "remarks": ""},
    "tr": {"voltage": "", "remarks": ""},
    "rn": {"voltage": "", "remarks": ""},
    "sn": {"voltage": "", "remarks": ""},
    "tn": {"voltage": "", "remarks": ""},
    "n":  {"voltage": "", "remarks": ""},
    "kw": "",
    "kva": "",
    "kvar": "",
    "cos_p": "",
    "r_ampere": "",
    "s_ampere": "",
    "t_ampere": "",
    "n_ampere": ""
  },
  "voltage_current": {
    "voltage_rs": "",
    "voltage_st": "",
    "voltage_tr": "",
    "voltage_rn": "",
    "voltage_sn": "",
    "voltage_tn": "",
    "voltage_ng": "",
    "ampere_r": "",
    "ampere_s": "",
    "ampere_t": "",
    "remarks": ""
  }
}

Fill each field with the exact value read from the corresponding photo. Leave empty "" for measurements not photographed.`,
			len(photos), strings.Join(descs, "\n"))

	case "visual_inspection":
		return fmt.Sprintf(`Analyze these %d visual inspection photos of an ATS panel at Neutra DC Cikarang.

Assess each of these inspection items based on what you see:

a. Unsafe action/condition check
b. Initial condition documentation
c. Cable grounding connection check
d. Support levelness check
e. Paint damage & corrosion check
f. Enclosure function check
g. Power meters/controller visual check
h. Lamp and indicator function check
i. Control wiring/relays inspection
j. Auxiliary connections check
k. Surge protection & fuse inspection
l. Cable connection thermal check
m. Panel cleaning status
n. Busbar and isolator inspection
o. CT connections inspection
p. Downstream power connections

Respond with ONLY this JSON (array of inspection items):
[
  {"no": "a", "activity": "Inspection unsafe action and unsafe condition before start activity maintenance", "parameter": "Good Condition", "condition": "Good", "remarks": ""},
  {"no": "b", "activity": "Take a photo before action activity to indicate the initial condition of the equipment panel", "parameter": "Information before activity clear", "condition": "Good", "remarks": ""},
  {"no": "c", "activity": "Check cable grounding to act know voltage in body panel. Measurement current and resistance using claim earth. Ensure grounding good connection", "parameter": "Tight & Good connection", "condition": "Good", "remarks": ""},
  {"no": "d", "activity": "Inspection of support levelness used water pass to analysis positioning support panel", "parameter": "Horizontally aligned, not tilted", "condition": "Good", "remarks": ""},
  {"no": "e", "activity": "Check and inspection visual of panels for paint damage and signs of corrosion", "parameter": "No peeling, No fading & No cracking", "condition": "Good", "remarks": ""},
  {"no": "f", "activity": "Check function of enclosure (cover panel, doors, form covers, automatic shutters, screws, keys). Cleaning using vacuum cleaner", "parameter": "Physical condition intact, no cracks or dents", "condition": "Good", "remarks": ""},
  {"no": "g", "activity": "Inspection visual and check function of power meters/controller compare with actual measurement, ensure by visual termination good connection", "parameter": "the display is lit up and clearly legible.", "condition": "Good", "remarks": ""},
  {"no": "h", "activity": "Check lamp and indicator function by visual", "parameter": "Not loose, not burnt", "condition": "Good", "remarks": ""},
  {"no": "i", "activity": "Inspection of control wiring, relays, power supply units, timers, etc.", "parameter": "There are no chipped, burnt, or worn wires.", "condition": "Good", "remarks": ""},
  {"no": "j", "activity": "Inspection and check visual of auxiliary connections, ensure termination good connection using thermal imager", "parameter": "No looseness, no rust or corrosion.", "condition": "Good", "remarks": ""},
  {"no": "k", "activity": "Inspection electronic surge protection is installed, control circuit fuse rating, and continuity", "parameter": "No rust", "condition": "Good", "remarks": ""},
  {"no": "l", "activity": "Check condition connection cabel using thermal imager if the found anomali like a hot spot indeed connection.", "parameter": "No hotspots found, stable temperature, good connection", "condition": "Good", "remarks": ""},
  {"no": "m", "activity": "Cleaning panel ATS used vacuum cleaner and apply sanpoliy to finish it", "parameter": "Clean", "condition": "Good", "remarks": ""},
  {"no": "n", "activity": "Inspection visual busbar and isolators, make sure condition isolator from cracking, signs of heating with thermal imager. Cleaning using vacuum cleaner", "parameter": "No rust or oxidation on the surface.", "condition": "Good", "remarks": ""},
  {"no": "o", "activity": "Inspection visual of CT connections and make sure good connection no miss connection. Cleaning using vacuum cleaner", "parameter": "Good connection", "condition": "Good", "remarks": ""},
  {"no": "p", "activity": "Inspection visual from downstream power connections (connecting pads, cable mechanical strength)", "parameter": "Good connection", "condition": "Good", "remarks": ""}
]

For condition, use ONLY "Good" or "Not Good" based on what you see in the photos. Add observations in remarks.`,
			len(photos))

	default:
		return "Analyze the photos and extract relevant data. Output ONLY valid JSON."
	}
}

// ═══════════════════════════════════════════════════════════════════════════════
// STAGE 3: CONSOLIDATION & VERIFICATION (Reasoning Model)
// ═══════════════════════════════════════════════════════════════════════════════

func (s *aiService) consolidateResults(ctx context.Context, apiKey string, partials map[string]string) (*models.ATSReportData, error) {
	// Build input from all partial results
	var sections []string
	for category, jsonStr := range partials {
		if jsonStr != "" {
			sections = append(sections, fmt.Sprintf("=== %s ANALYSIS RESULT ===\n%s", strings.ToUpper(category), jsonStr))
		}
	}

	if len(sections) == 0 {
		return nil, fmt.Errorf("no category produced valid results")
	}

	prompt := fmt.Sprintf(`You are a data consolidation agent. Below are partial analysis results from specialized AI vision agents that analyzed maintenance photos of an ATS (Automatic Transfer Switch) panel.

Your job:
1. MERGE all partial results into ONE complete JSON object
2. VALIDATE the data logic:
   - Grounding should be < 5Ω (if above, add warning in remarks)
   - Temperature should be < 40°C (if above, add warning in remarks)
   - Phase voltages R-S, S-T, T-R should be roughly balanced (deviation < 5%%)
   - If any anomalies found, set operation_status.is_normal = false
3. PRESERVE all original measurement values exactly as reported — DO NOT modify any numbers
4. Fill in operation_status based on overall assessment
5. For visual_inspection: ensure all 16 items (a through p) are present with the correct activities

PARTIAL RESULTS FROM VISION AGENTS:
%s

OUTPUT the merged result as ONLY a valid JSON object (no markdown, no code fences, no explanation) with this structure:
{
  "visual_inspection": [
    {"no": "a", "activity": "Inspection unsafe action and unsafe condition before start activity maintenance", "parameter": "Good Condition", "condition": "Good", "remarks": ""},
    {"no": "b", "activity": "Take a photo before action activity to indicate the initial condition of the equipment panel", "parameter": "Information before activity clear", "condition": "Good", "remarks": ""},
    {"no": "c", "activity": "Check cable grounding to act know voltage in body panel. Measurement current and resistance using claim earth. Ensure grounding good connection", "parameter": "Tight & Good connection", "condition": "Good", "remarks": ""},
    {"no": "d", "activity": "Inspection of support levelness used water pass to analysis positioning support panel", "parameter": "Horizontally aligned, not tilted", "condition": "Good", "remarks": ""},
    {"no": "e", "activity": "Check and inspection visual of panels for paint damage and signs of corrosion", "parameter": "No peeling, No fading & No cracking", "condition": "Good", "remarks": ""},
    {"no": "f", "activity": "Check function of enclosure (cover panel, doors, form covers, automatic shutters, screws, keys). Cleaning using vacuum cleaner", "parameter": "Physical condition intact, no cracks or dents", "condition": "Good", "remarks": ""},
    {"no": "g", "activity": "Inspection visual and check function of power meters/controller compare with actual measurement, ensure by visual termination good connection", "parameter": "the display is lit up and clearly legible.", "condition": "Good", "remarks": ""},
    {"no": "h", "activity": "Check lamp and indicator function by visual", "parameter": "Not loose, not burnt", "condition": "Good", "remarks": ""},
    {"no": "i", "activity": "Inspection of control wiring, relays, power supply units, timers, etc.", "parameter": "There are no chipped, burnt, or worn wires.", "condition": "Good", "remarks": ""},
    {"no": "j", "activity": "Inspection and check visual of auxiliary connections, ensure termination good connection using thermal imager", "parameter": "No looseness, no rust or corrosion.", "condition": "Good", "remarks": ""},
    {"no": "k", "activity": "Inspection electronic surge protection is installed, control circuit fuse rating, and continuity", "parameter": "No rust", "condition": "Good", "remarks": ""},
    {"no": "l", "activity": "Check condition connection cabel using thermal imager if the found anomali like a hot spot indeed connection.", "parameter": "No hotspots found, stable temperature, good connection", "condition": "Good", "remarks": ""},
    {"no": "m", "activity": "Cleaning panel ATS used vacuum cleaner and apply sanpoliy to finish it", "parameter": "Clean", "condition": "Good", "remarks": ""},
    {"no": "n", "activity": "Inspection visual busbar and isolators, make sure condition isolator from cracking, signs of heating with thermal imager. Cleaning using vacuum cleaner", "parameter": "No rust or oxidation on the surface.", "condition": "Good", "remarks": ""},
    {"no": "o", "activity": "Inspection visual of CT connections and make sure good connection no miss connection. Cleaning using vacuum cleaner", "parameter": "Good connection", "condition": "Good", "remarks": ""},
    {"no": "p", "activity": "Inspection visual from downstream power connections (connecting pads, cable mechanical strength)", "parameter": "Good connection", "condition": "Good", "remarks": ""}
  ],
  "power_meter_recording": {
    "rs": {"voltage": "", "remarks": ""},
    "st": {"voltage": "", "remarks": ""},
    "tr": {"voltage": "", "remarks": ""},
    "rn": {"voltage": "", "remarks": ""},
    "sn": {"voltage": "", "remarks": ""},
    "tn": {"voltage": "", "remarks": ""},
    "n":  {"voltage": "", "remarks": ""},
    "kw": "", "kva": "", "kvar": "", "cos_p": "",
    "r_ampere": "", "s_ampere": "", "t_ampere": "", "n_ampere": ""
  },
  "voltage_current": {
    "voltage_rs": "", "voltage_st": "", "voltage_tr": "",
    "voltage_rn": "", "voltage_sn": "", "voltage_tn": "", "voltage_ng": "",
    "ampere_r": "", "ampere_s": "", "ampere_t": "",
    "remarks": ""
  },
  "thermal_measurement": {
    "result_temperature": "", "standard": "40°C", "remarks": ""
  },
  "grounding_resistance": {
    "result_ohm": "", "standard": "<5 Ω", "remarks": ""
  },
  "operation_status": {
    "is_normal": true,
    "remark": "",
    "fault_symptom": "",
    "fault_analysis": "",
    "work_done": "",
    "fault_part_sn": "",
    "fault_part_name": ""
  }
}

RULES:
- Output ONLY the JSON object. No markdown code fences. No explanation text.
- PRESERVE all measurement values EXACTLY as reported by the vision agents — do NOT change any numbers
- If a category has no data (empty result), use default values
- For visual_inspection: keep the exact activity texts shown above, only update condition and remarks based on vision agent data`, strings.Join(sections, "\n\n"))

	messages := []map[string]interface{}{
		{
			"role":    "system",
			"content": "You are a precision data consolidation agent for electrical maintenance reports. Your job is to merge partial analysis results into a complete, validated JSON report. Never modify measurement values — preserve them exactly. Output ONLY valid JSON, no markdown, no code fences.",
		},
		{
			"role":    "user",
			"content": prompt,
		},
	}

	// Disable thinking mode to make consolidation super fast
	var extraBody map[string]interface{}

	respContent, err := s.callNVIDIA(ctx, apiKey, s.reasoningModel, messages, 0.2, 16384, 90*time.Second, extraBody)
	if err != nil {
		return nil, err
	}

	return s.parseJSONResponse(respContent)
}

// ═══════════════════════════════════════════════════════════════════════════════
// GENERIC NVIDIA NIM API CALLER
// ═══════════════════════════════════════════════════════════════════════════════

func (s *aiService) callNVIDIA(ctx context.Context, apiKey, model string, messages []map[string]interface{}, temperature float64, maxTokens int, timeout time.Duration, extraBody map[string]interface{}) (string, error) {
	payload := map[string]interface{}{
		"model":       model,
		"messages":    messages,
		"max_tokens":  maxTokens,
		"temperature": temperature,
		"top_p":       0.9,
		"stream":      false,
	}

	// Merge extra body fields (e.g. chat_template_kwargs for deepseek thinking)
	for k, v := range extraBody {
		payload[k] = v
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return "", fmt.Errorf("failed to marshal request: %w", err)
	}

	reqCtx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	req, err := http.NewRequestWithContext(reqCtx, http.MethodPost, s.baseURL, bytes.NewReader(body))
	if err != nil {
		return "", fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("NVIDIA NIM API call failed: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("failed to read response body: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("NVIDIA NIM API returned status %d: %s", resp.StatusCode, string(respBody))
	}

	// Parse chat completion response
	var chatResp struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}

	if err := json.Unmarshal(respBody, &chatResp); err != nil {
		return "", fmt.Errorf("failed to parse API response: %w", err)
	}

	if len(chatResp.Choices) == 0 {
		return "", fmt.Errorf("AI model returned no choices")
	}

	content := chatResp.Choices[0].Message.Content
	slog.Info("NVIDIA API response received",
		slog.String("model", model),
		slog.Int("content_length", len(content)),
	)

	return content, nil
}

// ═══════════════════════════════════════════════════════════════════════════════
// JSON RESPONSE PARSER
// ═══════════════════════════════════════════════════════════════════════════════

func (s *aiService) parseJSONResponse(content string) (*models.ATSReportData, error) {
	slog.Info("RAW CONSOLIDATION RESPONSE", slog.String("content", content))

	// Clean the content
	content = strings.TrimSpace(content)

	// Handle deepseek <think>...</think> blocks
	if idx := strings.Index(content, "</think>"); idx != -1 {
		content = strings.TrimSpace(content[idx+len("</think>"):])
	}

	// Remove markdown code fences
	content = strings.TrimPrefix(content, "```json")
	content = strings.TrimPrefix(content, "```")
	content = strings.TrimSuffix(content, "```")
	content = strings.TrimSpace(content)

	var result models.ATSReportData
	if err := json.Unmarshal([]byte(content), &result); err != nil {
		return nil, fmt.Errorf("failed to parse consolidated JSON: %w (raw: %.500s)", err, content)
	}

	return &result, nil
}

// Chat handles conversation logic for Data Center M/E/Cooling assistant.
func (s *aiService) Chat(ctx context.Context, messages []models.ChatMessage) (string, error) {
	if len(s.apiKeys) == 0 {
		return "", fmt.Errorf("no NVIDIA NIM API keys configured")
	}

	systemInstruction := `You are an expert Data Center AI Assistant specializing strictly in:
1. Data center infrastructure and operations.
2. Mechanical and electrical equipment (e.g. ATS, Transformers, UPS, Generators, Distribution Panels, Breakers).
3. Cooling systems (e.g. Precision Air Conditioning (PAC), Chillers, Cooling Towers, airflow management).

RULES:
- Answer ONLY technical questions related to these topics.
- Write your answers in a professional, polite, and helpful tone, preferably in Indonesian unless asked in another language.
- Keep your answers concise, practical, and focused on troubleshooting, operation, or safety guidelines.
- DO NOT use markdown formatting like asterisks (**) for bolding text. Output plain text only.
- CRITICAL: If the user asks about ANY topic outside of data centers, mechanical/electrical systems, or cooling (for example: cooking recipes, general pop culture, programming unrelated to equipment, history, personal advice), you must refuse politely and guide them back to the allowed topics.`

	// Reformat messages to meet NVIDIA API request requirements
	formattedMessages := make([]map[string]interface{}, 0, len(messages)+1)
	formattedMessages = append(formattedMessages, map[string]interface{}{
		"role":    "system",
		"content": systemInstruction,
	})

	for _, msg := range messages {
		formattedMessages = append(formattedMessages, map[string]interface{}{
			"role":    msg.Role,
			"content": msg.Content,
		})
	}

	apiKey := s.getNextAPIKey()
	// Use reasoningModel (GLM-5.1) for chat reasoning
	reply, err := s.callNVIDIA(ctx, apiKey, s.reasoningModel, formattedMessages, 0.7, 4096, 90*time.Second, nil)
	if err != nil {
		return "", err
	}

	return reply, nil
}
