import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import apiService from '../../services/api';
import { AvailableRun } from '../../types';

const PRIMARY_COLOR = '#e26136';
const BG_LIGHT = '#f6f8f7';

/**
 * 10.6: browse batched delivery runs -- the real target model (per
 * Joshua's own direction: "we do not want a single-order rider app or
 * backend"). Same first-come-first-served shape as nearby-orders.tsx,
 * keyed by run instead of individual order.
 */
export default function AvailableRunsScreen() {
  const router = useRouter();
  const [runs, setRuns] = useState<AvailableRun[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actingOnRunId, setActingOnRunId] = useState<string | null>(null);

  useEffect(() => {
    loadRuns();
  }, []);

  const loadRuns = async () => {
    try {
      setIsLoading(true);
      const data = await apiService.getAvailableRuns();
      setRuns(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error loading runs:', error);
      setRuns([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAccept = async (runId: string) => {
    setActingOnRunId(runId);
    try {
      await apiService.acceptRun(runId);
      router.replace({ pathname: '/(delivery)/run-details', params: { runId } } as any);
    } catch (error) {
      Alert.alert('Could not accept', 'This run may have just been taken by another rider.');
      loadRuns();
    } finally {
      setActingOnRunId(null);
    }
  };

  const handleReject = async (runId: string) => {
    setActingOnRunId(runId);
    try {
      await apiService.rejectRun(runId);
      setRuns((prev) => prev.filter((r) => r.run_id !== runId));
    } catch (error) {
      console.error('Error rejecting run:', error);
    } finally {
      setActingOnRunId(null);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Available Runs</Text>
        <TouchableOpacity style={styles.refreshButton} onPress={loadRuns}>
          <MaterialIcons name="refresh" size={20} color={PRIMARY_COLOR} />
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <ActivityIndicator color={PRIMARY_COLOR} style={{ marginTop: 40 }} />
      ) : !runs.length ? (
        <View style={styles.emptyContainer}>
          <MaterialIcons name="local-shipping" size={48} color="#ccc" />
          <Text style={styles.emptyTitle}>No runs nearby</Text>
          <Text style={styles.emptyText}>
            Batched delivery runs will appear here once orders in your area are ready.
          </Text>
        </View>
      ) : (
        <FlatList
          data={runs}
          keyExtractor={(item) => item.run_id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => {
            const busy = actingOnRunId === item.run_id;
            return (
              <View style={styles.runCard}>
                <View style={styles.runCardHeader}>
                  <View>
                    <Text style={styles.runMarket}>{item.market || 'Market'}</Text>
                    <Text style={styles.runArea}>{item.area}</Text>
                  </View>
                  <Text style={styles.runPrice}>
                    ₦{item.price_per_order != null ? item.price_per_order.toFixed(0) : '—'}
                  </Text>
                </View>

                <View style={styles.infoRow}>
                  <View style={styles.infoPill}>
                    <MaterialIcons name="inventory-2" size={14} color="#999" />
                    <Text style={styles.infoPillText}>{item.order_count} orders</Text>
                  </View>
                  <View style={styles.infoPill}>
                    <MaterialIcons name="near-me" size={14} color="#999" />
                    <Text style={styles.infoPillText}>{(item.distance_meters / 1000).toFixed(1)} km</Text>
                  </View>
                </View>

                <View style={styles.actionRow}>
                  <TouchableOpacity
                    style={[styles.acceptButton, busy && styles.buttonDisabled]}
                    disabled={busy}
                    onPress={() => handleAccept(item.run_id)}
                  >
                    {busy ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.acceptButtonText}>Accept run</Text>}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.rejectButton, busy && styles.buttonDisabled]}
                    disabled={busy}
                    onPress={() => handleReject(item.run_id)}
                  >
                    <Text style={styles.rejectButtonText}>Skip</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG_LIGHT },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#1a1a1a', letterSpacing: -0.5 },
  refreshButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, marginTop: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: '#1a1a1a', marginTop: 16, marginBottom: 8 },
  emptyText: { fontSize: 13, color: '#666', textAlign: 'center', lineHeight: 18 },
  listContent: { paddingHorizontal: 20, paddingBottom: 20 },
  runCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  runCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  runMarket: { fontSize: 15, fontWeight: '800', color: '#1a1a1a' },
  runArea: { fontSize: 12, color: '#666', marginTop: 2 },
  runPrice: { fontSize: 18, fontWeight: '800', color: PRIMARY_COLOR },
  infoRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  infoPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#eee',
  },
  infoPillText: { fontSize: 12, fontWeight: '700', color: '#666' },
  actionRow: { flexDirection: 'row', gap: 10 },
  acceptButton: { flex: 1, backgroundColor: PRIMARY_COLOR, borderRadius: 8, paddingVertical: 12, alignItems: 'center' },
  acceptButtonText: { fontSize: 14, fontWeight: '700', color: '#fff', letterSpacing: 0.3 },
  rejectButton: {
    paddingHorizontal: 20,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
  },
  rejectButtonText: { fontSize: 14, fontWeight: '700', color: '#666' },
  buttonDisabled: { opacity: 0.6 },
});
