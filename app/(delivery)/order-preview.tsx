import React, { useState, useEffect } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { apiService } from '../../services/api';

export default function OrderPreviewScreen() {
  const router = useRouter();
  const { orderId } = useLocalSearchParams();
  const [order, setOrder] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadOrder();
  }, [orderId]);

  const loadOrder = async () => {
    try {
      setIsLoading(true);
      const orders = await apiService.getAvailableOrders();
      const found = orders.find((o: any) => o.id === orderId);
      setOrder(found);
    } catch (error) {
      console.error('Error loading order:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmAcceptance = async () => {
    try {
      await apiService.acceptOrder(orderId as string);
      Alert.alert('Success', 'Order accepted. Start delivery?', [
        { text: 'Cancel', onPress: () => router.back() },
        {
          text: 'Start Delivery',
          onPress: () => router.push('/(delivery)/active-delivery-map'),
        },
      ]);
    } catch (error) {
      Alert.alert('Error', 'Failed to accept order');
    }
  };

  if (isLoading || !order) {
    return (
      <View style={styles.container}>
        <Text>Loading order details...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Order Details</Text>
        <Text style={styles.orderId}>#{order.id.substring(0, 8)}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Pickup</Text>
        <Text style={styles.address}>{order.pickupLocation.address}</Text>
        <Text style={styles.coords}>
          {order.pickupLocation.latitude.toFixed(4)}, {order.pickupLocation.longitude.toFixed(4)}
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Delivery</Text>
        <Text style={styles.address}>{order.deliveryLocation.address}</Text>
        <Text style={styles.coords}>
          {order.deliveryLocation.latitude.toFixed(4)}, {order.deliveryLocation.longitude.toFixed(4)}
        </Text>
      </View>

      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.label}>Distance:</Text>
          <Text style={styles.value}>{order.distance} km</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Estimated Time:</Text>
          <Text style={styles.value}>{order.estimatedDuration} min</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Payment:</Text>
          <Text style={[styles.value, { color: '#2E7D32', fontWeight: '700' }]}>
            ₹{order.amount}
          </Text>
        </View>
      </View>

      <TouchableOpacity style={styles.acceptButton} onPress={handleConfirmAcceptance}>
        <Text style={styles.acceptButtonText}>Accept Order</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.cancelButton} onPress={() => router.back()}>
        <Text style={styles.cancelButtonText}>Back</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  orderId: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  address: {
    fontSize: 14,
    color: '#333',
  },
  coords: {
    fontSize: 10,
    color: '#999',
    marginTop: 4,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  label: {
    fontSize: 13,
    color: '#666',
  },
  value: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
  },
  acceptButton: {
    backgroundColor: '#2E7D32',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  acceptButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
  cancelButton: {
    backgroundColor: '#f5f5f5',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  cancelButtonText: {
    color: '#333',
    fontWeight: '600',
    fontSize: 15,
  },
});
