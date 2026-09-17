import { Assignment, AvailableRun, DeliveryStop, Order, RunDetail } from '../types';

interface AssignmentStopsContext {
  onStatusUpdate: (status: string) => Promise<void>;
  onGoToPodConfirm: () => void;
}

/**
 * Single-order assignment -> 2 stops (pickup, dropoff). Dropoff's action
 * only appears once `status` is PICKED_UP or later -- assignments carry
 * no `pod_status` field (unlike run orders), so `status` itself is the
 * only gating signal for this flow. See agile-waddling-pie.md.
 */
export function assignmentToStops(assignment: Assignment, ctx: AssignmentStopsContext): DeliveryStop[] {
  const status = assignment.status;

  const pickupStatus = status === 'ARRIVED_PICKUP' ? 'ARRIVED_PICKUP' : status === 'ASSIGNED' || status === 'ACCEPTED' ? 'PENDING' : 'PICKED_UP';

  let pickupActionLabel: string | undefined;
  let pickupAction: (() => Promise<void>) | undefined;
  if (status === 'ASSIGNED' || status === 'ACCEPTED') {
    pickupActionLabel = 'Arrived at pickup';
    pickupAction = () => ctx.onStatusUpdate('ARRIVED_PICKUP');
  } else if (status === 'ARRIVED_PICKUP') {
    pickupActionLabel = 'Confirm pickup';
    pickupAction = () => ctx.onStatusUpdate('PICKED_UP');
  }

  const dropoffStatus =
    status === 'EN_ROUTE_TO_DROPOFF'
      ? 'EN_ROUTE_TO_DROPOFF'
      : status === 'DELIVERED_PENDING_QR'
      ? 'DELIVERED_PENDING_QR'
      : status === 'COMPLETED'
      ? 'COMPLETED'
      : 'PENDING';

  let dropoffActionLabel: string | undefined;
  let dropoffAction: (() => Promise<void>) | undefined;
  if (status === 'PICKED_UP') {
    dropoffActionLabel = 'Head to buyer';
    dropoffAction = () => ctx.onStatusUpdate('EN_ROUTE_TO_DROPOFF');
  } else if (status === 'EN_ROUTE_TO_DROPOFF') {
    dropoffActionLabel = "I've arrived";
    dropoffAction = () => ctx.onStatusUpdate('DELIVERED_PENDING_QR');
  } else if (status === 'DELIVERED_PENDING_QR') {
    dropoffActionLabel = 'Confirm delivery code';
    dropoffAction = async () => ctx.onGoToPodConfirm();
  }

  const orderTag = `Order #${assignment.orderId.slice(0, 8)}`;

  return [
    {
      id: 'pickup',
      kind: 'pickup',
      title: 'Pickup from seller',
      subtitle: orderTag,
      coords: assignment.pickup,
      status: pickupStatus,
      primaryActionLabel: pickupActionLabel,
      onPrimaryAction: pickupAction,
    },
    {
      id: 'dropoff',
      kind: 'dropoff',
      title: 'Deliver to buyer',
      subtitle: orderTag,
      coords: assignment.dropoff,
      status: dropoffStatus,
      primaryActionLabel: dropoffActionLabel,
      onPrimaryAction: dropoffAction,
    },
  ];
}

interface RunStopsContext {
  onArrive: (sellerId: number) => Promise<void>;
  onConfirmPickup: (sellerId: number) => Promise<void>;
  onGoToPodConfirm: (orderId: string) => void;
  onGoToReportFailure: (orderId: string) => void;
}

/**
 * Batch run -> N seller pickup stops + M order dropoffs. Unlike the
 * single-order case, multiple pickup stops (or multiple dropoffs) can be
 * simultaneously actionable -- sellers aren't visited in a strict order.
 * A dropoff's action only appears once `pod_status === 'qr_issued'`,
 * which the backend only sets after ALL pickup stops are picked up, not
 * per-stop (mirrors run-details.tsx's existing gating).
 *
 * RunStop.lat/lng and RunOrderAddress.lat/lng (added 2026-09-14) make real
 * map markers possible for runs too -- `coords` is omitted only when a
 * particular seller/address genuinely has no coordinates on file.
 */
export function runToStops(run: RunDetail, ctx: RunStopsContext): DeliveryStop[] {
  const pickupStops: DeliveryStop[] = run.stops.map((stop) => {
    let primaryActionLabel: string | undefined;
    let onPrimaryAction: (() => Promise<void>) | undefined;
    if (stop.status === 'pending') {
      primaryActionLabel = "I've arrived";
      onPrimaryAction = () => ctx.onArrive(stop.seller_id);
    } else if (stop.status === 'arrived') {
      primaryActionLabel = 'Confirm pickup';
      onPrimaryAction = () => ctx.onConfirmPickup(stop.seller_id);
    }

    return {
      id: `seller-${stop.seller_id}`,
      kind: 'pickup',
      title: stop.seller_name || `Seller #${stop.seller_id}`,
      subtitle: stop.shop_address || undefined,
      coords: stop.lat != null && stop.lng != null ? { lat: stop.lat, lng: stop.lng } : undefined,
      status: stop.status,
      primaryActionLabel,
      onPrimaryAction,
    };
  });

  const dropoffStops: DeliveryStop[] = run.orders.map((order) => {
    let primaryActionLabel: string | undefined;
    let onPrimaryAction: (() => Promise<void>) | undefined;
    let secondaryActionLabel: string | undefined;
    let onSecondaryAction: (() => void) | undefined;
    if (order.pod_status === 'qr_issued') {
      primaryActionLabel = 'Confirm delivery';
      onPrimaryAction = async () => ctx.onGoToPodConfirm(order.order_id);
      secondaryActionLabel = 'Report issue';
      onSecondaryAction = () => ctx.onGoToReportFailure(order.order_id);
    }

    const addressLine = order.delivery_address
      ? [order.delivery_address.street_address, order.delivery_address.city].filter(Boolean).join(', ')
      : undefined;
    const addressCoords = order.delivery_address;

    return {
      id: `order-${order.order_id}`,
      kind: 'dropoff',
      title: order.buyer_name || `Order ${order.order_number ?? order.order_id.slice(0, 8)}`,
      subtitle: addressLine,
      coords:
        addressCoords?.lat != null && addressCoords?.lng != null
          ? { lat: addressCoords.lat, lng: addressCoords.lng }
          : undefined,
      status: order.pod_status,
      primaryActionLabel,
      onPrimaryAction,
      secondaryActionLabel,
      onSecondaryAction,
    };
  });

  return [...pickupStops, ...dropoffStops];
}

