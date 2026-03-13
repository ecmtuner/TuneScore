import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, StatusBar, Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { getAnalysisHistory, clearAnalysisHistory } from '../services/LogAnalyzerService';

const ACCENT = '#00ff88';
const RED    = '#ff4444';
const YELLOW = '#ffcc00';
const BG     = '#000';
const CARD   = '#111';
const BORDER = '#1a1a1a';

function scoreColor(s) {
  if (s >= 80) return ACCENT;
  if (s >= 60) return YELLOW;
  return RED;
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function HistoryScreen({ navigation }) {
  const [history, setHistory] = useState([]);

  useFocusEffect(useCallback(() => {
    getAnalysisHistory().then(setHistory);
  }, []));

  const handleClear = () => {
    Alert.alert('Clear History', 'Delete all saved analyses?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear All', style: 'destructive', onPress: async () => {
        await clearAnalysisHistory();
        setHistory([]);
      }},
    ]);
  };

  if (history.length === 0) {
    return (
      <View style={styles.root}>
        <StatusBar barStyle="light-content" />
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>📂</Text>
          <Text style={styles.emptyTitle}>No analyses yet</Text>
          <Text style={styles.emptySub}>Your TuneScore reports will appear here</Text>
          <TouchableOpacity style={styles.emptyBtn} onPress={() => navigation.navigate('Analyzer')}>
            <Text style={styles.emptyBtnText}>Analyze a Log</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.header}>{history.length} Analyses</Text>

        {history.map(item => (
          <TouchableOpacity
            key={item.id}
            style={styles.card}
            onPress={() => navigation.navigate('Analyzer', { report: item })}
          >
            <View style={[styles.scoreCircle, { borderColor: scoreColor(item.healthScore) }]}>
              <Text style={[styles.scoreNum, { color: scoreColor(item.healthScore) }]}>{item.healthScore}</Text>
            </View>
            <View style={styles.cardInfo}>
              <Text style={styles.cardFilename} numberOfLines={1}>{item.filename}</Text>
              <Text style={styles.cardVehicle}>{item.vehicleInfo}</Text>
              <Text style={styles.cardDate}>{formatDate(item.date)}</Text>
            </View>
            <View style={styles.cardRight}>
              <Text style={[styles.grade, { color: scoreColor(item.healthScore) }]}>{item.grade}</Text>
              <Ionicons name="chevron-forward" size={16} color="#333" style={{ marginTop: 4 }} />
            </View>
          </TouchableOpacity>
        ))}

        <TouchableOpacity style={styles.clearBtn} onPress={handleClear}>
          <Text style={styles.clearBtnText}>Clear All History</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  scroll: { padding: 20 },
  header: { color: '#444', fontSize: 12, fontWeight: '700', letterSpacing: 1.5, marginBottom: 16 },

  card: {
    backgroundColor: CARD, borderRadius: 14, padding: 14,
    flexDirection: 'row', alignItems: 'center', marginBottom: 8,
    borderWidth: 1, borderColor: BORDER,
  },
  scoreCircle: {
    width: 48, height: 48, borderRadius: 24, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  scoreNum: { fontSize: 16, fontWeight: '900' },
  cardInfo: { flex: 1 },
  cardFilename: { color: '#fff', fontSize: 13, fontWeight: '700' },
  cardVehicle: { color: ACCENT, fontSize: 12, marginTop: 2 },
  cardDate: { color: '#444', fontSize: 11, marginTop: 2 },
  cardRight: { alignItems: 'center' },
  grade: { fontSize: 18, fontWeight: '900' },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyIcon: { fontSize: 52, marginBottom: 14 },
  emptyTitle: { color: '#fff', fontSize: 18, fontWeight: '800', marginBottom: 6 },
  emptySub: { color: '#444', fontSize: 14, textAlign: 'center', marginBottom: 24 },
  emptyBtn: { backgroundColor: ACCENT, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 28 },
  emptyBtnText: { color: '#000', fontWeight: '900', fontSize: 15 },

  clearBtn: { alignItems: 'center', padding: 16, marginTop: 8 },
  clearBtnText: { color: '#333', fontSize: 13 },
});
