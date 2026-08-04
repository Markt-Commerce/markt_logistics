import AsyncStorage from '@react-native-async-storage/async-storage';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function restoreToken() {
      try {
        const token = await AsyncStorage.getItem('sessionToken');
        if (token) {
          setIsAuthenticated(true);
        }
      } catch (error) {
        console.error('Failed to restore token:', error);
      } finally {
        setIsLoading(false);
        SplashScreen.hideAsync();
      }
    }

    restoreToken();
  }, []);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#e26136" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      {isAuthenticated ? (
        <Stack.Screen name="(delivery)" options={{ headerShown: false }} />
      ) : (
        <Stack.Screen name="(auth)/login" options={{ headerShown: false }} />
      )}
    </Stack>
  );
}
