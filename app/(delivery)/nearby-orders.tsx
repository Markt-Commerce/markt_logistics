import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { FlatList, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import apiService from '../../services/api';

const PRIMARY_COLOR = '#e26136';
const BG_LIGHT = '#f6f8f7';

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
      console.log('Accepting order:', orderId);
      await apiService.acceptOrder(orderId);
      router.push({ pathname: '/(delivery)/order-preview', params: { orderId } });
    } catch (error) {
      console.error('Error accepting order:', error);
    }
  };

  // Loading / Empty State Screen
  if (isLoading || orders.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <ScrollView contentContainerStyle={styles.emptyScrollContent}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitle}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>M</Text>
              </View>
              <View>
                <Text style={styles.headerMainText}>Nearby Orders</Text>
                <View style={styles.onlineIndicator}>
                  <View style={styles.onlineDot} />
                  <Text style={styles.onlineText}>Online</Text>
                </View>
              </View>
            </View>
            <TouchableOpacity style={styles.goOfflineButton}>
              <Text style={styles.goOfflineText}>Go Offline</Text>
            </TouchableOpacity>
          </View>

          {/* Scanning Animation Area */}
          <View style={styles.scanningContainer}>
            <View style={styles.radarOuter} />
            <View style={[styles.radarMiddle, { marginTop: -48 }]} />
            <View style={[styles.radarInner, { marginTop: -24 }]} />

            {/* Central Circle */}
            <View style={styles.centerCircle}>
              <MaterialIcons name="explore" size={80} color={PRIMARY_COLOR} />
            </View>

            {/* Scanning Label */}
            <View style={styles.scanningLabel}>
              <View style={styles.scanningDot} />
              <Text style={styles.scanningLabelText}>Scanning Area</Text>
            </View>
          </View>

          {/* Message */}
          <View style={styles.messageContainer}>
            <Text style={styles.messageTitle}>Looking for orders...</Text>
            <Text style={styles.messageSubtitle}>
              Hang tight! New delivery tasks in your area will appear here as soon as they become available.
            </Text>
          </View>

          {/* Refresh Button */}
          <TouchableOpacity style={styles.refreshButton} onPress={loadOrders}>
            <MaterialIcons name="refresh" size={20} color="#1a1a1a" />
            <Text style={styles.refreshButtonText}>Refresh Now</Text>
          </TouchableOpacity>

          {/* Location Preview */}
          <View style={styles.locationPreview}>
            <View style={styles.locationHeader}>
              <Text style={styles.locationLabel}>Your Location</Text>
              <Text style={styles.locationCity}>New York City</Text>
            </View>
            <View style={styles.locationMapPlaceholder}>
              <MaterialIcons name="location-on" size={24} color={PRIMARY_COLOR} />
            </View>
          </View>
        </ScrollView>

        {/* Bottom Nav */}
        <View style={styles.bottomNav}>
          <TouchableOpacity style={styles.navItem}>
            <MaterialIcons name="local-shipping" size={24} color={PRIMARY_COLOR} />
            <Text style={styles.navLabel}>Orders</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.navItem}>
            <MaterialIcons name="payments" size={24} color="#999" />
            <Text style={styles.navLabel}>Earnings</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.navItem}>
            <MaterialIcons name="map" size={24} color="#999" />
            <Text style={styles.navLabel}>Heatmap</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.navItem}>
            <MaterialIcons name="person-outline" size={24} color="#999" />
            <Text style={styles.navLabel}>Profile</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Orders List Screen
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle2}>Nearby Orders</Text>
        <TouchableOpacity style={styles.refreshIconButton} onPress={loadOrders}>
          <MaterialIcons name="refresh" size={20} color={PRIMARY_COLOR} />
        </TouchableOpacity>
      </View>

      {/* Filter Pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterContainer}
        contentContainerStyle={styles.filterContent}
      >
        <TouchableOpacity style={[styles.filterPill, styles.filterPillActive]}>
          <Text style={styles.filterPillActiveText}>All Orders</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.filterPill}>
          <Text style={styles.filterPillText}>Closest</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.filterPill}>
          <Text style={styles.filterPillText}>High Pay</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.filterPill}>
          <Text style={styles.filterPillText}>Quickest</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.filterPill}>
          <Text style={styles.filterPillText}>Groceries</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Orders List */}
      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        scrollEnabled={true}
        renderItem={({ item }) => (
          <View style={styles.orderCard}>
            {/* Header with Tags and Price */}
            <View style={styles.orderCardHeader}>
              <View style={styles.tagsContainer}>
                <View style={styles.tagFlash}>
                  <Text style={styles.tagFlashText}>Flash Delivery</Text>
                </View>
                <View style={styles.tagNormal}>
                  <Text style={styles.tagNormalText}>{item.items || '5'} Items</Text>
                </View>
              </View>
              <Text style={styles.orderPrice}>₦{item.estimatedEarnings || item.amount}</Text>
            </View>

            {/* Timeline */}
            <View style={styles.timeline}>
              <View style={styles.timelineConnector} />

              {/* Pickup */}
              <View style={styles.timelineItem}>
                <View style={styles.timelineDotPickup}>
                  <View style={styles.timelineDotInner} />
                </View>
                <View style={styles.timelineContent}>
                  <Text style={styles.timelineLabel}>Pickup</Text>
                  <Text style={styles.timelinePlace}>
                    {item.pickupLocation?.address || `Lat ${item.pickup?.lat}, Lng ${item.pickup?.lng}`}
                  </Text>
                </View>
              </View>

              {/* Dropoff */}
              <View style={styles.timelineItem}>
                <View style={styles.timelineDotDropoff}>
                  <MaterialIcons name="location-on" size={12} color="#999" />
                </View>
                <View style={styles.timelineContent}>
                  <Text style={styles.timelineLabel}>Drop-off</Text>
                  <Text style={styles.timelinePlace}>
                    {item.deliveryLocation?.address || `Lat ${item.dropoff?.lat}, Lng ${item.dropoff?.lng}`}
                  </Text>
                </View>
              </View>
            </View>

            {/* Distance and Time */}
            <View style={styles.infoRow}>
              <View style={styles.infoPill}>
                <MaterialIcons name="near-me" size={14} color="#999" />
                <Text style={styles.infoPillText}>{(item.distanceMeters / 1000).toFixed(1)} km</Text>
              </View>
              <View style={styles.infoPill}>
                <MaterialIcons name="schedule" size={14} color="#999" />
                <Text style={styles.infoPillText}>{item.estimatedDuration || Math.round(item.distanceMeters / 1500)} mins</Text>
              </View>
            </View>

            {/* Accept Button */}
            <TouchableOpacity
              style={styles.acceptButton}
              onPress={() => handleAcceptOrder(item.orderId)}
            >
              <Text style={styles.acceptButtonText}>Accept Order</Text>
            </TouchableOpacity>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG_LIGHT,
  },
  // Empty State Styles
  emptyScrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  headerTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  headerTitle2: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1a1a1a',
    letterSpacing: -0.5,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: PRIMARY_COLOR,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  headerMainText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  onlineIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: PRIMARY_COLOR,
  },
  onlineText: {
    fontSize: 11,
    fontWeight: '700',
    color: PRIMARY_COLOR,
    letterSpacing: 0.5,
  },
  goOfflineButton: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  goOfflineText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  scanningContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 40,
  },
  radarOuter: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 2,
    borderColor: PRIMARY_COLOR + '40',
  },
  radarMiddle: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    borderWidth: 2,
    borderColor: PRIMARY_COLOR + '30',
  },
  radarInner: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
    borderColor: PRIMARY_COLOR + '20',
  },
  centerCircle: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: PRIMARY_COLOR + '15',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: PRIMARY_COLOR + '25',
  },
  scanningLabel: {
    marginTop: 24,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  scanningDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: PRIMARY_COLOR,
  },
  scanningLabelText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#999',
    letterSpacing: 0.5,
  },
  messageContainer: {
    alignItems: 'center',
    marginVertical: 20,
  },
  messageTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  messageSubtitle: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 16,
  },
  refreshButton: {
    backgroundColor: PRIMARY_COLOR,
    paddingVertical: 14,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginVertical: 20,
    shadowColor: PRIMARY_COLOR,
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  refreshButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1a1a1a',
    letterSpacing: 0.5,
  },
  locationPreview: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#ddd',
  },
  locationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  locationLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#999',
    letterSpacing: 0.5,
  },
  locationCity: {
    fontSize: 11,
    fontWeight: '700',
    color: PRIMARY_COLOR,
  },
  locationMapPlaceholder: {
    height: 80,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingVertical: 8,
    paddingHorizontal: 0,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  navLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#666',
    marginTop: 4,
  },
  refreshIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  // Orders List Styles
  filterContainer: {
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  filterContent: {
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  filterPillActive: {
    backgroundColor: PRIMARY_COLOR,
    borderColor: PRIMARY_COLOR,
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  filterPillActiveText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  orderCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  orderCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  tagsContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  tagFlash: {
    backgroundColor: PRIMARY_COLOR + '15',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  tagFlashText: {
    fontSize: 10,
    fontWeight: '700',
    color: PRIMARY_COLOR,
    letterSpacing: 0.5,
  },
  tagNormal: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  tagNormalText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#666',
    letterSpacing: 0.5,
  },
  orderPrice: {
    fontSize: 18,
    fontWeight: '800',
    color: PRIMARY_COLOR,
  },
  timeline: {
    marginVertical: 16,
    marginLeft: 8,
  },
  timelineConnector: {
    position: 'absolute',
    left: 8,
    top: 20,
    bottom: 0,
    width: 2,
    backgroundColor: '#e0e0e0',
    borderStyle: 'dashed',
  },
  timelineItem: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
    zIndex: 1,
  },
  timelineDotPickup: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: PRIMARY_COLOR,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  timelineDotInner: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: PRIMARY_COLOR,
  },
  timelineDotDropoff: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#ddd',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  timelineContent: {
    flex: 1,
    paddingTop: 2,
  },
  timelineLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#999',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  timelinePlace: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  infoRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  infoPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#eee',
  },
  infoPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#666',
  },
  acceptButton: {
    backgroundColor: PRIMARY_COLOR,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  acceptButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1a1a1a',
    letterSpacing: 0.5,
  },
});


