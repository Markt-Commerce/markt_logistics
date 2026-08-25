import { Stack } from 'expo-router';

export default function DeliveryLayout() {
  return (
    <Stack>
      <Stack.Screen name="availability-toggle" options={{ title: 'My Status' }} />
      <Stack.Screen name="nearby-orders" options={{ title: 'Nearby Orders' }} />
      <Stack.Screen name="order-preview" options={{ title: 'Order Details' }} />
      <Stack.Screen name="active-delivery-map" options={{ title: 'Delivery Map' }} />
      <Stack.Screen name="delivery-status-controls" options={{ title: 'Update Status' }} />
      <Stack.Screen name="current-assignments" options={{ title: 'My Assignments' }} />
      <Stack.Screen name="assignment-details" options={{ title: 'Assignment Details' }} />
      <Stack.Screen name="available-runs" options={{ title: 'Available Runs' }} />
      <Stack.Screen name="run-details" options={{ title: 'Run Details' }} />
      <Stack.Screen name="pod-scan" options={{ title: 'Confirm Delivery', headerShown: false }} />
      <Stack.Screen name="report-failure" options={{ title: 'Report Issue' }} />
    </Stack>
  );
}
