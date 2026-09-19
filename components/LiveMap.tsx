import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import { DeliveryStop } from '../types';
import { colors, tones } from './theme';

const LAST_POSITION_KEY = 'lastKnownPosition';
// Only used before we've ever known a real position on this device (fresh
// install, permission not yet granted) -- not a meaningful default location.
const FALLBACK_REGION: Region = { latitude: 6.5244, longitude: 3.3792, latitudeDelta: 0.05, longitudeDelta: 0.05 };
// Off the shared tokens, so a change to the brand does not leave the map
// pointing at the old orange. Dropoff blue is the one value with no token
// behind it: nothing else in the app needs a second accent, and a pickup
// and a dropoff pin have to be told apart at a glance on a map.
const PICKUP_PIN_COLOR = colors.primary;
const DROPOFF_PIN_COLOR = '#2196F3';
// Browse-only pins (dashboard, not-yet-accepted) get their own colors so
// they read as distinct from the in-progress pickup/dropoff pins above.
const AVAILABLE_ORDER_PIN_COLOR = colors.success;
const AVAILABLE_RUN_PIN_COLOR = tones.attention.text;
const PIN_COLORS: Record<DeliveryStop['kind'], string> = {
  pickup: PICKUP_PIN_COLOR,
  dropoff: DROPOFF_PIN_COLOR,
  'available-order': AVAILABLE_ORDER_PIN_COLOR,
  'available-run': AVAILABLE_RUN_PIN_COLOR,
};

interface LiveMapProps {
  stops: DeliveryStop[];
}

/**
 * Real map (react-native-maps) replacing the earlier schematic
 * RouteMapPreview -- PROVIDER_GOOGLE on Android, native Apple Maps on iOS
 * (no iOS key needed). Shared by active-delivery.tsx (stops for one
 * already-accepted assignment/run) and the dashboard (availability-toggle.tsx,
 * added 2026-09-16), which mixes those in with browse-only
 * 'available-order'/'available-run' pins -- `kind` alone drives pin color
 * and whether a marker is tappable (`onPress`), so the caller decides what
 * goes on the map, this component just renders it. The current-position dot
 * is the native `showsUserLocation` layer, seeded from a cached last-known
 * fix (one AsyncStorage key) so the map centers instantly instead of
 * waiting on a fresh GPS lock. No tile caching to build -- the native SDK
 * already does that itself.
 */
export default function LiveMap({ stops }: LiveMapProps) {
  const mapRef = useRef<MapView>(null);
  const [initialRegion, setInitialRegion] = useState<Region | null>(null);
  const hasFitRef = useRef(false);
  const stopsRef = useRef(stops);

  useEffect(() => {
    stopsRef.current = stops;
  }, [stops]);

  useEffect(() => {
    let subscription: Location.LocationSubscription | null = null;
    let cancelled = false;
    let haveRealFix = false;

    (async () => {
      try {
        const cached = await AsyncStorage.getItem(LAST_POSITION_KEY);
        if (cached && !cancelled) {
          const { lat, lng } = JSON.parse(cached);
          setInitialRegion({ latitude: lat, longitude: lng, latitudeDelta: 0.02, longitudeDelta: 0.02 });
        }
      } catch (error) {
        console.error('Error reading cached position:', error);
      }

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted' || cancelled) return;

      subscription = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, timeInterval: 10000, distanceInterval: 25 },
        (location) => {
          if (cancelled) return;
          const { latitude, longitude } = location.coords;

          AsyncStorage.setItem(LAST_POSITION_KEY, JSON.stringify({ lat: latitude, lng: longitude })).catch(
            (error) => console.error('Error caching position:', error)
          );

          if (!haveRealFix) {
            haveRealFix = true;
            setInitialRegion({ latitude, longitude, latitudeDelta: 0.02, longitudeDelta: 0.02 });
          }

          // Fit the camera to the rider + every known stop exactly once,
          // the first time we have a real fix -- not a continuous
          // re-center (that would feel like navigation, which is
          // explicitly out of scope).
          if (!hasFitRef.current && mapRef.current) {
            const coordsWithStops = stopsRef.current
              .filter((s) => s.coords)
              .map((s) => ({ latitude: s.coords!.lat, longitude: s.coords!.lng }));
            const allCoords = [{ latitude, longitude }, ...coordsWithStops];
            if (allCoords.length > 1) {
              hasFitRef.current = true;
              mapRef.current.fitToCoordinates(allCoords, {
                edgePadding: { top: 80, right: 60, bottom: 260, left: 60 },
                animated: true,
              });
            }
          }
        }
      );
    })();

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, []);

  const markers = useMemo(() => stops.filter((s): s is DeliveryStop & { coords: { lat: number; lng: number } } => !!s.coords), [stops]);

  return (
    <View style={StyleSheet.absoluteFill}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        initialRegion={initialRegion ?? FALLBACK_REGION}
        showsUserLocation
        showsMyLocationButton={false}
      >
        {markers.map((stop) => (
          <Marker
            key={stop.id}
            coordinate={{ latitude: stop.coords.lat, longitude: stop.coords.lng }}
            title={stop.title}
            description={stop.subtitle}
            pinColor={PIN_COLORS[stop.kind]}
            onPress={stop.onPress}
          />
        ))}
      </MapView>
    </View>
  );
}
