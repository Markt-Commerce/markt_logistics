/**
 * The rider's own page: their photo, their details, and the way out.
 *
 * There was no settings screen at all. Signing out lived in a floating
 * avatar menu with no label, riders could not change their own name, and
 * they could not add a photo because delivery_users had no column for one
 * -- buyers and sellers have had `profile_picture` on User since the
 * beginning, and the one person who turns up at a stranger's door was the
 * one with no face in the app. See markt_python's rider profile work.
 */

import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
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
import { useAuth } from '../../contexts/auth';
import apiService from '../../services/api';
import { DeliveryPartner } from '../../types';

const VEHICLES: { value: string; label: string; icon: keyof typeof MaterialIcons.glyphMap }[] = [
  { value: 'BIKE', label: 'Bike', icon: 'two-wheeler' },
  { value: 'CAR', label: 'Car', icon: 'directions-car' },
  { value: 'VAN', label: 'Van', icon: 'local-shipping' },
];

export default function ProfileScreen() {
  const router = useRouter();
  const { signOut } = useAuth();

  const [partner, setPartner] = useState<DeliveryPartner | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [name, setName] = useState('');
  const [vehicle, setVehicle] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const me = await apiService.getCurrentPartner();
      setPartner(me);
      setName(me.name ?? '');
      setVehicle(me.vehicleType ?? null);
    } catch (error) {
      console.error('Could not load profile:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    // The rule cannot see past the await: load() suspends on its first
    // statement, so nothing is set synchronously and there is no cascade.
    // Same shape as earnings.tsx, which the analyser happens not to trace.
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
      const updated = await apiService.updatePartner({
        name: name.trim(),
        vehicleType: vehicle ?? undefined,
      });
      setPartner(updated);
      setNotice('Saved.');
    } catch (error: any) {
      setNotice(error?.message || 'Could not save that. Try again.');
    } finally {
      setSaving(false);
    }
  };

  const pickPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setNotice('Markt needs access to your photos to set a picture.');
      return;
    }

    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      // Square, because it is shown as a circle everywhere it appears --
      // letting someone crop a portrait and then cutting the top off it is
      // a worse experience than asking for the square up front.
      aspect: [1, 1],
      quality: 0.7,
    });
    if (picked.canceled || !picked.assets?.length) return;

    setUploading(true);
    setNotice(null);
    try {
      const url = await apiService.uploadProfilePhoto(picked.assets[0].uri);
      setPartner((current) =>
        current ? { ...current, profile_picture: url } : current
      );
    } catch (error: any) {
      setNotice(error?.message || 'Could not upload that photo.');
    } finally {
      setUploading(false);
    }
  };

  const confirmSignOut = () => {
    Alert.alert('Sign out?', 'You will stop receiving delivery alerts.', [
      { text: 'Stay signed in', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          await signOut();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.screen}>
        <ActivityIndicator style={{ flex: 1 }} color={colors.primary} />
      </SafeAreaView>
    );
  }

  const initial = (partner?.name || '?').charAt(0).toUpperCase();

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
              tintColor={colors.primary}
            />
          }
        >
          <View style={styles.identity}>
            <Pressable
              onPress={pickPhoto}
              disabled={uploading}
              style={styles.avatarWrap}
              accessibilityRole="button"
              accessibilityLabel="Change your photo"
            >
              {partner?.profile_picture ? (
                <Image source={{ uri: partner.profile_picture }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarEmpty]}>
                  <Text style={styles.avatarInitial}>{initial}</Text>
                </View>
              )}
              <View style={styles.avatarBadge}>
                {uploading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <MaterialIcons name="photo-camera" size={15} color="#fff" />
                )}
              </View>
            </Pressable>

            <Text style={styles.identityName}>{partner?.name || 'Delivery partner'}</Text>
            {!!partner?.phone_number && (
              <Text style={styles.identityMeta}>{partner.phone_number}</Text>
            )}
            {partner?.rating != null && (
              <View style={styles.ratingRow}>
                <MaterialIcons name="star" size={15} color={colors.primary} />
                <Text style={styles.ratingText}>{partner.rating.toFixed(1)}</Text>
              </View>
            )}
          </View>

          {notice && <Text style={styles.notice}>{notice}</Text>}

          <SectionHeader title="Your details" />

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
            style={styles.save}
          />

          {/* The email is shown but not editable here: it is where the
              sign-in code goes, so changing it is a way to lose an account
              rather than a setting. */}
          {!!partner?.email && (
            <View style={styles.readOnlyRow}>
              <Text style={styles.readOnlyLabel}>Sign-in email</Text>
              <Text style={styles.readOnlyValue} numberOfLines={1}>
                {partner.email}
              </Text>
            </View>
          )}

          <Button
            label="Sign out"
            onPress={confirmSignOut}
            variant="danger"
            style={styles.signOut}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const AVATAR = 92;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 20, paddingBottom: 40 },

  identity: { alignItems: 'center', paddingVertical: spacing.md },
  avatarWrap: { width: AVATAR, height: AVATAR },
  avatar: { width: AVATAR, height: AVATAR, borderRadius: AVATAR / 2 },
  avatarEmpty: {
    backgroundColor: colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: { ...typography.title, fontSize: 34, color: colors.primary },
  avatarBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.background,
  },
  identityName: {
    ...typography.title,
    fontSize: 21,
    color: colors.textPrimary,
    marginTop: spacing.sm,
  },
  identityMeta: { ...typography.secondary, color: colors.textSecondary, marginTop: 2 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  ratingText: { ...typography.bodyBold, fontSize: 14, color: colors.textPrimary },

  notice: {
    ...typography.caption,
    color: colors.textSecondary,
    backgroundColor: colors.surface,
    borderRadius: radius,
    padding: 10,
    marginBottom: spacing.sm,
    lineHeight: 17,
  },

  label: { ...typography.label, color: colors.textMuted, marginBottom: spacing.base },
  input: {
    height: 52,
    borderRadius: radius,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    ...typography.body,
    color: colors.textPrimary,
  },

  vehicleRow: { flexDirection: 'row', gap: spacing.base },
  vehicle: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    paddingVertical: spacing.sm,
    borderRadius: radius,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  vehicleChosen: { borderColor: colors.primary, backgroundColor: colors.primaryMuted },
  vehicleText: { ...typography.caption, color: colors.textSecondary },
  vehicleTextChosen: { color: colors.primary, fontWeight: '700' },

  save: { marginTop: spacing.md },

  readOnlyRow: {
    marginTop: spacing.section,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  readOnlyLabel: { ...typography.caption, color: colors.textMuted },
  readOnlyValue: { ...typography.body, color: colors.textSecondary, marginTop: 2 },

  signOut: { marginTop: spacing.section },
});
