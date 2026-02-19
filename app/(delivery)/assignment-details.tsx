import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, Image, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import apiService from '../../services/api';

const PRIMARY_COLOR = '#e26136';
const BG_LIGHT = '#f6f8f7';

export default function AssignmentDetailsScreen() {
  const router = useRouter();
  const { assignmentId } = useLocalSearchParams();
  const [assignment, setAssignment] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  useEffect(() => {
    loadAssignmentDetails();
  }, [assignmentId]);

  const loadAssignmentDetails = async () => {
    try {
      setIsLoading(true);
      const data = await apiService.getAssignmentDetails(assignmentId as string);
      setAssignment(data);
    } catch (error) {
      console.error('Error loading assignment details:', error);
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

  const getNextStatuses = (currentStatus: string): string[] => {
    switch (currentStatus) {
      case 'picked_up':
        return ['in_transit', 'arrived', 'delivered'];
      case 'in_transit':
        return ['arrived', 'delivered'];
      case 'arrived':
        return ['delivered'];
      case 'delivered':
        return [];
      default:
        return ['picked_up', 'in_transit', 'arrived', 'delivered'];
    }
  };

  const handleStatusUpdate = async (newStatus: string) => {
    try {
      setIsUpdatingStatus(true);
      await apiService.updateAssignmentStatus(assignment.assignmentId, newStatus);
      
      // Update local state
      setAssignment({ ...assignment, status: newStatus });
      setShowStatusModal(false);
      
      Alert.alert('Success', `Status updated to ${newStatus.replace('_', ' ')}`);
    } catch (error) {
      Alert.alert('Error', 'Failed to update status');
      console.error('Error updating status:', error);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()}>
            <MaterialIcons name="arrow-back" size={24} color="#1a1a1a" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Assignment Details</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading assignment details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!assignment) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()}>
            <MaterialIcons name="arrow-back" size={24} color="#1a1a1a" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Assignment Details</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Assignment not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const statusColor = getStatusColor(assignment.status);
  const distance = (assignment.distanceMeters / 1000).toFixed(1);
  const estimatedTime = assignment.estimatedDuration || Math.round(assignment.distanceMeters / 1500);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()}>
            <MaterialIcons name="arrow-back" size={24} color="#1a1a1a" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Assignment Details</Text>
          <View style={{ width: 24 }} />
        </View>

        {/* Status Card */}
        <View style={styles.statusCard}>
          <View style={styles.statusHeader}>
            <View style={styles.statusIconBox}>
              <MaterialIcons
                name={
                  assignment.status === 'delivered'
                    ? 'check-circle'
                    : assignment.status === 'arrived'
                    ? 'location-on'
                    : assignment.status === 'in_transit'
                    ? 'local-shipping'
                    : 'shopping-bag'
                }
                size={24}
                color={statusColor}
              />
            </View>
            <View style={styles.statusInfo}>
              <Text style={styles.statusLabel}>Current Status</Text>
              <Text style={[styles.statusValue, { color: statusColor }]}>
                {assignment.status.replace('_', ' ').toUpperCase()}
              </Text>
            </View>
          </View>
          <View style={styles.statusProgress}>
            <View style={[styles.progressBar, { width: `${Math.round(getStatusProgress(assignment.status) * 100)}%`, backgroundColor: statusColor }]} />
          </View>
        </View>

        {/* Order Info Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <MaterialIcons name="assignment" size={20} color={PRIMARY_COLOR} />
            <Text style={styles.cardTitle}>Order Information</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Order ID</Text>
            <Text style={styles.infoValue}>#{assignment.orderId.substring(0, 8)}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Assignment ID</Text>
            <Text style={styles.infoValue}>{assignment.assignmentId.substring(0, 12)}...</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Earnings</Text>
            <Text style={[styles.infoValue, { color: PRIMARY_COLOR, fontWeight: '700' }]}>
              ₦{assignment.estimatedEarnings}
            </Text>
          </View>
        </View>

        {/* Pickup Location */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <MaterialIcons name="location-on" size={20} color={PRIMARY_COLOR} />
            <Text style={styles.cardTitle}>Seller Location (Pickup)</Text>
          </View>
          <View style={styles.locationDetails}>
            <Text style={styles.locationName}>{assignment.sellerName || 'Seller Location'}</Text>
            <Text style={styles.locationAddress}>
              {assignment.pickupAddress || 'No address available'}
            </Text>
            <View style={styles.coordsContainer}>
              <Text style={styles.coordsLabel}>Coordinates:</Text>
              <Text style={styles.coordsValue}>
                {assignment.pickup.lat.toFixed(4)}, {assignment.pickup.lng.toFixed(4)}
              </Text>
            </View>
          </View>
        </View>

        {/* Delivery Location */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <MaterialIcons name="home" size={20} color={PRIMARY_COLOR} />
            <Text style={styles.cardTitle}>Buyer Location (Delivery)</Text>
          </View>
          <View style={styles.locationDetails}>
            <Text style={styles.locationName}>{assignment.buyerName || 'Buyer Location'}</Text>
            <Text style={styles.locationAddress}>
              {assignment.deliveryAddress || 'No address available'}
            </Text>
            <View style={styles.coordsContainer}>
              <Text style={styles.coordsLabel}>Coordinates:</Text>
              <Text style={styles.coordsValue}>
                {assignment.dropoff.lat.toFixed(4)}, {assignment.dropoff.lng.toFixed(4)}
              </Text>
            </View>
          </View>
        </View>

        {/* Status Update Section */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <MaterialIcons name="update" size={20} color={PRIMARY_COLOR} />
            <Text style={styles.cardTitle}>Update Status</Text>
          </View>
          <View style={styles.statusUpdateContainer}>
            <View style={styles.currentStatusBox}>
              <Text style={styles.currentStatusLabel}>Current Status</Text>
              <Text style={[styles.currentStatusValue, { color: getStatusColor(assignment.status) }]}>
                {assignment.status.replace('_', ' ').toUpperCase()}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.updateButton, isUpdatingStatus && styles.updateButtonDisabled]}
              onPress={() => setShowStatusModal(true)}
              disabled={isUpdatingStatus || getNextStatuses(assignment.status).length === 0}
            >
              <MaterialIcons name="arrow-forward" size={18} color="#1a1a1a" />
              <Text style={styles.updateButtonText}>
                {getNextStatuses(assignment.status).length === 0 ? 'Delivery Complete' : 'Change Status'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Route Summary */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <MaterialIcons name="directions" size={20} color={PRIMARY_COLOR} />
            <Text style={styles.cardTitle}>Route Summary</Text>
          </View>
          <View style={styles.routeSummary}>
            <View style={styles.routeItem}>
              <MaterialIcons name="near-me" size={24} color={PRIMARY_COLOR} />
              <Text style={styles.routeValue}>{distance} km</Text>
              <Text style={styles.routeLabel}>Distance</Text>
            </View>
            <View style={styles.routeItem}>
              <MaterialIcons name="schedule" size={24} color={PRIMARY_COLOR} />
              <Text style={styles.routeValue}>{estimatedTime} min</Text>
              <Text style={styles.routeLabel}>Est. Time</Text>
            </View>
            <View style={styles.routeItem}>
              <MaterialIcons name="payments" size={24} color={PRIMARY_COLOR} />
              <Text style={styles.routeValue}>₦{assignment.estimatedEarnings}</Text>
              <Text style={styles.routeLabel}>Earning</Text>
            </View>
          </View>
        </View>

        {/* QR Code Section */}
        {/* {assignment.status === 'delivered' && assignment.qrToken && ( */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <MaterialIcons name="qr-code-2" size={20} color={PRIMARY_COLOR} />
              <Text style={styles.cardTitle}>QR Confirmation</Text>
            </View>
            <View style={styles.qrContainer}>
              <View style={styles.qrBox}>
                <Text style={styles.qrLabel}>QR Token</Text>
                <Image
                  source={{ uri: `https://api.qrserver.com/v1/create-qr-code/?data=${assignment.qrToken}&size=200x200` }}
                  style={styles.qrImage}
                />
                <Text style={styles.qrCode}>{assignment.qrToken}</Text>
              </View>
              <Text style={styles.qrNote}>(This is the QR confirmation token for this delivery)</Text>
            </View>
          </View>
        {/*  */}

        {/* Action Buttons */}
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => router.push('/(delivery)/active-delivery-map')}
        >
          <MaterialIcons name="directions-run" size={20} color="#1a1a1a" />
          <Text style={styles.primaryButtonText}>View on Map</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryButton} onPress={() => router.back()}>
          <Text style={styles.secondaryButtonText}>Back to Assignments</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Status Update Modal */}
      <Modal
        visible={showStatusModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowStatusModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Update Delivery Status</Text>
              <TouchableOpacity onPress={() => setShowStatusModal(false)}>
                <MaterialIcons name="close" size={24} color="#1a1a1a" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtitle}>
              Select the new status for this delivery
            </Text>

            <View style={styles.statusOptionsList}>
              {getNextStatuses(assignment.status).map((status) => (
                <TouchableOpacity
                  key={status}
                  style={styles.statusOption}
                  onPress={() => handleStatusUpdate(status)}
                  disabled={isUpdatingStatus}
                >
                  <View style={[styles.statusOptionIcon, { backgroundColor: getStatusColor(status) + '15' }]}>
                    <MaterialIcons
                      name={
                        status === 'delivered'
                          ? 'check-circle'
                          : status === 'arrived'
                          ? 'location-on'
                          : status === 'in_transit'
                          ? 'local-shipping'
                          : 'shopping-bag'
                      }
                      size={20}
                      color={getStatusColor(status)}
                    />
                  </View>
                  <View style={styles.statusOptionInfo}>
                    <Text style={styles.statusOptionLabel}>{status.replace('_', ' ').toUpperCase()}</Text>
                    <Text style={styles.statusOptionDesc}>
                      {status === 'picked_up'
                        ? 'Item picked up from seller'
                        : status === 'in_transit'
                        ? 'On the way to buyer'
                        : status === 'arrived'
                        ? 'Arrived at destination'
                        : 'Delivery completed'}
                    </Text>
                  </View>
                  <MaterialIcons name="chevron-right" size={20} color={getStatusColor(status)} />
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={styles.modalCancelButton}
              onPress={() => setShowStatusModal(false)}
              disabled={isUpdatingStatus}
            >
              <Text style={styles.modalCancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function getStatusProgress(status: string): number {
  switch (status) {
    case 'picked_up':
      return 0.33;
    case 'in_transit':
      return 0.66;
    case 'arrived':
      return 0.85;
    case 'delivered':
      return 1;
    default:
      return 0;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG_LIGHT,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerRow: {
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
  statusCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  statusIconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: PRIMARY_COLOR + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusInfo: {
    flex: 1,
  },
  statusLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#999',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  statusValue: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  statusProgress: {
    height: 6,
    backgroundColor: '#f0f0f0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 3,
  },
  card: {
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
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  locationDetails: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 12,
  },
  locationName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  locationAddress: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    lineHeight: 18,
    marginBottom: 10,
  },
  coordsContainer: {
    backgroundColor: '#fff',
    borderRadius: 6,
    padding: 8,
    borderWidth: 1,
    borderColor: '#eee',
  },
  coordsLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#999',
    marginBottom: 4,
  },
  coordsValue: {
    fontSize: 11,
    fontWeight: '600',
    color: '#333',
    fontFamily: 'monospace',
  },
  routeSummary: {
    flexDirection: 'row',
    gap: 12,
  },
  routeItem: {
    flex: 1,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  routeValue: {
    fontSize: 16,
    fontWeight: '800',
    color: PRIMARY_COLOR,
    marginVertical: 6,
  },
  routeLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#999',
    letterSpacing: 0.3,
  },
  qrContainer: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  qrBox: {
    width: '100%',
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginBottom: 8,
    borderWidth: 2,
    borderColor: PRIMARY_COLOR + '30',
  },
  qrLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#999',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  qrCode: {
    fontSize: 12,
    fontWeight: '700',
    color: PRIMARY_COLOR,
    textAlign: 'center',
    fontFamily: 'monospace',
  },
  qrImage: {
    width: 200,
    height: 200,
    marginBottom: 8,
  },
  qrNote: {
    fontSize: 11,
    color: '#999',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  primaryButton: {
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
  primaryButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1a1a1a',
    letterSpacing: 0.5,
  },
  secondaryButton: {
    backgroundColor: '#fff',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    marginBottom: 20,
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#999',
    letterSpacing: 0.5,
  },
  // Status Update Styles
  statusUpdateContainer: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  currentStatusBox: {
    flex: 1,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#eee',
  },
  currentStatusLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#999',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  currentStatusValue: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  updateButton: {
    backgroundColor: PRIMARY_COLOR,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  updateButtonDisabled: {
    backgroundColor: '#ddd',
  },
  updateButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1a1a1a',
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#666',
    marginBottom: 16,
  },
  statusOptionsList: {
    gap: 8,
    marginBottom: 16,
    maxHeight: 400,
  },
  statusOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#f9f9f9',
    borderRadius: 10,
    padding: 12,
  },
  statusOptionIcon: {
    width: 44,
    height: 44,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusOptionInfo: {
    flex: 1,
  },
  statusOptionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 2,
  },
  statusOptionDesc: {
    fontSize: 11,
    color: '#666',
  },
  modalCancelButton: {
    backgroundColor: '#f5f5f5',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  modalCancelButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#666',
  },
});
