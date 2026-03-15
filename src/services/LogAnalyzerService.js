import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

// ─── Anthropic API Key ────────────────────────────────────────────────────────
const ANTHROPIC_API_KEY = Constants.expoConfig?.extra?.anthropicApiKey || '';

const HISTORY_KEY = 'tunescore_history';

// ─── Stoichiometric ratios by fuel ────────────────────────────────────────────
const STOICH = { pump: 14.7, e30: 13.5, e40: 13.0, e45: 12.7, e85: 9.8 };

// ─── AFR targets per fuel (ideal / acceptable) ────────────────────────────────
const AFR_TARGETS = {
  pump: { ideal: [12.0, 12.8], acceptable: [11.5, 13.2] },
  e30:  { ideal: [11.8, 12.5], acceptable: [11.2, 13.0] },
  e40:  { ideal: [11.5, 12.3], acceptable: [11.0, 12.8] },
  e45:  { ideal: [11.3, 12.2], acceptable: [10.8, 12.5] },
  e85:  { ideal: [10.5, 11.5], acceptable: [10.0, 12.0] },
};

// ─── Column aliases ───────────────────────────────────────────────────────────
// Order matters — first match wins. More-specific names come first.
const CHANNEL_ALIASES = {
  // BM3: "Accel. Pedal[%]"  MHD: "Accel Ped. Pos. (%)"
  accelPedal: [
    'accel. pedal[%]', 'accel. pedal', 'accel ped. pos. (%)', 'accel ped. pos.',
    'accelerator pedal', 'accel pedal', 'pedal position', 'pedal',
    'throttle position sensor', 'app',
  ],
  // BM3: "Engine speed[1/min]"  MHD: no RPM column
  rpm: ['engine speed[1/min]', 'engine speed', 'rpm', 'engine rpm', 'n_eng'],
  // BM3: "Boost (Pre-Throttle)[psig]"  MHD: "Boost (PSI)"
  boostActual: [
    'boost (pre-throttle)[psig]', 'boost (pre-throttle)',
    'map[psig]', 'map',
    'boost (psi)', 'boost pressure (psi)', 'boost pressure', 'boost[psi]', 'boost',
    '(bm3) boost (map) custom[psig]',
  ],
  // BM3: "Boost pressure (Target)[psig]"  MHD: "Boost target (PSI)"
  boostTarget: [
    'boost pressure (target)[psig]', 'boost pressure (target)',
    'boost target (psi)', 'boost target', 'target boost',
  ],
  // BM3: "Boost Pressure (Deviation)[psia]"  MHD: "Boost deviation (PSI)"
  boostDev: [
    'boost pressure (deviation)[psia]', 'boost pressure (deviation)',
    'boost deviation (psi)', 'boost deviation',
  ],
  // BM3: "Lambda Act.[AFR]" (lambda ratio — needs ×stoich)
  // MHD: "Lambda 1 (AFR)" (already AFR)
  afrBank1: [
    'lambda act.[afr]', 'lambda act. (bank 1)[afr]', 'lambda act. (bank 1)[-]',
    'lambda act. (bank 1)', 'lambda act.',
    'lambda 1 (afr)', 'lambda 1', 'afr', 'lambda', 'o2 bank 1',
  ],
  afrBank2: [
    'lambda act. (bank 2)[afr]', 'lambda act. (bank 2)[-]', 'lambda act. (bank 2)',
    'lambda 2 (afr)', 'lambda 2', 'o2 bank 2',
  ],
  // BM3: "(RAM) Ignition Timing Corr. Cyl. N[-|°]"
  // MHD: "Cyl1 Timing Cor (*)" … "Cyl8 Timing Cor (*)"
  knockCyl1: [
    '(ram) ignition timing corr. cyl. 1[-]', '(ram) ignition timing corr. cyl. 1[°]',
    '(ram) ignition timing corr. cyl. 1',
    'cyl1 timing cor (*)', 'cyl1 timing cor', 'knock cyl 1', 'knock correction 1',
  ],
  knockCyl2: [
    '(ram) ignition timing corr. cyl. 2[-]', '(ram) ignition timing corr. cyl. 2[°]',
    '(ram) ignition timing corr. cyl. 2',
    'cyl2 timing cor (*)', 'cyl2 timing cor', 'knock cyl 2', 'knock correction 2',
  ],
  knockCyl3: [
    '(ram) ignition timing corr. cyl. 3[-]', '(ram) ignition timing corr. cyl. 3[°]',
    '(ram) ignition timing corr. cyl. 3',
    'cyl3 timing cor (*)', 'cyl3 timing cor', 'knock cyl 3', 'knock correction 3',
  ],
  knockCyl4: [
    '(ram) ignition timing corr. cyl. 4[-]', '(ram) ignition timing corr. cyl. 4[°]',
    '(ram) ignition timing corr. cyl. 4',
    'cyl4 timing cor (*)', 'cyl4 timing cor', 'knock cyl 4', 'knock correction 4',
  ],
  knockCyl5: [
    '(ram) ignition timing corr. cyl. 5[-]', '(ram) ignition timing corr. cyl. 5[°]',
    '(ram) ignition timing corr. cyl. 5',
    'cyl5 timing cor (*)', 'cyl5 timing cor', 'knock cyl 5', 'knock correction 5',
  ],
  knockCyl6: [
    '(ram) ignition timing corr. cyl. 6[-]', '(ram) ignition timing corr. cyl. 6[°]',
    '(ram) ignition timing corr. cyl. 6',
    'cyl6 timing cor (*)', 'cyl6 timing cor', 'knock cyl 6', 'knock correction 6',
  ],
  knockCyl7: ['cyl7 timing cor (*)', 'cyl7 timing cor', 'knock cyl 7', 'knock correction 7'],
  knockCyl8: ['cyl8 timing cor (*)', 'cyl8 timing cor', 'knock cyl 8', 'knock correction 8'],
  // IAT: BM3 "IAT[F]"  MHD: "IAT (*F)" or "Charge air temp. (*F)"
  iat: [
    'iat[f]', 'iat (*f)', 'iat', 'intake air temp', 'intake air temperature',
    'charge air temp. (*f)', 'charge air temp.', 'air temp', 't_ansaug',
  ],
  coolant: ['coolant temp[f]', 'coolant temp', 'coolant temperature', 'water temp', 't_water'],
  throttleAngle: [
    'throttle angle[%]', 'throttle angle', 'throttle position', 'throttle',
    'throttle pos.', 'throttle pos.[%]', 'throttle valve pos.', 'throttle valve[%]',
  ],
  gear:    ['gear[-]', 'gear', 'current gear'],
  ethanol: ['(bm3) flex ethanol % (main)[%]', 'flex ethanol %', 'ethanol content', 'flex %'],
  battery: ['battery voltage', 'battery', 'batt v', 'voltage', 'supply voltage'],
  ignTiming: ['ignition timing 1[deg]', 'ignition timing 1', 'ignition timing', 'ign timing'],
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function findCol(headers, aliases) {
  const lower = headers.map(h => h.toLowerCase().trim());
  for (const alias of aliases) {
    const idx = lower.findIndex(h => h === alias);
    if (idx >= 0) return idx;
  }
  // Fallback: partial match
  for (const alias of aliases) {
    const idx = lower.findIndex(h => h.includes(alias));
    if (idx >= 0) return idx;
  }
  return -1;
}

function pct(arr, p) {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length * p)] ?? sorted[sorted.length - 1];
}

