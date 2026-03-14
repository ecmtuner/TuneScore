import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, Alert, StatusBar, TextInput,
} from 'react-native';

const FUEL_OPTIONS   = ['E0', 'E30', 'E50', 'E85'];
const ENGINE_OPTIONS = ['N55', 'B58', 'S55', 'S63', 'S58', 'N20', 'Other'];
const GEAR_OPTIONS   = ['Any', '3', '4', '5', '6'];
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { analyzeLog } from '../services/LogAnalyzerService';

const ACCENT = '#00ff88';
const RED    = '#ff4444';
const YELLOW = '#ffcc00';
const BG     = '#000';
const CARD   = '#111';
const BORDER = '#1a1a1a';

function scoreColor(score) {
  if (score >= 80) return ACCENT;
  if (score >= 60) return YELLOW;
  return RED;
}

function statusColor(status) {
  if (status === 'OK')       return ACCENT;
  if (status === 'WARNING')  return YELLOW;
  if (status === 'CRITICAL') return RED;
  return '#444';
}

function fmt(val) {
  if (val === null || val === undefined) return '—';
  return typeof val === 'number' ? val.toFixed(1) : String(val);
}

const CHANNELS = [
  { key: 'coolant', label: 'Coolant Temp',    icon: '🌡️', unit: '°C' },
  { key: 'iat',     label: 'Intake Air Temp', icon: '💨', unit: '°C' },
  { key: 'timing',  label: 'Ignition Timing', icon: '⚡', unit: '°' },
  { key: 'knock',   label: 'Knock / Retard',  icon: '🔔', unit: '°' },
  { key: 'afr',     label: 'AFR / Lambda',    icon: '🔥', unit: '' },
  { key: 'boost',   label: 'Boost Pressure',  icon: '💪', unit: '' },
  { key: 'battery', label: 'Battery Voltage', icon: '🔋', unit: 'V' },
];

function ChannelCard({ ch, data }) {
  if (!data) return null;
  const color = statusColor(data.status);
  const isNA = data.status === 'N/A';
  return (
    <View style={styles.channelCard}>
      <View style={styles.channelHeader}>
        <Text style={styles.channelIcon}>{ch.icon}</Text>
        <Text style={styles.channelLabel}>{ch.label}</Text>
        <View style={[styles.badge, { backgroundColor: color + '22', borderColor: color }]}>
          <Text style={[styles.badgeText, { color }]}>{data.status}</Text>
        </View>
      </View>
      {!isNA && (
        <View style={styles.statsRow}>
          {['min', 'avg', 'max'].map(k => (
            <View key={k} style={styles.statBox}>
              <Text style={styles.statLabel}>{k.toUpperCase()}</Text>
              <Text style={styles.statValue}>{fmt(data[k])}{ch.unit}</Text>
            </View>
          ))}
        </View>
      )}
      {data.note ? <Text style={styles.channelNote}>{data.note}</Text> : null}
    </View>
  );
}

