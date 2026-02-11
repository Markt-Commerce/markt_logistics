# Setup Guide - Markt Delivery Partner App

## Overview

This is a complete Expo Router-based React Native app for delivery partners. It uses:
- **Expo Router** for file-based routing (not React Navigation)
- **React Context** for state management
- **AsyncStorage** for persistence
- **Socket.io** for real-time updates
- **Expo Location** for GPS tracking

## Installation

1. **Install dependencies:**
```bash
npm install
```

2. **Start the development server:**
```bash
npm start
```

3. **Choose platform:**
- Press `i` for iOS Simulator
- Press `a` for Android Emulator
- Press `w` for Web

## App Architecture

### File-Based Routing Structure

```
app/
├── (root)/
│   └── layout.tsx              # Root layout with providers
├── (auth)/
│   ├── layout.tsx              # Auth layout with guard
│   └── login.tsx               # Login screen
└── (delivery)/
    ├── layout.tsx              # Delivery layout with guard
    ├── availability-toggle.tsx # Online/offline toggle
    ├── nearby-orders.tsx       # Orders list
    ├── order-preview.tsx       # Order details
    ├── active-delivery-map.tsx # Current delivery
    ├── delivery-status-controls.tsx  # Status updates
    └── qr-code.tsx            # QR code display
```

### Context API Structure

**AuthContext** - Handles:
- Login/logout
- Session token management
- Partner profile
- Auto-restore on app start
- Auto-connect WebSocket when authenticated

**LocationContext** - Handles:
- Real-time GPS tracking
- Location permissions
- Auto-report location to backend
- Updates every 5s or 10m

**DeliveryContext** - Handles:
- Fetch nearby orders
- Accept orders
- Manage active assignment
- Update delivery status
- WebSocket subscription to order updates

## Routing Navigation

### Route Names (File-Based)

Auth routes:
- `/(auth)/login` - Login screen

Delivery routes (protected):
- `/(delivery)/availability-toggle` - Main screen after login
- `/(delivery)/nearby-orders` - Browse orders
- `/(delivery)/order-preview` - Order details
- `/(delivery)/active-delivery-map` - Current delivery
- `/(delivery)/delivery-status-controls` - Update status
- `/(delivery)/qr-code` - QR confirmation

### Navigation Examples

```typescript
import { useRouter } from 'expo-router';

const router = useRouter();

// Push new screen
router.push('/(delivery)/nearby-orders');

// Push with params
router.push({
  pathname: '/(delivery)/order-preview',
  params: { order: JSON.stringify(order) },
});

// Replace (for login redirect)
router.replace('/(delivery)/availability-toggle');

// Go back
router.back();
```

### Getting Route Params

```typescript
import { useLocalSearchParams } from 'expo-router';

const params = useLocalSearchParams();
const order = params.order ? JSON.parse(params.order as string) : null;
```

## Backend Integration

### API Base URL

Edit `services/api.ts` to change the backend URL:
```typescript
const API_BASE_URL = 'http://localhost:3000/api'; // Change this
```

Or update `app.json`:
```json
"extra": {
  "apiUrl": "http://your-backend:3000/api",
  "wsUrl": "http://your-backend:3000"
}
```

### Required Endpoints

Your backend must implement:

1. **POST /auth/delivery/login**
   - Request: `{ phone, otp }`
   - Response: `{ partner, sessionToken }`

2. **GET /delivery-partners/me**
   - Returns: `{ id, name, vehicleType, rating, status }`

3. **PATCH /delivery-partners/me/status**
   - Request: `{ status: 'ONLINE' | 'OFFLINE' }`

4. **POST /delivery-partners/me/location**
   - Request: `{ lat, lng, accuracy, heading, speed }`

5. **GET /delivery/orders/available**
   - Returns: `{ rangeMeters, orders[] }`

6. **POST /delivery/orders/{orderId}/accept**
   - Returns: `{ assignmentId, status }`

7. **GET /delivery/assignments/active**
   - Returns: `{ assignmentId, orderId, pickup, dropoff, status }`

8. **PATCH /delivery/assignments/{id}/status**
   - Request: `{ status }`
   - Returns: Updated assignment

9. **POST /delivery/orders/{orderId}/qr**
   - Returns: `{ qrToken, orderId, expiresAt }`

### WebSocket Events

The app subscribes to:
- `delivery.partner.{partnerId}` - For partner updates
- `delivery.order.{orderId}` - For order updates

