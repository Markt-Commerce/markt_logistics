/**
 * How long is left on a hold.
 *
 * Counts to the server's expiry timestamp, not down from a duration this
 * component started. Three reasons, all of which have bitten somebody:
 *
 *  - the request that created the hold took time to come back, and a local
 *    timer would hand those seconds back to the rider, then let the accept
 *    fail on a hold the server already released;
 *  - a phone's clock can be minutes out and the rider can change it;
 *  - a backgrounded screen stops getting ticks, so on return a local
 *    counter is wrong by however long the app was away, while a target
 *    timestamp is simply recomputed and correct.
 *
 * `onExpire` fires once. The parent uses it to close the sheet and refresh,
 * but nothing depends on it running -- the hold is released by the server
 * whether or not this component is still mounted, which is the entire point
 * of putting the expiry there.
 */

import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, typography } from './theme';

function secondsLeft(expiresAt: string): number {
  const end = new Date(expiresAt).getTime();
  if (Number.isNaN(end)) return 0;
  return Math.max(0, Math.ceil((end - Date.now()) / 1000));
}

export default function OfferCountdown({
  expiresAt,
  total,
  onExpire,
}: {
  expiresAt: string;
  /** The full length of the hold, for the bar. */
  total: number;
  onExpire?: () => void;
}) {
  const [left, setLeft] = useState(() => secondsLeft(expiresAt));
  const [tracked, setTracked] = useState(expiresAt);
  const fired = useRef(false);

  // A new hold means a new deadline. Adjusted during render rather than in
  // an effect: setting state inside an effect renders once with the old
  // number first, which for a countdown is a visible jump backwards.
  if (tracked !== expiresAt) {
    setTracked(expiresAt);
    setLeft(secondsLeft(expiresAt));
  }

  useEffect(() => {
    // Safe to reset here rather than during render: the interval that reads
    // it is created below, in this same effect, so no tick can land in
    // between.
    fired.current = false;

    const id = setInterval(() => {
      const remaining = secondsLeft(expiresAt);
      setLeft(remaining);
      if (remaining <= 0 && !fired.current) {
        fired.current = true;
        onExpire?.();
      }
    }, 250);

    return () => clearInterval(id);
    // onExpire is intentionally not a dependency: a parent that rebuilds it
    // every render would restart the countdown on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expiresAt]);

  const ratio = total > 0 ? Math.min(left / total, 1) : 0;
  const urgent = left <= 10;

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Text style={styles.label}>
          {left > 0 ? 'Time to decide' : 'Time is up'}
        </Text>
        <Text
          style={[styles.seconds, urgent && styles.secondsUrgent]}
          // Announced as it changes would talk over a rider mid-ride.
          accessibilityLiveRegion="none"
        >
          {left}s
        </Text>
      </View>
      <View style={styles.track}>
        <View
          style={[
            styles.fill,
            { width: `${ratio * 100}%` },
            urgent && styles.fillUrgent,
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 16 },
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  label: { ...typography.caption, color: colors.textSecondary },
  seconds: { ...typography.subtitle, color: colors.textPrimary },
  secondsUrgent: { color: colors.error },
  track: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  fill: { height: 6, borderRadius: radius, backgroundColor: colors.primary },
  fillUrgent: { backgroundColor: colors.error },
  badge: {
    minWidth: 28,
    height: 28,
    borderRadius: 14,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  badgeText: { ...typography.caption, color: '#fff', fontWeight: '800' },
});

/**
 * Just the number, for sitting inside the Accept button.
 *
 * Its own component rather than a callback out of OfferCountdown so the
 * tick re-renders a two-character badge instead of the whole sheet four
 * times a second while a rider is reading it.
 */
export function OfferSecondsBadge({ expiresAt }: { expiresAt: string }) {
  const [left, setLeft] = useState(() => secondsLeft(expiresAt));
  const [tracked, setTracked] = useState(expiresAt);

  if (tracked !== expiresAt) {
    setTracked(expiresAt);
    setLeft(secondsLeft(expiresAt));
  }

  useEffect(() => {
    const id = setInterval(() => setLeft(secondsLeft(expiresAt)), 250);
    return () => clearInterval(id);
  }, [expiresAt]);

  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>{left}</Text>
    </View>
  );
}