// Convert lambda ratio → AFR if needed
// BM3 stores lambda (< 2.0); MHD stores AFR directly
function toAFR(val, fuelKey) {
  if (val < 2.0) return val * (STOICH[fuelKey] || 14.7);
  return val;
}

// AFR validity filter — strip sentinels (BM3: 19.11, MHD: 235.2) and junk
function isValidAFRRaw(val) {
  return val > 8 && val < 20;
}

// ─── CSV Parser ───────────────────────────────────────────────────────────────
export function parseCSV(csvText, options = {}) {
  const { gear, fuelType = 'pump', motorType = 'stock' } = options;

  // Normalize line endings (MHD uses \r\n)
  const normalized = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Strip comment/metadata lines (MHD uses # prefix)
  const lines = normalized
    .split('\n')
    .filter(l => {
      const t = l.trim();
      return t.length > 0 && !t.startsWith('#') && !t.startsWith(';') && !t.startsWith('//');
    });

  if (lines.length < 2) throw new Error('CSV file is empty or has no data rows.');

  // Find header line
  let headerIdx = 0;
  for (let i = 0; i < Math.min(10, lines.length); i++) {
    const lower = lines[i].toLowerCase();
    if (lower.includes('time') || lower.includes('rpm') || lower.includes('engine speed') ||
        lower.includes('boost') || lower.includes('accel')) {
      headerIdx = i;
      break;
    }
  }

  const rawHeaders = lines[headerIdx].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const dataLines  = lines.slice(headerIdx + 1);

  // Map all channels to column indices
  const colMap = {};
  for (const [channel, aliases] of Object.entries(CHANNEL_ALIASES)) {
    const idx = findCol(rawHeaders, aliases);
    if (idx >= 0) colMap[channel] = idx;
  }

  // Parse all rows
  const allRows = dataLines
    .map(line => line.split(',').map(v => v.trim().replace(/^"|"$/g, '')))
    .filter(cols => cols.length >= rawHeaders.length / 2);

  const getNum = (row, channel) => {
    const idx = colMap[channel];
    if (idx === undefined || !row[idx]) return null;
    const n = parseFloat(row[idx]);
    return isNaN(n) ? null : n;
  };

  // ── WOT Detection (spec-accurate) ─────────────────────────────────────────
  // Check what data we actually have
  const hasRpm    = allRows.some(r => (getNum(r, 'rpm') ?? 0) > 0);
  const hasPedal  = allRows.some(r => {
    const p = getNum(r, 'accelPedal') ?? getNum(r, 'throttleAngle') ?? 0;
    return p > 0;
  });

  const isWOT = (row) => {
    const pedal   = getNum(row, 'accelPedal') ?? getNum(row, 'throttleAngle') ?? 0;
    const rpm     = getNum(row, 'rpm') ?? 0;
    const boost   = getNum(row, 'boostActual') ?? 0;
    const atPedal = pedal > 85;

    if (hasPedal && hasRpm)  return atPedal && rpm > 2500;
    if (hasPedal && !hasRpm) return atPedal && boost > 3;   // MHD: no RPM col
    return rpm > 3000 && boost > 5;                          // No pedal col
  };

  let wotRows = allRows.filter(isWOT);

  // Gear filter
  if (gear && gear !== 'Any' && colMap['gear'] !== undefined) {
    wotRows = wotRows.filter(r => {
      const g = getNum(r, 'gear');
      return g !== null && g === parseFloat(gear);
    });
  }

  // ── Boost target inference ─────────────────────────────────────────────────
  const fullBoostRows = wotRows.filter(r => (getNum(r, 'boostActual') ?? 0) > 10);
  const boostActuals  = fullBoostRows.map(r => getNum(r, 'boostActual')).filter(Boolean);
  const boostTargets  = fullBoostRows.map(r => getNum(r, 'boostTarget')).filter(Boolean);
  const peakActual    = boostActuals.length ? Math.max(...boostActuals) : 0;
  const logTarget     = boostTargets.length ? Math.max(...boostTargets) : 0;
  const p90Boost      = pct(boostActuals, 0.90);
  // If log target is within 5 psi of peak, trust it; otherwise infer from p90
  const realTarget    = Math.abs(peakActual - logTarget) <= 5 ? logTarget : p90Boost;

  // ── Per-cylinder knock stats ───────────────────────────────────────────────
  const knockCols = ['knockCyl1','knockCyl2','knockCyl3','knockCyl4',
                     'knockCyl5','knockCyl6','knockCyl7','knockCyl8'];
  const detectedKnockCols = knockCols.filter(k => colMap[k] !== undefined);
  const cylinderCount = detectedKnockCols.length || 4;

  // Worst correction per cylinder across all WOT rows
  const worstPerCyl = detectedKnockCols.map(col => {
    const vals = wotRows.map(r => getNum(r, col)).filter(v => v !== null);
    return vals.length ? Math.min(...vals) : 0;
  });

  const cylsKnocking = worstPerCyl.filter(v => v < -0.5).length;
  const maxKnockCorr = worstPerCyl.length ? Math.min(...worstPerCyl) : 0;

  // ── AFR stats (sentinel-filtered) ─────────────────────────────────────────
  const fuelKey = fuelType.toLowerCase().replace('-', '');
  const afrRaws = wotRows
    .map(r => getNum(r, 'afrBank1'))
    .filter(v => v !== null)
    .map(v => toAFR(v, fuelKey))
    .filter(isValidAFRRaw);

  const avgAFR  = afrRaws.length ? afrRaws.reduce((a, b) => a + b, 0) / afrRaws.length : null;
  const minAFR  = afrRaws.length ? Math.min(...afrRaws) : null;
  const maxAFR  = afrRaws.length ? Math.max(...afrRaws) : null;

  // ── IAT stats ─────────────────────────────────────────────────────────────
  const iatVals  = wotRows.map(r => getNum(r, 'iat')).filter(v => v !== null && v > 0 && v < 250);
  const avgIAT   = iatVals.length ? iatVals.reduce((a, b) => a + b, 0) / iatVals.length : null;
  const iatRise  = iatVals.length >= 2 ? iatVals[iatVals.length - 1] - iatVals[0] : 0;

  // ── Boost deviations ─────────────────────────────────────────────────────
  const hasDevCol   = fullBoostRows.some(r => (getNum(r, 'boostDev') ?? 0) !== 0);
  const boostDevs   = fullBoostRows.map(r => {
    if (hasDevCol) return Math.abs(getNum(r, 'boostDev') ?? 0);
    return Math.abs((getNum(r, 'boostActual') ?? 0) - realTarget);
  }).filter(v => v >= 0 && v < 20);
  const avgBoostDev = boostDevs.length ? boostDevs.reduce((a, b) => a + b, 0) / boostDevs.length : null;
  const maxBoostDev = boostDevs.length ? Math.max(...boostDevs) : null;

  // ── Ethanol detection ─────────────────────────────────────────────────────
  const ethanolVals = allRows.map(r => getNum(r, 'ethanol')).filter(v => v !== null && v > 0 && v <= 100);
  const detectedEthanol = ethanolVals.length
    ? Math.round(ethanolVals.reduce((a, b) => a + b, 0) / ethanolVals.length)
    : null;

  return {
    headers: rawHeaders,
    colMap,
    wotRows,
    totalRows:       allRows.length,
    powerRunRows:    wotRows.length,
    cylinderCount,
    worstPerCyl,
    cylsKnocking,
    maxKnockCorr,
    peakBoost:       peakActual,
    realTarget,
    avgBoostDev,
    maxBoostDev,
    avgAFR,
    minAFR,
    maxAFR,
    avgIAT,
    iatRise,
    detectedEthanol,
    fuelType:        fuelKey,
    motorType,
    gear:            gear || null,
    hasRpm,
    hasPedal,
    hasDevCol,
  };
}

// ─── AI Prompt ────────────────────────────────────────────────────────────────
function buildPrompt(parsed, filename) {
  const {
    totalRows, powerRunRows, cylinderCount,
    worstPerCyl, cylsKnocking, maxKnockCorr,
    peakBoost, realTarget, avgBoostDev, maxBoostDev,
    avgAFR, minAFR, maxAFR,
    avgIAT, iatRise,
    detectedEthanol, fuelType, motorType,
    hasRpm, hasPedal,
  } = parsed;

  const fuelKey = fuelType || 'pump';
  const afrTarget = AFR_TARGETS[fuelKey] || AFR_TARGETS['pump'];
  const isBuilt = motorType === 'built';

  // Knock thresholds
  const knockThresh = isBuilt
    ? { mild: -2.5, moderate: -5.0, severe: -8.0 }
    : { mild: -1.5, moderate: -3.0, severe: -5.0 };

  const knockPens = isBuilt
    ? { mild: 2, moderate: 6, severe: 14, critical: 22 }
    : { mild: 3, moderate: 8, severe: 18, critical: 28 };

  const spreadThreshold = isBuilt ? 6 : 5;

  // Per-cyl knock summary
  const cylKnockLines = worstPerCyl
    .map((v, i) => `  Cyl ${i + 1}: worst ${v.toFixed(1)}°`)
    .join('\n');

  // Boost deviation context
  const boostDevText = avgBoostDev !== null
    ? `avg dev from target: ${avgBoostDev.toFixed(2)} psi, max dev: ${(maxBoostDev ?? 0).toFixed(1)} psi, inferred target: ${realTarget.toFixed(1)} psi`
    : 'no boost deviation data';

  // AFR context
  const afrText = avgAFR !== null
    ? `avg: ${avgAFR.toFixed(2)}, min: ${(minAFR ?? 0).toFixed(2)}, max: ${(maxAFR ?? 0).toFixed(2)}`
    : 'no valid AFR data (sentinels filtered)';

  // IAT context
  const iatText = avgIAT !== null
    ? `avg: ${avgIAT.toFixed(0)}°F, rise during pull: ${iatRise.toFixed(0)}°F`
    : 'no IAT data';

  const ethanolNote = detectedEthanol !== null
    ? `Flex sensor detected ${detectedEthanol}% ethanol`
    : 'No flex sensor data';

  const wotMethod = hasPedal && hasRpm
    ? 'pedal >85% AND rpm >2500'
    : hasPedal
    ? 'pedal >85% AND boost >3 psi (MHD — no RPM col)'
    : 'rpm >3000 AND boost >5 psi (no pedal col)';

  return `You are an expert ECU tuning analyst. Score this datalog precisely.

FILE: ${filename}
FUEL: ${fuelKey.toUpperCase()}
MOTOR: ${motorType.toUpperCase()} (${isBuilt ? 'forged internals — relaxed thresholds' : 'stock internals — strict thresholds'})
WOT DETECTION METHOD: ${wotMethod}
WOT SAMPLES: ${powerRunRows} of ${totalRows} total rows
CYLINDERS DETECTED: ${cylinderCount}
${ethanolNote}

── KNOCK DATA (WOT only, worst correction per cylinder) ──
${cylKnockLines}
Cylinders with any knock (< -0.5°): ${cylsKnocking}
Worst single correction: ${maxKnockCorr.toFixed(1)}°
Thresholds for ${motorType}: mild=${knockThresh.mild}°, moderate=${knockThresh.moderate}°, severe=${knockThresh.severe}°
Penalties: mild=-${knockPens.mild}, moderate=-${knockPens.moderate}, severe=-${knockPens.severe}, critical=-${knockPens.critical}
Simultaneous knock multiplier: ×1.5 if 2+ cyls
Spread penalty: -12 pts if ${spreadThreshold}+ cyls knocking

── AFR DATA (WOT, sentinel-filtered: stripped >20 and <8) ──
${afrText}
Target for ${fuelKey.toUpperCase()}: ideal ${afrTarget.ideal[0]}–${afrTarget.ideal[1]}, acceptable ${afrTarget.acceptable[0]}–${afrTarget.acceptable[1]}
Scoring per sample: ideal=100, acceptable=75, lean=max(0, 75 - overLean×20), rich=max(50, 75 - overRich×5)

── BOOST DATA (WOT, > 10 psi rows only) ──
Peak boost: ${peakBoost.toFixed(1)} psi
${boostDevText}
${isBuilt ? 'Built penalties: avg>2=-15, avg>4=-20more, avg>6=-20more, max>7=-10warn' : 'Stock penalties: avg>1=-15, avg>3=-20more, avg>5=-20more, max>5=-10warn'}

── IAT DATA (WOT) ──
${iatText}
Scoring: <85°F=100, <95°F=85, <105°F=70, <115°F=50, ≥115°F=30. Heat soak (rise >10°F): -10 additional.

── SCORING WEIGHTS ──
Knock: 40%, AFR: 25%, Boost: 20%, IAT: 15%
Grade: A=90-100, B=80-89, C=70-79, D=60-69, F<60

Score each category 0-100 using the exact formulas above, then compute the weighted overall.
Return ONLY valid JSON, no markdown:
{
  "healthScore": <0-100 weighted overall>,
  "grade": "<A|B|C|D|F>",
  "summary": "<2-3 sentences with specific values from the data>",
  "channels": {
    "knock":  { "score": <0-100>, "status": "<OK|WARNING|CRITICAL>", "note": "<specific detail>" },
    "afr":    { "score": <0-100>, "status": "<OK|WARNING|CRITICAL|N/A>", "note": "<specific>" },
    "boost":  { "score": <0-100>, "status": "<OK|WARNING|CRITICAL|N/A>", "note": "<specific>" },
    "iat":    { "score": <0-100>, "status": "<OK|WARNING|CRITICAL|N/A>", "note": "<specific>" },
    "coolant":{ "score": null, "status": "N/A", "note": "not scored" },
    "timing": { "score": null, "status": "N/A", "note": "use knock corrections instead" },
    "battery":{ "score": null, "status": "N/A", "note": "not scored" }
  },
  "recommendations": ["<rec 1>", "<rec 2>", "<rec 3>"],
  "professionalTuneNeeded": <true if ANY CRITICAL or 2+ WARNINGs>
}`;
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
export async function analyzeLog({ fileContent, filename, vehicleInfo, gear, fuelType, motorType }) {
  const parsed = parseCSV(fileContent, { gear, fuelType, motorType });
  const prompt = buildPrompt(parsed, filename);
  const report = await callClaude(prompt);

  const entry = {
    id:           Date.now().toString(),
    filename,
    carName:      vehicleInfo || 'Unknown Vehicle',
    gear:         gear || null,
    fuelType:     parsed.fuelType,
    motorType:    motorType || 'stock',
    date:         new Date().toISOString(),
    healthScore:  report.healthScore,
    grade:        report.grade || 'C',
    summary:      report.summary,
    channels:     report.channels,
    recommendations:       report.recommendations,
    professionalTuneNeeded: report.professionalTuneNeeded || false,
    totalRows:    parsed.totalRows,
    powerRunRows: parsed.powerRunRows,
    // Key stats for history display
    stats: {
      peakBoost:      parsed.peakBoost,
      avgAFR:         parsed.avgAFR,
      maxKnockCorr:   parsed.maxKnockCorr,
      avgIAT:         parsed.avgIAT,
      cylinderCount:  parsed.cylinderCount,
      cylsKnocking:   parsed.cylsKnocking,
    },
  };

  // AsyncStorage history
  try {
    const raw     = await AsyncStorage.getItem(HISTORY_KEY);
    const history = raw ? JSON.parse(raw) : [];
    history.unshift(entry);
    if (history.length > 20) history.splice(20);
    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch (e) { console.warn('LogAnalyzer: history save failed', e); }

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
