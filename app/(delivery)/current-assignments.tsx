import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import apiService from '../../services/api';

const PRIMARY_COLOR = '#e26136';
const BG_LIGHT = '#f6f8f7';

export default function CurrentAssignmentsScreen() {
  const router = useRouter();
  const [assignments, setAssignments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadAssignments();
  }, []);

  const loadAssignments = async () => {
    try {
      setIsLoading(true);
      const data = await apiService.getActiveAssignments();
      setAssignments(data);
    } catch (error) {
      console.error('Error loading assignments:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'picked_up':
        return PRIMARY_COLOR;
      case 'in_transit':
        return '#FF9800';
      case 'arrived':
        return '#2196F3';
      case 'delivered':
        return '#4CAF50';
      default:
        return '#999';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'picked_up':
        return 'shopping-bag';
      case 'in_transit':
        return 'local-shipping';
      case 'arrived':
        return 'location-on';
      case 'delivered':
        return 'check-circle';
      default:
        return 'info';
    }
  };

  const handleAssignmentPress = (assignmentId: string) => {
    router.push({
      pathname: '/(delivery)/assignment-details',
      params: { assignmentId },
    });
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.headerContainer}>
          <Text style={styles.pageTitle}>Current Assignments</Text>
          <TouchableOpacity style={styles.refreshButton} onPress={loadAssignments}>
            <MaterialIcons name="refresh" size={20} color={PRIMARY_COLOR} />
          </TouchableOpacity>
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading assignments...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (assignments.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.headerContainer}>
          <Text style={styles.pageTitle}>Current Assignments</Text>
          <TouchableOpacity style={styles.refreshButton} onPress={loadAssignments}>
            <MaterialIcons name="refresh" size={20} color={PRIMARY_COLOR} />
          </TouchableOpacity>
        </View>
        <View style={styles.emptyStateContainer}>
          <MaterialIcons name="assignment-ind" size={80} color={PRIMARY_COLOR + '40'} />
          <Text style={styles.emptyTitle}>No Active Assignments</Text>
          <Text style={styles.emptySubtitle}>
            You don't have any active deliveries right now. Go online to start accepting orders!
          </Text>
          <TouchableOpacity
            style={styles.emptyButton}
            onPress={() => router.push('/(delivery)/availability-toggle')}
          >
            <Text style={styles.emptyButtonText}>Back to Dashboard</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.headerContainer}>
        <Text style={styles.pageTitle}>Current Assignments</Text>
        <TouchableOpacity style={styles.refreshButton} onPress={loadAssignments}>
          <MaterialIcons name="refresh" size={20} color={PRIMARY_COLOR} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={assignments}
        keyExtractor={(item) => item.assignmentId}
        contentContainerStyle={styles.listContent}
        scrollEnabled={true}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.assignmentCard}
            onPress={() => handleAssignmentPress(item.assignmentId)}
          >
            {/* Top Row: Order ID and Status */}
            <View style={styles.cardHeader}>
              <View style={styles.orderIdContainer}>
                <MaterialIcons name="assignment" size={20} color={PRIMARY_COLOR} />
                <Text style={styles.orderId}>#{item.orderId.substring(0, 8)}</Text>
              </View>
              <View
                style={[
                  styles.statusBadge,
                  { backgroundColor: getStatusColor(item.status) + '20', borderColor: getStatusColor(item.status) },
                ]}
              >
                <MaterialIcons name={getStatusIcon(item.status)} size={14} color={getStatusColor(item.status)} />
                <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
                  {item.status.replace('_', ' ')}
                </Text>
              </View>
            </View>

            {/* Locations Row */}
            <View style={styles.locationsContainer}>
              {/* Pickup */}
              <View style={styles.locationItem}>
                <View style={styles.locationDot}>
                  <MaterialIcons name="location-on" size={12} color={PRIMARY_COLOR} />
                </View>
                <View style={styles.locationText}>
                  <Text style={styles.locationLabel}>Pickup</Text>
                  <Text style={styles.locationAddress} numberOfLines={1}>
                    {item.pickupAddress || `${item.pickup.lat.toFixed(2)}, ${item.pickup.lng.toFixed(2)}`}
                  </Text>
                </View>
              </View>

              {/* Arrow */}
              <MaterialIcons name="arrow-forward" size={18} color="#ddd" />

              {/* Delivery */}
              <View style={styles.locationItem}>
                <View style={styles.locationDot}>
                  <MaterialIcons name="location-on" size={12} color={PRIMARY_COLOR} />
                </View>
                <View style={styles.locationText}>
                  <Text style={styles.locationLabel}>Delivery</Text>
                  <Text style={styles.locationAddress} numberOfLines={1}>
                    {item.deliveryAddress || `${item.dropoff.lat.toFixed(2)}, ${item.dropoff.lng.toFixed(2)}`}
                  </Text>
                </View>
              </View>
            </View>

            {/* Distance and Earnings */}
            <View style={styles.infoRow}>
              <View style={styles.infoPill}>
                <MaterialIcons name="near-me" size={14} color="#999" />
                <Text style={styles.infoPillText}>
                  {(item.distanceMeters / 1000).toFixed(1)} km
                </Text>
              </View>
              <View style={styles.infoPill}>
                <MaterialIcons name="schedule" size={14} color="#999" />
                <Text style={styles.infoPillText}>
                  {item.estimatedDuration || Math.round(item.distanceMeters / 1500)} mins
                </Text>
              </View>
              <View style={styles.infoPill}>
                <MaterialIcons name="payments" size={14} color={PRIMARY_COLOR} />
                <Text style={[styles.infoPillText, { color: PRIMARY_COLOR, fontWeight: '700' }]}>
                  ₦{item.estimatedEarnings}
                </Text>
              </View>
            </View>

            {/* Tap to View Details */}
            <View style={styles.footerRow}>
              <Text style={styles.tapText}>Tap to view details</Text>
              <MaterialIcons name="chevron-right" size={20} color={PRIMARY_COLOR} />
            </View>
          </TouchableOpacity>
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
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1a1a1a',
    letterSpacing: -0.5,
  },
  refreshButton: {
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
  emptyStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 24,
  },
  emptyButton: {
    backgroundColor: PRIMARY_COLOR,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  emptyButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  assignmentCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  orderIdContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  orderId: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  locationsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    paddingVertical: 8,
    paddingHorizontal: 8,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
  },
  locationItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  locationDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: PRIMARY_COLOR + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  locationText: {
    flex: 1,
  },
  locationLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#999',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  locationAddress: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
  },
  infoRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  infoPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#f5f5f5',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#eee',
  },
  infoPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#666',
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  tapText: {
    fontSize: 12,
    fontWeight: '600',
    color: PRIMARY_COLOR,
  },
});
