import AsyncStorage from '@react-native-async-storage/async-storage';


import Constants from 'expo-constants';

// ─── Anthropic API Key ────────────────────────────────────────────────────────
const ANTHROPIC_API_KEY = Constants.expoConfig?.extra?.anthropicApiKey || '';



const HISTORY_KEY = 'tunescore_history';

// ─── Analysis scope ───────────────────────────────────────────────────────────
const LOAD_CHANNELS = new Set(['timing', 'knock', 'afr', 'boost']);
const MIN_TPS_PCT   = 95;
const MIN_RPM       = 4000;
const MAX_RPM       = 7200;

// ─── Engine-specific AFR targets at WOT [min, max] ───────────────────────────
const ENGINE_AFR_TARGETS = {
  'N55':  { e0:[11.5,12.2], e30:[11.2,11.8], e50:[10.8,11.5], e85:[9.8,10.8]  },
  'B58':  { e0:[11.5,12.2], e30:[11.2,11.8], e50:[10.8,11.5], e85:[9.8,10.8]  },
  'S55':  { e0:[11.3,12.0], e30:[11.0,11.6], e50:[10.5,11.3], e85:[9.5,10.5]  },
  'S63':  { e0:[11.3,12.0], e30:[11.0,11.6], e50:[10.5,11.3], e85:[9.5,10.5]  },
  'S58':  { e0:[11.5,12.2], e30:[11.2,11.8], e50:[10.8,11.5], e85:[9.8,10.8]  },
  'N20':  { e0:[11.8,12.5], e30:[11.4,12.0], e50:[11.0,11.6], e85:[10.0,11.0] },
  'other':{ e0:[11.5,12.5], e30:[11.0,12.0], e50:[10.5,11.5], e85:[9.5,10.8]  },
};

const ENGINE_BOOST_MAX = {
  'N55': { e0:22, e30:23, e50:24, e85:26 },
  'B58': { e0:24, e30:25, e50:26, e85:28 },
  'S55': { e0:26, e30:27, e50:28, e85:30 },
  'S63': { e0:24, e30:25, e50:26, e85:28 },
  'S58': { e0:28, e30:29, e50:30, e85:32 },
  'N20': { e0:18, e30:19, e50:20, e85:22 },
  'other':{ e0:22, e30:23, e50:24, e85:26 },
};

const KNOCK_WARN = { e0:2.0, e30:2.5, e50:3.0, e85:3.5 };
const KNOCK_CRIT = { e0:3.5, e30:4.0, e50:5.0, e85:6.0 };

// ─── Column aliases ───────────────────────────────────────────────────────────
const CHANNEL_ALIASES = {
  coolant:  ['coolant temp', 'clt', 'engine coolant temperature', 'coolant', 'ect', 'water temp'],
  iat:      ['iat', 'intake air temp', 'air temp', 'intake air temperature', 'charge temp', 'inlet temp'],
  timing:   ['ignition timing 1', 'ignition timing', 'timing', 'ign timing', 'spark advance', 'ignition cyl 1'],
  knock:    ['knock detected', 'knock retard', 'knock activity', 'knock sum', 'knock level', 'knock'],
  afr:      ['lambda[afr]', 'afr', 'lambda act', 'air fuel ratio', 'wideband', 'lambda['],
  boost:    ['boost (pre-throttle)', 'boost pressure', 'boost', 'map', 'manifold pressure', 'boost psi'],
  battery:  ['battery', 'battery voltage', 'batt v', 'voltage', 'supply voltage'],
  rpm:      ['engine speed', 'rpm', 'engine rpm'],
  throttle: ['accel. pedal', 'throttle angle', 'tps', 'throttle position', 'pedal position'],
  gear:     ['gear'],
};

