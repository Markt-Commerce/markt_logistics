import { MaterialIcons } from '@expo/vector-icons';
import BottomSheet, { BottomSheetScrollView, BottomSheetView } from '@gorhom/bottom-sheet';
import React, { useMemo, useState } from 'react';
import { Image, Linking, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { DeliveryStop } from '../types';
import Button from './Button';
import SectionHeader from './SectionHeader';
import SlideToConfirm from './SlideToConfirm';
import StatusPill from './StatusPill';
import { colors, radius, shadow, typography } from './theme';

/** The statuses that mean a stop is behind the rider.
 *
 * Four vocabularies meet here: run pickups are lowercase
 * (pending/arrived/picked_up), run dropoffs carry a pod_status
 * (pending/qr_issued/delivered), and assignment stops are uppercase
 * (PENDING/ARRIVED_PICKUP/PICKED_UP, ... /COMPLETED). Rather than teach the
 * sheet all four, it only has to know which ones are finished -- everything
 * else is still ahead. */
const DONE_STATUSES = new Set([
  'picked_up',
  'PICKED_UP',
  'delivered',
  'DELIVERED',
  'completed',
  'COMPLETED',
]);

function isDone(status: string): boolean {
  return DONE_STATUSES.has(status);
}

interface ScreenActions {
  refreshing?: boolean;
  onRefresh?: () => void;
  dangerActionLabel?: string;
  onDangerAction?: () => void;
}

interface ParcelLine {
  name: string;
  quantity: number;
  variant?: string | null;
}

interface ActiveDeliverySheetProps {
  headerTitle: string;
  headerSubtitle?: string;
  stops: DeliveryStop[];
  screenActions?: ScreenActions;
  /** The order number. What the shop looks this parcel up by, and the
   *  only string on the screen that both sides can read off. */
  reference?: string | null;
  /** What is in the bag, line by line. A rider handed a parcel had a
   *  count and nothing to check it against. */
  parcel?: ParcelLine[];
}

// The persistent map+sheet experience shared by both single-order and
// batch-run active deliveries (see agile-waddling-pie.md for why this
// replaces 4 separate screens). Plain BottomSheet, not BottomSheetModal --
// this sheet IS the screen, not a transient overlay.
export default function ActiveDeliverySheet({
  headerTitle,
  headerSubtitle,
  stops,
  screenActions,
  reference,
  parcel,
}: ActiveDeliverySheetProps) {
  const snapPoints = useMemo(() => ['22%', '82%'], []);
  const [busyStopId, setBusyStopId] = useState<string | null>(null);

  // The currently actionable stop -- adapters (assignmentToStops/
  // runToStops) only attach onPrimaryAction to the one stop that's
  // actually next, respecting each flow's own gating rules.
  const nextStop = stops.find((s) => s.onPrimaryAction);
  const doneCount = stops.filter((s) => isDone(s.status)).length;

  const runStopAction = async (stop: DeliveryStop) => {
    if (!stop.onPrimaryAction || busyStopId) return;
    setBusyStopId(stop.id);
    try {
      await stop.onPrimaryAction();
    } finally {
      setBusyStopId(null);
    }
  };

  return (
    <BottomSheet
      index={0}
      snapPoints={snapPoints}
      enablePanDownToClose={false}
      enableDynamicSizing={false}
      handleIndicatorStyle={styles.handle}
      backgroundStyle={styles.sheetBackground}
    >
      {/* One BottomSheetView wrapping both. A BottomSheetView and a
          BottomSheetScrollView as siblings do not lay out against each
          other -- the summary rendered on top of the list, so the title,
          the route heading and the first stop all printed over one
          another. */}
      <BottomSheetView style={styles.sheetBody}>
      <View style={styles.summary}>
        <Text style={styles.headerTitle}>{headerTitle}</Text>
        {!!headerSubtitle && <Text style={styles.headerSubtitle}>{headerSubtitle}</Text>}

        {/* How far through the route the rider is. The list said "All stops
            (5)", which is the one thing about a route you can see by
            looking -- what you cannot see is how many are behind you. */}
        {stops.length > 0 && (
          <View style={styles.progress}>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${(doneCount / stops.length) * 100}%` },
                ]}
              />
            </View>
            <Text style={styles.progressText}>
              {doneCount} of {stops.length} done
            </Text>
          </View>
        )}
        {nextStop ? (
          <>
            {nextStop.confirmBySlide ? (
              // The last step, and the only one that cannot be undone.
              // Full width, under its own heading, rather than sharing a
              // row with the stop name -- a slider squeezed beside a
              // label has nowhere to travel.
              <View style={styles.nextStack}>
                <Text style={styles.nextLabel}>Next</Text>
                <Text style={styles.nextTitle}>{nextStop.title}</Text>
                <SlideToConfirm
                  label={nextStop.primaryActionLabel ?? 'Slide to confirm'}
                  loading={busyStopId === nextStop.id}
                  onConfirm={() => runStopAction(nextStop)}
                />
              </View>
            ) : (
              <View style={styles.nextRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.nextLabel}>Next</Text>
                  <Text style={styles.nextTitle}>{nextStop.title}</Text>
                </View>
                <Button
                  label={nextStop.primaryActionLabel ?? 'Continue'}
                  onPress={() => runStopAction(nextStop)}
                  loading={busyStopId === nextStop.id}
                  style={styles.nextButton}
                />
              </View>
            )}
            {/* What the button commits them to, next to the button
                itself. Every action here was labelled with a state --
                "Arrived at pickup", "Confirm pickup" -- and a rider on
                their first delivery had nothing telling them what
                pressing it does, or what it tells the shop and the
                buyer. */}
            {!!nextStop.hint && <Text style={styles.nextHint}>{nextStop.hint}</Text>}
          </>
        ) : (
          <Text style={styles.nextTitle}>All stops handled</Text>
        )}
      </View>

      <BottomSheetScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.listContent}
        refreshControl={
          screenActions?.onRefresh ? (
            <RefreshControl
              refreshing={!!screenActions.refreshing}
              onRefresh={screenActions.onRefresh}
              tintColor={colors.primary}
            />
          ) : undefined
        }
      >
        {/* What this delivery is, in the sheet rather than behind
            another tap. The rider needed the order number to be given
            the right bag and the contents to know it is the right bag,
            and neither was anywhere on this screen. */}
        {(!!reference || !!parcel?.length) && (
          <View style={styles.parcelCard}>
            {!!reference && (
              <View style={styles.parcelRefRow}>
                <Text style={styles.parcelRefLabel}>ORDER</Text>
                <Text style={styles.parcelRef} selectable>
                  {reference}
                </Text>
              </View>
            )}
            {!!parcel?.length && (
              <>
                <Text style={styles.parcelTitle}>
                  Check these before you accept the parcel
                </Text>
                {parcel.map((line, index) => (
                  <View key={`${line.name}-${index}`} style={styles.parcelLine}>
                    <Text style={styles.parcelQty}>{line.quantity}×</Text>
                    <Text style={styles.parcelName} numberOfLines={2}>
                      {line.name}
                      {line.variant ? ` · ${line.variant}` : ''}
                    </Text>
                  </View>
                ))}
              </>
            )}
          </View>
        )}

        <SectionHeader title={`Your route (${stops.length} stops)`} />
        {stops.map((stop, index) => {
          const done = isDone(stop.status);
          const isNext = nextStop?.id === stop.id;
          const last = index === stops.length - 1;

          return (
          <View key={stop.id} style={styles.stopRow}>
            <View style={styles.stopHeader}>
              {/* The rail: a marker per stop joined by a line, so the list
                  reads as a route rather than as rows that happen to be
                  stacked. Filled behind the rider, hollow ahead. */}
              <View style={styles.rail}>
                <View
                  style={[
                    styles.marker,
                    done && styles.markerDone,
                    isNext && styles.markerNext,
                  ]}
                >
                  {done ? (
                    <MaterialIcons name="check" size={14} color="#fff" />
                  ) : stop.image ? (
                    // The shop itself. A rider pulling up to a row of
                    // stalls is matching a picture, not reading a name --
                    // the marker was a generic storefront glyph for every
                    // pickup on the route.
                    <Image source={{ uri: stop.image }} style={styles.markerImage} />
                  ) : (
                    <MaterialIcons
                      name={stop.kind === 'pickup' ? 'storefront' : 'person-pin-circle'}
                      size={14}
                      color={isNext ? '#fff' : colors.textSecondary}
                    />
                  )}
                </View>
                {!last && (
                  <View style={[styles.railLine, done && styles.railLineDone]} />
                )}
              </View>
              <View style={{ flex: 1, paddingBottom: last ? 0 : 4 }}>
                <View style={styles.stopTopRow}>
                  <Text style={styles.stopKind}>
                    {stop.kind === 'pickup' ? 'PICK UP' : 'DROP OFF'}
                  </Text>
                  {/* A rider outside a shut shop, or at a gate with nobody
                      answering, has no other move. Hidden rather than
                      disabled when there is no number: a call button that
                      does nothing is worse than none. */}
                  {!!stop.phone && !done && (
                    <Pressable
                      style={styles.callButton}
                      onPress={() => Linking.openURL(`tel:${stop.phone}`)}
                      accessibilityRole="button"
                      accessibilityLabel={`Call ${stop.title}`}
                      hitSlop={8}
                    >
                      <MaterialIcons name="call" size={15} color={colors.primary} />
                      <Text style={styles.callText}>Call</Text>
                    </Pressable>
                  )}
                </View>
                <Text style={[styles.stopTitle, done && styles.stopTitleDone]}>
                  {stop.title}
                </Text>
                {!!stop.subtitle && <Text style={styles.stopSubtitle}>{stop.subtitle}</Text>}
                <StatusPill status={stop.status} />
                {/* Already shown against the button in the summary for
                    the next stop; here it explains the ones that are not
                    actionable yet, which otherwise just look broken. */}
                {!!stop.hint && !isNext && !done && (
                  <Text style={styles.stopHint}>{stop.hint}</Text>
                )}
              </View>
            </View>
            {/* The next stop's action is already the big button in the
                summary above. Repeating it here put two identical
                "Arrived at pickup" buttons on screen, one of them the
                wrong weight. The secondary action still shows. */}
            {((stop.onPrimaryAction && !isNext) || stop.onSecondaryAction) && (
              <View style={styles.stopActions}>
                {/* A slider needs the full width to have any travel in
                    it -- sharing a row with "Report issue" left a thumb
                    with about forty pixels to cross, which is a tap
                    with extra steps. So it goes on its own line and the
                    secondary action sits above it. */}
                {stop.onSecondaryAction && (
                  <Button
                    label={stop.secondaryActionLabel ?? 'Report issue'}
                    onPress={stop.onSecondaryAction}
                    variant="outline"
                  />
                )}
                {stop.onPrimaryAction && !isNext && (
                  stop.confirmBySlide ? (
                    <SlideToConfirm
                      label={stop.primaryActionLabel ?? 'Slide to confirm'}
                      loading={busyStopId === stop.id}
                      onConfirm={() => runStopAction(stop)}
                    />
                  ) : (
                    <Button
                      label={stop.primaryActionLabel ?? 'Continue'}
                      onPress={() => runStopAction(stop)}
                      loading={busyStopId === stop.id}
                      variant="secondary"
                    />
                  )
                )}
              </View>
            )}
          </View>
          );
        })}

        {screenActions?.onDangerAction && (
          <Button
            label={screenActions.dangerActionLabel ?? 'Cancel'}
            onPress={screenActions.onDangerAction}
            variant="danger"
            style={styles.dangerButton}
          />
        )}
      </BottomSheetScrollView>
      </BottomSheetView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheetBackground: {
    backgroundColor: colors.background,
    ...shadow,
  },
  handle: {
    backgroundColor: colors.border,
    width: 40,
  },
  sheetBody: { flex: 1 },
  summary: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  headerTitle: {
    ...typography.subtitle,
    color: colors.textPrimary,
  },
  headerSubtitle: {
    ...typography.secondary,
    color: colors.textSecondary,
    marginTop: 2,
  },
  nextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 14,
  },
  nextLabel: {
    ...typography.label,
    color: colors.textMuted,
    marginBottom: 4,
  },
  nextTitle: {
    ...typography.bodyBold,
    color: colors.textPrimary,
  },
  nextButton: {
    paddingHorizontal: 20,
  },
  nextStack: { marginTop: 14, gap: 4 },
  nextHint: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 10,
    lineHeight: 18,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
  },
  stopRow: {
    paddingVertical: 12,
    // No divider: the rail runs through these rows and a hairline across it
    // chops the route into segments.
  },
  stopHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },

  progress: { marginTop: 12 },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  progressFill: {
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.primary,
  },
  progressText: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 6,
  },

  rail: { alignItems: 'center', alignSelf: 'stretch' },
  marker: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Fills the marker circle, so a shop with a picture and one without
  // still line up on the same rail.
  markerImage: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.border,
  },
  markerDone: {
    backgroundColor: colors.textMuted,
    borderColor: colors.textMuted,
  },
  markerNext: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  railLine: {
    flex: 1,
    width: 2,
    minHeight: 12,
    marginTop: 2,
    backgroundColor: colors.border,
  },
  railLineDone: { backgroundColor: colors.textMuted },

  stopTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  callButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: colors.primaryMuted,
  },
  callText: { ...typography.caption, fontWeight: '700', color: colors.primary },
  stopKind: {
    ...typography.label,
    fontSize: 10,
    color: colors.textMuted,
    marginBottom: 2,
  },
  stopTitleDone: { color: colors.textSecondary },
  stopActions: {
    gap: 8,
    marginTop: 10,
    // Indented past the rail so the actions line up with the stop they
    // belong to rather than with the markers.
    marginLeft: 40,
  },
  stopIndex: {
    width: 28,
    height: 28,
    borderRadius: radius,
    backgroundColor: colors.bgMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopIndexText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '700',
  },
  stopTitle: {
    ...typography.bodyBold,
    color: colors.textPrimary,
  },
  stopSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
    marginBottom: 6,
  },
  parcelCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius,
    padding: 14,
    marginBottom: 20,
    gap: 6,
  },
  parcelRefRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  parcelRefLabel: { ...typography.label, fontSize: 10, color: colors.textMuted },
  parcelRef: { ...typography.bodyBold, color: colors.textPrimary },
  parcelTitle: { ...typography.caption, color: colors.textSecondary, marginTop: 4 },
  parcelLine: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  parcelQty: { ...typography.bodyBold, color: colors.primary, minWidth: 26 },
  parcelName: { ...typography.body, color: colors.textPrimary, flex: 1 },
  stopHint: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 6,
    lineHeight: 17,
  },
  dangerButton: { marginTop: 20 },
});
