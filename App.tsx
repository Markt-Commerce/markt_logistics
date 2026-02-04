import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from './contexts/AuthContext';
import { LocationProvider } from './contexts/LocationContext';
import { WebSocketProvider } from './contexts/WebSocketContext';
import LoginScreen from './screens/LoginScreen';
import AvailabilityToggleScreen from './screens/AvailabilityToggleScreen';
import NearbyOrdersScreen from './screens/NearbyOrdersScreen';
import OrderPreviewScreen from './screens/OrderPreviewScreen';
import ActiveDeliveryMapScreen from './screens/ActiveDeliveryMapScreen';
import DeliveryStatusControlsScreen from './screens/DeliveryStatusControlsScreen';
import QRCodeScreen from './screens/QRCodeScreen';

const Stack = createStackNavigator();

export default function App() {
  return (
    <AuthProvider>
      <LocationProvider>
        <WebSocketProvider>
          <NavigationContainer>
            <Stack.Navigator initialRouteName="Login">
              <Stack.Screen name="Login" component={LoginScreen} />
              <Stack.Screen name="AvailabilityToggle" component={AvailabilityToggleScreen} />
              <Stack.Screen name="NearbyOrders" component={NearbyOrdersScreen} />
              <Stack.Screen name="OrderPreview" component={OrderPreviewScreen} />
              <Stack.Screen name="ActiveDeliveryMap" component={ActiveDeliveryMapScreen} />
              <Stack.Screen name="DeliveryStatusControls" component={DeliveryStatusControlsScreen} />
              <Stack.Screen name="QRCode" component={QRCodeScreen} />
            </Stack.Navigator>
            <StatusBar style="auto" />
          </NavigationContainer>
        </WebSocketProvider>
      </LocationProvider>
    </AuthProvider>
  );
}
