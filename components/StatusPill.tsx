import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Tone, tones, typography } from './theme';

// Every status vocabulary this app deals with -- single-order assignment
// status (ASSIGNED/ACCEPTED/REJECTED, then ARRIVED_PICKUP..COMPLETED), run
// stop status (pending/arrived/picked_up), and run order POD status
// (pending/qr_issued/delivered) -- mapped onto markt_mobile's 4-tone table.
const NEGATIVE = new Set(['REJECTED', 'FAILED', 'CANCELLED']);
const POSITIVE = new Set(['COMPLETED', 'DELIVERED', 'PICKED_UP', 'ACCEPTED']);
const ATTENTION = new Set(['ARRIVED_PICKUP', 'EN_ROUTE_TO_DROPOFF', 'DELIVERED_PENDING_QR', 'ARRIVED', 'QR_ISSUED']);

export function statusTone(status: string): Tone {
  const key = status.toUpperCase();
  if (NEGATIVE.has(key)) return 'negative';
  if (ATTENTION.has(key)) return 'attention';
  if (POSITIVE.has(key)) return 'positive';
  return 'neutral';
}

export function humanizeStatus(status: string): string {
  return status
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

interface StatusPillProps {
  status: string;
  label?: string;
}

export default function StatusPill({ status, label }: StatusPillProps) {
  const tone = tones[statusTone(status)];
  return (
    <View style={[styles.pill, { backgroundColor: tone.bg }]}>
      <Text style={[styles.text, { color: tone.text }]}>{label ?? humanizeStatus(status)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  text: {
    ...typography.caption,
    fontWeight: '700',
  },
});
