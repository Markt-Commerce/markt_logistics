import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import apiService from '../../services/api';

export default function DeliveryStatusControlsScreen() {
  const router = useRouter();
  const [assignment, setAssignment] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadAssignment();
  }, []);

  const loadAssignment = async () => {
    try {
      const data = await apiService.getActiveAssignment();
      setAssignment(data);
    } catch (error) {
      console.error('Error loading assignment:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateStatus = async (newStatus: string) => {
    try {
      if (assignment) {
        await apiService.updateAssignmentStatus(assignment.id, newStatus);
        if (newStatus === 'delivered') {
          Alert.alert('Success', 'Delivery confirmed! Proceed to QR confirmation?', [
            { text: 'Skip', onPress: () => router.replace('/(delivery)/availability-toggle') },
            {
              text: 'Scan QR',
              onPress: () => router.push('/(delivery)/qr-code'),
            },
          ]);
        } else {
          loadAssignment();
        }
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to update status');
    }
  };

  if (isLoading || !assignment) {
    return (
      <View style={styles.container}>
        <Text>Loading...</Text>
      </View>
    );
  }

  const statuses = ['picked_up', 'in_transit', 'arrived', 'delivered'];
  const currentIndex = statuses.indexOf(assignment.status);

  return (
    <ScrollView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Delivery Status</Text>
        <Text style={styles.currentStatus}>Current: {assignment.status}</Text>
      </View>

      <View style={styles.progressCard}>
        {statuses.map((status, index) => (
          <View key={status} style={styles.progressItem}>
            <View
              style={[
                styles.progressDot,
                index <= currentIndex && styles.progressDotActive,
              ]}
            >
              <Text style={styles.progressDotText}>{index + 1}</Text>
            </View>
            <Text style={styles.progressLabel}>{status.replace('_', ' ')}</Text>
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Next Actions</Text>
        {currentIndex < statuses.length - 1 && (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleUpdateStatus(statuses[currentIndex + 1])}
          >
            <Text style={styles.actionButtonText}>
              Move to {statuses[currentIndex + 1].replace('_', ' ')}
            </Text>
          </TouchableOpacity>
        )}
        {currentIndex === statuses.length - 1 && (
          <Text style={styles.completedText}>✓ Delivery Completed</Text>
        )}
      </View>

      <TouchableOpacity
        style={styles.cancelButton}
        onPress={() => router.back()}
      >
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
  currentStatus: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  progressCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  progressItem: {
    alignItems: 'center',
  },
  progressDot: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#eee',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressDotActive: {
    backgroundColor: '#e26136',
  },
  progressDotText: {
    color: '#999',
    fontWeight: '600',
  },
  progressLabel: {
    fontSize: 10,
    color: '#666',
    textAlign: 'center',
  },
  actionButton: {
    backgroundColor: '#e26136',
    paddingVertical: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  completedText: {
    fontSize: 14,
    color: '#e26136',
    fontWeight: '700',
    textAlign: 'center',
    paddingVertical: 12,
  },
  cancelButton: {
    backgroundColor: '#f5f5f5',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    marginBottom: 20,
  },
  cancelButtonText: {
    color: '#333',
    fontWeight: '600',
    fontSize: 15,
  },
});
