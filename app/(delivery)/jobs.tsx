import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import EmptyState from '../../components/EmptyState';
import StatusPill from '../../components/StatusPill';
import { colors, radius, spacing, typography } from '../../components/theme';
import apiService from '../../services/api';
import { DeliveryJob } from '../../types';

/**
 * Every delivery this rider has taken.
 *
 * Earnings shows the money and never says which job it came from, and
 * the dashboard only ever showed what they are carrying right now. So a
 * rider checking a payout that looked short, or answering "what did I
 * deliver on Tuesday", had nowhere to look.
 */

type Filter = 'all' | 'active' | 'completed';

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Carrying' },
  { value: 'completed', label: 'Delivered' },
];

function money(amount?: number | null): string {
  if (amount == null) return '—';
  return `₦${amount.toLocaleString()}`;
}

/** "20 Sep", and the year only when it is not this one. */
function when(iso?: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}

export default function JobsScreen() {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>('all');
  const [jobs, setJobs] = useState<DeliveryJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const load = useCallback(async () => {
    setProblem(null);
    try {
      const page = await apiService.getJobHistory(
        filter === 'all' ? undefined : filter
      );
      setJobs(page.jobs);
    } catch (error: any) {
      console.error('Error loading jobs:', error);
      setProblem(error?.message || 'Could not load your jobs.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filter]);

  useEffect(() => {
    // Refetching on a filter change, which is the point of the filter.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    load();
  }, [load]);

  const openJob = (job: DeliveryJob) => {
    // A finished delivery has no live screen to open -- active-delivery
    // reads from the active list, which this has already dropped out of.
    if (job.logisticalStatus === 'COMPLETED') return;
    router.push({
      pathname: '/(delivery)/active-delivery',
      params: { kind: 'order', id: job.assignmentId },
    });
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <Text style={styles.title}>Your jobs</Text>

      <View style={styles.filters}>
        {FILTERS.map((option) => {
          const chosen = filter === option.value;
          return (
            <TouchableOpacity
              key={option.value}
              style={[styles.filter, chosen && styles.filterOn]}
              onPress={() => setFilter(option.value)}
              accessibilityRole="tab"
              accessibilityState={{ selected: chosen }}
            >
              <Text style={[styles.filterText, chosen && styles.filterTextOn]}>
                {option.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={jobs}
          keyExtractor={(job) => job.assignmentId}
          contentContainerStyle={styles.list}
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
          ListEmptyComponent={
            <EmptyState
              icon="receipt-long"
              title={problem ?? 'Nothing here yet'}
              subtitle={
                problem
                  ? 'Pull down to try again.'
                  : filter === 'completed'
                  ? 'Deliveries you finish show up here.'
                  : 'Deliveries you accept show up here, with what each one paid.'
              }
            />
          }
          renderItem={({ item }) => {
            const done = item.logisticalStatus === 'COMPLETED';
            return (
              <TouchableOpacity
                style={styles.card}
                onPress={() => openJob(item)}
                disabled={done}
                activeOpacity={done ? 1 : 0.8}
                accessibilityRole={done ? 'text' : 'button'}
              >
                {item.sellerImage ? (
                  <Image source={{ uri: item.sellerImage }} style={styles.thumb} />
                ) : (
                  <View style={[styles.thumb, styles.thumbEmpty]}>
                    <MaterialIcons name="storefront" size={18} color={colors.textSecondary} />
                  </View>
                )}

                <View style={{ flex: 1 }}>
                  <Text style={styles.shop} numberOfLines={1}>
                    {item.sellerName || 'Pickup from seller'}
                  </Text>
                  {/* The order number, because this screen exists to be
                      cross-referenced -- against a wallet row, or a
                      question about one particular delivery. */}
                  <Text style={styles.meta} numberOfLines={1}>
                    {[item.orderNumber, when(item.assignedAt)].filter(Boolean).join(' · ')}
                  </Text>
                  {!!item.dropoffAddress && (
                    <Text style={styles.meta} numberOfLines={1}>
                      {item.dropoffAddress}
                    </Text>
                  )}
                  <View style={styles.pillRow}>
                    <StatusPill status={item.logisticalStatus || 'ACCEPTED'} />
                  </View>
                </View>

                <View style={styles.right}>
                  <Text style={styles.pay}>{money(item.earnings)}</Text>
                  {!done && (
                    <MaterialIcons name="chevron-right" size={20} color={colors.textMuted} />
                  )}
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  title: {
    ...typography.title,
    color: colors.textPrimary,
    paddingHorizontal: spacing.screenX,
    paddingTop: 8,
    paddingBottom: 12,
  },
  filters: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: spacing.screenX,
    paddingBottom: 12,
  },
  filter: {
    paddingHorizontal: 14,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  filterOn: { backgroundColor: colors.primary },
  filterText: { ...typography.caption, color: colors.textSecondary, fontWeight: '700' },
  filterTextOn: { color: '#fff' },
  list: { paddingHorizontal: spacing.screenX, paddingBottom: 32, gap: 10 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: radius,
    borderWidth: 1,
    borderColor: colors.border,
  },
  thumb: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.border },
  thumbEmpty: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  shop: { ...typography.bodyBold, color: colors.textPrimary },
  meta: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  pillRow: { flexDirection: 'row', marginTop: 6 },
  right: { alignItems: 'flex-end', gap: 4 },
  pay: { ...typography.bodyBold, color: colors.textPrimary },
});
