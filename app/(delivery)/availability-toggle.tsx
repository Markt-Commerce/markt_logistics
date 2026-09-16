import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import BottomSheet, { BottomSheetScrollView, BottomSheetView } from '@gorhom/bottom-sheet';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Button from '../../components/Button';
import LiveMap from '../../components/LiveMap';
import StatusPill from '../../components/StatusPill';
import { colors, radius, shadow, typography } from '../../components/theme';
import { useAuth } from '../../contexts/auth';
import apiService from '../../services/api';
import { Assignment, AvailableRun, DeliveryStop, Order, RunDetail } from '../../types';
import { activeAssignmentsToPins, activeRunToPins, availableOrdersToPins, availableRunsToPins } from '../../utils/deliveryStops';

type Selection = { kind: 'order'; item: Order } | { kind: 'run'; item: AvailableRun };

const EMPTY_RUN: RunDetail = { run_id: null, stops: [], orders: [] };

/**
 * Home/Dashboard -- rebuilt 2026-09-16 as the always-on map + persistent
 * sheet (replacing the earlier card-list layout, and folding in what
 * single-orders.tsx/batch-runs.tsx used to do -- see REFACTOR_NOTES.md,
 * "Always-on map dashboard"). The map is always showing the rider's own
 * location plus pins for their in-progress work (active single-order
 * assignments, active run) and, while online, what's nearby to accept
 * (available orders, available runs at their market/area centroid). The
 * sheet is the browse+preview+accept surface for all of it; tapping either
 * a pin or a sheet row opens the same preview.
 */
