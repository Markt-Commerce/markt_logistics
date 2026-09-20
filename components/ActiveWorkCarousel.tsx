import { MaterialIcons } from '@expo/vector-icons';
import React from 'react';
import { Dimensions, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Assignment, RunDetail } from '../types';
import StatusPill from './StatusPill';
import { colors, radius, shadow, spacing, typography } from './theme';

/**
 * What the rider is already carrying, across the top of the dashboard.
 *
 * This was a vertical list of one-line cards above the job feed, so
 * every delivery in progress pushed the available work further down --
 * with three on the go there was nothing to find on the "Find work"
 * screen without scrolling past your own deliveries first.
 *
 * A carousel costs one row of height whatever the count is, which is the
 * whole point. The cards had to grow to earn that width: a one-line card
 * side-scrolling would be a worse version of the list it replaced.
 */

const CARD_WIDTH = Math.min(Dimensions.get('window').width * 0.78, 320);

/** What this rider should do next, in words, from the step they are on.
 *
 * The card showed a status pill and nothing else, so it named a state
 * ("PICKED UP") without ever saying what that left the rider to do. */
const NEXT_MOVE: Record<string, string> = {
  ARRIVED_PICKUP: 'Check the parcel, then confirm pickup',
  PICKED_UP: 'Set off for the buyer',
  EN_ROUTE_TO_DROPOFF: 'Tap when you reach the door',
  DELIVERED_PENDING_QR: 'Get the buyer’s delivery code',
};

function nextMove(assignment: Assignment): string {
  if (!assignment.logisticalStatus) return 'Head to the shop';
  return NEXT_MOVE[assignment.logisticalStatus] ?? 'Open to continue';
}

function itemLine(assignment: Assignment): string | null {
  const lines = assignment.items ?? [];
  if (lines.length === 0) return null;
  const total = lines.reduce((sum, line) => sum + (line.quantity || 1), 0);
  // The first thing by name, because "2 items" is not something you can
  // check a bag against but "Ankara wrapper +1 more" is a start.
  const first = lines[0].name;
  const rest = total - (lines[0].quantity || 1);
  return rest > 0 ? `${first} +${rest} more` : first;
}

interface Props {
  assignments: Assignment[];
  run: RunDetail | null;
  onOpenAssignment: (assignment: Assignment) => void;
  onOpenRun: () => void;
}

export default function ActiveWorkCarousel({
  assignments,
  run,
  onOpenAssignment,
  onOpenRun,
}: Props) {
  const hasRun = !!run?.run_id;
  if (assignments.length === 0 && !hasRun) return null;

  const total = assignments.length + (hasRun ? 1 : 0);

  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <Text style={styles.header}>
          {total === 1 ? 'Carrying 1 delivery' : `Carrying ${total} deliveries`}
        </Text>
        {total > 1 && <Text style={styles.headerHint}>Swipe</Text>}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        // Snapping, so a swipe lands on a card rather than between two.
        snapToInterval={CARD_WIDTH + spacing.sm}
        decelerationRate="fast"
        contentContainerStyle={styles.track}
      >
        {assignments.map((assignment) => (
          <TouchableOpacity
            key={assignment.assignmentId}
            style={styles.card}
            onPress={() => onOpenAssignment(assignment)}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={`Open delivery from ${assignment.sellerName || 'the shop'}`}
          >
            <View style={styles.cardTop}>
              {assignment.sellerImage ? (
                <Image source={{ uri: assignment.sellerImage }} style={styles.thumb} />
              ) : (
                <View style={[styles.thumb, styles.thumbEmpty]}>
                  <MaterialIcons name="storefront" size={18} color={colors.textSecondary} />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.kind}>SINGLE ORDER</Text>
                <Text style={styles.title} numberOfLines={1}>
                  {assignment.sellerName || 'Pickup from seller'}
                </Text>
              </View>
            </View>

            <StatusPill status={assignment.logisticalStatus || 'ACCEPTED'} />

            {/* The order number is how the shop finds this parcel among
                the others on their counter -- it is the one thing on
                this card both sides can read off. */}
            {!!assignment.orderNumber && (
              <Text style={styles.reference}>{assignment.orderNumber}</Text>
            )}
            {!!itemLine(assignment) && (
              <Text style={styles.meta} numberOfLines={1}>
                {itemLine(assignment)}
              </Text>
            )}

            <View style={styles.cardFoot}>
              <Text style={styles.next} numberOfLines={1}>
                {nextMove(assignment)}
              </Text>
              <MaterialIcons name="arrow-forward" size={16} color={colors.primary} />
            </View>
          </TouchableOpacity>
        ))}

        {hasRun && (
          <TouchableOpacity
            style={styles.card}
            onPress={onOpenRun}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Open your batch run"
          >
            <View style={styles.cardTop}>
              <View style={[styles.thumb, styles.thumbEmpty]}>
                <MaterialIcons name="local-shipping" size={18} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.kind}>BATCH RUN</Text>
                <Text style={styles.title} numberOfLines={1}>
                  {run?.market || run?.area || 'Run in progress'}
                </Text>
              </View>
            </View>

            <StatusPill status={run?.status || 'IN PROGRESS'} />

            <Text style={styles.meta} numberOfLines={1}>
              {run?.stops?.length ?? 0} pickup
              {(run?.stops?.length ?? 0) === 1 ? '' : 's'} ·{' '}
              {run?.orders?.length ?? 0} drop
              {(run?.orders?.length ?? 0) === 1 ? '' : 's'}
            </Text>

            <View style={styles.cardFoot}>
              <Text style={styles.next} numberOfLines={1}>
                Open the route
              </Text>
              <MaterialIcons name="arrow-forward" size={16} color={colors.primary} />
            </View>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.section },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  header: { ...typography.bodyBold, color: colors.textPrimary },
  headerHint: { ...typography.caption, color: colors.textMuted },
  // Negative margin so the first card lines up with the screen gutter
  // while the track itself can still scroll edge to edge.
  track: { paddingRight: spacing.screenX, gap: spacing.sm },
  card: {
    width: CARD_WIDTH,
    borderRadius: radius,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.primaryMuted,
    padding: 14,
    gap: 8,
    ...shadow,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  thumb: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.border },
  thumbEmpty: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  kind: { ...typography.label, color: colors.textMuted, fontSize: 10 },
  title: { ...typography.bodyBold, color: colors.textPrimary },
  reference: { ...typography.caption, color: colors.textSecondary },
  meta: { ...typography.caption, color: colors.textSecondary },
  cardFoot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 2,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  next: { ...typography.caption, color: colors.primary, fontWeight: '700', flex: 1 },
});
