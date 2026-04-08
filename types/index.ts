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
