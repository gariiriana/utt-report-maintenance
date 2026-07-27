import { ATSPhotoInput, ATSReportData } from '@/types/atsReportTypes';

// ─── Environment Configurations ─────────────────────────────────────────────

const apiKeysStr = import.meta.env.VITE_NVIDIA_NIM_API_KEYS || '';
const apiKeys = apiKeysStr.split(',').map((k: string) => k.trim()).filter(Boolean);

const visionModel = import.meta.env.VITE_NVIDIA_NIM_VISION_MODEL || 'meta/llama-3.2-11b-vision-instruct';
const reasoningModel = import.meta.env.VITE_NVIDIA_NIM_REASONING_MODEL || 'deepseek-ai/deepseek-v4-flash';

let keyIndex = 0;
function getNextAPIKey(): string {
  if (apiKeys.length === 0) {
    throw new Error('NVIDIA NIM API Keys are not configured. Please check VITE_NVIDIA_NIM_API_KEYS.');
  }
  const key = apiKeys[keyIndex % apiKeys.length];
  keyIndex++;
  return key;
}

// ─── System Prompts ─────────────────────────────────────────────────────────

const SYSTEM_PROMPTS: Record<string, string> = {
  grounding: `You are a precision instrument display reader specializing in EARTH CLAMP TESTER / grounding meter readings.
Your ONLY job is to read the exact Ω (ohm) value from the LCD display of the grounding meter in the photo.
Rules:
- Read EVERY digit precisely, including decimal points
- If the engineer's description mentions a value (e.g. "0.34 ohm"), cross-verify with the photo
- NEVER guess or hallucinate values. If you see "0.34" on the display, output "0.34"
- Output ONLY valid JSON, no markdown, no explanation`,

  thermal: `You are a precision instrument display reader specializing in THERMAL IMAGER readings.
Your ONLY job is to read the exact temperature (°C) from the thermal camera display/photo.
Rules:
- Read the temperature value precisely, including decimal points
- Look for the MAIN temperature reading on the display (usually the largest number)
- If the engineer's description mentions a temperature, cross-verify with the photo
- NEVER guess or hallucinate values
- Output ONLY valid JSON, no markdown, no explanation`,

  power_meter: `You are a precision instrument display reader specializing in ELECTRICAL MEASUREMENT INSTRUMENTS.
Your ONLY job is to read exact voltage (V), current (A), power (kW/kVA/kVAR), and power factor values from clamp meters and digital power meters.
Rules:
- Read EVERY digit precisely, including decimal points
- For clamp meters (e.g. Fluke, Kyoritsu): read the LARGE MAIN DIGITS on the LCD
- For built-in digital power meters (DPM): read each displayed parameter value
- Match each photo's engineer description to determine which measurement it is (R-S, S-T, T-R, R-N, S-N, T-N, N-G, Ampere R/S/T)
- NEVER guess standard nominal values (like 398.5, 230.2). Read the ACTUAL digits shown
- If you see "390.1", write "390.1" — NOT "398.5" or any other value
- Output ONLY valid JSON, no markdown, no explanation`,

  visual_inspection: `You are an expert electrical engineer performing a visual inspection of an ATS (Automatic Transfer Switch) panel.
Your job is to assess the physical condition of panel components from photos.
Rules:
- Evaluate each inspection item based on what you see in the photos
- Set condition to "Good" if the component appears normal, or "Not Good" if issues are found
- Add specific observations in remarks if any issues are noted
- Output ONLY valid JSON, no markdown, no explanation`
};

// ─── Prompts Builder ────────────────────────────────────────────────────────

function buildCategoryPrompt(category: string, photos: ATSPhotoInput[]): string {
  switch (category) {
    case 'grounding':
      return `Analyze these ${photos.length} grounding measurement photos. Read the EXACT ohm (Ω) value from each earth clamp tester display.

Respond with ONLY this JSON:
{
  "result_ohm": "<exact ohm value from display, e.g. 0.34>",
  "standard": "<5 Ω",
  "remarks": "<any observation>"
}`;

    case 'thermal':
      return `Analyze these ${photos.length} thermal imager photos. Read the EXACT temperature (°C) from each thermal display.

If multiple thermal photos show different locations, report the HIGHEST temperature found.

Respond with ONLY this JSON:
{
  "result_temperature": "<highest temperature in °C, e.g. 32.1>",
  "standard": "40°C",
  "remarks": "<list all measured locations and their temperatures>"
}`;

    case 'power_meter': {
      const descs = photos.map((p, i) => `Photo ${i + 1}: ${p.label || 'Unknown measurement'}`).join('\n');
      return `Analyze these ${photos.length} electrical measurement photos. Each photo shows a clamp meter or digital power meter display.

The photos and their engineer descriptions:
${descs}

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

Fill each field with the exact value read from the corresponding photo. Leave empty "" for measurements not photographed.`;
    }

    case 'visual_inspection':
      return `Analyze these ${photos.length} visual inspection photos of an ATS panel.

Assess each of these inspection items based on what you see:

a. Unsafe action/condition check
b. Initial condition documentation
c. Check cable grounding connection
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

For condition, use ONLY "Good" or "Not Good" based on what you see in the photos. Add observations in remarks.`;

    default:
      return 'Analyze the photos and extract relevant data. Output ONLY valid JSON.';
  }
}

