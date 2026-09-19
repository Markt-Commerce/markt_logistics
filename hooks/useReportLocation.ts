/**
 * Tell the server where the rider is.
 *
 * Nothing did. LiveMap watches the device's position to draw the map, and
 * `apiService.reportLocation` existed and was called by no one, so
 * `DeliveryLastLocation` was never written from the app at all.
 *
 * That is not cosmetic. The backend's `get_available_orders` refuses
 * outright without a location ("Location not set"), and `_nearby_rider_ids`
 * -- which decides who gets told a delivery exists -- joins the same table.
 * So a rider whose location had never been posted by some other route could
 * not see a single order and would never be alerted to one, however much
 * work was happening around them. The dashboard swallowed the error and
 * showed "Available orders (0)", which looks exactly like a quiet
 * afternoon.
 *
 * Runs only while the rider is online: an app that reports a courier's
 * position when they are off shift is tracking them, not dispatching to
 * them.
 */

import * as Location from 'expo-location';
import { useEffect } from 'react';

import apiService from '../services/api';

/** Roughly how often a position reaches the server while riding. */
const INTERVAL_MS = 15000;
const DISTANCE_M = 50;

export function useReportLocation(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    let subscription: Location.LocationSubscription | undefined;

    const send = (coords: Location.LocationObjectCoords) => {
      void apiService.reportLocation({
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracy: coords.accuracy ?? undefined,
        speed: coords.speed ?? undefined,
      });
    };

    (async () => {
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        // LiveMap is what asks for permission. If it was refused there is
        // nothing to report and nothing useful to say twice.
        if (status !== 'granted' || cancelled) return;

        // Send one immediately. Waiting for the first movement leaves a
        // rider who goes online standing still -- at home, at a shop, which
        // is most of them -- invisible until they set off.
        const first = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (cancelled) return;
        send(first.coords);

        subscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            timeInterval: INTERVAL_MS,
            distanceInterval: DISTANCE_M,
          },
          (position) => {
            if (!cancelled) send(position.coords);
          }
        );
      } catch (error) {
        // Never throws outward: a rider who cannot be located can still use
        // the rest of the app.
        console.warn('[location] could not report position', error);
      }
    })();

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [enabled]);
}
