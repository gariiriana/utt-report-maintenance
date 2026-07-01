import { onCall, HttpsError, CallableRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";

admin.initializeApp();

// ─── TYPES ──────────────────────────────────────────────────────────────────

interface ATSPhotoInput {
  base64: string;
  category: string;
  label?: string;
}

interface VisualInspectionItem {
  no: string;
  activity: string;
  parameter: string;
  condition: string;
  remarks: string;
}

interface PowerMeterRow {
  voltage: string;
  remarks: string;
}

interface PowerMeterData {
  rs: PowerMeterRow;
  st: PowerMeterRow;
  tr: PowerMeterRow;
  rn: PowerMeterRow;
  sn: PowerMeterRow;
  tn: PowerMeterRow;
  n: PowerMeterRow;
  kw: string;
  kva: string;
  kvar: string;
  cos_p: string;
  r_ampere: string;
  s_ampere: string;
  t_ampere: string;
  n_ampere: string;
}

interface VoltageCurrentData {
  voltage_rs: string;
  voltage_st: string;
  voltage_tr: string;
  voltage_rn: string;
  voltage_sn: string;
  voltage_tn: string;
  voltage_ng: string;
  ampere_r: string;
  ampere_s: string;
  ampere_t: string;
  remarks: string;
}

interface ThermalData {
  result_temperature: string;
  standard: string;
  remarks: string;
}

interface GroundingData {
  result_ohm: string;
  standard: string;
  remarks: string;
}

interface OperationStatusData {
  is_normal: boolean;
  remark: string;
  fault_symptom: string;
  fault_analysis: string;
  work_done: string;
  fault_part_sn: string;
  fault_part_name: string;
}

interface ATSReportData {
  visual_inspection: VisualInspectionItem[];
  power_meter_recording: PowerMeterData;
  voltage_current: VoltageCurrentData;
  thermal_measurement: ThermalData;
  grounding_resistance: GroundingData;
  operation_status: OperationStatusData;
}

// ─── Environment Configurations ─────────────────────────────────────────────

const apiKeysStr = process.env.NVIDIA_NIM_API_KEYS || "";
const apiKeys = apiKeysStr.split(",").map((k) => k.trim()).filter(Boolean);

const visionModel = process.env.NVIDIA_NIM_VISION_MODEL || "moonshotai/kimi-k2.6";
const reasoningModel = process.env.NVIDIA_NIM_REASONING_MODEL || "deepseek-ai/deepseek-v4-flash";

let keyIndex = 0;
function getNextAPIKey(): string {
  if (apiKeys.length === 0) {
    throw new HttpsError("failed-precondition", "NVIDIA NIM API Keys are not configured in process.env.");
  }
  const key = apiKeys[keyIndex % apiKeys.length];
  keyIndex++;
  return key;
}

// ─── NVIDIA API Caller ──────────────────────────────────────────────────────

async function callNVIDIA(
  apiKey: string,
  model: string,
  messages: any[],
  temperature = 0.0,
  maxTokens = 4096,
  extraBody: any = {}
): Promise<string> {
  const payload = {
    model,
    messages,
    max_tokens: maxTokens,
    temperature,
    top_p: 0.9,
    stream: false,
    ...extraBody
  };

  const response = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Accept": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new HttpsError("internal", `NVIDIA NIM API error (${response.status}): ${errText}`);
  }

  const data = await response.json();
  if (!data.choices || data.choices.length === 0) {
    throw new HttpsError("internal", "NVIDIA NIM API returned no choices");
  }

  return data.choices[0].message.content || "";
}

// ─── Category Vision Worker ──────────────────────────────────────────────────

// ─── Single Photo Vision Worker ──────────────────────────────────────────────

async function runSinglePhotoAnalysis(
  photo: ATSPhotoInput,
  index: number
): Promise<string> {
  const apiKey = getNextAPIKey();
  const category = photo.category || "visual_inspection";
  const label = photo.label || "";

  let systemPrompt = "";
  let userPrompt = "";

  switch (category) {
    case "grounding":
      systemPrompt = "You are a grounding resistance meter reader. Read the LCD screen ohm (Ω) value.";
      userPrompt = `Please read the grounding resistance meter LCD display value shown in the photo.
Identify the exact ohm (Ω) number.
Return ONLY this JSON schema:
{
  "result_ohm": "<exact read number, e.g. 0.34>",
  "remarks": "Grounding resistance is <exact number> ohms"
}`;
      break;

    case "thermal":
      systemPrompt = "You are a thermal imager reader. Read the main temperature in Celsius (°C).";
      userPrompt = `Please read the main/highest temperature shown in the thermal camera display photo.
Return ONLY this JSON schema:
{
  "result_temperature": "<exact temperature value, e.g. 32.5>",
  "location": "${label || "ATS panel components"}"
}`;
      break;

    case "power_meter":
      systemPrompt = "You are a digital power meter and clamp meter reader.";
      userPrompt = `This photo represents measurement for parameter: "${label}".
Read the EXACT number displayed on the instrument screen.
Identify the parameter name (e.g. RS voltage, ST voltage, TR voltage, RN voltage, SN voltage, TN voltage, NG voltage, R current, S current, T current, N current, kW, kVA, kVAR, Cos phi).
Return ONLY this JSON schema:
{
  "parameter": "<parameter name based on label, e.g., voltage_rs, voltage_st, voltage_tr, voltage_rn, voltage_sn, voltage_tn, voltage_ng, ampere_r, ampere_s, ampere_t, ampere_n, kw, kva, kvar, cos_p>",
  "value": "<exact numeric string read from display, e.g., 395.2>"
}`;
      break;

    case "visual_inspection":
    default:
      systemPrompt = "You are an electrical inspector checking ATS panel components.";
      userPrompt = `This photo shows visual inspection of the ATS panel.
Identify which checklist items (a through p) are visible in the photo.
For each visible checklist item, evaluate its physical condition (Good or Not Good).
Return ONLY this JSON array:
[
  {
    "no": "<checklist letter, e.g., a, b, c, d, etc.>",
    "condition": "Good/Not Good",
    "remarks": "<brief observation note>"
  }
]`;
      break;
  }

  const mimeType = photo.base64.startsWith("iVBOR") ? "image/png" : "image/jpeg";
  const imageUrl = `data:${mimeType};base64,${photo.base64}`;

  const messages = [
    { role: "system", content: systemPrompt },
    {
      role: "user",
      content: [
        { type: "text", text: userPrompt },
        { type: "image_url", image_url: { url: imageUrl } }
      ]
    }
  ];

  try {
    return await callNVIDIA(apiKey, visionModel, messages, 0.0, 1024);
  } catch (error: any) {
    console.error(`Stage 2 failed for photo ${index + 1} (${category}):`, error);
    return JSON.stringify({ error: error.message, category, index });
  }
}