// ─── NVIDIA API Caller ──────────────────────────────────────────────────────

class RateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RateLimitError';
  }
}

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

  const response = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errText = await response.text();
    // Throw a special RateLimitError for 429 so failover can catch it
    if (response.status === 429 || errText.includes('RESOURCE_EXHAUSTED')) {
      throw new RateLimitError(`API rate limit exceeded (${response.status}): ${errText}`);
    }
    throw new Error(`AI API error (${response.status}): ${errText}`);
  }

  const data = await response.json();
  if (!data.choices || data.choices.length === 0) {
    throw new Error('AI API returned no choices');
  }

  return data.choices[0].message.content || '';
}

// callWithFailover tries all API keys on 429 errors before giving up.
async function callWithFailover(
  model: string,
  messages: any[],
  temperature = 0.0,
  maxTokens = 4096,
  extraBody: any = {}
): Promise<string> {
  const totalKeys = apiKeys.length;
  if (totalKeys === 0) {
    throw new Error('No API keys configured. Please check VITE_NVIDIA_NIM_API_KEYS.');
  }

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < totalKeys; attempt++) {
    const apiKey = getNextAPIKey();
    try {
      return await callNVIDIA(apiKey, model, messages, temperature, maxTokens, extraBody);
    } catch (error: any) {
      if (error instanceof RateLimitError) {
        console.warn(`API key #${(keyIndex - 1) % totalKeys} rate limited (429), trying next key... (attempt ${attempt + 1}/${totalKeys})`);
        lastError = error;
        continue;
      }
      // Non-429 errors: fail immediately
      throw error;
    }
  }

  // All keys exhausted
  throw new Error(`Semua API key telah mencapai batas quota harian (1.500 request/key). Quota akan reset jam 07:00 WIB. ${lastError?.message || ''}`);
}

// ─── Category Vision Worker ──────────────────────────────────────────────────

async function runCategoryAnalysis(
  category: string,
  photos: ATSPhotoInput[],
  onProgress: (msg: string) => void
): Promise<string> {
  onProgress(`Analyzing ${category.toUpperCase()} (${photos.length} photos)...`);

  const prompt = buildCategoryPrompt(category, photos);

  const content: any[] = [{ type: 'text', text: prompt }];

  for (let i = 0; i < photos.length; i++) {
    const photo = photos[i];
    const mimeType = photo.base64.startsWith('iVBOR') ? 'image/png' : 'image/jpeg';
    const imageUrl = `data:${mimeType};base64,${photo.base64}`;

    content.push({
      type: 'text',
      text: `--- PHOTO ${i + 1} of ${photos.length} ---\nEngineer Description: ${photo.label || category}`
    });
    content.push({
      type: 'image_url',
      image_url: { url: imageUrl }
    });
  }

  const messages = [
    { role: 'system', content: SYSTEM_PROMPTS[category] || 'Read instrument displays.' },
    { role: 'user', content }
  ];

  try {
    const result = await callWithFailover(visionModel, messages, 0.0, 4096);
    onProgress(`Finished analyzing ${category.toUpperCase()} successfully.`);
    return result;
  } catch (error: any) {
    console.error(`Stage 2 failed for category ${category}:`, error);
    onProgress(`Failed analyzing ${category.toUpperCase()} (ignoring).`);
    return ''; // Return empty string to allow other categories to complete
  }
}

// ─── Main Pipeline orchestrator ─────────────────────────────────────────────