// --- Dashboard browse/active pins (2026-09-16) --------------------------
// The always-on dashboard map (availability-toggle.tsx) mixes the rider's
// own in-progress work with things they haven't accepted yet. These
// adapters produce plain, action-less DeliveryStops (`onPress` only, no
// onPrimaryAction) -- tapping a pin or a sheet row just selects it; the
// screen itself owns accept/decline/open-active-delivery.

/** A rider's already-accepted single-order assignments, as pickup+dropoff
 * pin pairs -- tapping either opens that assignment's active-delivery
 * screen directly (same navigation single-orders.tsx used to do from its
 * "My active deliveries" list). */
export function activeAssignmentsToPins(assignments: Assignment[], onSelect: (assignment: Assignment) => void): DeliveryStop[] {
  return assignments.flatMap((assignment) => {
    const orderTag = `Order #${assignment.orderId.slice(0, 8)}`;
    return [
      {
        id: `active-pickup-${assignment.assignmentId}`,
        kind: 'pickup' as const,
        title: 'Pickup in progress',
        subtitle: orderTag,
        coords: assignment.pickup,
        status: assignment.status,
        onPress: () => onSelect(assignment),
      },
      {
        id: `active-dropoff-${assignment.assignmentId}`,
        kind: 'dropoff' as const,
        title: 'Dropoff in progress',
        subtitle: orderTag,
        coords: assignment.dropoff,
        status: assignment.status,
        onPress: () => onSelect(assignment),
      },
    ];
  });
}

/** The rider's one active run (if any), as its real per-stop pins -- reuses
 * the same lat/lng RunStop/RunOrderAddress already carry post-acceptance
 * (see "Real map upgrade" in REFACTOR_NOTES.md). Every pin opens the same
 * active-run screen; there's no per-stop distinction needed here the way
 * active-delivery.tsx's own stop list has (that's for the sheet, not the
 * map). */
export function activeRunToPins(run: RunDetail, onSelect: () => void): DeliveryStop[] {
  if (!run.run_id) return [];

  const pickups: DeliveryStop[] = run.stops
    .filter((stop) => stop.lat != null && stop.lng != null)
    .map((stop) => ({
      id: `active-run-pickup-${stop.seller_id}`,
      kind: 'pickup',
      title: stop.seller_name || `Seller #${stop.seller_id}`,
      subtitle: run.area ?? undefined,
      coords: { lat: stop.lat!, lng: stop.lng! },
      status: stop.status,
      onPress: onSelect,
    }));

  const dropoffs: DeliveryStop[] = run.orders
    .filter((order) => order.delivery_address?.lat != null && order.delivery_address?.lng != null)
    .map((order) => ({
      id: `active-run-dropoff-${order.order_id}`,
      kind: 'dropoff',
      title: order.buyer_name || `Order ${order.order_number ?? order.order_id.slice(0, 8)}`,
      subtitle: run.area ?? undefined,
      coords: { lat: order.delivery_address!.lat!, lng: order.delivery_address!.lng! },
      status: order.pod_status,
      onPress: onSelect,
    }));

  return [...pickups, ...dropoffs];
}

/** Browse-only pins for available single orders -- not yet accepted, so
 * these carry the real pickup coordinate (already returned by
 * getAvailableOrders() today, no backend gap here). */
export function availableOrdersToPins(orders: Order[], onSelect: (order: Order) => void): DeliveryStop[] {
  return orders.map((order) => ({
    id: `available-order-${order.orderId}`,
    kind: 'available-order',
    title: `₦${order.estimatedEarnings}`,
    subtitle: `${(order.distanceMeters / 1000).toFixed(1)} km away`,
    coords: order.pickup,
    status: 'AVAILABLE',
    onPress: () => onSelect(order),
  }));
}

/** Browse-only pins for available batch runs -- one pin per run at its
 * market/area centroid (AvailableRun.lat/lng, added 2026-09-16), not real
 * per-seller/per-buyer coordinates. Deliberate: a rider hasn't committed to
 * a run yet, so its real stop addresses stay hidden until accept (see
 * REFACTOR_NOTES.md, "Always-on map dashboard"). A run whose area has no
 * centroid on file (rare -- get_available_runs already filters most of
 * these out server-side) simply gets no pin. */
export function availableRunsToPins(runs: AvailableRun[], onSelect: (run: AvailableRun) => void): DeliveryStop[] {
  return runs
    .filter((run) => run.lat != null && run.lng != null)
    .map((run) => ({
      id: `available-run-${run.run_id}`,
      kind: 'available-run',
      title: run.market ? `${run.market} · ${run.area}` : run.area,
      subtitle: `${run.order_count} orders · ${(run.distance_meters / 1000).toFixed(1)} km`,
      coords: { lat: run.lat!, lng: run.lng! },
      status: 'AVAILABLE',
      onPress: () => onSelect(run),
    }));
}
