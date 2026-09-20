export interface DeliveryPartner {
  id: string;
  name: string;
  vehicleType: 'BIKE' | 'SCOOTER' | 'CAR';
  rating: number;
  status?: 'ONLINE' | 'OFFLINE';
  email?: string | null;
  phone_number?: string | null;
  /** URL of the rider's photo, or null if they have not set one. */
  profile_picture?: string | null;
}

// --- Wallet / payout (2026-09-17) ---------------------------------------
// Backed by the same buyer/seller wallet system in markt_python
// (app/wallet/) -- WalletAccount gained a nullable delivery_user_id FK
// alongside the existing user_id, so these hit the exact same /wallet/*
// routes a buyer/seller would, just authenticated as a DeliveryUser
// instead. See REFACTOR_NOTES.md, "No rider payout functionality."

export interface WalletBalance {
  currency: string;
  availableBalance: number;
}

export interface WalletTransaction {
  id: number;
  type: 'credit' | 'debit';
  amount: number;
  balanceAfter: number;
  referenceType: string;
  referenceId: string;
  description: string | null;
  createdAt: string | null;
}

export type WithdrawalStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface Withdrawal {
  id: string;
  amount: number;
  currency: string;
  status: WithdrawalStatus;
  // Only present on GET /wallet/withdrawals list items -- the POST
  // /wallet/withdraw response (WithdrawalResponseSchema) doesn't dump
  // these, so they're optional here rather than on two separate types.
  accountName?: string;
  accountNumber?: string;
  paystackTransferRef?: string | null;
  failureReason?: string | null;
  createdAt?: string | null;
}

export interface Bank {
  name: string;
  code: string;
  slug?: string | null;
  type?: string | null;
}

export interface ResolvedBankAccount {
  accountNumber: string;
  accountName: string | null;
  bankCode: string;
  resolved: boolean;
}

export interface Pagination {
  page: number;
  perPage: number;
  totalItems: number;
  totalPages: number;
}

export interface Location {
  latitude: number;
  longitude: number;
  accuracy?: number;
  //heading?: number;
  speed?: number;
}

export interface Order {
  orderId: string;
  orderNumber?: string | null;
  pickup: { lat: number; lng: number };
  dropoff: { lat: number; lng: number };
  distanceMeters: number;
  estimatedEarnings: number;
  /** What the job actually is. An offer used to be an id, a distance and
   *  a number of naira, so the accept card could only say "Order
   *  #a1b2c3d4" -- a rider had no way to tell a shop they know from one
   *  down an alley they don't, and had seconds to decide. */
  sellerName?: string | null;
  sellerImage?: string | null;
  pickupAddress?: string | null;
  /** A second shop is a second stop, which is the difference between a
   *  ten-minute job and a half-hour one. */
  pickupCount?: number;
  itemCount?: number;
  /** The area only -- the buyer's full address is not the rider's until
   *  they have accepted. */
  dropoffArea?: string | null;
}

// An assignment has two statuses, and this used to be written down here
// as one. The note that replaced this one said a GET after a PATCH
// "does return the real progress value" because marshmallow doesn't
// enforce `validate` on dump -- true about marshmallow, and wrong about
// the data: they are different columns.
//
//   status             the assignment's own -- ASSIGNED, then ACCEPTED for
//                      the whole job, and it never moves again
//   logisticalStatus   the one that moves -- ARRIVED_PICKUP, PICKED_UP,
//                      EN_ROUTE_TO_DROPOFF, DELIVERED_PENDING_QR, COMPLETED,
//                      and null until the rider does the first thing
//
// Driving the screen off `status` meant every reload re-offered the step
// the rider had just finished, and the second tap was rejected by the
// backend's transition check as an error they could do nothing about.
/** One line of what the rider is collecting. */
export interface ParcelLine {
  name: string;
  quantity: number;
  /** "Colour", "Size" -- the axis the buyer chose on, which is exactly
   *  the mix-up a count can never catch. */
  variant?: string | null;
}