// ─── Cloud Function HTTPS Callable Handler ──────────────────────────────────

export const analyzeATSReport = onCall({ region: "asia-southeast1", cors: true, timeoutSeconds: 300 }, async (request: CallableRequest<any>) => {
  // Check auth
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Request must be authenticated.");
  }

  const photos = request.data.photos as ATSPhotoInput[];
  if (!photos || !Array.isArray(photos) || photos.length === 0) {
    throw new HttpsError("invalid-argument", "Photos parameter is required and must not be empty.");
  }

  // Stage 1 & 2: Process all photos in parallel
  const photoPromises = photos.map((p, idx) =>
    runSinglePhotoAnalysis(p, idx)
  );

  const rawResults = await Promise.all(photoPromises);

  // Stage 3: Consolidation
  const partialSections = rawResults
    .map((res, idx) => `=== PHOTO ${idx + 1} (Category: ${photos[idx].category}, Label: ${photos[idx].label || "None"}) ===\n${res}`)
    .join("\n\n");

  const consolidationPrompt = `You are a data consolidation agent. Below are the results of individual vision analysis of maintenance photos of an ATS (Automatic Transfer Switch) panel.

Your job:
1. MERGE all individual findings into ONE complete JSON object matching the exact schema below.
2. MAP each parameter to the correct field:
   - For grounding: set grounding_resistance.result_ohm and its remarks
   - For thermal: set thermal_measurement.result_temperature (use the highest temperature found if multiple) and compile location remarks
   - For power_meter:
     * voltage_rs -> power_meter_recording.rs.voltage and voltage_current.voltage_rs
     * voltage_st -> power_meter_recording.st.voltage and voltage_current.voltage_st
     * voltage_tr -> power_meter_recording.tr.voltage and voltage_current.voltage_tr
     * voltage_rn -> power_meter_recording.rn.voltage and voltage_current.voltage_rn
     * voltage_sn -> power_meter_recording.sn.voltage and voltage_current.voltage_sn
     * voltage_tn -> power_meter_recording.tn.voltage and voltage_current.voltage_tn
     * voltage_ng -> voltage_current.voltage_ng
     * ampere_r -> power_meter_recording.r_ampere and voltage_current.ampere_r
     * ampere_s -> power_meter_recording.s_ampere and voltage_current.ampere_s
     * ampere_t -> power_meter_recording.t_ampere and voltage_current.ampere_t
     * ampere_n -> power_meter_recording.n_ampere
     * kw -> power_meter_recording.kw
     * kva -> power_meter_recording.kva
     * kvar -> power_meter_recording.kvar
     * cos_p -> power_meter_recording.cos_p
   - For visual_inspection: map the checklist items. Update their condition ("Good" or "Not Good") and remarks based on findings. Ensure all 16 items (a to p) are present in the final list with their exact activity names.
3. VALIDATE logic:
   - Grounding should be < 5Ω
   - Temperature should be < 40°C
   - If any anomalies are found, set operation_status.is_normal = false and fill in remarks/fault details
4. Output ONLY valid JSON matching the exact schema below. Do not output markdown code fences, do not output explanations, just the JSON.

INDIVIDUAL VISION ANALYSIS RESULTS:
${partialSections}

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
- If a category has no data (empty result), use default values
- For visual_inspection: keep the exact activity texts shown above, only update condition and remarks based on vision agent data`;

  const messages = [
    {
      role: "system",
      content: "You are a precision data consolidation agent for electrical maintenance reports. Your job is to merge partial analysis results into a complete, validated JSON report. Never modify measurement values. Output ONLY valid JSON, no markdown."
    },
    {
      role: "user",
      content: consolidationPrompt
    }
  ];

  const apiKey = getNextAPIKey();
  let content = await callNVIDIA(apiKey, reasoningModel, messages, 0.2, 16384);

  // Clean raw output (think tags, code fences)
  content = content.trim();
  if (content.includes("</think>")) {
    content = content.split("</think>")[1].trim();
  }
  content = content.replace(/^```json\s*/i, "").replace(/^```\s*/, "").replace(/\s*```$/, "").trim();

  try {
    return JSON.parse(content) as ATSReportData;
  } catch (error: any) {
    console.error("Failed to parse final consolidated JSON:", content);
    throw new HttpsError("internal", `Consolidation parsing failed: ${error.message}`);
  }
});
