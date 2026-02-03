import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';

interface Order {
  orderId: string;
  pickup: { lat: number; lng: number };
  dropoff: { lat: number; lng: number };
  distanceMeters: number;
  estimatedEarnings: number;
}

const NearbyOrdersScreen: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const navigation = useNavigation();

  useEffect(() => {
    // TODO: Fetch nearby orders from API
    const mockOrders: Order[] = [
      {
        orderId: 'ord_789',
        pickup: { lat: 53.348, lng: -6.261 },
        dropoff: { lat: 53.351, lng: -6.258 },
        distanceMeters: 1200,
        estimatedEarnings: 6.5,
      },
    ];
    setOrders(mockOrders);
  }, []);

  const handleOrderPress = (order: Order) => {
    navigation.navigate('OrderPreview', { order });
  };

  const renderOrder = ({ item }: { item: Order }) => (
    <TouchableOpacity style={styles.orderItem} onPress={() => handleOrderPress(item)}>
      <Text>Order ID: {item.orderId}</Text>
      <Text>Distance: {item.distanceMeters}m</Text>
      <Text>Earnings: ${item.estimatedEarnings}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Nearby Orders</Text>
      <FlatList
        data={orders}
        renderItem={renderOrder}
        keyExtractor={(item) => item.orderId}
      />
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
  orderItem: {
    padding: 15,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
    marginBottom: 10,
  },
});

export default NearbyOrdersScreen;