export interface Assignment {
  assignmentId: string;
  orderId: string;
  orderNumber?: string | null;
  pickup: { lat: number; lng: number };
  dropoff: { lat: number; lng: number };
  status: string;
  /** What is actually in the parcel, line by line.
   *
   *  A count cannot be checked against a bag. A rider standing at a
   *  stall needs to know they are being handed an Ankara wrapper and a
   *  lace blouse, not "3 items". */
  items?: ParcelLine[];
  /** Which step they are on. Null on a freshly accepted delivery, which
   *  is what makes "Arrived at pickup" the right first action exactly
   *  once. */
  logisticalStatus?: string | null;
  /** Who is at each end, and how to reach them. A run's stops have carried
   *  these since runs existed; a single order carried two coordinates, so
   *  the app could only print "Pickup from seller". */
  sellerName?: string | null;
  sellerImage?: string | null;
  pickupAddress?: string | null;
  sellerPhone?: string | null;
  buyerName?: string | null;
  dropoffAddress?: string | null;
  buyerPhone?: string | null;
}

export interface LoginResponse {
  partner: DeliveryPartner;
  // Matches markt_python's DeliveryLoginResponseSchema field name exactly --
  // stateless signed bearer token, 30-day expiry, same mechanism markt_mobile
  // already relies on for buyer/seller sessions (see contexts/auth.tsx).
  access_token: string;
}

// --- Batched delivery runs (10.6-10.7) --------------------------------
// A run batches several sellers' orders into one dispatch. This is the
// second permanent delivery option buyers can choose at checkout,
// alongside single-order delivery above (see REFACTOR_NOTES.md) -- both
// types are live today and neither replaces the other.

export interface AvailableRun {
  run_id: string;
  market: string | null;
  area: string;
  order_count: number;
  /** What each buyer pays towards the run -- not the rider's number. */
  price_per_order: number | null;
  /** What the rider is credited for one drop on this run, and for all of
   *  them. Showing price_per_order as earnings over-promised: it is the
   *  buyers' split, and the rider takes a share of the trip. */
  rider_earning_per_drop: number | null;
  rider_earning_total: number | null;
  distance_meters: number;
  // Area centroid, not real per-seller/per-buyer coordinates -- added
  // 2026-09-16 for the always-on dashboard map. One representative pin per
  // run; real per-stop coords only ever appear post-acceptance (RunStop/
  // RunOrderAddress below). See REFACTOR_NOTES.md.
  lat: number | null;
  lng: number | null;
}

export type RunStopStatus = 'pending' | 'arrived' | 'picked_up';

export interface RunStop {
  seller_id: number;
  seller_name: string | null;
  shop_address: string | null;
  // Added 2026-09-14 (DeliveryRunStopDetailSchema) -- Seller.shop_latitude/
  // shop_longitude, exposed so the rider app can plot a real pickup pin.
  lat: number | null;
  lng: number | null;
  status: RunStopStatus;
  arrived_at: string | null;
  picked_up_at: string | null;
}

export interface RunOrderAddress {
  street_address: string | null;
  city: string | null;
  state: string | null;
  // Added 2026-09-14 -- Address.latitude/longitude, same reasoning as
  // RunStop.lat/lng above.
  lat: number | null;
  lng: number | null;
}

export type RunOrderPodStatus = 'pending' | 'qr_issued' | 'delivered';

export interface RunOrder {
  order_id: string;
  order_number: string | null;
  buyer_name: string | null;
  delivery_address: RunOrderAddress | null;
  pod_status: RunOrderPodStatus;
  delivered_at: string | null;
}

/** GET /runs/active returns just {run_id: null} when nothing's in
 * progress -- every other field is only present alongside a real run_id. */
export interface RunDetail {
  run_id: string | null;
  status?: string;
  market?: string | null;
  area?: string | null;
  price_per_order?: number | null;
  stops: RunStop[];
  orders: RunOrder[];
}