function ReportView({ report, onReset }) {
  const scoreCol = scoreColor(report.healthScore);
  const gradeColors = { A: ACCENT, B: '#69f0ae', C: YELLOW, D: '#ff9800', F: RED };
  const gradeColor = gradeColors[report.grade] || YELLOW;

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.reportScroll}>

      {/* Score Card */}
      <LinearGradient colors={['#0a0a0a', '#000']} style={styles.scoreCard}>
        <View style={styles.scoreRow}>
          <View style={[styles.scoreRing, { borderColor: scoreCol }]}>
            <Text style={[styles.scoreNum, { color: scoreCol }]}>{report.healthScore}</Text>
            <Text style={styles.scoreSubLabel}>/ 100</Text>
          </View>
          <View style={[styles.gradeBadge, { borderColor: gradeColor, backgroundColor: gradeColor + '22' }]}>
            <Text style={[styles.gradeText, { color: gradeColor }]}>{report.grade}</Text>
          </View>
        </View>
        <Text style={styles.scoreSummary}>{report.summary}</Text>
        <Text style={styles.scoreFile}>📄 {report.filename} · {report.totalRows?.toLocaleString()} rows</Text>

        {report.professionalTuneNeeded && (
          <View style={styles.tuneAlert}>
            <Ionicons name="warning-outline" size={16} color={RED} style={{ marginRight: 6 }} />
            <Text style={styles.tuneAlertText}>Professional tune recommended</Text>
          </View>
        )}
      </LinearGradient>

      {/* Channels */}
      <Text style={styles.sectionTitle}>CHANNEL ANALYSIS</Text>
      {CHANNELS.map(ch => (
        <ChannelCard key={ch.key} ch={ch} data={report.channels?.[ch.key]} />
      ))}

      {/* Recommendations */}
      {report.recommendations?.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>RECOMMENDATIONS</Text>
          <View style={styles.recCard}>
            {report.recommendations.map((rec, i) => (
              <View key={i} style={styles.recRow}>
                <Text style={styles.recArrow}>→</Text>
                <Text style={styles.recText}>{rec}</Text>
              </View>
            ))}
          </View>
        </>
      )}

      {/* CTA */}
      <TouchableOpacity
        style={styles.ctaCard}
        onPress={() => Alert.alert('Get a Professional Tune', 'Visit ecmtuner.com to book a professional ECU tune and maximize your vehicle\'s performance.')}
      >
        <LinearGradient colors={['#1a1a1a', '#111']} style={styles.ctaCardInner}>
          <Text style={styles.ctaCardTitle}>🏎️ Want a better score?</Text>
          <Text style={styles.ctaCardDesc}>Get a professional ECU tune and unlock your car's full potential.</Text>
          <View style={styles.ctaCardBtn}>
            <Text style={styles.ctaCardBtnText}>Find a Tuner →</Text>
          </View>
        </LinearGradient>
      </TouchableOpacity>

      <TouchableOpacity style={styles.resetBtn} onPress={onReset}>
        <Ionicons name="add-circle-outline" size={18} color="#fff" style={{ marginRight: 6 }} />
        <Text style={styles.resetBtnText}>Analyze Another Log</Text>
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

