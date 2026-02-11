// NEXT STEPS: Context Files Still Needed
// These files reference the contexts but they haven't been fully implemented yet
// Here's what each context should export:

// 1. AuthContext.tsx - Already exists, but ensure it has:
export interface AuthContextType {
  partner: DeliveryPartner | null;
  sessionToken: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (phone: string, otp: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuth = (): AuthContextType => { ... }

// 2. LocationContext.tsx - Should export:
export interface LocationContextType {
  currentLocation: Location | null;
  isTracking: boolean;
  startTracking: () => Promise<void>;
  stopTracking: () => void;
}

export const useLocation = (): LocationContextType => { ... }

// 3. DeliveryContext.tsx - Should export:
export interface DeliveryContextType {
  availableOrders: Order[];
  activeAssignment: Assignment | null;
  isLoading: boolean;
  fetchAvailableOrders: () => Promise<void>;
  acceptOrder: (orderId: string) => Promise<void>;
  updateAssignmentStatus: (id: string, status: string) => Promise<void>;
  clearActiveAssignment: () => void;
}

export const useDelivery = (): DeliveryContextType => { ... }

// 4. WebSocketContext.tsx - Should export:
export interface WebSocketContextType {
  isConnected: boolean;
  connectionError: string | null;
}

export const useWebSocket = (): WebSocketContextType => { ... }

// Key Integration Points:
// - AuthContext.login() calls apiService.login()
// - LocationContext.startTracking() calls expo-location APIs
// - DeliveryContext.fetchAvailableOrders() calls apiService.getAvailableOrders()
// - DeliveryContext.acceptOrder() calls apiService.acceptOrder()
// - WebSocketContext listens to webSocketService events

// All contexts use useCallback to memoize functions
// All contexts initialize on mount with useEffect
// AuthContext restores token from AsyncStorage on app launch
// LocationContext only starts tracking when auth is ready
// DeliveryContext fetches orders when location is available

// The app flow:
// 1. RootLayout creates providers
// 2. RootNavigator uses useAuth() to check authentication
// 3. If authenticated, show (delivery) group
// 4. If not authenticated, show (auth) group (login screen)
// 5. On login, AuthContext sets sessionToken & partner
// 6. RootNavigator re-renders, routes to (delivery)
// 7. User can toggle availability, view orders, accept delivery
// 8. Status updates tracked through DeliveryContext
// 9. QR code shown for final confirmation
// 10. On logout, token cleared, back to login

// Screen Dependencies:
// login.tsx: useAuth (login function)
// availability-toggle.tsx: useAuth, useLocation, useDelivery
// nearby-orders.tsx: useDelivery
// order-preview.tsx: useDelivery (acceptOrder)
// active-delivery-map.tsx: useDelivery, useLocation
// delivery-status-controls.tsx: useDelivery
// qr-code.tsx: useDelivery
