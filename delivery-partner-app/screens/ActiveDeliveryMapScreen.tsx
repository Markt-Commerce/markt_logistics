import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';

interface Order {
  orderId: string;
  pickup: { lat: number; lng: number };
  dropoff: { lat: number; lng: number };
  distanceMeters: number;
  estimatedEarnings: number;
}

const ActiveDeliveryMapScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { order }: { order: Order } = route.params as any;

  const handleStatusUpdate = () => {
    navigation.navigate('DeliveryStatusControls', { order });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Active Delivery Map</Text>
      <Text>Order ID: {order.orderId}</Text>
      {/* TODO: Add map component */}
      <TouchableOpacity style={styles.button} onPress={handleStatusUpdate}>
        <Text style={styles.buttonText}>Update Status</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#007bff',
    padding: 15,
    borderRadius: 5,
    alignItems: 'center',
    marginTop: 20,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
  },
});

export default ActiveDeliveryMapScreen;
