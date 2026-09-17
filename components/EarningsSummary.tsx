/**
 * The week a rider has had, derived from the wallet ledger.
 *
 * Deliberately computed from real transactions rather than displayed from a
 * stats endpoint, because there isn't one: the backend exposes the wallet
 * balance, the ledger and withdrawals, and nothing else about a rider's
 * performance. So the figures here are the ones the ledger can actually
 * support -- what was paid, and how many drops it was paid for.
 *
 * What is deliberately NOT here: an on-time percentage or a rating. Both
 * appear on every rider-app design going, and Markt has no data for either.
 * A number that looks authoritative and is invented is worse than a missing
 * tile, particularly a number a rider might be judged on.
 */

import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, typography } from './theme';
import { WalletTransaction } from '../types';

/** Reference types that mean "you were paid for delivering something". */
const EARNING_REFERENCES = new Set(['delivery_earning', 'DELIVERY_EARNING']);

const DAY_MS = 24 * 60 * 60 * 1000;
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export interface WeekSummary {
  paid: number;
  drops: number;
  bars: { label: string; amount: number; today: boolean }[];
  busiest: number;
}

export function summariseWeek(
  transactions: WalletTransaction[],
  now = new Date()
): WeekSummary {
  // Midnight today, so "the last 7 days" means 7 whole days and not a
  // rolling window that cuts this morning in half.
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  ).getTime();
  const windowStart = startOfToday - 6 * DAY_MS;

  const bars = Array.from({ length: 7 }, (_, i) => {
    const day = new Date(windowStart + i * DAY_MS);
    return {
      label: DAY_LABELS[day.getDay()],
      amount: 0,
      today: i === 6,
    };
  });

  let paid = 0;
  let drops = 0;

  for (const tx of transactions) {
    if (tx.type !== 'credit' || !EARNING_REFERENCES.has(tx.referenceType)) continue;
    if (!tx.createdAt) continue;

    const at = new Date(tx.createdAt).getTime();
    if (Number.isNaN(at) || at < windowStart) continue;

    paid += tx.amount;
    drops += 1;

    const index = Math.floor((at - windowStart) / DAY_MS);
    if (index >= 0 && index < 7) bars[index].amount += tx.amount;
  }

  return { paid, drops, bars, busiest: Math.max(...bars.map((b) => b.amount), 0) };
}

function money(value: number): string {
  return `₦${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export default function EarningsSummary({
  transactions,
}: {
  transactions: WalletTransaction[];
}) {
  const week = useMemo(() => summariseWeek(transactions), [transactions]);

  const average = week.drops > 0 ? week.paid / week.drops : 0;

  return (
    <View style={styles.card}>
      <View style={styles.statRow}>
        <Stat label="Paid this week" value={money(week.paid)} />
        <View style={styles.divider} />
        <Stat label="Deliveries" value={String(week.drops)} />
        <View style={styles.divider} />
        <Stat label="Per delivery" value={week.drops ? money(average) : '—'} />
      </View>

      <View style={styles.chart}>
        {week.bars.map((bar, index) => {
          // Every bar keeps a sliver of height so the row still reads as
          // seven days rather than a gap where a quiet day was.
          const ratio = week.busiest > 0 ? bar.amount / week.busiest : 0;
          return (
            <View key={index} style={styles.barColumn}>
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.bar,
                    { height: `${Math.max(ratio * 100, 3)}%` },
                    bar.amount > 0 ? styles.barPaid : styles.barEmpty,
                    bar.today && bar.amount > 0 ? styles.barToday : null,
                  ]}
                />
              </View>
              <Text style={[styles.barLabel, bar.today ? styles.barLabelToday : null]}>
                {bar.label}
              </Text>
            </View>
          );
        })}
      </View>

      {week.drops === 0 ? (
        <Text style={styles.quiet}>
          No deliveries in the last seven days. Go online to start picking
          them up.
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.background,
    borderRadius: radius,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.card,
    marginBottom: spacing.section,
  },
  statRow: { flexDirection: 'row', alignItems: 'center' },
  stat: { flex: 1, alignItems: 'center' },
  statValue: { ...typography.subtitle, color: colors.textPrimary },
  statLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
    textAlign: 'center',
  },
  divider: {
    width: 1,
    height: 28,
    backgroundColor: colors.border,
    marginHorizontal: spacing.base,
  },

  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.base,
    marginTop: spacing.md,
  },
  barColumn: { flex: 1, alignItems: 'center' },
  barTrack: {
    width: '100%',
    height: 64,
    justifyContent: 'flex-end',
    backgroundColor: colors.surface,
    borderRadius: 6,
    overflow: 'hidden',
  },
  bar: { width: '100%', borderRadius: 6 },
  barPaid: { backgroundColor: colors.primary, opacity: 0.55 },
  barToday: { opacity: 1 },
  barEmpty: { backgroundColor: colors.surfaceDim },
  barLabel: {
    ...typography.caption,
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 6,
  },
  barLabelToday: { color: colors.textPrimary, fontWeight: '700' },

  quiet: {
    ...typography.secondary,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    lineHeight: 20,
  },
});
