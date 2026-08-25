export interface DeliveryPartner {
  id: string;
  name: string;
  vehicleType: 'BIKE' | 'SCOOTER' | 'CAR';
  rating: number;
  status?: 'ONLINE' | 'OFFLINE';
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
  pickup: { lat: number; lng: number };
  dropoff: { lat: number; lng: number };
  distanceMeters: number;
  estimatedEarnings: number;
}

export interface Assignment {
  assignmentId: string;
  orderId: string;
  pickup: { lat: number; lng: number };
  dropoff: { lat: number; lng: number };
  status: 'EN_ROUTE_TO_PICKUP' | 'ARRIVED_PICKUP' | 'PICKED_UP' | 'EN_ROUTE_TO_DROPOFF' | 'DELIVERED_PENDING_QR';
}

export interface LoginResponse {
  partner: DeliveryPartner;
  sessionToken: string;
}

// --- Batched delivery runs (10.6-10.7) --------------------------------
// The real target model (per Joshua's own direction: "we do not want a
// single-order rider app or backend") -- a run batches several sellers'
// orders into one dispatch. Built alongside the single-order types
// above rather than replacing them; both are live today.

export interface AvailableRun {
  run_id: string;
  market: string | null;
  area: string;
  order_count: number;
  price_per_order: number | null;
  distance_meters: number;
}

export type RunStopStatus = 'pending' | 'arrived' | 'picked_up';

export interface RunStop {
  seller_id: number;
  seller_name: string | null;
  shop_address: string | null;
  status: RunStopStatus;
  arrived_at: string | null;
  picked_up_at: string | null;
}

export interface RunOrderAddress {
  street_address: string | null;
  city: string | null;
  state: string | null;
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
