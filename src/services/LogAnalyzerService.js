import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

// ─── Anthropic API Key (injected via EAS env at build time) ──────────────────
const ANTHROPIC_API_KEY = Constants.expoConfig?.extra?.anthropicApiKey || '';

const HISTORY_KEY = 'tunescore_history';

// ─── Column aliases (case-insensitive, supports BM3, MHD, EcuTek, Cobb, OBD2)
const CHANNEL_ALIASES = {
  coolant: ['coolant temp', 'clt', 'engine coolant temperature', 'coolant', 'ect', 'water temp'],
  iat:     ['iat', 'intake air temp', 'air temp', 'intake air temperature', 'charge temp', 'inlet temp'],
  timing:  ['ignition timing', 'timing', 'ign', 'spark advance', 'ign timing', 'timing advance', 'spark timing'],
  knock:   ['knock', 'knock retard', 'knock activity', 'knock sum', 'knock level', 'cyl 1 knock', 'cyl 2 knock', 'cyl 3 knock', 'cyl 4 knock', 'cyl 5 knock', 'cyl 6 knock'],
  afr:     ['afr', 'lambda', 'air fuel ratio', 'wideband', 'o2', 'stft', 'ltft', 'fuel trim', 'equiv ratio'],
  boost:   ['boost', 'map', 'boost pressure', 'manifold pressure', 'boost psi', 'boost bar', 'turbo boost', 'intake manifold pressure'],
  battery: ['battery', 'battery voltage', 'batt v', 'batt', 'voltage', 'supply voltage'],
  rpm:     ['rpm', 'engine speed', 'engine rpm'],
  throttle:['throttle', 'tps', 'throttle position', 'pedal position', 'accel pedal'],
  maf:     ['maf', 'mass air flow', 'air mass', 'load'],
};

export function parseCSV(csvText) {
  const lines = csvText.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) throw new Error('CSV file is empty or has no data rows.');

  let headerIdx = 0;
  for (let i = 0; i < Math.min(10, lines.length); i++) {
    if (lines[i].split(',').length > 3) { headerIdx = i; break; }
  }

  const rawHeaders = lines[headerIdx].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const dataLines = lines.slice(headerIdx + 1);

  const colMap = {};
  rawHeaders.forEach((h, idx) => {
    const lower = h.toLowerCase();
    for (const [channel, aliases] of Object.entries(CHANNEL_ALIASES)) {
      if (aliases.some(a => lower.includes(a))) {
        if (!colMap[channel]) colMap[channel] = idx;
      }
    }
  });

  const rows = dataLines
    .map(line => line.split(',').map(v => v.trim().replace(/^"|"$/g, '')))
    .filter(cols => cols.length >= rawHeaders.length / 2);

  const stats = {};
  for (const [channel, colIdx] of Object.entries(colMap)) {
    const vals = rows.map(r => parseFloat(r[colIdx])).filter(v => !isNaN(v));
    if (vals.length === 0) continue;
    stats[channel] = {
      min: Math.min(...vals),
      max: Math.max(...vals),
      avg: vals.reduce((a, b) => a + b, 0) / vals.length,
      count: vals.length,
    };
  }

  const sampleSize = Math.min(500, rows.length);
  const step = Math.max(1, Math.floor(rows.length / sampleSize));
  const sampledRows = rows.filter((_, i) => i % step === 0).slice(0, sampleSize);

  return { headers: rawHeaders, colMap, stats, sampledRows, totalRows: rows.length };
}