// ─── CSV Parser ───────────────────────────────────────────────────────────────
export function parseCSV(csvText, options = {}) {
  const { gear, fuelType = 'e0', engineFamily = 'other' } = options;

  const lines = csvText.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) throw new Error('CSV file is empty or has no data rows.');

  let headerIdx = 0;
  for (let i = 0; i < Math.min(10, lines.length); i++) {
    if (lines[i].split(',').length > 3) { headerIdx = i; break; }
  }

  const rawHeaders = lines[headerIdx].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const dataLines  = lines.slice(headerIdx + 1);

  // Map channels to column indices
  const colMap = {};
  rawHeaders.forEach((h, idx) => {
    const lower = h.toLowerCase();
    for (const [channel, aliases] of Object.entries(CHANNEL_ALIASES)) {
      if (!colMap[channel] && aliases.some(a => lower.includes(a))) {
        colMap[channel] = idx;
      }
    }
  });

  const allRows = dataLines
    .map(line => line.split(',').map(v => v.trim().replace(/^"|"$/g, '')))
    .filter(cols => cols.length >= rawHeaders.length / 2);

  // ── WOT + RPM band filter ─────────────────────────────────────────────────
  const tpsIdx  = colMap['throttle'];
  const rpmIdx  = colMap['rpm'];
  const gearIdx = colMap['gear'];

  // Auto-detect throttle scale (0-1 vs 0-100)
  let tpsThreshold = MIN_TPS_PCT;
  if (tpsIdx !== undefined) {
    const tpsSample = allRows.map(r => parseFloat(r[tpsIdx])).filter(v => !isNaN(v));
    const maxTps = Math.max(...tpsSample);
    if (maxTps <= 1.1) tpsThreshold = 0.95;
  }

  let powerRows = allRows;
  let powerRunRows = 0;

  if (tpsIdx !== undefined && rpmIdx !== undefined) {
    // Find last WOT point, trim post-lift-off coasting
    let lastWOTIdx = -1;
    for (let i = allRows.length - 1; i >= 0; i--) {
      const tps = parseFloat(allRows[i][tpsIdx]);
      if (!isNaN(tps) && tps >= tpsThreshold) { lastWOTIdx = i; break; }
    }
    const trimmedRows = lastWOTIdx >= 0 ? allRows.slice(0, lastWOTIdx + 1) : allRows;

    // Keep WOT rows in RPM band, optionally filter by gear
    powerRows = trimmedRows.filter(row => {
      const tps  = parseFloat(row[tpsIdx]);
      const rpm  = parseFloat(row[rpmIdx]);
      if (isNaN(tps) || isNaN(rpm)) return false;
      if (tps < tpsThreshold || rpm < MIN_RPM || rpm > MAX_RPM) return false;
      // Gear filter — if user specified a gear and log has gear data
      if (gear && gearIdx !== undefined) {
        const rowGear = parseFloat(row[gearIdx]);
        if (!isNaN(rowGear) && rowGear !== parseFloat(gear)) return false;
      }
      return true;
    });
    powerRunRows = powerRows.length;
  }

  // ── Compute stats ─────────────────────────────────────────────────────────
  const stats = {};
  for (const [channel, colIdx] of Object.entries(colMap)) {
    const useRows = LOAD_CHANNELS.has(channel) ? powerRows : allRows;
    const vals = useRows.map(r => parseFloat(r[colIdx])).filter(v => !isNaN(v));
    if (vals.length === 0) continue;
    stats[channel] = {
      min:   Math.min(...vals),
      max:   Math.max(...vals),
      avg:   vals.reduce((a, b) => a + b, 0) / vals.length,
      count: vals.length,
      fullThrottleOnly: LOAD_CHANNELS.has(channel),
    };
  }

  // Sample power rows for AI context
  const sampleSource = powerRows.length >= 10 ? powerRows : allRows;
  const sampleSize   = Math.min(500, sampleSource.length);
  const step         = Math.max(1, Math.floor(sampleSource.length / sampleSize));
  const sampledRows  = sampleSource.filter((_, i) => i % step === 0).slice(0, sampleSize);

  return {
    headers: rawHeaders,
    colMap,
    stats,
    sampledRows,
    totalRows:    allRows.length,
    powerRunRows,
    hasThrottleFilter: tpsIdx !== undefined && rpmIdx !== undefined,
    fuelType,
    engineFamily,
    gear: gear || null,
  };
}

