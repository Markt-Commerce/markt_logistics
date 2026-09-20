import { Assignment, AvailableRun, DeliveryStop, Order, RunDetail } from '../types';

interface AssignmentStopsContext {
  onStatusUpdate: (status: string) => Promise<void>;
  onGoToPodConfirm: () => void;
}

/**
 * Single-order assignment -> 2 stops (pickup, dropoff).
 *
 * Driven by `logisticalStatus`, which is the field that moves. This read
 * `assignment.status` instead -- the assignment's own status, which is
 * ACCEPTED from the moment a rider takes the job until it is delivered
 * and never changes in between. So every reload rebuilt the stops from a
 * value that had not moved, re-offered the step the rider had just
 * finished, and the second tap came back as a transition error they
 * could do nothing about. `status` is still read for the one thing it
 * genuinely says: whether the job has been accepted at all.
 *
 * `logisticalStatus` is null until the rider does the first thing, which
 * is what makes "Arrived at pickup" correct exactly once.
 */
export function assignmentToStops(assignment: Assignment, ctx: AssignmentStopsContext): DeliveryStop[] {
  const step = assignment.logisticalStatus ?? null;

  const pickupStatus =
    step === null ? 'PENDING' : step === 'ARRIVED_PICKUP' ? 'ARRIVED_PICKUP' : 'PICKED_UP';

  let pickupActionLabel: string | undefined;
  let pickupAction: (() => Promise<void>) | undefined;
  let pickupHint: string | undefined;
  if (step === null) {
    pickupActionLabel = 'Slide when you arrive';
    pickupAction = () => ctx.onStatusUpdate('ARRIVED_PICKUP');
    // What the tap means, not what the state is called. A rider who has
    // not done this before was given a button labelled with a status and
    // left to work out whether it was safe to press yet.
    pickupHint = 'Head to the shop. Tap this when you get there, and the shop is told you have arrived.';
  } else if (step === 'ARRIVED_PICKUP') {
    pickupActionLabel = 'Slide to confirm pickup';
    pickupAction = () => ctx.onStatusUpdate('PICKED_UP');
    pickupHint = 'Check the parcel against the order before you confirm. Once you do, it is on you.';
  }

  const dropoffStatus =
    step === 'EN_ROUTE_TO_DROPOFF'
      ? 'EN_ROUTE_TO_DROPOFF'
      : step === 'DELIVERED_PENDING_QR'
      ? 'DELIVERED_PENDING_QR'
      : step === 'COMPLETED'
      ? 'COMPLETED'
      : 'PENDING';

  let dropoffActionLabel: string | undefined;
  let dropoffAction: (() => Promise<void>) | undefined;
  let dropoffHint: string | undefined;
  if (step === 'PICKED_UP') {
    dropoffActionLabel = 'Slide when you set off';
    dropoffAction = () => ctx.onStatusUpdate('EN_ROUTE_TO_DROPOFF');
    dropoffHint = 'You have the parcel. Tap this when you set off and the buyer can follow you in.';
  } else if (step === 'EN_ROUTE_TO_DROPOFF') {
    dropoffActionLabel = 'Slide when you arrive';
    dropoffAction = () => ctx.onStatusUpdate('DELIVERED_PENDING_QR');
    dropoffHint = 'Tap this at the door. The buyer gets their delivery code the moment you do.';
  } else if (step === 'DELIVERED_PENDING_QR') {
    dropoffActionLabel = 'Slide to confirm delivery';
    dropoffAction = async () => ctx.onGoToPodConfirm();
    dropoffHint = 'Ask the buyer for their code, or scan it. This is what releases your pay.';
  } else if (step === 'COMPLETED') {
    dropoffHint = 'Delivered and confirmed. Your earnings are on the way to your wallet.';
  }

  const orderTag = `Order #${assignment.orderId.slice(0, 8)}`;

  return [
    {
      id: 'pickup',
      kind: 'pickup',
      // The shop's real name where the backend knows it. This said
      // "Pickup from seller" for every order, because the assignment
      // payload carried two coordinates and nothing else.
      title: assignment.sellerName || 'Pickup from seller',
      // The address, where we have one. The order id was printed under
      // both stops, which told the rider the same thing twice and neither
      // time anything they could navigate to.
      subtitle: assignment.pickupAddress || orderTag,
      coords: assignment.pickup,
      status: pickupStatus,
      phone: assignment.sellerPhone,
      image: assignment.sellerImage,
      primaryActionLabel: pickupActionLabel,
      onPrimaryAction: pickupAction,
      // Every step a rider reports is a swipe, not a tap. They are all
      // being done one-handed, on a bike, at a gate or a stall counter,
      // and each one tells the shop or the buyer something that is
      // awkward to walk back -- a mis-tapped "I've arrived" sends
      // somebody to their door.
      confirmBySlide: true,
      hint: pickupHint,
    },
    {
      id: 'dropoff',
      kind: 'dropoff',
      title: assignment.buyerName || 'Deliver to buyer',
      subtitle: assignment.dropoffAddress || orderTag,
      coords: assignment.dropoff,
      status: dropoffStatus,
      phone: assignment.buyerPhone,
      primaryActionLabel: dropoffActionLabel,
      onPrimaryAction: dropoffAction,
      confirmBySlide: true,
      hint: dropoffHint,
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
    let hint: string | undefined;
    if (stop.status === 'pending') {
      primaryActionLabel = 'Slide when you arrive';
      onPrimaryAction = () => ctx.onArrive(stop.seller_id);
      hint = 'Tap this at the shop. Stops can be done in any order -- take whichever is nearest.';
    } else if (stop.status === 'arrived') {
      primaryActionLabel = 'Slide to confirm pickup';
      onPrimaryAction = () => ctx.onConfirmPickup(stop.seller_id);
      hint = 'Check the parcels against the order before you confirm.';
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
      confirmBySlide: true,
      hint,
    };
  });

  const dropoffStops: DeliveryStop[] = run.orders.map((order) => {
    let primaryActionLabel: string | undefined;
    let onPrimaryAction: (() => Promise<void>) | undefined;
    let secondaryActionLabel: string | undefined;
    let onSecondaryAction: (() => void) | undefined;
    let hint: string | undefined;
    if (order.pod_status === 'qr_issued') {
      primaryActionLabel = 'Slide to confirm delivery';
      onPrimaryAction = async () => ctx.onGoToPodConfirm(order.order_id);
      secondaryActionLabel = 'Report issue';
      onSecondaryAction = () => ctx.onGoToReportFailure(order.order_id);
      hint = 'Ask the buyer for their code, or scan it. This is what releases your pay for this drop.';
    } else {
      // The backend only issues codes once every pickup on the run is
      // done, so a rider looking at a locked dropoff needs to be told
      // what is holding it rather than left to guess it is broken.
      hint = 'Collect from every shop on the run first -- delivery codes are issued once you have.';
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
      confirmBySlide: true,
      secondaryActionLabel,
      onSecondaryAction,
      hint,
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
