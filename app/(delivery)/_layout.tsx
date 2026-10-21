import { Stack } from 'expo-router';

export default function DeliveryLayout() {
  return (
    <Stack>
      <Stack.Screen name="availability-toggle" options={{ title: 'Dashboard', headerShown: false }} />
      <Stack.Screen name="active-delivery" options={{ title: 'Active Delivery' }} />
      <Stack.Screen name="earnings" options={{ title: 'Earnings', headerShown: false }} />
      <Stack.Screen name="pod-scan" options={{ title: 'Confirm Delivery', headerShown: false }} />
      <Stack.Screen name="report-failure" options={{ title: 'Report Issue' }} />
    </Stack>
  );
}
