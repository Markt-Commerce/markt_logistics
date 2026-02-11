import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import apiService from '../../services/api';

export default function ActiveDeliveryMapScreen() {
  const router = useRouter();
  const [assignment, setAssignment] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadActiveAssignment();
  }, []);

  const loadActiveAssignment = async () => {
    try {
      setIsLoading(true);
      const data = await apiService.getActiveAssignment();
      setAssignment(data);
    } catch (error) {
      console.error('Error loading assignment:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Text>Loading...</Text>
      </View>
    );
  }

  if (!assignment) {
    return (
      <View style={styles.container}>
        <Text style={styles.emptyText}>No active delivery</Text>
        <TouchableOpacity
          style={styles.button}
          onPress={() => router.push('/(delivery)/availability-toggle')}
        >
          <Text style={styles.buttonText}>Back to Home</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.mapPlaceholder}>
        <Text style={styles.mapText}>📍 Map View</Text>
        <Text style={styles.mapSubtext}>(Live map would render here)</Text>
      </View>

      <View style={styles.detailsCard}>
        <Text style={styles.status}>Current: {assignment.status}</Text>
        <Text style={styles.address}>To: {assignment.deliveryLocation.address}</Text>
        <Text style={styles.distance}>Distance: {assignment.distance} km</Text>
      </View>

      <TouchableOpacity
        style={styles.button}
        onPress={() => router.push('/(delivery)/delivery-status-controls')}
      >
        <Text style={styles.buttonText}>Update Delivery Status</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 16,
  },
  mapPlaceholder: {
    flex: 1,
    backgroundColor: '#e8f5e9',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  mapText: {
    fontSize: 24,
    fontWeight: '700',
  },
  mapSubtext: {
    fontSize: 12,
    color: '#666',
    marginTop: 8,
  },
  detailsCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  status: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  address: {
    fontSize: 13,
    color: '#333',
    marginBottom: 4,
  },
  distance: {
    fontSize: 13,
    color: '#666',
  },
  button: {
    backgroundColor: '#2E7D32',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
  },
});
