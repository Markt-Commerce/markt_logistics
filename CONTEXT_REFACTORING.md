# Context Refactoring - Separation of Concerns

## Overview
Refactored all React Contexts to follow a clean separation of concerns pattern:
- **Contexts** now only manage state
- **Custom Hooks** contain all business logic and actions
- **Components** use contexts for state and hooks for actions

This improves:
- ✅ Testability - Logic is isolated in hooks
- ✅ Reusability - Hooks can be used independently
- ✅ Maintainability - Clear responsibility boundaries
- ✅ Scalability - Easy to add new features

---

## File Structure

### Contexts (State Management Only)
All contexts are now simplified to only manage state:

#### `contexts/AuthContext.tsx`
```typescript
// State only
interface AuthContextType {
  partner: DeliveryPartner | null;
  sessionToken: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (phone: string, otp: string) => Promise<void>;  // From hook
  logout: () => Promise<void>;                            // From hook
}
```

#### `contexts/LocationContext.tsx`
```typescript
// State only
interface LocationContextType {
  currentLocation: LocationType | null;
  isTracking: boolean;
}
```

#### `contexts/DeliveryContext.tsx`
```typescript
// State only
interface DeliveryContextType {
  availableOrders: Order[];
  activeAssignment: Assignment | null;
  isLoadingOrders: boolean;
  isAcceptingOrder: boolean;
}
```

#### `contexts/WebSocketContext.tsx`
```typescript
// State only
interface WebSocketContextType {
  isConnected: boolean;
  connectionError: string | null;
}
```

---

### Custom Hooks (Business Logic)
All action functions moved to dedicated hooks:

#### `hooks/useAuthActions.ts`
Exports:
- `restoreToken()` - Restore session from storage
- `login(phone, otp)` - Handle login with API
- `logout()` - Clear session and storage

Usage:
```typescript
const { login, logout, restoreToken } = useAuthActions({
  setPartner,
  setSessionToken,
  setIsLoading,
});
```

#### `hooks/useLocationActions.ts`
Exports:
- `requestPermission()` - Request location permissions
- `startTracking(onLocationChange?)` - Start location tracking
- `stopTracking()` - Stop location tracking

Usage:
```typescript
const { startTracking, stopTracking, requestPermission } = useLocationActions({
  setCurrentLocation,
  setIsTracking,
  setLocationSubscription,
});
```

#### `hooks/useDeliveryActions.ts`
Exports:
- `fetchAvailableOrders()` - Fetch available orders
- `acceptOrder(orderId)` - Accept a delivery order
- `fetchActiveAssignment()` - Get active delivery
- `updateAssignmentStatus(id, status)` - Update delivery status
- `clearActiveAssignment()` - Clear active delivery

Usage:
```typescript
const actions = useDeliveryActions({
  availableOrders,
  setAvailableOrders,
  setActiveAssignment,
  setIsLoadingOrders,
  setIsAcceptingOrder,
});
```

---

## Usage Examples

### In Components (Login Screen)

**Before (Mixed concerns):**
```typescript
export default function LoginScreen() {
  const { login } = useAuth();  // Had both state AND logic
  
  const handleLogin = async () => {
    await login(phone, otp);
  };
}
```

**After (Clean separation):**
```typescript
export default function LoginScreen() {
  const { login } = useAuth();  // State + actions from context
  
  const handleLogin = async () => {
    try {
      await login(phone, otp);  // Context action handles everything
    } catch (error) {
      Alert.alert('Login Failed', error.message);
    }
  };
}
```

### Using Hooks Independently

You can use the action hooks even without the context:

```typescript
// In a utility or service
const { login } = useAuthActions({
  setPartner: (p) => updatePartner(p),
  setSessionToken: (t) => saveToken(t),
  setIsLoading: (l) => console.log(l),
});
```

---

## Data Flow

```
┌─────────────────────────────────────────┐
│         React Component                 │
│   (LoginScreen, NearbyOrders, etc)      │
└──────────────┬──────────────────────────┘
               │
          Uses Context
          (for state)
               │
               ▼
┌─────────────────────────────────────────┐
│         React Context                   │
│   (AuthContext, LocationContext, etc)   │
│   • Manages state (useState)             │
│   • Calls hooks for actions             │
│   • Provides via Context.Provider        │
└──────────────┬──────────────────────────┘
               │
          Uses Custom Hooks
          (for logic)
               │
               ▼
┌─────────────────────────────────────────┐
│       Custom Hooks                      │
│   (useAuthActions, useLocationActions)  │
│   • Contains business logic             │
│   • API calls                           │
│   • Data persistence                    │
│   • Updates state via callbacks         │
└──────────────┬──────────────────────────┘
               │
          Uses Services
               │
               ▼
┌─────────────────────────────────────────┐
│         Services                        │
│   (apiService, webSocketService)        │
│   • HTTP requests                       │
│   • WebSocket connections               │
│   • Low-level operations                │
└─────────────────────────────────────────┘
```

---

## Benefits

### 1. **Testability**
- Hooks can be tested in isolation
- Easy to mock state setters
- No need to wrap tests in context providers

### 2. **Reusability**
```typescript
// Reuse logic in different contexts
const actions = useAuthActions({ setPartner, setSessionToken, setIsLoading });
const actions2 = useAuthActions({ setPartner: otherSetter, ... });
```

### 3. **Maintainability**
- Business logic separate from state management
- Easier to debug - clear responsibility
- Changes to API only affect hooks

### 4. **Performance**
- Components only re-render when their specific context state changes
- Hooks don't cause re-renders (no context)
- Can optimize with `useCallback`

### 5. **Scalability**
```typescript
// Adding new feature
// 1. Update context type
// 2. Add state to provider
// 3. Create actions in hook
// 4. Use in component

// Much cleaner than adding to existing complex context
```

---

## Migration Guide

If you're using other parts of the app, update imports:

### Auth
```typescript
// OLD - Had login function in context
const { login } = useAuth();

// NEW - Same import, but cleaner internally
const { login } = useAuth();
// login is now provided by the hook, context only manages state
```

### Location (Usage Pattern)
```typescript
// In components that need location
const { currentLocation, isTracking } = useLocation();

// Use hook separately for actions
const { startTracking, stopTracking } = useLocationActions({
  setCurrentLocation,
  setIsTracking,
  setLocationSubscription,
});
```

### Delivery (Usage Pattern)
```typescript
// In components that need orders
const { availableOrders, activeAssignment } = useDelivery();

// Use hook separately for actions (implement DeliveryProvider wrapper if needed)
const actions = useDeliveryActions({
  availableOrders,
  setAvailableOrders,
  setActiveAssignment,
  setIsLoadingOrders,
  setIsAcceptingOrder,
});

await actions.fetchAvailableOrders();
```

---

## Next Steps

1. **Update any screens** that directly import from contexts to use the proper hooks
2. **Create wrapper hooks** for common patterns (e.g., `useDeliveryOrders`)
3. **Add error handling** - Components handle errors from actions
4. **Add loading states** - Components manage UI feedback
5. **Test the hooks** - Unit test business logic separately

---

**Benefits Summary:**
- ✅ Cleaner code organization
- ✅ Better testability
- ✅ Improved reusability
- ✅ Easier maintenance
- ✅ Better performance
- ✅ Clearer data flow
