import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import apiService from '../../services/api';
import { DeliveryFailureReason } from '../../types';

const PRIMARY_COLOR = '#e26136';
const BG_LIGHT = '#f6f8f7';

const REASONS: { value: DeliveryFailureReason; label: string; description: string }[] = [
  {
    value: 'buyer_unavailable',
    label: 'Buyer unavailable',
    description: "Couldn't reach the buyer at the delivery address.",
  },
  {
    value: 'bad_address',
    label: 'Bad address',
    description: "The address given doesn't match a real location.",
  },
  {
    value: 'buyer_refused',
    label: 'Buyer refused',
    description: 'The buyer declined to accept the delivery.',
  },
];

/** 10.7: typed delivery-failure reporting for one order within an
 * accepted run. Financial consequences differ by reason (who bears the
 * cost of redelivery/return/dispose), so the reason itself matters --
 * not just "it failed." */
export default function ReportFailureScreen() {
  const router = useRouter();
  const { runId, orderId } = useLocalSearchParams<{ runId: string; orderId: string }>();
  const [selected, setSelected] = useState<DeliveryFailureReason | null>(null);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!runId || !orderId || !selected) return;
    setSubmitting(true);
    try {
      await apiService.reportDeliveryFailure(runId, orderId, selected, notes || undefined);
      Alert.alert('Reported', 'The failed delivery has been logged.', [
        { text: 'OK', onPress: () => router.replace({ pathname: '/(delivery)/run-details', params: { runId } } as any) },
      ]);
    } catch (error) {
      Alert.alert('Could not report this', 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={22} color="#1a1a1a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Report failed delivery</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sectionLabel}>What happened?</Text>
        {REASONS.map((r) => (
          <TouchableOpacity
            key={r.value}
            style={[styles.reasonCard, selected === r.value && styles.reasonCardSelected]}
            onPress={() => setSelected(r.value)}
          >
            <View style={styles.radioOuter}>
              {selected === r.value && <View style={styles.radioInner} />}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.reasonLabel}>{r.label}</Text>
              <Text style={styles.reasonDescription}>{r.description}</Text>
            </View>
          </TouchableOpacity>
        ))}

        <Text style={[styles.sectionLabel, { marginTop: 20 }]}>Additional notes (optional)</Text>
        <TextInput
          style={styles.notesInput}
          value={notes}
          onChangeText={setNotes}
          placeholder="Anything else worth noting..."
          multiline
          numberOfLines={4}
        />

        <TouchableOpacity
          style={[styles.submitButton, (!selected || submitting) && styles.submitButtonDisabled]}
          disabled={!selected || submitting}
          onPress={handleSubmit}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.submitButtonText}>Submit report</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG_LIGHT },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#1a1a1a' },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: { paddingHorizontal: 20, paddingBottom: 32 },
  sectionLabel: { fontSize: 12, fontWeight: '700', color: '#999', letterSpacing: 0.5, marginBottom: 10 },
  reasonCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#eee',
    padding: 14,
    marginBottom: 10,
  },
  reasonCardSelected: { borderColor: PRIMARY_COLOR, backgroundColor: PRIMARY_COLOR + '08' },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: PRIMARY_COLOR,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: PRIMARY_COLOR },
  reasonLabel: { fontSize: 14, fontWeight: '700', color: '#1a1a1a' },
  reasonDescription: { fontSize: 12, color: '#666', marginTop: 2 },
  notesInput: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 14,
    fontSize: 14,
    minHeight: 90,
    textAlignVertical: 'top',
  },
  submitButton: {
    backgroundColor: PRIMARY_COLOR,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 24,
  },
  submitButtonDisabled: { opacity: 0.5 },
  submitButtonText: { color: '#fff', fontSize: 14, fontWeight: '700', letterSpacing: 0.5 },
});