And handles events:
- `DELIVERY_LOCATION_UPDATE` - Location changed
- `DELIVERY_STATUS_UPDATE` - Status changed
- `ORDER_UNASSIGNED` - Order reassigned

## Using the Contexts

### AuthContext

```typescript
import { useAuth } from '../contexts/AuthContext';

function MyComponent() {
  const { 
    partner,           // Partner data or null
    sessionToken,      // Auth token or null
    isAuthenticated,   // Boolean
    isLoading,        // Boolean
    login,            // (phone, otp) => Promise<void>
    logout,           // () => Promise<void>
  } = useAuth();
}
```

### LocationContext

```typescript
import { useLocation } from '../contexts/LocationContext';

function MyComponent() {
  const {
    currentLocation,   // { lat, lng, accuracy, heading, speed } or null
    isTracking,       // Boolean
    startTracking,    // () => Promise<void>
    stopTracking,     // () => void
    requestPermission // () => Promise<boolean>
  } = useLocation();
}
```

### DeliveryContext

```typescript
import { useDelivery } from '../contexts/DeliveryContext';

function MyComponent() {
  const {
    availableOrders,           // Order[]
    activeAssignment,          // Assignment or null
    isLoadingOrders,          // Boolean
    isAcceptingOrder,         // Boolean
    fetchAvailableOrders,     // () => Promise<void>
    acceptOrder,              // (orderId) => Promise<void>
    fetchActiveAssignment,    // () => Promise<void>
    updateAssignmentStatus,   // (id, status) => Promise<void>
    clearActiveAssignment,    // () => void
  } = useDelivery();
}
```

## App Flow

1. **Load** → App checks for saved session token
   - If found → Jump to delivery screens
   - If not → Show login screen

2. **Login** → User enters phone + OTP
   - Auth saves token to AsyncStorage
   - Creates WebSocket connection
   - Auto-redirects to availability toggle

3. **Availability Toggle** → User goes online
   - Starts location tracking
   - Navigates to nearby orders

4. **Browse Orders** → User sees available orders
   - Can pull to refresh
   - Tap to preview details

5. **Accept Order** → Order becomes active assignment
   - User navigates to active delivery map
   - Can update status anytime

6. **Update Status** → Track delivery progress
   - Arrived at Pickup
   - Picked Up
   - En Route
   - Ready for delivery (shows QR)

7. **QR Code** → Customer scans for confirmation
   - Marks delivery complete
   - Returns to availability toggle

8. **Logout** → Clear token and session
   - User returns to login

## Testing

### With Mock Data

The app will work with minimal backend. Create mock responses:

```typescript
// In api.ts, for testing:
async login() {
  return {
    partner: {
      id: 'dp_123',
      name: 'John Doe',
      vehicleType: 'BIKE',
      rating: 4.7,
      status: 'OFFLINE'
    },
    sessionToken: 'mock-token-123'
  };
}
```

### Demo Credentials

For testing, any phone/OTP combination works:
- Phone: `+234 800 000 0000`
- OTP: `000000`

## Debugging

### Enable Logging

Add to services/api.ts:
```typescript
console.log('API Request:', url, body);
```

### Check WebSocket

In browser console:
```javascript
// Check if socket is connected
console.log('Socket connected:', socket.connected);
```

### View AsyncStorage

In app code:
```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';

const token = await AsyncStorage.getItem('sessionToken');
console.log('Saved token:', token);
```

## Troubleshooting

### "useAuth must be used within AuthProvider"
- Ensure `AuthProvider` wraps the app (should be in root layout)
- Check context import paths are correct

### Location not updating
- Check device permissions
- Ensure location tracking is enabled on device
- Verify `startTracking()` was called

### API requests fail
- Check backend is running on correct URL
- Verify network connectivity
- Check CORS settings on backend

### WebSocket won't connect
- Ensure backend supports Socket.io
- Check firewall allows WebSocket port
- Verify auth token is valid

## Performance Tips

- Location updates throttled to 5s/10m
- Orders fetched on-demand (no polling)
- Images cached by React Native
- Remove heavy console logs in production

## Next Steps

1. Connect to your backend API
2. Test all endpoints return expected formats
3. Configure WebSocket events
4. Test location permission flow
5. Build and deploy to stores

## Key Files to Modify

- `services/api.ts` - Change API base URL
- `services/websocket.ts` - Configure WebSocket URL
- `contexts/AuthContext.tsx` - Add custom auth logic
- `contexts/DeliveryContext.tsx` - Add business logic
- `app/(delivery)/*.tsx` - Customize UI/UX
