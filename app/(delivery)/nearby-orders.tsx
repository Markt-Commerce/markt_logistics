import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import apiService from '../../services/api';

export default function NearbyOrdersScreen() {
  const router = useRouter();
  const [orders, setOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    try {
      setIsLoading(true);
      const data = await apiService.getAvailableOrders();
      setOrders(data);
    } catch (error) {
      console.error('Error loading orders:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAcceptOrder = async (orderId: string) => {
    try {
      await apiService.acceptOrder(orderId);
      router.push({ pathname: '/(delivery)/order-preview', params: { orderId } });
    } catch (error) {
      console.error('Error accepting order:', error);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Text>Loading orders...</Text>
      </View>
    );
  }

  if (orders.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.emptyText}>No orders available</Text>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      data={orders}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <View style={styles.orderCard}>
          <View style={styles.orderHeader}>
            <Text style={styles.orderId}>Order #{item.id.substring(0, 8)}</Text>
            <Text style={styles.distance}>{item.distance} km away</Text>
          </View>

          <Text style={styles.pickupText}>From: {item.pickupLocation.address}</Text>
          <Text style={styles.deliveryText}>To: {item.deliveryLocation.address}</Text>
          <Text style={styles.amount}>₹{item.amount}</Text>

          <TouchableOpacity
            style={styles.acceptButton}
            onPress={() => handleAcceptOrder(item.id)}
          >
            <Text style={styles.acceptButtonText}>Accept Order</Text>
          </TouchableOpacity>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 16,
  },
  orderCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  orderId: {
    fontSize: 14,
    fontWeight: '700',
  },
  distance: {
    fontSize: 12,
    color: '#666',
  },
  pickupText: {
    fontSize: 12,
    color: '#333',
    marginBottom: 4,
  },
  deliveryText: {
    fontSize: 12,
    color: '#333',
    marginBottom: 8,
  },
  amount: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2E7D32',
    marginBottom: 12,
  },
  acceptButton: {
    backgroundColor: '#2E7D32',
    paddingVertical: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  acceptButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 20,
  },
});
