import BottomSheet, { BottomSheetScrollView, BottomSheetView } from '@gorhom/bottom-sheet';
import React, { useMemo, useState } from 'react';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';
import { DeliveryStop } from '../types';
import Button from './Button';
import SectionHeader from './SectionHeader';
import StatusPill from './StatusPill';
import { colors, radius, shadow, typography } from './theme';

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
      <BottomSheetView style={styles.summary}>
        <Text style={styles.headerTitle}>{headerTitle}</Text>
        {!!headerSubtitle && <Text style={styles.headerSubtitle}>{headerSubtitle}</Text>}
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
      </BottomSheetView>

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
        <SectionHeader title={`All stops (${stops.length})`} />
        {stops.map((stop, index) => (
          <View key={stop.id} style={styles.stopRow}>
            <View style={styles.stopHeader}>
              <View style={styles.stopIndex}>
                <Text style={styles.stopIndexText}>{index + 1}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.stopTitle}>{stop.title}</Text>
                {!!stop.subtitle && <Text style={styles.stopSubtitle}>{stop.subtitle}</Text>}
                <StatusPill status={stop.status} />
              </View>
            </View>
            {(stop.onPrimaryAction || stop.onSecondaryAction) && (
              <View style={styles.stopActions}>
                {stop.onSecondaryAction && (
                  <Button
                    label={stop.secondaryActionLabel ?? 'Report issue'}
                    onPress={stop.onSecondaryAction}
                    variant="outline"
                    style={{ flex: 1 }}
                  />
                )}
                {stop.onPrimaryAction && (
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
        ))}

        {screenActions?.onDangerAction && (
          <Button
            label={screenActions.dangerActionLabel ?? 'Cancel'}
            onPress={screenActions.onDangerAction}
            variant="outline"
            style={styles.dangerButton}
          />
        )}
      </BottomSheetScrollView>
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
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  stopHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  stopActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
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
  dangerButton: {
    marginTop: 20,
    borderColor: colors.error,
  },
});
