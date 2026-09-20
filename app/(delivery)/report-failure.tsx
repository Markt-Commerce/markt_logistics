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

/** Typed delivery-failure reporting, for both delivery models.
 *
 * Financial consequences differ by reason -- who bears the cost of a
 * redelivery, a return or a disposal -- so the reason itself matters,
 * not just "it failed".
 *
 * `mode` picks which call to make, the same way pod-scan does. A run
 * reports against the run and the order; a single order reports
 * against the assignment, because that is what identifies this
 * rider's attempt at it. */
export default function ReportFailureScreen() {
  const router = useRouter();
  const { mode, runId, orderId, assignmentId } = useLocalSearchParams<{
    mode?: 'run' | 'order';
    runId?: string;
    orderId?: string;
    assignmentId?: string;
  }>();
  const isOrderMode = mode === 'order';
  const [selected, setSelected] = useState<DeliveryFailureReason | null>(null);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!selected) return;
    if (isOrderMode ? !assignmentId : !runId || !orderId) return;
    setSubmitting(true);
    try {
      // Leave first, then say so. Navigating from inside the alert's
      // OK handler means not navigating at all when the alert is
      // dismissed another way -- an Android alert tapped outside of
      // fires nothing -- which left the rider on a form they had
      // already submitted, free to submit it again. Same fix as
      // pod-scan.
      if (isOrderMode) {
        await apiService.reportAssignmentFailure(
          assignmentId!,
          selected,
          notes || undefined
        );
        // Back to the dashboard, not to the delivery: reporting a
        // single-order failure releases the assignment, so there is
        // no longer a delivery to return to.
        router.replace('/(delivery)/availability-toggle');
        Alert.alert(
          'Reported',
          'This delivery has been logged as failed and is off your list.'
        );
        return;
      }

      await apiService.reportDeliveryFailure(runId!, orderId!, selected, notes || undefined);
      router.replace({ pathname: '/(delivery)/active-delivery', params: { kind: 'run', id: runId! } });
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
