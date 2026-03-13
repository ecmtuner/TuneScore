import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, StatusBar, Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

export default function HomeScreen({ navigation }) {
  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* Hero */}
        <LinearGradient colors={['#0a0a0a', '#000']} style={styles.hero}>
          <View style={styles.logoRow}>
            <Text style={styles.logoIcon}>⚡</Text>
            <Text style={styles.logoText}>TuneScore</Text>
          </View>
          <Text style={styles.heroTagline}>AI-Powered Engine Log Analysis</Text>
          <Text style={styles.heroSub}>
            Upload any ECU datalog and get an instant AI health report with a score, grade, and actionable recommendations.
          </Text>
        </LinearGradient>

        {/* Main CTA */}
        <TouchableOpacity
          style={styles.ctaBtn}
          onPress={() => navigation.navigate('Analyzer')}
          activeOpacity={0.85}
        >
          <LinearGradient colors={['#00ff88', '#00cc6a']} style={styles.ctaGradient}>
            <Ionicons name="cloud-upload-outline" size={22} color="#000" style={{ marginRight: 10 }} />
            <Text style={styles.ctaBtnText}>Analyze My Log</Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* Feature cards */}
        <Text style={styles.sectionTitle}>WHAT WE ANALYZE</Text>
        <View style={styles.featureGrid}>
          {FEATURES.map((f, i) => (
            <View key={i} style={styles.featureCard}>
              <Text style={styles.featureIcon}>{f.icon}</Text>
              <Text style={styles.featureLabel}>{f.label}</Text>
            </View>
          ))}
        </View>

        {/* How it works */}
        <Text style={styles.sectionTitle}>HOW IT WORKS</Text>
        <View style={styles.stepsCard}>
          {STEPS.map((s, i) => (
            <View key={i} style={styles.stepRow}>
              <View style={styles.stepNum}>
                <Text style={styles.stepNumText}>{i + 1}</Text>
              </View>
              <View style={styles.stepInfo}>
                <Text style={styles.stepTitle}>{s.title}</Text>
                <Text style={styles.stepDesc}>{s.desc}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Supported formats */}
        <Text style={styles.sectionTitle}>SUPPORTED FORMATS</Text>
        <View style={styles.formatsCard}>
          {FORMATS.map((f, i) => (
            <View key={i} style={styles.formatPill}>
              <Text style={styles.formatText}>{f}</Text>
            </View>
          ))}
        </View>

        {/* History shortcut */}
        <TouchableOpacity style={styles.historyBtn} onPress={() => navigation.navigate('History')}>
          <Ionicons name="time-outline" size={18} color="#555" style={{ marginRight: 8 }} />
          <Text style={styles.historyBtnText}>View Previous Analyses</Text>
          <Ionicons name="chevron-forward" size={16} color="#555" />
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const FEATURES = [
  { icon: '🌡️', label: 'Coolant Temp' },
  { icon: '💨', label: 'Intake Air' },
  { icon: '⚡', label: 'Ignition Timing' },
  { icon: '🔔', label: 'Knock / Retard' },
  { icon: '🔥', label: 'AFR / Lambda' },
  { icon: '💪', label: 'Boost Pressure' },
  { icon: '🔋', label: 'Battery Voltage' },
  { icon: '📊', label: 'Health Score' },
];

const STEPS = [
  { title: 'Upload Your Log', desc: 'Select any CSV datalog from your ECU software' },
  { title: 'AI Analysis', desc: 'Our AI reviews every channel against safe thresholds' },
  { title: 'Get Your Score', desc: 'Receive a 0–100 health score, letter grade, and detailed report' },
];

const FORMATS = ['BM3', 'MHD', 'EcuTek', 'Cobb', 'HP Tuners', 'BurgerTuning', 'Generic OBD2', 'Any CSV'];

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  scroll: { paddingBottom: 20 },

  hero: { padding: 28, paddingTop: 60, paddingBottom: 32 },
  logoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  logoIcon: { fontSize: 28, marginRight: 8 },
  logoText: { fontSize: 32, fontWeight: '900', color: '#fff', letterSpacing: -1 },
  heroTagline: { color: '#00ff88', fontSize: 13, fontWeight: '700', letterSpacing: 2, marginBottom: 12 },
  heroSub: { color: '#888', fontSize: 15, lineHeight: 22 },

  ctaBtn: { marginHorizontal: 20, marginBottom: 32, borderRadius: 16, overflow: 'hidden' },
  ctaGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 18 },
  ctaBtnText: { color: '#000', fontWeight: '900', fontSize: 17 },

  sectionTitle: {
    color: '#444', fontSize: 11, fontWeight: '700', letterSpacing: 2,
    marginHorizontal: 20, marginBottom: 12, marginTop: 4,
  },

  featureGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    paddingHorizontal: 16, gap: 8, marginBottom: 28,
  },
  featureCard: {
    backgroundColor: '#111', borderRadius: 12, padding: 14,
    width: (width - 56) / 4, alignItems: 'center',
    borderWidth: 1, borderColor: '#1a1a1a',
  },
  featureIcon: { fontSize: 20, marginBottom: 6 },
  featureLabel: { color: '#666', fontSize: 10, fontWeight: '600', textAlign: 'center' },

  stepsCard: {
    backgroundColor: '#111', borderRadius: 16, marginHorizontal: 20,
    padding: 20, marginBottom: 28, borderWidth: 1, borderColor: '#1a1a1a', gap: 18,
  },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  stepNum: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#00ff8822', borderWidth: 1, borderColor: '#00ff88',
    alignItems: 'center', justifyContent: 'center',
  },
  stepNumText: { color: '#00ff88', fontWeight: '900', fontSize: 13 },
  stepInfo: { flex: 1 },
  stepTitle: { color: '#fff', fontWeight: '700', fontSize: 14, marginBottom: 2 },
  stepDesc: { color: '#666', fontSize: 13, lineHeight: 18 },

  formatsCard: {
    flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 20,
    gap: 8, marginBottom: 28,
  },
  formatPill: {
    backgroundColor: '#111', borderRadius: 20, paddingHorizontal: 14,
    paddingVertical: 7, borderWidth: 1, borderColor: '#222',
  },
  formatText: { color: '#888', fontSize: 12, fontWeight: '600' },

  historyBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    marginHorizontal: 20, padding: 16, borderRadius: 12,
    borderWidth: 1, borderColor: '#1a1a1a',
  },
  historyBtnText: { color: '#555', fontSize: 14, flex: 1, textAlign: 'center' },
});
