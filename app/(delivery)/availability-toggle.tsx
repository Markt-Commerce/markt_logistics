import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import BottomSheet, { BottomSheetScrollView, BottomSheetView } from '@gorhom/bottom-sheet';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Button from '../../components/Button';
import LiveMap from '../../components/LiveMap';
import OfferCountdown from '../../components/OfferCountdown';
import SectionEmpty from '../../components/SectionEmpty';
import SectionHeader from '../../components/SectionHeader';
import StatusPill from '../../components/StatusPill';
import { colors, radius, shadow, typography } from '../../components/theme';
import { useAuth } from '../../contexts/auth';
import apiService, { OrderTakenError } from '../../services/api';
import {
  Assignment,
  AvailableRun,
  DeliveryStop,
  Order,
  OrderOffer,
  RunDetail,
} from '../../types';
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
/** Money the way a rider reads it: whole naira, no trailing kobo. */
function money(value: number | null | undefined): string {
  if (value == null) return '\u2014';
  return `\u20a6${Math.round(value).toLocaleString()}`;
}

function km(meters: number): string {
  return `${(meters / 1000).toFixed(1)} km`;
}

/** What the whole run pays. Falls back to the per-drop figure times the
 *  drops when an older backend has not sent the total yet, and to a dash
 *  rather than \u20a60 when it has sent neither -- an unpriced run should not
 *  advertise nothing as if it were free. */
