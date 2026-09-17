// services/notifications.ts
//
// Push for riders.
//
// The dashboard lists what is available nearby, and until now that was the
// only way to find out a delivery existed — a rider had to be looking at the
// screen at the moment an order was paid for. The backend now pushes instead
// (markt_python: riders can be notified, and push works at all); this is the
// side that asks for permission, registers the device, and takes a tap to the
// right screen.
//
// Mirrors markt_mobile/services/notifications.ts so both apps behave the same
// way, including the parts that are easy to get wrong: push needs a physical
// device, it does not work in Expo Go, and the EAS project id is what ties a
// token to our Expo project.

import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import apiService from "./api";

/** A notification arriving while the app is open shows as a banner too.
 *
 * Deliberate for this app and not for the shopper one: a rider is usually
 * holding the phone with the app open, and "a delivery is available" is worth
 * interrupting for — it is the whole reason the notification exists. */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

function projectId(): string | null {
  return (
    (Constants?.expoConfig?.extra as any)?.eas?.projectId ??
    (Constants as any)?.easConfig?.projectId ??
    null
  );
}

async function ensurePermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.status === "granted") return true;
  const asked = await Notifications.requestPermissionsAsync();
  return asked.status === "granted";
}

/**
 * Register this device for push and hand the token to the backend.
 *
 * Returns the token, or null when push cannot work here — a simulator, Expo
 * Go, a refused permission, or a build with no EAS project id. Every one of
 * those is normal during development, so none of them throw.
 */
export async function registerForPush(): Promise<string | null> {
  try {
    if (!Device.isDevice) return null;

    if (Platform.OS === "android") {
      // Without a channel, Android silently drops notifications on 8+.
      await Notifications.setNotificationChannelAsync("deliveries", {
        name: "Deliveries",
        importance: Notifications.AndroidImportance.HIGH,
        sound: "default",
        vibrationPattern: [0, 250, 250, 250],
      });
    }

    if (!(await ensurePermission())) return null;

    const id = projectId();
    if (!id) {
      // Not fatal: the app works, it just cannot be pushed to. Worth knowing
      // in a build log rather than failing silently.
      console.warn("[push] no EAS project id — run `eas init`");
      return null;
    }

    const { data: token } = await Notifications.getExpoPushTokenAsync({
      projectId: id,
    });
    if (!token) return null;

    await apiService.registerPushToken(token, Platform.OS);
    return token;
  } catch (e) {
    // Commonly an FCM key that is not set up yet. The rider can still work.
    console.warn("[push] registration failed", e);
    return null;
  }
}

/** Where a tapped notification should land.
 *
 * The backend sends `reference_type` and `reference_id` with every one. A
 * type we do not recognise opens the dashboard rather than nothing at all —
 * a tap that appears to do nothing reads as a broken app. */
export function routeForNotification(data: Record<string, any>): string {
  const type = String(data?.reference_type ?? "");
  const id = data?.reference_id ? String(data.reference_id) : null;

  if (type === "delivery_earning" || type === "wallet") return "/(delivery)/wallet";
  if (type === "run" && id) return `/(delivery)/run/${id}`;
  // An available or assigned order: the dashboard is where it can be taken.
  return "/(delivery)/availability-toggle";
}

/** Unregister on sign-out, so a shared device stops receiving this rider's
 *  deliveries. Never throws: signing out must always succeed. */
export async function unregisterPush(): Promise<void> {
  try {
    const id = projectId();
    if (!id || !Device.isDevice) return;
    const { data: token } = await Notifications.getExpoPushTokenAsync({
      projectId: id,
    });
    if (token) await apiService.removePushToken(token);
  } catch {
    // The token is cleared server-side on the next registration anyway.
  }
}