// ─── AI Prompt ────────────────────────────────────────────────────────────────
function buildPrompt(parsed, filename) {
  const { stats, totalRows, powerRunRows, hasThrottleFilter, fuelType, engineFamily, gear } = parsed;

  const fuelKey  = (fuelType  || 'e0').toLowerCase().replace('-','');
  const engKey   = (engineFamily || 'other').toUpperCase();
  const afrRange = ENGINE_AFR_TARGETS[engKey]?.[fuelKey] || ENGINE_AFR_TARGETS['other'][fuelKey] || [11.5, 12.5];
  const boostMax = ENGINE_BOOST_MAX[engKey]?.[fuelKey]   || ENGINE_BOOST_MAX['other'][fuelKey]   || 24;
  const knockW   = KNOCK_WARN[fuelKey] || 2.0;
  const knockC   = KNOCK_CRIT[fuelKey] || 3.5;

  const statsText = Object.entries(stats)
    .map(([ch, s]) => {
      const tag = s.fullThrottleOnly ? '[WOT 4000-7200 RPM ONLY]' : '[ALL DATA]';
      return `${ch.toUpperCase()} ${tag}: min=${s.min.toFixed(2)}, max=${s.max.toFixed(2)}, avg=${s.avg.toFixed(2)} (${s.count} samples)`;
    }).join('\n');

  const filterNote = hasThrottleFilter
    ? `DATA FILTER: WOT only (TPS ≥ 95%, RPM 4000–7200, post-lift-off trimmed). ${powerRunRows} qualifying rows from ${totalRows} total.${gear ? ` Gear ${gear} only.` : ''}`
    : `Note: Throttle/RPM not detected — using all ${totalRows} rows.`;

  return `You are an expert BMW performance tuner analyzing an ECU datalog.

FILE: ${filename}
ENGINE: ${engineFamily || 'Unknown'}
FUEL: ${fuelType?.toUpperCase() || 'Unknown'}${gear ? `\nGEAR: ${gear}` : ''}

${filterNote}

CHANNEL STATISTICS:
${statsText || 'No recognized channels found.'}

ENGINE-SPECIFIC THRESHOLDS FOR THIS TUNE:
- AFR target at WOT: ${afrRange[0]}–${afrRange[1]} (${fuelType} on ${engineFamily})
- Boost max expected: ${boostMax} psi
- Knock retard WARNING threshold: ${knockW}°, CRITICAL: ${knockC}°
- Timing pull on ANY cylinder at WOT = flag immediately
- On ${fuelType}: ${fuelKey === 'e0' ? 'conservative fueling, any lean spike is dangerous' : fuelKey === 'e85' ? 'ethanol allows more timing advance, lean AFR is still dangerous' : 'ethanol blend — richer AFR targets than pump gas'}

Return ONLY valid JSON, no markdown:
{
  "healthScore": <0-100>,
  "summary": "<2-3 sentences with specific values>",
  "grade": "<A|B|C|D|F>",
  "channels": {
    "coolant": { "status": "<OK|WARNING|CRITICAL|N/A>", "note": "<specific>", "min": <n|null>, "max": <n|null>, "avg": <n|null> },
    "iat":     { "status": "<OK|WARNING|CRITICAL|N/A>", "note": "<specific>", "min": <n|null>, "max": <n|null>, "avg": <n|null> },
    "timing":  { "status": "<OK|WARNING|CRITICAL|N/A>", "note": "<specific>", "min": <n|null>, "max": <n|null>, "avg": <n|null> },
    "knock":   { "status": "<OK|WARNING|CRITICAL|N/A>", "note": "<specific>", "min": <n|null>, "max": <n|null>, "avg": <n|null> },
    "afr":     { "status": "<OK|WARNING|CRITICAL|N/A>", "note": "<specific>", "min": <n|null>, "max": <n|null>, "avg": <n|null> },
    "boost":   { "status": "<OK|WARNING|CRITICAL|N/A>", "note": "<specific>", "min": <n|null>, "max": <n|null>, "avg": <n|null> },
    "battery": { "status": "<OK|WARNING|CRITICAL|N/A>", "note": "<specific>", "min": <n|null>, "max": <n|null>, "avg": <n|null> }
  },
  "recommendations": ["<rec 1>", "<rec 2>", "<rec 3>"],
  "professionalTuneNeeded": <true|false>
}

Scoring: A=90-100, B=80-89, C=70-79, D=60-69, F<60
Set professionalTuneNeeded=true if ANY CRITICAL or 2+ WARNINGs`;
}

// ─── Claude API ───────────────────────────────────────────────────────────────
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

// ─── Main ─────────────────────────────────────────────────────────────────────
export async function analyzeLog({ fileContent, filename, vehicleInfo, gear, fuelType, engineFamily }) {
  const parsed = parseCSV(fileContent, { gear, fuelType, engineFamily });
  const prompt = buildPrompt(parsed, filename);
  const report = await callClaude(prompt);

  // Fill nulls from local stats
  for (const [channel, localStats] of Object.entries(parsed.stats)) {
    if (report.channels[channel]) {
      const ch = report.channels[channel];
      if (ch.min == null) ch.min = parseFloat(localStats.min.toFixed(2));
      if (ch.max == null) ch.max = parseFloat(localStats.max.toFixed(2));
      if (ch.avg == null) ch.avg = parseFloat(localStats.avg.toFixed(2));
    }
  }

  const entry = {
    id:          Date.now().toString(),
    filename,
    carName:     vehicleInfo || 'Unknown Vehicle',
    gear:        gear || null,
    fuelType:    fuelType || 'e0',
    engineFamily:engineFamily || 'other',
    date:        new Date().toISOString(),
    healthScore: report.healthScore,
    grade:       report.grade || 'C',
    summary:     report.summary,
    channels:    report.channels,
    recommendations: report.recommendations,
    professionalTuneNeeded: report.professionalTuneNeeded || false,
    totalRows:   parsed.totalRows,
    powerRunRows:parsed.powerRunRows,
  };

  // AsyncStorage history
  try {
    const raw     = await AsyncStorage.getItem(HISTORY_KEY);
    const history = raw ? JSON.parse(raw) : [];
    history.unshift(entry);
    if (history.length > 10) history.splice(10);
    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch (e) { console.warn('LogAnalyzer: history save failed', e); }

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
