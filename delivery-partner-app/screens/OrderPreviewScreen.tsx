import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';

interface Order {
  orderId: string;
  pickup: { lat: number; lng: number };
  dropoff: { lat: number; lng: number };
  distanceMeters: number;
  estimatedEarnings: number;
}

const OrderPreviewScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { order }: { order: Order } = route.params as any;

  const handleAccept = () => {
    // TODO: Accept order API call
    navigation.navigate('ActiveDeliveryMap', { order });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Order Preview</Text>
      <Text>Order ID: {order.orderId}</Text>
      <Text>Distance: {order.distanceMeters}m</Text>
      <Text>Earnings: ${order.estimatedEarnings}</Text>
      <TouchableOpacity style={styles.button} onPress={handleAccept}>
        <Text style={styles.buttonText}>Accept Order</Text>
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
    backgroundColor: '#28a745',
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

export default OrderPreviewScreen;
