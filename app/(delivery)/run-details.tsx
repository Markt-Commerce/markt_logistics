import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import apiService from '../../services/api';
import { RunDetail, RunOrder, RunStop } from '../../types';

const PRIMARY_COLOR = '#e26136';
const BG_LIGHT = '#f6f8f7';

const STOP_STATUS_LABEL: Record<string, string> = {
  pending: 'Not yet arrived',
  arrived: 'Arrived, ready for pickup',
  picked_up: 'Picked up',
};

const POD_STATUS_LABEL: Record<string, string> = {
  pending: 'Waiting on pickup',
  qr_issued: 'Out for delivery',
  delivered: 'Delivered',
};

/**
 * 10.6 run cockpit: per-seller pickup stops on the left, per-order POD
 * progress on the right, plus the mid-run "can't continue" escape hatch
 * (10.7). Loaded either by an explicit runId param (from available-runs
 * accept, or pod-scan/report-failure returning here) or, with none
 * given, by asking the backend for the rider's own active run.
 */
export default function RunDetailsScreen() {
  const router = useRouter();
  const { runId: routeRunId } = useLocalSearchParams<{ runId?: string }>();
  const [run, setRun] = useState<RunDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const load = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      try {
        const data = routeRunId
          ? await apiService.getRunDetail(routeRunId)
          : await apiService.getActiveRun();
        setRun(data);
      } catch (error) {
        console.error('Error loading run:', error);
        setRun(null);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [routeRunId]
  );

  useEffect(() => {
    load();
  }, [load]);

  const runId = run?.run_id;

  const handleArrive = async (stop: RunStop) => {
    if (!runId) return;
    setBusyKey(`arrive-${stop.seller_id}`);
    try {
      await apiService.arriveAtStop(runId, stop.seller_id);
      load();
    } catch (error) {
      Alert.alert('Could not update', 'Please try again.');
    } finally {
      setBusyKey(null);
    }
  };

  const handlePickup = async (stop: RunStop) => {
    if (!runId) return;
    setBusyKey(`pickup-${stop.seller_id}`);
    try {
      await apiService.confirmPickupAtStop(runId, stop.seller_id);
      load();
    } catch (error) {
      Alert.alert('Could not confirm pickup', 'Please try again.');
    } finally {
      setBusyKey(null);
    }
  };

  const handleFailRun = () => {
    if (!runId) return;
    Alert.alert(
      "Can't continue this run?",
      'This reopens the run for another rider to pick up. Only use this if you genuinely cannot continue (breakdown, emergency, etc).',
      [
        { text: 'Never mind', style: 'cancel' },
        {
          text: "I can't continue",
          style: 'destructive',
          onPress: async () => {
            try {
              await apiService.failRun(runId);
              router.replace('/(delivery)/availability-toggle');
            } catch (error) {
              Alert.alert('Could not update', 'Please try again.');
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator color={PRIMARY_COLOR} style={{ flex: 1 }} />
      </SafeAreaView>
    );
  }

  if (!run || !run.run_id) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.emptyContainer}>
          <MaterialIcons name="local-shipping" size={48} color="#ccc" />
          <Text style={styles.emptyTitle}>No run in progress</Text>
          <TouchableOpacity style={styles.primaryButton} onPress={() => router.push('/(delivery)/available-runs' as any)}>
            <Text style={styles.primaryButtonText}>Browse available runs</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{run.market || 'Run'}</Text>
        <Text style={styles.headerSubtitle}>{run.area}</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={PRIMARY_COLOR} />}
      >
        <View style={styles.statusBanner}>
          <Text style={styles.statusBannerText}>{(run.status || '').replace(/_/g, ' ')}</Text>
        </View>

        <Text style={styles.sectionLabel}>Pickup stops ({run.stops.length})</Text>
        {run.stops.map((stop) => (
          <View key={stop.seller_id} style={styles.card}>
            <View style={styles.cardRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{stop.seller_name || `Seller #${stop.seller_id}`}</Text>
                {!!stop.shop_address && <Text style={styles.cardSubtitle}>{stop.shop_address}</Text>}
                <Text style={styles.statusText}>{STOP_STATUS_LABEL[stop.status]}</Text>
              </View>
            </View>
            {stop.status === 'pending' && (
              <TouchableOpacity
                style={styles.actionButton}
                disabled={busyKey === `arrive-${stop.seller_id}`}
                onPress={() => handleArrive(stop)}
              >
                {busyKey === `arrive-${stop.seller_id}` ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.actionButtonText}>I've arrived</Text>
                )}
              </TouchableOpacity>
            )}
            {stop.status === 'arrived' && (
              <TouchableOpacity
                style={styles.actionButton}
                disabled={busyKey === `pickup-${stop.seller_id}`}
                onPress={() => handlePickup(stop)}
              >
                {busyKey === `pickup-${stop.seller_id}` ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.actionButtonText}>Confirm pickup</Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        ))}

        <Text style={[styles.sectionLabel, { marginTop: 20 }]}>Orders ({run.orders.length})</Text>
        {run.orders.map((order: RunOrder) => (
          <View key={order.order_id} style={styles.card}>
            <View style={styles.cardRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>
                  {order.buyer_name || 'Buyer'} {order.order_number ? `· #${order.order_number}` : ''}
                </Text>
                {!!order.delivery_address && (
                  <Text style={styles.cardSubtitle}>
                    {[order.delivery_address.street_address, order.delivery_address.city]
                      .filter(Boolean)
                      .join(', ')}
                  </Text>
                )}
                <Text style={styles.statusText}>{POD_STATUS_LABEL[order.pod_status]}</Text>
              </View>
            </View>
            {order.pod_status === 'qr_issued' && (
              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={[styles.actionButton, { flex: 1 }]}
                  onPress={() =>
                    router.push({ pathname: '/(delivery)/pod-scan', params: { runId, orderId: order.order_id } } as any)
                  }
                >
                  <MaterialIcons name="qr-code-scanner" size={16} color="#fff" />
                  <Text style={styles.actionButtonText}>Confirm delivery</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.secondaryActionButton}
                  onPress={() =>
                    router.push({ pathname: '/(delivery)/report-failure', params: { runId, orderId: order.order_id } } as any)
                  }
                >
                  <Text style={styles.secondaryActionButtonText}>Report issue</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        ))}

        <TouchableOpacity style={styles.failRunButton} onPress={handleFailRun}>
          <Text style={styles.failRunButtonText}>I can't continue this run</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG_LIGHT },
  header: { paddingHorizontal: 20, paddingVertical: 12 },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#1a1a1a', letterSpacing: -0.5 },
  headerSubtitle: { fontSize: 13, color: '#666', marginTop: 2 },
  content: { paddingHorizontal: 20, paddingBottom: 32 },
  statusBanner: {
    backgroundColor: PRIMARY_COLOR + '15',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 20,
  },
  statusBannerText: { fontSize: 12, fontWeight: '700', color: PRIMARY_COLOR, textTransform: 'capitalize' },
  sectionLabel: { fontSize: 12, fontWeight: '700', color: '#999', letterSpacing: 0.5, marginBottom: 10 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  cardRow: { flexDirection: 'row', marginBottom: 10 },
  cardTitle: { fontSize: 14, fontWeight: '700', color: '#1a1a1a' },
  cardSubtitle: { fontSize: 12, color: '#666', marginTop: 2 },
  statusText: { fontSize: 11, fontWeight: '700', color: PRIMARY_COLOR, marginTop: 6 },
  actionRow: { flexDirection: 'row', gap: 8 },
  actionButton: {
    flexDirection: 'row',
    gap: 6,
    backgroundColor: PRIMARY_COLOR,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  secondaryActionButton: {
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryActionButtonText: { fontSize: 13, fontWeight: '700', color: '#666' },
  failRunButton: { marginTop: 24, alignItems: 'center', padding: 12 },
  failRunButtonText: { fontSize: 13, fontWeight: '700', color: '#D32F2F' },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: '#1a1a1a', marginTop: 16, marginBottom: 20 },
  primaryButton: { backgroundColor: PRIMARY_COLOR, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 24 },
  primaryButtonText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