function riderTotal(run: AvailableRun): string {
  if (run.rider_earning_total != null) return money(run.rider_earning_total);
  if (run.rider_earning_per_drop != null) {
    return money(run.rider_earning_per_drop * run.order_count);
  }
  return '\u2014';
}

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
  const [offer, setOffer] = useState<OrderOffer | null>(null);
  const [offerError, setOfferError] = useState<string | null>(null);
  const [acting, setActing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
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
  const openOrderPreview = (order: Order) => {
    setSelection({ kind: 'order', item: order });
    // Hold it while the rider reads. The countdown on the sheet is only
    // meaningful if the order is really held for those seconds, and the
    // expiry it counts to comes from the server -- see services/api.ts.
    setOffer(null);
    setOfferError(null);
    apiService
      .offerOrder(order.orderId)
      .then(setOffer)
      .catch((error) => {
        if (error instanceof OrderTakenError) {
          // Normal. Somebody was quicker, or this rider passed recently.
          setOfferError(error.message);
          load();
        } else {
          // The hold failed for some other reason. Let them try to accept
          // anyway rather than blocking on a countdown we could not start:
          // accept re-checks server-side regardless.
          console.warn('Could not hold order:', error);
        }
      });
  };
  const openRunPreview = (run: AvailableRun) => setSelection({ kind: 'run', item: run });
  const closePreview = () => {
    setSelection(null);
    setOffer(null);
    setOfferError(null);
  };

  /** The hold ran out while the sheet was open.
   *
   * Nothing has to happen for the order to be released -- the server let it
   * go by the clock. This just stops showing a rider an accept button that
   * would now lose a race, and puts the order back in the list. */
  const handleOfferExpired = () => {
    setOfferError('Time is up. This order is back in the list.');
    setOffer(null);
    load();
  };

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
      if (error instanceof OrderTakenError) {
        // Someone else got there first, or the hold lapsed between the tap
        // and the request landing. Not a failure worth an error dialog.
        setOfferError(error.message);
        setOffer(null);
        load();
      } else {
        console.error('Error accepting order:', error);
        setOfferError('Could not accept that. Try again.');
      }
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

      {menuOpen && <Pressable style={StyleSheet.absoluteFill} onPress={() => setMenuOpen(false)} />}

      <SafeAreaView style={styles.topOverlay} edges={['top']} pointerEvents="box-none">
        <View style={styles.avatarWrap}>
          <TouchableOpacity style={styles.avatar} onPress={() => setMenuOpen((open) => !open)}>
            <Text style={styles.avatarText}>{(partner.name || '?').charAt(0).toUpperCase()}</Text>
          </TouchableOpacity>

          {menuOpen && (
            <View style={styles.avatarMenu}>
              <TouchableOpacity
                style={styles.menuRow}
                onPress={() => {
                  setMenuOpen(false);
                  handleStatusToggle();
                }}
                disabled={isUpdating}
              >
                {isUpdating ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <MaterialIcons name={isOnline ? 'wifi-off' : 'wifi'} size={18} color={colors.textPrimary} />
                )}
                <Text style={styles.menuRowText}>{isOnline ? 'Go offline' : 'Go online'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.menuRow}
                onPress={() => {
                  setMenuOpen(false);
                  router.push('/(delivery)/earnings');
                }}
              >
                <MaterialIcons name="account-balance-wallet" size={18} color={colors.textPrimary} />
                <Text style={styles.menuRowText}>Wallet</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.menuRow}
                onPress={() => {
                  setMenuOpen(false);
                  handleLogout();
                }}
              >
                <MaterialIcons name="logout" size={18} color={colors.textPrimary} />
                <Text style={styles.menuRowText}>Sign out</Text>
              </TouchableOpacity>
            </View>
          )}
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
                {offer && (
                  <OfferCountdown
                    expiresAt={offer.expiresAt}
                    total={offer.seconds}
                    onExpire={handleOfferExpired}
                  />
                )}
                {offerError && <Text style={styles.previewNotice}>{offerError}</Text>}

                <View style={styles.previewRow}>
                  <Text style={styles.previewLabel}>You earn</Text>
                  <Text style={styles.previewValueStrong}>
                    {money(selection.item.estimatedEarnings)}
                  </Text>
                </View>
                <View style={styles.previewRow}>
                  <Text style={styles.previewLabel}>Distance</Text>
                  <Text style={styles.previewValue}>{km(selection.item.distanceMeters)}</Text>
                </View>
                <View style={styles.previewActions}>
                  <Button label="Decline" variant="outline" onPress={handleDeclineOrder} disabled={acting} style={{ flex: 1 }} />
                  <Button
                    label={offerError ? 'Back to list' : 'Accept order'}
                    onPress={offerError ? closePreview : handleAcceptOrder}
                    loading={acting}
                    style={{ flex: 1 }}
                  />
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
                  <Text style={styles.previewValue}>{km(selection.item.distance_meters)}</Text>
                </View>
                {/* "Price per order" was price_per_order -- what each buyer
                    pays towards the run, not what the rider is credited.
                    These are the rider's own figures. */}
                <View style={styles.previewRow}>
                  <Text style={styles.previewLabel}>You earn per drop</Text>
                  <Text style={styles.previewValue}>
                    {money(selection.item.rider_earning_per_drop)}
                  </Text>
                </View>
                <View style={styles.previewRow}>
                  <Text style={styles.previewLabel}>You earn in total</Text>
                  <Text style={styles.previewValueStrong}>
                    {riderTotal(selection.item)}
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
                <SectionHeader title="My active deliveries" />
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
                <SectionEmpty icon="wifi-off" title="You're offline. Go online to see nearby single orders and batch runs on the map." />
              </View>
            ) : (
              <>
                <View style={styles.section}>
                  <SectionHeader title={`Available orders (${orders.length})`} />
                  {orders.length === 0 && !loading && <SectionEmpty icon="explore" title="No orders nearby right now." />}
                  {orders.map((order) => (
                    <TouchableOpacity
                      key={order.orderId}
                      style={styles.jobCard}
                      onPress={() => openOrderPreview(order)}
                      accessibilityRole="button"
                      accessibilityLabel={`Single order, ${money(order.estimatedEarnings)}, ${km(order.distanceMeters)} away`}
                    >
                      <View style={styles.jobHead}>
                        <View style={styles.jobBadge}>
                          <MaterialIcons name="two-wheeler" size={14} color={colors.textSecondary} />
                          <Text style={styles.jobBadgeText}>Single order</Text>
                        </View>
                        <Text style={styles.jobPay}>{money(order.estimatedEarnings)}</Text>
                      </View>
                      <View style={styles.jobFoot}>
                        <Text style={styles.jobMeta}>{km(order.distanceMeters)} to pick up</Text>
                        <Text style={styles.jobAction}>View</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>

                <View style={styles.section}>
                  <SectionHeader title={`Available runs (${availableRuns.length})`} />
                  {availableRuns.length === 0 && !loading && <SectionEmpty icon="local-shipping" title="No runs nearby right now." />}
                  {availableRuns.map((run) => (
                    <TouchableOpacity
                      key={run.run_id}
                      style={styles.jobCard}
                      onPress={() => openRunPreview(run)}
                      accessibilityRole="button"
                      accessibilityLabel={`Run of ${run.order_count} orders, ${riderTotal(run)} total`}
                    >
                      <View style={styles.jobHead}>
                        <View style={styles.jobBadge}>
                          <MaterialIcons name="local-shipping" size={14} color={colors.textSecondary} />
                          <Text style={styles.jobBadgeText}>
                            {run.order_count} {run.order_count === 1 ? 'drop' : 'drops'}
                          </Text>
                        </View>
                        {/* The total, not price_per_order. That is what each
                            buyer pays towards the run; the rider takes a
                            share of the trip, and the total is what makes a
                            run worth more than a single order. */}
                        <Text style={styles.jobPay}>{riderTotal(run)}</Text>
                      </View>
                      <Text style={styles.jobWhere} numberOfLines={1}>
                        {run.market ? `${run.market} · ${run.area}` : run.area}
                      </Text>
                      <View style={styles.jobFoot}>
                        <Text style={styles.jobMeta}>
                          {km(run.distance_meters)} away
                          {run.rider_earning_per_drop != null
                            ? ` · ${money(run.rider_earning_per_drop)} a drop`
                            : ''}
                        </Text>
                        <Text style={styles.jobAction}>View</Text>
                      </View>
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
  avatarWrap: { marginHorizontal: 12, marginTop: 8, alignItems: 'flex-start' },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow,
  },
  avatarText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  avatarMenu: {
    marginTop: 8,
    borderRadius: radius,
    backgroundColor: colors.background,
    paddingVertical: 6,
    minWidth: 168,
    ...shadow,
  },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  menuRowText: { ...typography.body, color: colors.textPrimary },
  sheetBackground: { backgroundColor: colors.background, ...shadow },
  handle: { backgroundColor: colors.border, width: 40 },
  listContent: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 32 },
  section: { marginBottom: 32 },
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
  // One card shape for both kinds of work, so a rider comparing a single
  // order against a run is comparing like with like. What it pays is the
  // biggest thing on it, because that is what the decision turns on.
  jobCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius,
    padding: 14,
    marginBottom: 10,
  },
  jobHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  jobBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.surface,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  jobBadgeText: { ...typography.caption, fontSize: 11, color: colors.textSecondary },
  jobPay: { ...typography.title, fontSize: 22, color: colors.textPrimary },
  jobWhere: { ...typography.bodyBold, color: colors.textPrimary, marginTop: 10 },
  jobFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  jobMeta: { ...typography.caption, color: colors.textSecondary, flex: 1 },
  jobAction: { ...typography.caption, fontWeight: '700', color: colors.primary },
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
  previewNotice: {
    ...typography.caption,
    color: colors.textSecondary,
    backgroundColor: colors.surface,
    borderRadius: radius,
    padding: 10,
    marginBottom: 12,
    lineHeight: 17,
  },
  previewValueStrong: { ...typography.subtitle, color: colors.primary },
  previewActions: { flexDirection: 'row', gap: 12, marginTop: 20, marginBottom: 12 },
});
