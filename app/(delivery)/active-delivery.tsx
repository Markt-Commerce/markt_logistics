import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ActiveDeliverySheet from '../../components/ActiveDeliverySheet';
import EmptyState from '../../components/EmptyState';
import LiveMap from '../../components/LiveMap';
import { colors } from '../../components/theme';
import apiService from '../../services/api';
import { Assignment, DeliveryStop, RunDetail } from '../../types';
import { assignmentToStops, runToStops } from '../../utils/deliveryStops';

/**
 * The shared map+sheet screen for both delivery models -- replaces
 * active-delivery-map.tsx, delivery-status-controls.tsx,
 * assignment-details.tsx, and run-details.tsx (see agile-waddling-pie.md).
 * `kind`+`id` select which backend entity to load; everything else is
 * driven off the shared DeliveryStop list built by the adapters in
 * utils/deliveryStops.ts.
 */
export default function ActiveDeliveryScreen() {
  const router = useRouter();
  const { kind, id } = useLocalSearchParams<{ kind: 'order' | 'run'; id: string }>();
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [run, setRun] = useState<RunDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // No synchronous setState before the first `await` here -- `loading`
  // already initializes to true, so this doesn't need one.
  const load = useCallback(async () => {
    try {
      if (kind === 'order') {
        setAssignment(await apiService.getAssignmentDetails(id));
      } else if (kind === 'run') {
        setRun(await apiService.getRunDetail(id));
      }
    } catch (error) {
      console.error('Error loading active delivery:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [kind, id]);

  useEffect(() => {
    // Standard fetch-on-mount, not the anti-pattern this rule targets.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const handleRefresh = () => {
    setRefreshing(true);
    load();
  };

  const handleFailRun = (runId: string) => {
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
              console.error('Error failing run:', error);
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
        <ActivityIndicator color={colors.primary} style={{ flex: 1 }} />
      </SafeAreaView>
    );
  }

  let stops: DeliveryStop[] = [];
  let headerTitle = '';
  let headerSubtitle: string | undefined;
  // Only single orders carry a manifest: a run's stops are per-seller
  // and its parcels belong to different buyers, so one combined list
  // under one order number would be actively misleading.
  let reference: string | null | undefined;
  let parcel: Assignment['items'];
  let screenActions: { refreshing: boolean; onRefresh: () => void; dangerActionLabel?: string; onDangerAction?: () => void } = {
    refreshing,
    onRefresh: handleRefresh,
  };

  if (kind === 'order' && assignment) {
    stops = assignmentToStops(assignment, {
      onStatusUpdate: async (status) => {
        await apiService.updateAssignmentStatus(assignment.assignmentId, status);
        await load();
      },
      onGoToPodConfirm: () =>
        router.push({
          pathname: '/(delivery)/pod-scan',
          params: { mode: 'order', assignmentId: assignment.assignmentId, orderId: assignment.orderId },
        }),
    });
    headerTitle = assignment.sellerName || `Order #${assignment.orderId.slice(0, 8)}`;
    headerSubtitle = assignment.pickupAddress ?? undefined;
    reference = assignment.orderNumber;
    parcel = assignment.items;
  } else if (kind === 'run' && run?.run_id) {
    const runId = run.run_id;
    stops = runToStops(run, {
      onArrive: async (sellerId) => {
        await apiService.arriveAtStop(runId, sellerId);
        await load();
      },
      onConfirmPickup: async (sellerId) => {
        await apiService.confirmPickupAtStop(runId, sellerId);
        await load();
      },
      onGoToPodConfirm: (orderId) =>
        router.push({ pathname: '/(delivery)/pod-scan', params: { mode: 'run', runId, orderId } }),
      onGoToReportFailure: (orderId) =>
        router.push({ pathname: '/(delivery)/report-failure', params: { runId, orderId } }),
    });
    headerTitle = run.market || 'Run';
    headerSubtitle = run.area ?? undefined;
    screenActions = {
      ...screenActions,
      dangerActionLabel: "I can't continue this run",
      onDangerAction: () => handleFailRun(runId),
    };
  }

  if (stops.length === 0) {
    // Two ways to land here, and they mean different things. Arriving
    // with an id and finding nothing means the delivery is over. Arriving
    // with no id at all means the rider tapped the tab, which is now a
    // permanent destination rather than something you are pushed into --
    // telling them their delivery "may have already been completed" when
    // they never had one is answering a question nobody asked.
    const idle = !id;
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <EmptyState
          icon={idle ? 'explore' : 'local-shipping'}
          title={idle ? "You're not carrying anything" : 'Nothing active here'}
          subtitle={
            idle
              ? 'Deliveries you accept show up here, with the route and every stop.'
              : 'This delivery may have already been completed, or is no longer available.'
          }
          actionLabel={idle ? 'Find work' : 'Back to dashboard'}
          onAction={() => router.replace('/(delivery)/availability-toggle')}
        />
      </SafeAreaView>
    );
  }

  // Full-bleed map with the sheet overlaying it (not a SafeAreaView -- the
  // map should render edge to edge; @gorhom/bottom-sheet handles its own
  // bottom safe-area inset for the sheet content).
  return (
    <View style={styles.container}>
      <LiveMap stops={stops} />
      <ActiveDeliverySheet
        headerTitle={headerTitle}
        headerSubtitle={headerSubtitle}
        stops={stops}
        screenActions={screenActions}
        reference={reference}
        parcel={parcel}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
});
