import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Button from '../../components/Button';
import ActiveWorkCarousel from '../../components/ActiveWorkCarousel';
import LiveMap from '../../components/LiveMap';
import OfferCountdown, { OfferSecondsBadge } from '../../components/OfferCountdown';
import SectionEmpty from '../../components/SectionEmpty';
import { colors, radius, shadow, spacing, TAB_BAR_HEIGHT, typography } from '../../components/theme';
import { useReportLocation } from '../../hooks/useReportLocation';
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

/** Mirrors offers.MAX_CONCURRENT_ORDERS in markt_python.
 *
 * The server is the authority and refuses the third order itself -- this
 * copy exists only so the app can say so *before* a rider picks an order,
 * reads it, and taps accept. Being told "finish what you are carrying"
 * by a 409 at the end of that is being told the rule at the one moment
 * it is no longer useful. If the two ever disagree the server still
 * wins; the worst case is this card explaining a rule slightly early or
 * slightly late, never one being enforced that the server would allow.
 */
const MAX_CONCURRENT_ORDERS = 2;

export default function DashboardMapScreen() {
  const router = useRouter();
  const [partner, setPartner] = useState<any>(null);
  const [isOnline, setIsOnline] = useState(false);

  // Nothing was telling the server where this rider is, so the backend's
  // radius search had nothing to search from. See hooks/useReportLocation.
  useReportLocation(isOnline);
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
  const [loadProblem, setLoadProblem] = useState<string | null>(null);
  const [tab, setTab] = useState<'orders' | 'runs'>('orders');
  const [acting, setActing] = useState(false);
  const sheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['20%', '52%', '88%'], []);

  // How full the rider is. A delivery still counts while it is being
  // carried and stops counting once it is COMPLETED -- the same test the
  // server applies when it decides whether to allow another.
  const carrying = activeAssignments.filter(
    (assignment) => assignment.logisticalStatus !== 'COMPLETED'
  ).length;
  const atCapacity = carrying >= MAX_CONCURRENT_ORDERS;

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
            // "No orders nearby" and "we do not know where you are" look
            // identical once the error is swallowed, and the second one is
            // the rider's to fix. Say which it is.
            console.error('Error loading available orders:', error);
            setLoadProblem(
              String(error?.message || '').toLowerCase().includes('location')
                ? 'We cannot see your location yet. Turn location on for ' +
                    'Markt, then pull to refresh.'
                : null
            );
            return [] as Order[];
          }),
          apiService.getAvailableRuns().catch((error) => {
            console.error('Error loading available runs:', error);
            return [] as AvailableRun[];
          }),
        ]);
        setOrders(availableOrders);
        setAvailableRuns(runs);
        if (availableOrders.length) setLoadProblem(null);
      } else {
        setOrders([]);
        setAvailableRuns([]);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isOnline]);

  // On focus rather than on mount. Coming back from a delivery -- one
  // just completed, or a run just worked through -- left this showing
  // whatever was true when the rider last opened it, so the only way to
  // see the current state of their own work was to pull to refresh.
  // Covers the first mount and an isOnline flip too, both of which the
  // plain mount effect used to handle.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

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
    setOffer(null);
    setOfferError(null);

    // A rider who is already full cannot accept this, so holding it would
    // take it off every other rider's list for the length of a countdown
    // that can only end one way. Show them the order, say why the button
    // is off, and leave the order where someone can take it.
    if (atCapacity) return;

    // Hold it while the rider reads. The countdown on the sheet is only
    // meaningful if the order is really held for those seconds, and the
    // expiry it counts to comes from the server -- see services/api.ts.
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
      // The run is the rider's now, so the dashboard behind this has to
      // know. handleAcceptOrder has always reloaded and this never did,
      // which is why an accepted run only appeared in "carrying" after
      // a manual pull-to-refresh.
      load();
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
        {/* Online/offline is the one control that belongs on the map:
            a rider changes it constantly and it governs everything on this
            screen. Wallet, profile and sign-out moved to the tab bar,
            where they are labelled and one tap away rather than hidden
            behind an unlabelled avatar. */}
        <Pressable
          style={[styles.statusPill, isOnline && styles.statusPillOn]}
          onPress={handleStatusToggle}
          disabled={isUpdating}
          accessibilityRole="switch"
          accessibilityState={{ checked: isOnline, disabled: isUpdating }}
          accessibilityLabel={isOnline ? 'Go offline' : 'Go online'}
        >
          {isUpdating ? (
            <ActivityIndicator size="small" color={isOnline ? '#fff' : colors.primary} />
          ) : (
            <View style={[styles.statusDot, isOnline && styles.statusDotOn]} />
          )}
          <Text style={[styles.statusText, isOnline && styles.statusTextOn]}>
            {isOnline ? "You're online" : "You're offline"}
          </Text>
        </Pressable>
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
          <BottomSheetScrollView
            style={{ flex: 1 }}
            contentContainerStyle={[
              styles.previewSheet,
              { paddingBottom: TAB_BAR_HEIGHT + 24 },
            ]}
            keyboardShouldPersistTaps="handled"
          >
            <TouchableOpacity onPress={closePreview} style={styles.backRow}>
              <MaterialIcons name="arrow-back" size={18} color={colors.textSecondary} />
              <Text style={styles.backText}>Back</Text>
            </TouchableOpacity>

            {selection.kind === 'order' ? (
              <>
                {/* What it pays, first and biggest. A rider deciding
                    inside a thirty-second hold reads one number and
                    then looks for the reasons to say no -- so the fee
                    leads, and the shop, the distance and where it is
                    going sit under it in that order. The order id, the
                    one thing on here nobody can act on, is gone from
                    the top entirely. */}
                <Text style={styles.offerFee}>{money(selection.item.estimatedEarnings)}</Text>
                <Text style={styles.offerFeeNote}>
                  Your earnings for this delivery
                </Text>

                <View style={styles.offerFactsRow}>
                  <Text style={styles.offerFact}>
                    {km(selection.item.distanceMeters)} to pick up
                  </Text>
                  {(selection.item.pickupCount ?? 1) > 1 && (
                    <Text style={styles.offerFact}>
                      · {selection.item.pickupCount} shops
                    </Text>
                  )}
                  {!!selection.item.itemCount && (
                    <Text style={styles.offerFact}>
                      · {selection.item.itemCount}{' '}
                      {selection.item.itemCount === 1 ? 'item' : 'items'}
                    </Text>
                  )}
                </View>

                {/* The two ends of the trip, as a route rather than as
                    rows of a table. */}
                <View style={styles.offerRoute}>
                  <View style={styles.offerStop}>
                    {selection.item.sellerImage ? (
                      <Image source={{ uri: selection.item.sellerImage }} style={styles.offerThumb} />
                    ) : (
                      <View style={[styles.offerThumb, styles.offerThumbEmpty]}>
                        <MaterialIcons name="storefront" size={16} color={colors.textSecondary} />
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={styles.offerStopLabel}>PICK UP</Text>
                      <Text style={styles.offerStopName} numberOfLines={1}>
                        {selection.item.sellerName || 'Pickup from seller'}
                      </Text>
                      {!!selection.item.pickupAddress && (
                        <Text style={styles.offerStopMeta} numberOfLines={1}>
                          {selection.item.pickupAddress}
                        </Text>
                      )}
                    </View>
                  </View>

                  <View style={styles.offerRouteLine} />

                  <View style={styles.offerStop}>
                    <View style={[styles.offerThumb, styles.offerThumbEmpty]}>
                      <MaterialIcons name="place" size={16} color={colors.textSecondary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.offerStopLabel}>DROP OFF</Text>
                      <Text style={styles.offerStopName} numberOfLines={1}>
                        {selection.item.dropoffArea || 'Customer drop-off'}
                      </Text>
                      {/* The buyer's exact address stays hidden until
                          they have accepted -- the area is enough to
                          judge the trip on. */}
                      <Text style={styles.offerStopMeta}>
                        Full address once you accept
                      </Text>
                    </View>
                  </View>
                </View>

                {offer && (
                  <OfferCountdown
                    expiresAt={offer.expiresAt}
                    total={offer.seconds}
                    onExpire={handleOfferExpired}
                  />
                )}
                {offerError && <Text style={styles.previewNotice}>{offerError}</Text>}
                {atCapacity && (
                  <Text style={styles.previewNotice}>
                    You are carrying {carrying} already. Finish one and this
                    is yours to take.
                  </Text>
                )}

                {offerError ? (
                  <Button label="Back to list" onPress={closePreview} />
                ) : (
                  <TouchableOpacity
                    style={[styles.acceptButton, (acting || atCapacity) && styles.acceptButtonOff]}
                    onPress={handleAcceptOrder}
                    disabled={acting || atCapacity}
                    activeOpacity={0.85}
                    accessibilityRole="button"
                    accessibilityLabel="Accept this order"
                  >
                    {acting ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <>
                        <Text style={styles.acceptLabel}>Accept order</Text>
                        {offer && <OfferSecondsBadge expiresAt={offer.expiresAt} />}
                      </>
                    )}
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  onPress={handleDeclineOrder}
                  disabled={acting}
                  style={styles.declineRow}
                  accessibilityRole="button"
                >
                  <Text style={styles.declineText}>Decline</Text>
                </TouchableOpacity>
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
          </BottomSheetScrollView>
        ) : (
          <BottomSheetScrollView
            style={{ flex: 1 }}
            contentContainerStyle={[
              styles.listContent,
              // The tab bar is drawn over the sheet, so without this the
              // last job in the list sits underneath it.
              { paddingBottom: TAB_BAR_HEIGHT + 24 },
            ]}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
          >
            {/* How full they are, and what that means. The cap is
                enforced on the server and was mentioned nowhere in the
                app, so the only way to learn it existed was to pick an
                order, read it, tap accept and be refused. */}
            {atCapacity && (
              <Text style={styles.capacityNote}>
                You are carrying {carrying} of {MAX_CONCURRENT_ORDERS}. Finish one
                to take on more.
              </Text>
            )}

            {hasActiveWork && (
              <ActiveWorkCarousel
                assignments={activeAssignments}
                run={activeRun.run_id ? activeRun : null}
                onOpenAssignment={openActiveAssignment}
                onOpenRun={openActiveRun}
              />
            )}

            {!isOnline ? (
              <View style={styles.section}>
                <SectionEmpty icon="wifi-off" title="You're offline. Go online to see nearby single orders and batch runs on the map." />
              </View>
            ) : (
              <>
                {/* One segment, not two stacked lists. A rider is choosing
                    between two kinds of work, and stacking them meant
                    scrolling past an empty "Available orders (0)" to find
                    out whether there were any runs. Both counts show at
                    once now. */}
                <View style={styles.segment}>
                  {(['orders', 'runs'] as const).map((key) => {
                    const active = tab === key;
                    const count =
                      key === 'orders' ? orders.length : availableRuns.length;
                    return (
                      <Pressable
                        key={key}
                        style={[styles.segmentTab, active && styles.segmentTabOn]}
                        onPress={() => setTab(key)}
                        accessibilityRole="tab"
                        accessibilityState={{ selected: active }}
                      >
                        <Text style={[styles.segmentText, active && styles.segmentTextOn]}>
                          {key === 'orders' ? 'Single orders' : 'Batched runs'}
                        </Text>
                        <View style={[styles.segmentCount, active && styles.segmentCountOn]}>
                          <Text
                            style={[
                              styles.segmentCountText,
                              active && styles.segmentCountTextOn,
                            ]}
                          >
                            {count}
                          </Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>

                {tab === 'orders' ? (
                  <View style={styles.section}>
                    {orders.length === 0 && !loading && (
                      <SectionEmpty
                        icon={loadProblem ? 'location-off' : 'explore'}
                        title={loadProblem ?? 'No orders nearby right now.'}
                      />
                    )}
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
                        {!!order.sellerName && (
                          <Text style={styles.jobWhere} numberOfLines={1}>
                            {order.sellerName}
                          </Text>
                        )}
                        <View style={styles.jobFoot}>
                          <Text style={styles.jobMeta}>
                            {km(order.distanceMeters)} to pick up
                            {order.dropoffArea ? ` \u00b7 to ${order.dropoffArea}` : ''}
                          </Text>
                          <Text style={styles.jobAction}>View</Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : (
                  <View style={styles.section}>
                    {availableRuns.length === 0 && !loading && (
                      <SectionEmpty icon="local-shipping" title="No runs nearby right now." />
                    )}
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
                          <Text style={styles.jobPay}>{riderTotal(run)}</Text>
                        </View>
                        <Text style={styles.jobWhere} numberOfLines={1}>
                          {run.market ? `${run.market} \u00b7 ${run.area}` : run.area}
                        </Text>
                        <View style={styles.jobFoot}>
                          <Text style={styles.jobMeta}>
                            {km(run.distance_meters)} away
                            {run.rider_earning_per_drop != null
                              ? ` \u00b7 ${money(run.rider_earning_per_drop)} a drop`
                              : ''}
                          </Text>
                          <Text style={styles.jobAction}>View</Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
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
  listContent: { paddingHorizontal: 20, paddingTop: 8 },
  section: { marginBottom: 32 },
  capacityNote: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: 10,
    lineHeight: 18,
  },
  // One card shape for both kinds of work, so a rider comparing a single
  // order against a run is comparing like with like. What it pays is the
  // biggest thing on it, because that is what the decision turns on.
  // The online/offline control, on the map where it is used.
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    margin: spacing.screenX,
    paddingHorizontal: 16,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow,
  },
  statusPillOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.textMuted,
  },
  statusDotOn: { backgroundColor: '#fff' },
  statusText: { ...typography.caption, fontWeight: '700', color: colors.textSecondary },
  statusTextOn: { color: '#fff' },

  segment: {
    flexDirection: 'row',
    gap: 6,
    backgroundColor: colors.surface,
    borderRadius: radius,
    padding: 4,
    marginBottom: spacing.md,
  },
  segmentTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 38,
    borderRadius: 6,
  },
  segmentTabOn: { backgroundColor: colors.background, ...shadow },
  segmentText: { ...typography.caption, fontWeight: '600', color: colors.textSecondary },
  segmentTextOn: { color: colors.textPrimary, fontWeight: '700' },
  segmentCount: {
    minWidth: 20,
    paddingHorizontal: 5,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceDim,
  },
  segmentCountOn: { backgroundColor: colors.primary },
  segmentCountText: { fontSize: 11, fontWeight: '700', color: colors.textSecondary },
  segmentCountTextOn: { color: '#fff' },

  // Same reasoning as EarningsSummary's card: an outline around every
  // job turned a list of work into a stack of rectangles. The surface and
  // the gap between them are enough to read as separate cards.
  jobCard: {
    backgroundColor: colors.surface,
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
  // The offer card: the fee leads, the route reads as a route, and the
  // accept button carries its own clock.
  offerFee: { fontSize: 36, fontWeight: '800', color: colors.textPrimary },
  offerFeeNote: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  offerFactsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 10 },
  offerFact: { ...typography.secondary, color: colors.textSecondary },
  offerRoute: {
    marginTop: 18,
    marginBottom: 18,
    padding: 14,
    borderRadius: radius,
    backgroundColor: colors.surface,
    gap: 4,
  },
  offerStop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  offerThumb: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.border },
  offerThumbEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  offerStopLabel: { ...typography.label, fontSize: 10, color: colors.textMuted },
  offerStopName: { ...typography.bodyBold, color: colors.textPrimary },
  offerStopMeta: { ...typography.caption, color: colors.textSecondary },
  // Joins the two stops, aligned with the middle of the 34px thumbs.
  offerRouteLine: {
    width: 1,
    height: 16,
    marginLeft: 17,
    backgroundColor: colors.surfaceDim,
  },
  acceptButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    height: 54,
    borderRadius: radius,
    backgroundColor: colors.primary,
  },
  acceptButtonOff: { backgroundColor: colors.surfaceDim },
  acceptLabel: { ...typography.bodyBold, color: '#fff' },
  declineRow: { alignItems: 'center', paddingVertical: 14 },
  declineText: { ...typography.body, color: colors.textSecondary },
  previewTitle: { ...typography.subtitle, color: colors.textPrimary },
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