export type DeliveryFailureReason = 'buyer_unavailable' | 'bad_address' | 'buyer_refused';

// --- Shared "Stop" abstraction for the active-delivery screen ---------
// Both delivery models reduce to an ordered list of stops the rider works
// through one at a time. `coords` is optional because the backend's run
// schemas (RunStop/RunOrder above) carry no lat/lng at all today -- only
// single-order assignments do -- so the batch-run map preview falls back
// to a coordinate-less layout (see REFACTOR_NOTES.md).
export interface DeliveryStop {
  id: string;
  // 'pickup'/'dropoff' are per-stop states within one already-accepted
  // assignment/run (active-delivery.tsx). 'available-order'/'available-run'
  // (added 2026-09-16 for the always-on dashboard map) are browse-only pins
  // for things the rider hasn't accepted yet -- LiveMap colors them
  // differently and they carry `onPress` (a tap opens a preview/accept
  // sheet) instead of `onPrimaryAction` (which runs a status transition).
  kind: 'pickup' | 'dropoff' | 'available-order' | 'available-run';
  title: string;
  subtitle?: string;
  coords?: { lat: number; lng: number };
  status: string;
  // Fires when the marker itself is tapped on the map -- used by the
  // dashboard's browse pins to open the matching sheet row; unused by
  // active-delivery.tsx's stops (those act via onPrimaryAction instead).
  onPress?: () => void;
  // Only the one stop that's genuinely actionable right now (per each
  // flow's own gating rules) gets these set -- ActiveDeliverySheet reads
  // their presence, not the stop's position in the list, to decide what
  // "Next" means.
  primaryActionLabel?: string;
  onPrimaryAction?: () => Promise<void>;
  // A second, non-destructive action alongside the primary one -- used
  // for a run dropoff's "Report issue" (navigates away, doesn't mutate
  // anything itself), available under the same gating as the primary
  // delivery-confirm action.
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  /** Someone to call when the shop is shut or nobody answers the gate.
   *  Absent when the backend has no number for this end. */
  phone?: string | null;
  /** The shop's picture, so a rider is looking for a storefront rather
   *  than reading a name off a list. Pickup stops only. */
  image?: string | null;
  /** This action cannot be undone, so it is confirmed by a deliberate
   *  swipe rather than a tap. Set only on the proof-of-delivery step:
   *  it releases the parcel and the rider's pay, there is no transition
   *  back out of it, and it is done one-handed at somebody's gate. */
  confirmBySlide?: boolean;
  /** What to do here, in one line, on the one stop that is actionable.
   *  A rider new to the app was shown a button labelled with a state
   *  ("Arrived at pickup") and nothing about what it commits them to or
   *  what happens next. */
  hint?: string;
}

/** A hold on an order while the rider decides. */
export interface OrderOffer {
  assignmentId: string;
  status: string;
  /** ISO-8601, UTC, from the server. The countdown runs to this rather than
   *  to a locally-started duration, so a slow response does not hand out
   *  extra seconds and a wrong phone clock still expires on time. */
  expiresAt: string;
  seconds: number;
}

/** One delivery a rider has taken, for the jobs screen.
 *
 *  Separate from Assignment: that is a delivery in progress with
 *  everything needed to work it (coordinates, phone numbers, the
 *  manifest). This is the record of one, and a list of two hundred of
 *  them has no business carrying any of that. */
export interface DeliveryJob {
  assignmentId: string;
  orderId: string;
  orderNumber?: string | null;
  assignedAt?: string | null;
  logisticalStatus?: string | null;
  sellerName?: string | null;
  sellerImage?: string | null;
  dropoffAddress?: string | null;
  /** What this job paid, read server-side through the same function the
   *  payout uses -- so the history cannot disagree with the wallet. */
  earnings?: number | null;
}

export interface DeliveryJobPage {
  jobs: DeliveryJob[];
  pagination: Pagination;
}
