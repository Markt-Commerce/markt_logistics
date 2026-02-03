import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRoute } from '@react-navigation/native';

interface Order {
  orderId: string;
  pickup: { lat: number; lng: number };
  dropoff: { lat: number; lng: number };
  distanceMeters: number;
  estimatedEarnings: number;
}

const QRCodeScreen: React.FC = () => {
  const route = useRoute();
  const { order }: { order: Order } = route.params as any;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>QR Code for Delivery</Text>
      <Text>Order ID: {order.orderId}</Text>
      {/* TODO: Generate and display QR code */}
      <Text>QR Code Placeholder</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
});

export default QRCodeScreen;
