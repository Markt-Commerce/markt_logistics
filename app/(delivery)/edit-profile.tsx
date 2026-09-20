import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Button from '../../components/Button';
import { colors, radius, spacing, typography } from '../../components/theme';
import apiService from '../../services/api';
import { DeliveryPartner } from '../../types';

/**
 * The two things a rider can change about themselves.
 *
 * Its own screen because the profile was the form: a name field and a
 * vehicle picker sat permanently open above everything else, so the
 * screen's whole shape was "fill this in" when the thing a rider
 * actually opens it for is to reach their jobs, their earnings, or the
 * way out.
 */

const VEHICLES: { value: string; label: string; icon: keyof typeof MaterialIcons.glyphMap }[] = [
  { value: 'BIKE', label: 'Bike', icon: 'two-wheeler' },
  { value: 'CAR', label: 'Car', icon: 'directions-car' },
  { value: 'VAN', label: 'Van', icon: 'local-shipping' },
];

export default function EditProfileScreen() {
  const router = useRouter();
  const [partner, setPartner] = useState<DeliveryPartner | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [vehicle, setVehicle] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const me = await apiService.getCurrentPartner();
      setPartner(me);
      setName(me.name ?? '');
      setVehicle(me.vehicleType ?? null);
    } catch (error) {
      console.error('Could not load profile:', error);
      setNotice('Could not load your details. Pull back and try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Suspends on its first statement, so nothing is set synchronously.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const dirty =
    !!partner &&
    (name.trim() !== (partner.name ?? '') || vehicle !== (partner.vehicleType ?? null));

  const save = async () => {
    if (!dirty) return;
    setSaving(true);
    setNotice(null);
    try {
      await apiService.updatePartner({
        name: name.trim() || undefined,
        vehicleType: vehicle ?? undefined,
      });
      // Straight back, because saving is the only reason to be here and
      // a "Saved." on a screen nobody has a reason to stay on is a
      // message read by nobody.
      router.back();
    } catch (error: any) {
      setNotice(error?.message || 'Could not save that. Try again.');
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.screen} edges={['top']}>
        <ActivityIndicator color={colors.primary} style={{ flex: 1 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <MaterialIcons name="arrow-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Your details</Text>
        <View style={{ width: 22 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {!!notice && <Text style={styles.notice}>{notice}</Text>}

          <Text style={styles.label}>NAME</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Your name"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="words"
            maxLength={100}
          />

          <Text style={[styles.label, { marginTop: spacing.md }]}>VEHICLE</Text>
          <View style={styles.vehicleRow}>
            {VEHICLES.map((option) => {
              const chosen = vehicle === option.value;
              return (
                <Pressable
                  key={option.value}
                  style={[styles.vehicle, chosen && styles.vehicleChosen]}
                  onPress={() => setVehicle(option.value)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: chosen }}
                  accessibilityLabel={option.label}
                >
                  <MaterialIcons
                    name={option.icon}
                    size={20}
                    color={chosen ? colors.primary : colors.textSecondary}
                  />
                  <Text style={[styles.vehicleText, chosen && styles.vehicleTextChosen]}>
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Button
            label="Save changes"
            onPress={save}
            loading={saving}
            disabled={!dirty}
            style={{ marginTop: spacing.md }}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.screenX,
    paddingVertical: 12,
  },
  headerTitle: { ...typography.subtitle, color: colors.textPrimary },
  content: { paddingHorizontal: spacing.screenX, paddingBottom: 40 },
  notice: { ...typography.caption, color: colors.error, marginBottom: 12 },
  label: { ...typography.label, color: colors.textMuted, marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius,
    paddingHorizontal: 14,
    height: 48,
    ...typography.body,
    color: colors.textPrimary,
  },
  vehicleRow: { flexDirection: 'row', gap: 10 },
  vehicle: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: radius,
    borderWidth: 1,
    borderColor: colors.border,
  },
  vehicleChosen: { borderColor: colors.primary, backgroundColor: colors.primaryMuted },
  vehicleText: { ...typography.caption, color: colors.textSecondary },
  vehicleTextChosen: { color: colors.primary, fontWeight: '700' },
});
