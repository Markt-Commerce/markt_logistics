import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';

interface Order {
  orderId: string;
  pickup: { lat: number; lng: number };
  dropoff: { lat: number; lng: number };
  distanceMeters: number;
  estimatedEarnings: number;
}

const DeliveryStatusControlsScreen: React.FC = () => {
  const [status, setStatus] = useState('EN_ROUTE_TO_PICKUP');
  const navigation = useNavigation();
  const route = useRoute();
  const { order }: { order: Order } = route.params as any;

  const handleStatusUpdate = (newStatus: string) => {
    setStatus(newStatus);
    // TODO: Update status via API
    if (newStatus === 'DELIVERED_PENDING_QR') {
      navigation.navigate('QRCode', { order });
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Delivery Status Controls</Text>
      <Text>Order ID: {order.orderId}</Text>
      <Text>Current Status: {status}</Text>
      <TouchableOpacity style={styles.button} onPress={() => handleStatusUpdate('ARRIVED_PICKUP')}>
        <Text style={styles.buttonText}>Arrived at Pickup</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.button} onPress={() => handleStatusUpdate('PICKED_UP')}>
        <Text style={styles.buttonText}>Picked Up</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.button} onPress={() => handleStatusUpdate('EN_ROUTE_TO_DROPOFF')}>
        <Text style={styles.buttonText}>En Route to Dropoff</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.button} onPress={() => handleStatusUpdate('DELIVERED_PENDING_QR')}>
        <Text style={styles.buttonText}>Delivered - Show QR</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#007bff',
    padding: 15,
    borderRadius: 5,
    alignItems: 'center',
    marginBottom: 10,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
  },
});

export default DeliveryStatusControlsScreen;