function buildPrompt(parsed, filename, vehicleInfo) {
  const { stats, totalRows } = parsed;

  const statsText = Object.entries(stats)
    .map(([ch, s]) =>
      `${ch.toUpperCase()}: min=${s.min.toFixed(2)}, max=${s.max.toFixed(2)}, avg=${s.avg.toFixed(2)} (${s.count} samples)`
    ).join('\n');

  const vehicleCtx = vehicleInfo ? `Vehicle: ${vehicleInfo}` : 'Vehicle: Unknown';

  return `You are an expert ECU tuner analyzing a performance car datalog.

FILE: ${filename}
${vehicleCtx}
TOTAL ROWS: ${totalRows}

CHANNEL STATISTICS:
${statsText || 'No recognized channels found.'}

Analyze this log and return ONLY valid JSON (no markdown, no explanation) in this exact format:
{
  "healthScore": <0-100 integer>,
  "summary": "<2-3 sentence overall assessment, mention specific values>",
  "grade": "<A|B|C|D|F>",
  "channels": {
    "coolant": { "status": "<OK|WARNING|CRITICAL|N/A>", "note": "<specific note with values>", "min": <number|null>, "max": <number|null>, "avg": <number|null> },
    "iat":     { "status": "<OK|WARNING|CRITICAL|N/A>", "note": "<specific note with values>", "min": <number|null>, "max": <number|null>, "avg": <number|null> },
    "timing":  { "status": "<OK|WARNING|CRITICAL|N/A>", "note": "<specific note with values>", "min": <number|null>, "max": <number|null>, "avg": <number|null> },
    "knock":   { "status": "<OK|WARNING|CRITICAL|N/A>", "note": "<specific note with values>", "min": <number|null>, "max": <number|null>, "avg": <number|null> },
    "afr":     { "status": "<OK|WARNING|CRITICAL|N/A>", "note": "<specific note with values>", "min": <number|null>, "max": <number|null>, "avg": <number|null> },
    "boost":   { "status": "<OK|WARNING|CRITICAL|N/A>", "note": "<specific note with values>", "min": <number|null>, "max": <number|null>, "avg": <number|null> },
    "battery": { "status": "<OK|WARNING|CRITICAL|N/A>", "note": "<specific note with values>", "min": <number|null>, "max": <number|null>, "avg": <number|null> }
  },
  "recommendations": ["<specific actionable rec 1>", "<specific actionable rec 2>", "<specific actionable rec 3>"],
  "professionalTuneNeeded": <true|false>
}

Thresholds:
- Knock retard: >2° = WARNING, >4° = CRITICAL
- IAT: >45°C = WARNING, >55°C = CRITICAL
- AFR: <11.5 or >13.5 at high load = WARNING, <11.0 or >14.0 = CRITICAL
- Coolant: >105°C = WARNING, >115°C = CRITICAL
- Battery: <12.5V = WARNING, <11.5V = CRITICAL
- Boost: flag unusually high spikes vs average
- Grade: A=90-100, B=80-89, C=70-79, D=60-69, F=<60
- Set professionalTuneNeeded=true if any CRITICAL or 2+ WARNINGs`;
}

async function callClaude(prompt) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`AI analysis failed (${response.status}): ${err}`);
  }

  const data = await response.json();
  const text = data.content?.[0]?.text || '';
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('AI returned invalid response format.');
  return JSON.parse(jsonMatch[0]);
}

export async function analyzeLog({ fileContent, filename, vehicleInfo }) {
  const parsed = parseCSV(fileContent);
  const prompt = buildPrompt(parsed, filename, vehicleInfo);
  const report = await callClaude(prompt);

  // Fill in stats from local parse if AI left nulls
  for (const [channel, localStats] of Object.entries(parsed.stats)) {
    if (report.channels[channel]) {
      const ch = report.channels[channel];
      if (ch.min === null || ch.min === undefined) ch.min = parseFloat(localStats.min.toFixed(2));
      if (ch.max === null || ch.max === undefined) ch.max = parseFloat(localStats.max.toFixed(2));
      if (ch.avg === null || ch.avg === undefined) ch.avg = parseFloat(localStats.avg.toFixed(2));
    }
  }

  const entry = {
    id: Date.now().toString(),
    filename,
    vehicleInfo: vehicleInfo || 'Unknown Vehicle',
    date: new Date().toISOString(),
    healthScore: report.healthScore,
    grade: report.grade || 'C',
    summary: report.summary,
    channels: report.channels,
    recommendations: report.recommendations,
    professionalTuneNeeded: report.professionalTuneNeeded || false,
    totalRows: parsed.totalRows,
  };

  try {
    const raw = await AsyncStorage.getItem(HISTORY_KEY);
    const history = raw ? JSON.parse(raw) : [];
    history.unshift(entry);
    if (history.length > 20) history.splice(20);
    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch (e) {
    console.warn('TuneScore: history save failed', e);
  }

  return entry;
}

export async function getAnalysisHistory() {
  try {
    const raw = await AsyncStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export async function clearAnalysisHistory() {
  await AsyncStorage.removeItem(HISTORY_KEY);
}
