// services/authStorage.ts
//
// Where the rider's session token lives.
//
// It was in AsyncStorage, which is unencrypted: on Android it is a plain file
// in the app sandbox, readable on a rooted device or out of an ADB backup, and
// on iOS it sits in the app container. That token is the full credential for a
// delivery account — it can accept deliveries and, since delivery partner
// wallets landed, request a withdrawal to a bank account.
//
// SecureStore is the Keychain on iOS and the Keystore on Android, which is
// where a credential belongs. Same reasoning, and the same split, as
// markt_mobile/services/authStorage.ts.

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";

const TOKEN_KEY = "sessionToken";

/** Keys this app is allowed to clear on sign-out.
 *
 * Sign-out used to call AsyncStorage.clear(), which empties everything the app
 * has ever stored — including anything a future feature keeps there that has
 * nothing to do with the session. Naming what goes keeps that honest. */
const CLEARED_ON_SIGN_OUT = [TOKEN_KEY];

export async function getAuthToken(): Promise<string | null> {
  try {
    const secure = await SecureStore.getItemAsync(TOKEN_KEY);
    if (secure) return secure;
  } catch {
    // SecureStore can be unavailable (an emulator without a keystore, a
    // locked device at cold start). Fall through rather than sign the rider
    // out mid-shift.
  }

  // Migration: tokens written by earlier builds are still in AsyncStorage.
  // Move rather than copy, so the unencrypted one does not linger.
  try {
    const legacy = await AsyncStorage.getItem(TOKEN_KEY);
    if (legacy) {
      await setAuthToken(legacy);
      await AsyncStorage.removeItem(TOKEN_KEY);
      return legacy;
    }
  } catch {
    // Nothing to migrate.
  }
  return null;
}

export async function setAuthToken(token: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
  } catch {
    // Better a signed-in rider on a device without a working keystore than a
    // rider who cannot log in at all. Rare, and the token is still scoped to
    // this app's sandbox.
    await AsyncStorage.setItem(TOKEN_KEY, token);
  }
}

export async function clearAuthToken(): Promise<void> {
  // Both, always: a token could be in either after a partial migration.
  await Promise.all([
    SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => {}),
    AsyncStorage.multiRemove(CLEARED_ON_SIGN_OUT).catch(() => {}),
  ]);
}
