import { MaterialIcons } from '@expo/vector-icons';
import BottomSheet, { BottomSheetScrollView, BottomSheetView } from '@gorhom/bottom-sheet';
import React, { useMemo, useState } from 'react';
import { Linking, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { DeliveryStop } from '../types';
import Button from './Button';
import SectionHeader from './SectionHeader';
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

interface ActiveDeliverySheetProps {
  headerTitle: string;
  headerSubtitle?: string;
  stops: DeliveryStop[];
  screenActions?: ScreenActions;
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
              </View>
            </View>
            {/* The next stop's action is already the big button in the
                summary above. Repeating it here put two identical
                "Arrived at pickup" buttons on screen, one of them the
                wrong weight. The secondary action still shows. */}
            {((stop.onPrimaryAction && !isNext) || stop.onSecondaryAction) && (
              <View style={styles.stopActions}>
                {stop.onSecondaryAction && (
                  <Button
                    label={stop.secondaryActionLabel ?? 'Report issue'}
                    onPress={stop.onSecondaryAction}
                    variant="outline"
                    style={{ flex: 1 }}
                  />
                )}
                {stop.onPrimaryAction && !isNext && (
                  <Button
                    label={stop.primaryActionLabel ?? 'Continue'}
                    onPress={() => runStopAction(stop)}
                    loading={busyStopId === stop.id}
                    variant="secondary"
                    style={{ flex: 1 }}
                  />
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
    flexDirection: 'row',
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
  dangerButton: { marginTop: 20 },
});
