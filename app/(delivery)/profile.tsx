/**
 * Who the rider is, and everything about themselves they can reach.
 *
 * This was a form. A name field and a vehicle picker sat permanently
 * open below the avatar, so the screen's whole shape said "fill this
 * in" -- while the things a rider actually opens it for (their jobs,
 * their earnings, the way out) were scattered around the edges of it
 * or, in the case of their work, nowhere at all.
 *
 * Same structure as markt_mobile's profile now: an identity block, then
 * named groups of rows. Editing moved to its own screen, which is what
 * makes the rest of it readable as a list.
 *
 * The photo stays here. It is part of who you are rather than a setting,
 * and it is the one thing on this screen a buyer at a gate also sees.
 */

import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SettingsRow, SettingsSection } from '../../components/SettingsList';
import { colors, spacing, typography } from '../../components/theme';
import { useAuth } from '../../contexts/auth';
import apiService from '../../services/api';
import { DeliveryPartner } from '../../types';

const VEHICLE_LABEL: Record<string, string> = {
  BIKE: 'Bike',
  CAR: 'Car',
  VAN: 'Van',
};

export default function ProfileScreen() {
  const router = useRouter();
  const { signOut } = useAuth();

  const [partner, setPartner] = useState<DeliveryPartner | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [uploading, setUploading] = useState(false);
  // The photo they just chose, shown while it uploads. Without it the
  // avatar sat on the old picture (or the initial) through the whole
  // upload, so the one signal that the right file was picked arrived
  // only once it was already too late to change.
  const [pendingPhoto, setPendingPhoto] = useState<string | null>(null);
  // A stored URL can 404 -- the file was cleaned up, the CDN moved. An
  // <Image> that fails to load renders as a blank box; falling back to
  // the initial at least looks deliberate.
  const [photoBroken, setPhotoBroken] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setPartner(await apiService.getCurrentPartner());
    } catch (error) {
      console.error('Could not load profile:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // On focus rather than on mount: editing happens on another screen
  // now, and coming back from it with the old name still on display
  // would look like the save had not worked.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const pickPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setNotice('Markt needs access to your photos to set a picture.');
      return;
    }

    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      // Square, because it is shown as a circle everywhere it appears.
      aspect: [1, 1],
      quality: 0.7,
    });
    if (picked.canceled || !picked.assets?.length) return;

    setUploading(true);
    setNotice(null);
    setPendingPhoto(picked.assets[0].uri);
    try {
      const url = await apiService.uploadProfilePhoto(picked.assets[0].uri);
      setPhotoBroken(false);
      setPartner((current) => (current ? { ...current, profile_picture: url } : current));
    } catch (error: any) {
      // Drop the preview on failure. Leaving it up shows a picture that
      // is not saved anywhere.
      setPendingPhoto(null);
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
  const photo = pendingPhoto ?? (photoBroken ? null : partner?.profile_picture) ?? null;
  const vehicle = partner?.vehicleType ? VEHICLE_LABEL[partner.vehicleType] : null;

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void load();
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
            {photo ? (
              <Image
                source={{ uri: photo }}
                style={[styles.avatar, uploading && styles.avatarUploading]}
                onError={() => setPhotoBroken(true)}
              />
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

          {/* Rating and vehicle read as facts about the rider, so they
              sit with the name rather than as rows further down. */}
          <View style={styles.chips}>
            {partner?.rating != null && (
              <View style={styles.chip}>
                <MaterialIcons name="star" size={14} color={colors.primary} />
                <Text style={styles.chipText}>{partner.rating.toFixed(1)}</Text>
              </View>
            )}
            {!!vehicle && (
              <View style={styles.chip}>
                <MaterialIcons name="two-wheeler" size={14} color={colors.textSecondary} />
                <Text style={styles.chipText}>{vehicle}</Text>
              </View>
            )}
          </View>
        </View>

        {!!notice && <Text style={styles.notice}>{notice}</Text>}

        <SettingsSection title="Your work">
          <SettingsRow
            icon="receipt-long"
            title="Your jobs"
            subtitle="Every delivery you have taken, and what it paid"
            onPress={() => router.push('/(delivery)/jobs')}
          />
          <SettingsRow
            icon="account-balance-wallet"
            title="Earnings"
            subtitle="Your balance, withdrawals and activity"
            onPress={() => router.push('/(delivery)/earnings')}
            last
          />
        </SettingsSection>

        <SettingsSection title="Account">
          <SettingsRow
            icon="person"
            title="Your details"
            subtitle="Name and vehicle"
            onPress={() => router.push('/(delivery)/edit-profile')}
          />
          {/* Shown, not editable: it is where the sign-in code goes, so
              changing it is a way to lose an account rather than a
              setting. No chevron, because nothing opens. */}
          <SettingsRow
            icon="mail-outline"
            title="Sign-in email"
            value={partner?.email || 'Not set'}
            last
          />
        </SettingsSection>

        <SettingsSection title="Session">
          <SettingsRow
            icon="logout"
            title="Sign out"
            onPress={confirmSignOut}
            destructive
            last
          />
        </SettingsSection>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: 40 },
  identity: { alignItems: 'center', paddingTop: 12, paddingBottom: spacing.md },
  avatarWrap: { marginBottom: 12 },
  avatar: { width: 88, height: 88, borderRadius: 44, backgroundColor: colors.primaryMuted },
  // Dimmed while the upload is in flight, so the preview reads as "this
  // is going" rather than "this is done".
  avatarUploading: { opacity: 0.55 },
  avatarEmpty: { alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontSize: 34, fontWeight: '800', color: colors.primary },
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
  identityName: { ...typography.title, color: colors.textPrimary },
  identityMeta: { ...typography.secondary, color: colors.textSecondary, marginTop: 2 },
  chips: { flexDirection: 'row', gap: 8, marginTop: 12 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.surface,
  },
  chipText: { ...typography.caption, color: colors.textPrimary, fontWeight: '700' },
  notice: {
    ...typography.caption,
    color: colors.error,
    paddingHorizontal: spacing.screenX,
    marginBottom: 8,
  },
});