export async function runAIAgentPipeline(
  photos: ATSPhotoInput[],
  onProgress: (status: string) => void
): Promise<ATSReportData> {
  onProgress('Partitioning photos by category...');

  // Stage 1: Partition
  const groups: Record<string, ATSPhotoInput[]> = {
    grounding: [],
    thermal: [],
    power_meter: [],
    visual_inspection: []
  };

  for (const p of photos) {
    const cat = p.category && p.category in groups ? p.category : 'visual_inspection';
    groups[cat].push(p);
  }

  // Stage 2: Parallel vision calls
  onProgress('Launching parallel category vision models...');
  const activeCategories = Object.keys(groups).filter(cat => groups[cat].length > 0);

  const categoryPromises = activeCategories.map(cat =>
    runCategoryAnalysis(cat, groups[cat], onProgress)
  );

  const rawResults = await Promise.all(categoryPromises);

  const partials: Record<string, string> = {};
  activeCategories.forEach((cat, idx) => {
    partials[cat] = rawResults[idx];
  });

  // Stage 3: Consolidation
  onProgress('Consolidating and validating all results...');
  const partialSections = Object.entries(partials)
    .filter(([_, jsonStr]) => Boolean(jsonStr))
    .map(([cat, jsonStr]) => `=== ${cat.toUpperCase()} ANALYSIS RESULT ===\n${jsonStr}`)
    .join('\n\n');

  if (!partialSections) {
    throw new Error('Vision analysis did not return any readable data from photos.');
  }

  const consolidationPrompt = `You are a data consolidation agent. Below are partial analysis results from specialized AI vision agents that analyzed maintenance photos of an ATS (Automatic Transfer Switch) panel.

Your job:
1. MERGE all partial results into ONE complete JSON object
2. VALIDATE the data logic:
   - Grounding should be < 5Ω (if above, add warning in remarks)
   - Temperature should be < 40°C (if above, add warning in remarks)
   - Phase voltages R-S, S-T, T-R should be roughly balanced (deviation < 5%)
   - If any anomalies found, set operation_status.is_normal = false
3. PRESERVE all original measurement values exactly as reported — DO NOT modify any numbers
4. Fill in operation_status based on overall assessment
5. For visual_inspection: ensure all 16 items (a through p) are present with the correct activities

PARTIAL RESULTS FROM VISION AGENTS:
${partialSections}

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
- For visual_inspection: keep the exact activity texts shown above, only update condition and remarks based on vision agent data`;

  const messages = [
    {
      role: 'system',
      content: 'You are a precision data consolidation agent for electrical maintenance reports. Your job is to merge partial analysis results into a complete, validated JSON report. Never modify measurement values. Output ONLY valid JSON, no markdown.'
    },
    {
      role: 'user',
      content: consolidationPrompt
    }
  ];

  const extraBody: any = {};
  if (reasoningModel.includes('deepseek')) {
    extraBody.chat_template_kwargs = {
      thinking: true,
      reasoning_effort: 'high'
    };
  }

  let content = await callWithFailover(reasoningModel, messages, 0.2, 16384, extraBody);

  // Clean raw output (think tags, code fences)
  content = content.trim();
  if (content.includes('</think>')) {
    content = content.split('</think>')[1].trim();
  }
  content = content.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/\s*```$/, '').trim();

  try {
    onProgress('Done! Parsing report data...');
    return JSON.parse(content) as ATSReportData;
  } catch (error: any) {
    console.error('Failed to parse final consolidated JSON:', content);
    throw new Error(`Consolidation parsing failed: ${error.message}`);
  }
}

// ─── Service Report AI Triggers for Trafo, AC Split, CT, Generator ──────────

export async function analyzeTrafoReportAI(photos: any[], existingData?: any) {
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';
  const response = await fetch(`${apiUrl}/ai/trafo-report`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ photos, existing_data: existingData }),
  });
  if (!response.ok) throw new Error(`Trafo AI failed: ${response.statusText}`);
  return response.json();
}

export async function analyzeACSplitReportAI(photos: any[], existingData?: any) {
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';
  const response = await fetch(`${apiUrl}/ai/acsplit-report`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ photos, existing_data: existingData }),
  });
  if (!response.ok) throw new Error(`AC Split AI failed: ${response.statusText}`);
  return response.json();
}

export async function analyzeCTReportAI(photos: any[], existingData?: any) {
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';
  const response = await fetch(`${apiUrl}/ai/ct-report`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ photos, existing_data: existingData }),
  });
  if (!response.ok) throw new Error(`CT AI failed: ${response.statusText}`);
  return response.json();
}

export async function analyzeGeneratorReportAI(photos: any[], existingData?: any) {
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';
  const response = await fetch(`${apiUrl}/ai/generator-report`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ photos, existing_data: existingData }),
  });
  if (!response.ok) throw new Error(`Generator AI failed: ${response.statusText}`);
  return response.json();
}

export async function analyzeBusductReportAI(photos: any[], existingData?: any) {
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8080/api';
  const response = await fetch(`${apiUrl}/ai/busduct-report`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ photos, existing_data: existingData }),
  });
  if (!response.ok) throw new Error(`Busduct AI failed: ${response.statusText}`);
  return response.json();
}


