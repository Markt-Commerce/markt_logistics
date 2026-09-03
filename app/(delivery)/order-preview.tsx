import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import apiService from '../../services/api';

const PRIMARY_COLOR = '#e26136';
const BG_LIGHT = '#f6f8f7';

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
      const found = orders.find((o: any) => o.orderId === orderId);
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
      router.push('/(delivery)/active-delivery-map');
    } catch (error) {
      console.error('Error accepting order:', error);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading order details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!order) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Order not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const distance = (order.distanceMeters / 1000).toFixed(1);
  const estimatedTime = order.estimatedDuration || Math.round(order.distanceMeters / 1500);
  const pickupCoords = order.pickup ? `${order.pickup.lat.toFixed(4)}, ${order.pickup.lng.toFixed(4)}` : 'N/A';
  const dropoffCoords = order.dropoff ? `${order.dropoff.lat.toFixed(4)}, ${order.dropoff.lng.toFixed(4)}` : 'N/A';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <MaterialIcons name="arrow-back" size={24} color="#1a1a1a" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Order Preview</Text>
          <View style={{ width: 24 }} />
        </View>

        {/* Order ID Card */}
        <View style={styles.orderIdCard}>
          <View style={styles.orderIdLeft}>
            <MaterialIcons name="assignment" size={32} color={PRIMARY_COLOR} />
            <View>
              <Text style={styles.orderIdLabel}>Order ID</Text>
              <Text style={styles.orderIdValue}>#{(orderId as string).substring(0, 8)}</Text>
            </View>
          </View>
          <View style={styles.orderIdRight}>
            <Text style={styles.earningsLabel}>Earnings</Text>
            <Text style={styles.earningsValue}>₦{order.estimatedEarnings}</Text>
          </View>
        </View>

        {/* Pickup Section */}
        <View style={styles.locationCard}>
          <View style={styles.locationHeader}>
            <View style={styles.locationIconBox}>
              <MaterialIcons name="location-on" size={20} color={PRIMARY_COLOR} />
            </View>
            <Text style={styles.locationTitle}>Pickup Location</Text>
          </View>
          <Text style={styles.locationAddress}>
            {order.pickupLocation?.address || 'No address available'}
          </Text>
          <Text style={styles.locationCoords}>{pickupCoords}</Text>
        </View>

        {/* Distance & Time Info */}
        <View style={styles.infoGrid}>
          <View style={styles.infoCard}>
            <MaterialIcons name="near-me" size={24} color={PRIMARY_COLOR} />
            <Text style={styles.infoValue}>{distance} km</Text>
            <Text style={styles.infoLabel}>Distance</Text>
          </View>
          <View style={styles.infoCard}>
            <MaterialIcons name="schedule" size={24} color={PRIMARY_COLOR} />
            <Text style={styles.infoValue}>{estimatedTime} min</Text>
            <Text style={styles.infoLabel}>Est. Time</Text>
          </View>
        </View>

        {/* Dropoff Section */}
        <View style={styles.locationCard}>
          <View style={styles.locationHeader}>
            <View style={styles.locationIconBox}>
              <MaterialIcons name="location-on" size={20} color={PRIMARY_COLOR} />
            </View>
            <Text style={styles.locationTitle}>Delivery Location</Text>
          </View>
          <Text style={styles.locationAddress}>
            {order.deliveryLocation?.address || 'No address available'}
          </Text>
          <Text style={styles.locationCoords}>{dropoffCoords}</Text>
        </View>

        {/* Route Summary */}
        <View style={styles.routeCard}>
          <View style={styles.routeHeader}>
            <MaterialIcons name="directions" size={20} color={PRIMARY_COLOR} />
            <Text style={styles.routeTitle}>Route Summary</Text>
          </View>
          <View style={styles.routeLine} />
          <Text style={styles.routeText}>
            Pickup • {distance} km • {estimatedTime} min • Delivery
          </Text>
        </View>

        {/* Buttons */}
        <TouchableOpacity style={styles.acceptButton} onPress={handleConfirmAcceptance}>
          <MaterialIcons name="check-circle" size={20} color="#1a1a1a" />
          <Text style={styles.acceptButtonText}>Accept Order</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <MaterialIcons name="close" size={20} color="#999" />
          <Text style={styles.backButtonText}>Decline</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG_LIGHT,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  orderIdCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  orderIdLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  orderIdRight: {
    alignItems: 'flex-end',
  },
  orderIdLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#999',
    letterSpacing: 0.5,
  },
  orderIdValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1a1a1a',
    marginTop: 2,
  },
  earningsLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#999',
    letterSpacing: 0.5,
  },
  earningsValue: {
    fontSize: 18,
    fontWeight: '800',
    color: PRIMARY_COLOR,
    marginTop: 2,
  },
  locationCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  locationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  locationIconBox: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: PRIMARY_COLOR + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  locationTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  locationAddress: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 6,
  },
  locationCoords: {
    fontSize: 11,
    color: '#999',
    fontFamily: 'monospace',
  },
  infoGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  infoCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  infoValue: {
    fontSize: 18,
    fontWeight: '800',
    color: PRIMARY_COLOR,
    marginVertical: 6,
  },
  infoLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#999',
    letterSpacing: 0.5,
  },
  routeCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  routeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  routeTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  routeLine: {
    height: 2,
    backgroundColor: PRIMARY_COLOR,
    marginBottom: 12,
  },
  routeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    textAlign: 'center',
  },
  acceptButton: {
    backgroundColor: PRIMARY_COLOR,
    paddingVertical: 14,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    shadowColor: PRIMARY_COLOR,
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  acceptButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1a1a1a',
    letterSpacing: 0.5,
  },
  backButton: {
    backgroundColor: '#fff',
    paddingVertical: 14,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  backButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#999',
    letterSpacing: 0.5,
  },
});
