import * as Notifications from 'expo-notifications';
import { Stack, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider, useAuth } from '../contexts/auth';
import { routeForNotification } from '../services/notifications';

SplashScreen.preventAutoHideAsync();

function RootLayoutNav() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      SplashScreen.hideAsync();
    }
  }, [isLoading]);

  // Tapping a notification takes the rider to what it was about.
  //
  // Two cases, and both matter: the app was already running, and the app was
  // opened by the tap from cold. Handling only the first is the common miss,
  // and it is the one that happens when a rider is not staring at the phone
  // -- which is exactly when a push was worth sending.
  useEffect(() => {
    if (!isAuthenticated) return;

    const go = (response: Notifications.NotificationResponse | null) => {
      const data = response?.notification?.request?.content?.data;
      if (!data) return;
      router.push(routeForNotification(data as Record<string, any>) as any);
    };

    // Cold start.
    Notifications.getLastNotificationResponseAsync().then(go).catch(() => {});
    // Already running.
    const sub = Notifications.addNotificationResponseReceivedListener(go);
    return () => sub.remove();
  }, [isAuthenticated, router]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#e26136" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={isAuthenticated}>
        <Stack.Screen name="(delivery)" />
      </Stack.Protected>
      <Stack.Protected guard={!isAuthenticated}>
        {/* Reference the group by its own name, like (delivery) above --
            "(auth)/login" isn't a valid child name at this level and
            triggers "[Layout children]: No route named ... exists in
            nested children" at runtime. */}
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <RootLayoutNav />
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
