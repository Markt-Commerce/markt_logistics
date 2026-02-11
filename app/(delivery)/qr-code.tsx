import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import apiService from '../../services/api';

export default function QRCodeScreen() {
  const router = useRouter();
  const [assignment, setAssignment] = useState<any>(null);
  const [qrToken, setQrToken] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadQRData();
  }, []);

  const loadQRData = async () => {
    try {
      const data = await apiService.getActiveAssignment();
      setAssignment(data);
      if (data && data.orderId) {
        const token = await apiService.generateQRToken(data.orderId);
        setQrToken(token);
      }
    } catch (error) {
      console.error('Error loading QR data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmDelivery = async () => {
    try {
      if (assignment && assignment.orderId) {
        await apiService.confirmDelivery(assignment.orderId);
        Alert.alert('Success', 'Delivery confirmed!', [
          {
            text: 'Return to Home',
            onPress: () => router.replace('/(delivery)/availability-toggle'),
          },
        ]);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to confirm delivery');
    }
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Text>Loading QR Code...</Text>
      </View>
    );
  }

  if (!qrToken) {
    return (
      <View style={styles.container}>
        <Text style={styles.emptyText}>No QR Code available</Text>
        <TouchableOpacity
          style={styles.button}
          onPress={() => router.replace('/(delivery)/availability-toggle')}
        >
          <Text style={styles.buttonText}>Back to Home</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Confirm Delivery</Text>
      </View>

      <View style={styles.qrContainer}>
        <View style={styles.qrBox}>
          <Text style={styles.qrLabel}>QR Token</Text>
          <Text style={styles.qrCode}>{qrToken}</Text>
        </View>
        <Text style={styles.qrNote}>(In a real app, this would be a scannable QR code)</Text>
      </View>

      {assignment && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Delivery Details</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Order ID:</Text>
            <Text style={styles.value}>{assignment.orderId?.substring(0, 8)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Recipient:</Text>
            <Text style={styles.value}>{assignment.recipientName || 'N/A'}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Status:</Text>
            <Text style={styles.value}>{assignment.status}</Text>
          </View>
        </View>
      )}

      <TouchableOpacity style={styles.confirmButton} onPress={handleConfirmDelivery}>
        <Text style={styles.confirmButtonText}>✓ Confirm Delivery</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.cancelButton} onPress={() => router.back()}>
        <Text style={styles.cancelButtonText}>Cancel</Text>
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
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  qrContainer: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 32,
    alignItems: 'center',
    marginBottom: 12,
  },
  qrBox: {
    width: 240,
    height: 240,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#ddd',
  },
  qrLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  qrCode: {
    fontSize: 13,
    fontWeight: '700',
    color: '#333',
    textAlign: 'center',
  },
  qrNote: {
    fontSize: 11,
    color: '#999',
    fontStyle: 'italic',
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
  confirmButton: {
    backgroundColor: '#e26136',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  confirmButtonText: {
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
    marginBottom: 20,
  },
  cancelButtonText: {
    color: '#333',
    fontWeight: '600',
    fontSize: 15,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#e26136',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
});
