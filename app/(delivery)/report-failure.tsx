import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Button from '../../components/Button';
import SectionHeader from '../../components/SectionHeader';
import { colors, radius, spacing, typography } from '../../components/theme';
import apiService from '../../services/api';
import { DeliveryFailureReason } from '../../types';

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
      // Leave first, then say so. Navigating from inside the alert's
      // OK handler means not navigating at all when the alert is
      // dismissed another way -- an Android alert tapped outside of
      // fires nothing -- which left the rider on a form they had
      // already submitted, free to submit it again. Same fix as
      // pod-scan.
      router.replace({ pathname: '/(delivery)/active-delivery', params: { kind: 'run', id: runId } });
      Alert.alert('Reported', 'The failed delivery has been logged.');
    } catch (error) {
      console.error('Error reporting failure:', error);
      Alert.alert('Could not report this', 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={8}
        >
          <MaterialIcons name="arrow-back" size={22} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Report failed delivery</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <SectionHeader title="What happened?" />
        {REASONS.map((r) => {
          const chosen = selected === r.value;
          return (
            <Pressable
              key={r.value}
              style={[styles.reasonCard, chosen && styles.reasonCardSelected]}
              onPress={() => setSelected(r.value)}
              accessibilityRole="radio"
              accessibilityState={{ selected: chosen }}
              accessibilityLabel={`${r.label}. ${r.description}`}
            >
              <View style={[styles.radioOuter, chosen && styles.radioOuterSelected]}>
                {chosen && <View style={styles.radioInner} />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.reasonLabel}>{r.label}</Text>
                <Text style={styles.reasonDescription}>{r.description}</Text>
              </View>
            </Pressable>
          );
        })}

        <SectionHeader title="Additional notes (optional)" style={{ marginTop: 20 }} />
        <TextInput
          style={styles.notesInput}
          value={notes}
          onChangeText={setNotes}
          placeholder="Anything else worth noting..."
          placeholderTextColor={colors.textMuted}
          multiline
        />

        <Button
          label="Submit report"
          onPress={handleSubmit}
          loading={submitting}
          disabled={!selected}
          style={styles.submit}
        />
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.screenX,
    paddingVertical: spacing.sm,
  },
  headerTitle: { ...typography.subtitle, color: colors.textPrimary },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: { paddingHorizontal: 20, paddingBottom: 32 },
  reasonCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.background,
    borderRadius: radius,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 10,
  },
  reasonCardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryMuted,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    // Unselected radios were already brand-orange, so every option looked
    // half-chosen and the actual choice was hard to pick out.
    borderColor: colors.surfaceDim,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  radioOuterSelected: { borderColor: colors.primary },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
  reasonLabel: { ...typography.bodyBold, fontSize: 14, color: colors.textPrimary },
  reasonDescription: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
    lineHeight: 17,
  },
  notesInput: {
    backgroundColor: colors.surface,
    borderRadius: radius,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    ...typography.secondary,
    color: colors.textPrimary,
    minHeight: 90,
    textAlignVertical: 'top',
  },
  submit: { marginTop: spacing.md },
});