export default function DashboardMapScreen() {
  const router = useRouter();
  const { signOut } = useAuth();
  const [partner, setPartner] = useState<any>(null);
  const [isOnline, setIsOnline] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const [orders, setOrders] = useState<Order[]>([]);
  const [activeAssignments, setActiveAssignments] = useState<Assignment[]>([]);
  const [availableRuns, setAvailableRuns] = useState<AvailableRun[]>([]);
  const [activeRun, setActiveRun] = useState<RunDetail>(EMPTY_RUN);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [selection, setSelection] = useState<Selection | null>(null);
  const [acting, setActing] = useState(false);
  const sheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['20%', '52%', '88%'], []);

  // Ref access lives here, outside render -- expands the sheet to show a
  // preview once something's selected (pin tap or sheet row tap), and back
  // down once it's cleared.
  useEffect(() => {
    sheetRef.current?.snapToIndex(selection ? 2 : 1);
  }, [selection]);

  const loadPartnerData = async () => {
    try {
      const partnerData = await AsyncStorage.getItem('partner');
      const sessionToken = await AsyncStorage.getItem('sessionToken');

      if (sessionToken) {
        apiService.setSessionToken(sessionToken);
      }

      if (partnerData) {
        const parsedPartner = JSON.parse(partnerData);
        setPartner(parsedPartner);
        setIsOnline(parsedPartner.status === 'ONLINE');
      }

      // The login response (PartnerSchema) only ever carries id/name/status --
      // rating and vehicleType only come from GET /partners/me. Refresh from
      // there once we have a token so the pills below aren't blank.
      if (sessionToken) {
        try {
          const freshPartner = await apiService.getCurrentPartner();
          setPartner(freshPartner);
          setIsOnline(freshPartner.status === 'ONLINE');
          await AsyncStorage.setItem('partner', JSON.stringify(freshPartner));
        } catch (error) {
          console.error('Error refreshing partner:', error);
        }
      }
    } catch (error) {
      console.error('Error loading partner:', error);
    }
  };

  useEffect(() => {
    // See original comment (kept from the card-list version): standard
    // fetch-on-mount, not the anti-pattern the set-state-in-effect rule
    // targets.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadPartnerData();
  }, []);

  // Active work (assignments/run) loads regardless of online status -- a
  // rider going offline mid-run still needs to see and finish it. Browse
  // lists (available orders/runs) only load while online, matching the
  // status card's own copy ("Go online to start receiving requests") and
  // avoiding calls the backend may reject anyway (get_available_runs 400s
  // without a known rider location). Re-runs automatically whenever
  // `isOnline` flips, so toggling online populates the map immediately.
  const load = useCallback(async () => {
    try {
      const [assignments, currentRun] = await Promise.all([
        apiService.getActiveAssignments().catch((error) => {
          console.error('Error loading active assignments:', error);
          return [] as Assignment[];
        }),
        apiService.getActiveRun(),
      ]);
      setActiveAssignments(assignments);
      setActiveRun(currentRun);

      if (isOnline) {
        const [availableOrders, runs] = await Promise.all([
          apiService.getAvailableOrders().catch((error) => {
            console.error('Error loading available orders:', error);
            return [] as Order[];
          }),
          apiService.getAvailableRuns().catch((error) => {
            console.error('Error loading available runs:', error);
            return [] as AvailableRun[];
          }),
        ]);
        setOrders(availableOrders);
        setAvailableRuns(runs);
      } else {
        setOrders([]);
        setAvailableRuns([]);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isOnline]);

  useEffect(() => {
    load();
  }, [load]);

  const handleRefresh = () => {
    setRefreshing(true);
    load();
  };

  const handleStatusToggle = async () => {
    const newStatus = isOnline ? 'OFFLINE' : 'ONLINE';
    setIsUpdating(true);

    try {
      await apiService.updatePartnerStatus(newStatus);
      setIsOnline(!isOnline);

      const updatedPartner = { ...partner, status: newStatus };
      await AsyncStorage.setItem('partner', JSON.stringify(updatedPartner));
      setPartner(updatedPartner);
    } catch (error) {
      Alert.alert('Error', 'Failed to update status. Please try again.');
      console.error('Status update error:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          await signOut();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  const openActiveAssignment = (assignment: Assignment) =>
    router.push({ pathname: '/(delivery)/active-delivery', params: { kind: 'order', id: assignment.assignmentId } });

  const openActiveRun = () => {
    if (!activeRun.run_id) return;
    router.push({ pathname: '/(delivery)/active-delivery', params: { kind: 'run', id: activeRun.run_id } });
  };

  // Plain state updates -- no ref access here, since these are called from
  // pin-adapter callbacks built during render (see `pins` below). The sheet
  // itself is snapped to the right point in the effect above instead, kept
  // out of the render path.
  const openOrderPreview = (order: Order) => setSelection({ kind: 'order', item: order });
  const openRunPreview = (run: AvailableRun) => setSelection({ kind: 'run', item: run });
  const closePreview = () => setSelection(null);

  const handleAcceptOrder = async () => {
    if (selection?.kind !== 'order') return;
    const order = selection.item;
    setActing(true);
    try {
      const assignment = await apiService.acceptOrder(order.orderId);
      closePreview();
      if (assignment) {
        router.push({ pathname: '/(delivery)/active-delivery', params: { kind: 'order', id: assignment.assignmentId } });
      }
      load();
    } catch (error) {
      console.error('Error accepting order:', error);
    } finally {
      setActing(false);
    }
  };

  const handleDeclineOrder = async () => {
    if (selection?.kind !== 'order') return;
    const order = selection.item;
    setActing(true);
    try {
      await apiService.rejectOrder(order.orderId);
    } catch (error) {
      console.error('Error rejecting order:', error);
    } finally {
      setActing(false);
      closePreview();
      load();
    }
  };

  const handleAcceptRun = async () => {
    if (selection?.kind !== 'run') return;
    const run = selection.item;
    setActing(true);
    try {
      await apiService.acceptRun(run.run_id);
      closePreview();
      router.push({ pathname: '/(delivery)/active-delivery', params: { kind: 'run', id: run.run_id } });
    } catch (error) {
      console.error('Error accepting run:', error);
      closePreview();
      load();
    } finally {
      setActing(false);
    }
  };

  const handleDeclineRun = async () => {
    if (selection?.kind !== 'run') return;
    const run = selection.item;
    setActing(true);
    try {
      await apiService.rejectRun(run.run_id);
    } catch (error) {
      console.error('Error rejecting run:', error);
    } finally {
      setActing(false);
      closePreview();
      load();
    }
  };

  if (!partner) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const pins: DeliveryStop[] = [
    ...activeAssignmentsToPins(activeAssignments, openActiveAssignment),
    ...activeRunToPins(activeRun, openActiveRun),
    ...availableOrdersToPins(orders, openOrderPreview),
    ...availableRunsToPins(availableRuns, openRunPreview),
  ];

  const hasActiveWork = activeAssignments.length > 0 || !!activeRun.run_id;

  return (
    <View style={styles.container}>
      <LiveMap stops={pins} />

      <SafeAreaView style={styles.topOverlay} edges={['top']} pointerEvents="box-none">
        <View style={styles.topBar}>
          <View style={styles.topBarLeft}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{(partner.name || '?').charAt(0).toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.partnerName} numberOfLines={1}>
                {partner.name}
              </Text>
              <View style={styles.statusRow}>
                <View style={[styles.dot, isOnline && styles.dotActive]} />
                <Text style={styles.statusText}>{isOnline ? "You're online" : "You're offline"}</Text>
              </View>
            </View>
          </View>
          <View style={styles.topBarRight}>
            <TouchableOpacity
              style={[styles.onlinePill, isOnline && styles.onlinePillActive]}
              onPress={handleStatusToggle}
              disabled={isUpdating}
            >
              {isUpdating ? (
                <ActivityIndicator size="small" color={isOnline ? '#fff' : colors.primary} />
              ) : (
                <Text style={[styles.onlinePillText, isOnline && styles.onlinePillTextActive]}>
                  {isOnline ? 'Go offline' : 'Go online'}
                </Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconButton} onPress={handleLogout}>
              <MaterialIcons name="logout" size={18} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>

      <BottomSheet
        ref={sheetRef}
        index={1}
        snapPoints={snapPoints}
        enablePanDownToClose={false}
        enableDynamicSizing={false}
        handleIndicatorStyle={styles.handle}
        backgroundStyle={styles.sheetBackground}
      >
        {selection ? (
          <BottomSheetView style={styles.previewSheet}>
            <TouchableOpacity onPress={closePreview} style={styles.backRow}>
              <MaterialIcons name="arrow-back" size={18} color={colors.textSecondary} />
              <Text style={styles.backText}>Back</Text>
            </TouchableOpacity>

            {selection.kind === 'order' ? (
              <>
                <Text style={styles.previewTitle}>Order #{selection.item.orderId.slice(0, 8)}</Text>
                <View style={styles.previewRow}>
                  <Text style={styles.previewLabel}>Earnings</Text>
                  <Text style={styles.previewValue}>₦{selection.item.estimatedEarnings}</Text>
                </View>
                <View style={styles.previewRow}>
                  <Text style={styles.previewLabel}>Distance</Text>
                  <Text style={styles.previewValue}>{(selection.item.distanceMeters / 1000).toFixed(1)} km</Text>
                </View>
                <View style={styles.previewActions}>
                  <Button label="Decline" variant="outline" onPress={handleDeclineOrder} disabled={acting} style={{ flex: 1 }} />
                  <Button label="Accept order" onPress={handleAcceptOrder} loading={acting} style={{ flex: 1 }} />
                </View>
              </>
            ) : (
              <>
                <Text style={styles.previewTitle}>
                  {selection.item.market ? `${selection.item.market} · ${selection.item.area}` : selection.item.area}
                </Text>
                <View style={styles.previewRow}>
                  <Text style={styles.previewLabel}>Orders in this run</Text>
                  <Text style={styles.previewValue}>{selection.item.order_count}</Text>
                </View>
                <View style={styles.previewRow}>
                  <Text style={styles.previewLabel}>Distance</Text>
                  <Text style={styles.previewValue}>{(selection.item.distance_meters / 1000).toFixed(1)} km</Text>
                </View>
                <View style={styles.previewRow}>
                  <Text style={styles.previewLabel}>Price per order</Text>
                  <Text style={styles.previewValue}>
                    ₦{selection.item.price_per_order != null ? selection.item.price_per_order.toFixed(0) : '—'}
                  </Text>
                </View>
                <View style={styles.previewActions}>
                  <Button label="Skip" variant="outline" onPress={handleDeclineRun} disabled={acting} style={{ flex: 1 }} />
                  <Button label="Accept run" onPress={handleAcceptRun} loading={acting} style={{ flex: 1 }} />
                </View>
              </>
            )}
          </BottomSheetView>
        ) : (
          <BottomSheetScrollView
            style={{ flex: 1 }}
            contentContainerStyle={styles.listContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
          >
            {hasActiveWork && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>My active deliveries</Text>
                {activeAssignments.map((assignment) => (
                  <TouchableOpacity
                    key={assignment.assignmentId}
                    style={styles.activeCard}
                    onPress={() => openActiveAssignment(assignment)}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.activeCardTitle}>Order #{assignment.orderId.slice(0, 8)}</Text>
                      <StatusPill status={assignment.status} />
                    </View>
                    <MaterialIcons name="chevron-right" size={20} color={colors.textMuted} />
                  </TouchableOpacity>
                ))}
                {activeRun.run_id && (
                  <TouchableOpacity style={styles.activeCard} onPress={openActiveRun}>
                    <MaterialIcons name="local-shipping" size={20} color={colors.primary} />
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={styles.activeCardTitle}>Run in progress</Text>
                      <Text style={styles.activeCardSubtitle}>
                        {activeRun.market ? `${activeRun.market} · ${activeRun.area}` : activeRun.area}
                      </Text>
                    </View>
                    <MaterialIcons name="chevron-right" size={20} color={colors.textMuted} />
                  </TouchableOpacity>
                )}
              </View>
            )}

            {!isOnline ? (
              <View style={styles.section}>
                <View style={styles.offlineNotice}>
                  <MaterialIcons name="wifi-off" size={22} color={colors.textMuted} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.offlineTitle}>You&apos;re offline</Text>
                    <Text style={styles.offlineSubtitle}>Go online to see nearby single orders and batch runs on the map.</Text>
                  </View>
                </View>
              </View>
            ) : (
              <>
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>Available orders ({orders.length})</Text>
                  {orders.length === 0 && !loading && <Text style={styles.emptyRow}>No orders nearby right now.</Text>}
                  {orders.map((order) => (
                    <TouchableOpacity key={order.orderId} style={styles.itemCard} onPress={() => openOrderPreview(order)}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.itemPrice}>₦{order.estimatedEarnings}</Text>
                        <Text style={styles.itemMeta}>{(order.distanceMeters / 1000).toFixed(1)} km away</Text>
                      </View>
                      <MaterialIcons name="chevron-right" size={20} color={colors.textMuted} />
                    </TouchableOpacity>
                  ))}
                </View>

                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>Available runs ({availableRuns.length})</Text>
                  {availableRuns.length === 0 && !loading && <Text style={styles.emptyRow}>No runs nearby right now.</Text>}
                  {availableRuns.map((run) => (
                    <TouchableOpacity key={run.run_id} style={styles.itemCard} onPress={() => openRunPreview(run)}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.runArea}>{run.market ? `${run.market} · ${run.area}` : run.area}</Text>
                        <Text style={styles.itemMeta}>
                          {run.order_count} orders · {(run.distance_meters / 1000).toFixed(1)} km
                        </Text>
                      </View>
                      <Text style={styles.runPrice}>₦{run.price_per_order != null ? run.price_per_order.toFixed(0) : '—'}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}
          </BottomSheetScrollView>
        )}
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  topOverlay: { position: 'absolute', top: 0, left: 0, right: 0 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginHorizontal: 12,
    marginTop: 8,
    padding: 10,
    borderRadius: radius,
    backgroundColor: colors.background,
    ...shadow,
  },
  topBarLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  topBarRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  partnerName: { ...typography.bodyBold, color: colors.textPrimary },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.textMuted },
  dotActive: { backgroundColor: colors.primary },
  statusText: { ...typography.caption, color: colors.textSecondary },
  onlinePill: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  onlinePillActive: { backgroundColor: colors.primary },
  onlinePillText: { ...typography.caption, fontWeight: '700', color: colors.primary },
  onlinePillTextActive: { color: '#fff' },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetBackground: { backgroundColor: colors.background, ...shadow },
  handle: { backgroundColor: colors.border, width: 40 },
  listContent: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 32 },
  section: { marginBottom: 22 },
  sectionLabel: { ...typography.label, color: colors.textMuted, marginBottom: 10 },
  activeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.primaryMuted,
    borderRadius: radius,
    padding: 14,
    marginBottom: 10,
  },
  activeCardTitle: { ...typography.bodyBold, color: colors.textPrimary, marginBottom: 6 },
  activeCardSubtitle: { ...typography.caption, color: colors.textSecondary },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius,
    padding: 14,
    marginBottom: 10,
  },
  itemPrice: { ...typography.subtitle, color: colors.primary },
  itemMeta: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  runArea: { ...typography.bodyBold, color: colors.textPrimary },
  runPrice: { ...typography.subtitle, color: colors.primary },
  emptyRow: { ...typography.secondary, color: colors.textMuted, paddingVertical: 8 },
  offlineNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderWidth: 1,
    borderColor: colors.borderLight,
    backgroundColor: colors.surface,
    borderRadius: radius,
    padding: 14,
  },
  offlineTitle: { ...typography.bodyBold, color: colors.textPrimary, marginBottom: 2 },
  offlineSubtitle: { ...typography.caption, color: colors.textSecondary },
  previewSheet: { paddingHorizontal: 20, paddingTop: 4 },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 14 },
  backText: { ...typography.secondary, color: colors.textSecondary },
  previewTitle: { ...typography.subtitle, color: colors.textPrimary, marginBottom: 16 },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  previewLabel: { ...typography.secondary, color: colors.textSecondary },
  previewValue: { ...typography.bodyBold, color: colors.textPrimary },
  previewActions: { flexDirection: 'row', gap: 12, marginTop: 20, marginBottom: 12 },
});
