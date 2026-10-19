// services/appUpdate.ts -- mirrors markt_mobile's, so both apps update the same way.
//
// Tells the app whether the installed version is still good enough, using
// Firebase Remote Config as the switch.
//
// Four parameters per platform, set by `npm run release:announce` (or by hand
// in the Firebase console -> Remote Config):
//
//   logistics_latest_version_android / _ios   newer than installed -> soft prompt
//   logistics_min_version_android / _ios      newer than installed -> blocking
//   logistics_update_message                  optional copy for either prompt
//   logistics_store_url_android / _ios        optional store link override
//
// The fetch talks to Remote Config's REST endpoint directly -- the same one the
// Firebase JS SDK uses -- rather than through @react-native-firebase. The native
// SDK needs a GoogleService-Info.plist this project does not have and static
// iOS frameworks, which fight the Google Maps pods; one POST does not.
//
// Fails open, always. A Firebase outage, airplane mode or an empty template
// must never lock someone out of the app. The only thing that blocks is a
// minimum version we actually received -- and once received it is cached, so
// going offline does not get around a required update.

import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Linking, Platform } from 'react-native';

/** Parameter prefix, so this app's keys don't collide with markt's in the
 *  shared Firebase project. */
const APP_KEY = 'logistics';

// From google-services.json. Firebase client keys identify the project, they
// do not authorise anything -- they are meant to ship inside the app.
const FIREBASE_PROJECT_NUMBER = '133653295470';
const FIREBASE_APP_ID = '1:133653295470:android:21ac9a01c95cfe4ecf117f';
const FIREBASE_API_KEY = 'AIzaSyA8dcgUWWTSqjNAk6eQNhRNnxi2QygQFrA';

const ANDROID_PACKAGE = 'com.marktcommerce.marktlogistics';
/** App Store Connect's Apple ID for the app (eas.json -> submit.ascAppId).
 *  Empty until the App Store record exists; until then iOS falls back to a
 *  store search, or to logistics_store_url_ios when that is set. */
const APP_STORE_ID = '';

const CACHE_KEY = 'appUpdate.config.v1';
const INSTANCE_KEY = 'appUpdate.instanceId.v1';
const DISMISSED_KEY = 'appUpdate.dismissedVersion.v1';

export type UpdateStatus =
  | { kind: 'none' }
  | { kind: 'optional'; latest: string; message?: string; storeUrl: string }
  | { kind: 'required'; minimum: string; message?: string; storeUrl: string };

type Entries = Record<string, string>;

/** The version baked into this build (app.json -> expo.version). */
export function installedVersion(): string {
  return Constants.expoConfig?.version ?? '0.0.0';
}

/** Numeric, segment-wise: 1.10.0 > 1.9.3. Missing segments count as 0, and
 *  anything after a "-" (1.2.0-beta) is ignored. */
export function compareVersions(a: string, b: string): number {
  const parse = (v: string) =>
    v.split('-')[0].split('.').map((n) => parseInt(n, 10) || 0);
  const pa = parse(a);
  const pb = parse(b);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d < 0 ? -1 : 1;
  }
  return 0;
}

function platformKey(): 'android' | 'ios' | null {
  if (Platform.OS === 'android' || Platform.OS === 'ios') return Platform.OS;
  return null;
}

function defaultStoreUrl(platform: 'android' | 'ios'): string {
  return platform === 'android'
    ? `market://details?id=${ANDROID_PACKAGE}`
    : APP_STORE_ID
      ? `itms-apps://apps.apple.com/app/id${APP_STORE_ID}`
      : webStoreUrl(platform);
}

function webStoreUrl(platform: 'android' | 'ios'): string {
  return platform === 'android'
    ? `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}`
    : APP_STORE_ID
      ? `https://apps.apple.com/app/id${APP_STORE_ID}`
      : 'https://apps.apple.com/search?term=Markt%20Logistics';
}

/** Turn fetched entries into what the UI should show for this install. */
export function evaluate(entries: Entries | null): UpdateStatus {
  const platform = platformKey();
  if (!entries || !platform) return { kind: 'none' };

  const current = installedVersion();
  const minimum = entries[`${APP_KEY}_min_version_${platform}`];
  const latest = entries[`${APP_KEY}_latest_version_${platform}`];
  const message = entries[`${APP_KEY}_update_message`] || undefined;
  const storeUrl =
    entries[`${APP_KEY}_store_url_${platform}`] || defaultStoreUrl(platform);

  if (minimum && compareVersions(current, minimum) < 0) {
    return { kind: 'required', minimum, message, storeUrl };
  }
  if (latest && compareVersions(current, latest) < 0) {
    return { kind: 'optional', latest, message, storeUrl };
  }
  return { kind: 'none' };
}

/** Remote Config wants a per-install id. Nothing is derived from it; it only
 *  has to be stable so percentage rollouts stay consistent per device. */
async function instanceId(): Promise<string> {
  try {
    const existing = await AsyncStorage.getItem(INSTANCE_KEY);
    if (existing) return existing;
  } catch {}
  const alphabet =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  let id = '';
  for (let i = 0; i < 22; i++) id += alphabet[Math.floor(Math.random() * 64)];
  try {
    await AsyncStorage.setItem(INSTANCE_KEY, id);
  } catch {}
  return id;
}

/** Last config we received, so a required update survives going offline. */
export async function readCachedEntries(): Promise<Entries | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as Entries) : null;
  } catch {
    return null;
  }
}

/** Fetch the current template. Returns null on any failure (fail open). */
export async function fetchEntries(): Promise<Entries | null> {
  try {
    const res = await fetch(
      `https://firebaseremoteconfig.googleapis.com/v1/projects/${FIREBASE_PROJECT_NUMBER}/namespaces/firebase:fetch?key=${FIREBASE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          app_id: FIREBASE_APP_ID,
          app_instance_id: await instanceId(),
          app_version: installedVersion(),
          platform_version: String(Platform.Version),
        }),
      },
    );
    if (!res.ok) {
      if (__DEV__) console.warn('[appUpdate] Remote Config fetch failed', res.status);
      return null;
    }
    const body = (await res.json()) as { state?: string; entries?: Entries };
    // NO_TEMPLATE / EMPTY_CONFIG: nothing published yet, which is a real
    // answer ("no requirements"), not an error.
    const entries = body.entries ?? {};
    try {
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(entries));
    } catch {}
    return entries;
  } catch (e) {
    if (__DEV__) console.warn('[appUpdate] Remote Config fetch error', e);
    return null;
  }
}

/** The soft prompt is shown once per announced version, not on every launch. */
export async function wasDismissed(version: string): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(DISMISSED_KEY)) === version;
  } catch {
    return false;
  }
}

export async function dismiss(version: string): Promise<void> {
  try {
    await AsyncStorage.setItem(DISMISSED_KEY, version);
  } catch {}
}

/** Open the store listing, falling back to the web page when the store app's
 *  scheme can't be opened (no Play Store on the device, simulators). */
export async function openStore(storeUrl: string): Promise<void> {
  const platform = platformKey();
  try {
    await Linking.openURL(storeUrl);
  } catch {
    if (platform) await Linking.openURL(webStoreUrl(platform)).catch(() => {});
  }
}