export default function AnalyzerScreen() {
  const [file, setFile]           = useState(null);
  const [vehicleInfo, setVehicle] = useState('');
  const [loading, setLoading]     = useState(false);
  const [report, setReport]       = useState(null);
  const [fuelType, setFuelType]   = useState('E0');
  const [engineFamily, setEngine] = useState('Other');
  const [gear, setGear]           = useState('Any');

  const pickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/plain', 'application/octet-stream', '*/*'],
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const asset = result.assets?.[0];
      if (!asset) return;
      setFile({ name: asset.name, uri: asset.uri, size: asset.size });
      setReport(null);
    } catch (e) {
      Alert.alert('Error', 'Could not open file: ' + e.message);
    }
  };

  const runAnalysis = async () => {
    if (!file) return;
    setLoading(true);
    try {
      const content = await FileSystem.readAsStringAsync(file.uri);
      const result = await analyzeLog({
        fileContent:  content,
        filename:     file.name,
        vehicleInfo,
        fuelType:     fuelType.toLowerCase(),
        engineFamily: engineFamily === 'Other' ? 'other' : engineFamily,
        gear:         gear === 'Any' ? null : gear,
      });
      setReport(result);
    } catch (e) {
      Alert.alert('Analysis Failed', e.message);
    } finally {
      setLoading(false);
    }
  };

  const fileSizeLabel = (bytes) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  if (report) return <ReportView report={report} onReset={() => { setFile(null); setReport(null); }} />;

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={BG} />
      <ScrollView contentContainerStyle={styles.analyzeContainer}>

        <Text style={styles.pageTitle}>Log Analyzer</Text>
        <Text style={styles.pageSubtitle}>Upload any engine datalog CSV for an instant AI health report</Text>

        {/* Vehicle input */}
        <View style={styles.inputCard}>
          <Text style={styles.inputLabel}>VEHICLE (optional)</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. 2022 BMW M5 S63"
            placeholderTextColor="#444"
            value={vehicleInfo}
            onChangeText={setVehicle}
          />
        </View>

        {/* Tune Config */}
        <View style={styles.configCard}>
          <View style={styles.configRow}>
            <Text style={styles.configLabel}>ENGINE</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.pillRow}>
                {ENGINE_OPTIONS.map(e => (
                  <TouchableOpacity
                    key={e}
                    style={[styles.pill, engineFamily === e && styles.pillActive]}
                    onPress={() => setEngine(e)}
                  >
                    <Text style={[styles.pillText, engineFamily === e && styles.pillTextActive]}>{e}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>
          <View style={styles.configRow}>
            <Text style={styles.configLabel}>FUEL TYPE</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.pillRow}>
                {FUEL_OPTIONS.map(f => (
                  <TouchableOpacity
                    key={f}
                    style={[styles.pill, fuelType === f && styles.pillActive]}
                    onPress={() => setFuelType(f)}
                  >
                    <Text style={[styles.pillText, fuelType === f && styles.pillTextActive]}>{f}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>
          <View style={styles.configRow}>
            <Text style={styles.configLabel}>LOG GEAR</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.pillRow}>
                {GEAR_OPTIONS.map(g => (
                  <TouchableOpacity
                    key={g}
                    style={[styles.pill, gear === g && styles.pillActive]}
                    onPress={() => setGear(g)}
                  >
                    <Text style={[styles.pillText, gear === g && styles.pillTextActive]}>{g === 'Any' ? 'Any Gear' : `Gear ${g}`}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>
        </View>

        {/* Upload box */}
        <TouchableOpacity style={styles.uploadBox} onPress={pickFile} activeOpacity={0.7}>
          {file ? (
            <View style={styles.fileInfo}>
              <Ionicons name="document-text" size={34} color={ACCENT} />
              <Text style={styles.fileName} numberOfLines={2}>{file.name}</Text>
              <Text style={styles.fileSize}>{fileSizeLabel(file.size)}</Text>
              <Text style={styles.fileTapChange}>Tap to change</Text>
            </View>
          ) : (
            <View style={styles.uploadPrompt}>
              <Ionicons name="cloud-upload-outline" size={48} color="#333" />
              <Text style={styles.uploadText}>Tap to upload datalog</Text>
              <Text style={styles.uploadSubtext}>.csv or .txt — any ECU software</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Analyze button */}
        <TouchableOpacity
          style={[styles.analyzeBtn, (!file || loading) && styles.analyzeBtnDisabled]}
          onPress={runAnalysis}
          disabled={!file || loading}
        >
          {loading ? (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <ActivityIndicator color="#000" size="small" style={{ marginRight: 10 }} />
              <Text style={styles.analyzeBtnText}>Analyzing...</Text>
            </View>
          ) : (
            <Text style={styles.analyzeBtnText}>
              {file ? '🔍  Get My TuneScore' : 'Select a file first'}
            </Text>
          )}
        </TouchableOpacity>

        {/* Supported channels */}
        <View style={styles.checkList}>
          <Text style={styles.checkTitle}>CHANNELS ANALYZED</Text>
          <View style={styles.checkGrid}>
            {CHANNELS.map(ch => (
              <View key={ch.key} style={styles.checkItem}>
                <Text style={styles.checkIcon}>{ch.icon}</Text>
                <Text style={styles.checkLabel}>{ch.label}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  analyzeContainer: { padding: 20, paddingTop: 16 },

  pageTitle: { color: '#fff', fontSize: 24, fontWeight: '900', marginBottom: 6 },
  pageSubtitle: { color: '#555', fontSize: 14, marginBottom: 24, lineHeight: 20 },

  inputCard: { backgroundColor: CARD, borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: BORDER },
  inputLabel: { color: '#444', fontSize: 10, fontWeight: '700', letterSpacing: 1.5, marginBottom: 8 },
  input: { color: '#fff', fontSize: 15, padding: 0 },

  configCard: {
    backgroundColor: CARD, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: BORDER, marginBottom: 16, gap: 14,
  },
  configRow: { gap: 8 },
  configLabel: { color: '#444', fontSize: 10, fontWeight: '700', letterSpacing: 1.5 },
  pillRow: { flexDirection: 'row', gap: 8 },
  pill: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1, borderColor: '#222', backgroundColor: '#080808',
  },
  pillActive: { borderColor: ACCENT, backgroundColor: ACCENT + '22' },
  pillText: { color: '#444', fontSize: 12, fontWeight: '700' },
  pillTextActive: { color: ACCENT },

  uploadBox: {
    borderWidth: 2, borderColor: '#222', borderStyle: 'dashed',
    borderRadius: 16, padding: 36, alignItems: 'center',
    backgroundColor: '#080808', marginBottom: 16,
  },
  uploadPrompt: { alignItems: 'center' },
  uploadText: { color: '#777', fontSize: 16, fontWeight: '600', marginTop: 14 },
  uploadSubtext: { color: '#444', fontSize: 13, marginTop: 5 },
  fileInfo: { alignItems: 'center' },
  fileName: { color: '#fff', fontSize: 15, fontWeight: '700', marginTop: 10, textAlign: 'center' },
  fileSize: { color: '#555', fontSize: 13, marginTop: 4 },
  fileTapChange: { color: ACCENT, fontSize: 12, marginTop: 8 },

  analyzeBtn: {
    backgroundColor: ACCENT, borderRadius: 14, paddingVertical: 18,
    alignItems: 'center', marginBottom: 24,
  },
  analyzeBtnDisabled: { backgroundColor: '#111' },
  analyzeBtnText: { color: '#000', fontWeight: '900', fontSize: 16 },

  checkList: { backgroundColor: CARD, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: BORDER },
  checkTitle: { color: '#444', fontSize: 10, fontWeight: '700', letterSpacing: 1.5, marginBottom: 14 },
  checkGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  checkItem: { flexDirection: 'row', alignItems: 'center', width: '45%' },
  checkIcon: { fontSize: 15, marginRight: 6 },
  checkLabel: { color: '#666', fontSize: 13 },

  // Report
  reportScroll: { padding: 20 },
  scoreCard: { borderRadius: 20, padding: 22, marginBottom: 24, borderWidth: 1, borderColor: '#1a1a1a' },
  scoreRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 16 },
  scoreRing: {
    width: 88, height: 88, borderRadius: 44, borderWidth: 3,
    alignItems: 'center', justifyContent: 'center', backgroundColor: '#0a0a0a',
  },
  scoreNum: { fontSize: 28, fontWeight: '900', lineHeight: 32 },
  scoreSubLabel: { color: '#444', fontSize: 10 },
  gradeBadge: {
    width: 56, height: 56, borderRadius: 28, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
  },
  gradeText: { fontSize: 26, fontWeight: '900' },
  scoreSummary: { color: '#ccc', fontSize: 14, lineHeight: 21, marginBottom: 10 },
  scoreFile: { color: '#444', fontSize: 12 },
  tuneAlert: {
    flexDirection: 'row', alignItems: 'center', marginTop: 12,
    backgroundColor: '#ff444422', borderRadius: 8, padding: 10, borderWidth: 1, borderColor: '#ff444444',
  },
  tuneAlertText: { color: RED, fontSize: 13, fontWeight: '600' },

  sectionTitle: { color: '#333', fontSize: 11, fontWeight: '700', letterSpacing: 1.5, marginBottom: 10, marginTop: 4 },

  channelCard: {
    backgroundColor: CARD, borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: BORDER, marginBottom: 8,
  },
  channelHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  channelIcon: { fontSize: 16, marginRight: 8 },
  channelLabel: { color: '#fff', fontSize: 14, fontWeight: '700', flex: 1 },
  badge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1 },
  badgeText: { fontSize: 11, fontWeight: '800' },
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  statBox: { flex: 1, alignItems: 'center', backgroundColor: '#0a0a0a', borderRadius: 8, padding: 8 },
  statLabel: { color: '#444', fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  statValue: { color: '#fff', fontSize: 13, fontWeight: '800', marginTop: 2 },
  channelNote: { color: '#777', fontSize: 12, lineHeight: 18 },

  recCard: { backgroundColor: CARD, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: BORDER, marginBottom: 20, gap: 10 },
  recRow: { flexDirection: 'row', gap: 8 },
  recArrow: { color: ACCENT, fontWeight: '800', fontSize: 14 },
  recText: { color: '#bbb', fontSize: 13, lineHeight: 19, flex: 1 },

  ctaCard: { borderRadius: 16, overflow: 'hidden', marginBottom: 16 },
  ctaCardInner: { padding: 20, borderWidth: 1, borderColor: '#222', borderRadius: 16 },
  ctaCardTitle: { color: '#fff', fontSize: 16, fontWeight: '800', marginBottom: 6 },
  ctaCardDesc: { color: '#666', fontSize: 13, lineHeight: 19, marginBottom: 14 },
  ctaCardBtn: { backgroundColor: ACCENT, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 16, alignSelf: 'flex-start' },
  ctaCardBtnText: { color: '#000', fontWeight: '800', fontSize: 13 },

  resetBtn: {
    borderWidth: 1, borderColor: '#222', borderRadius: 12,
    paddingVertical: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center',
  },
  resetBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
