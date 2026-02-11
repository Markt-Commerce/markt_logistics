import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function AvailabilityToggleScreen() {
  const router = useRouter();
  const [partner, setPartner] = useState<any>(null);
  const [isOnline, setIsOnline] = useState(false);

  useEffect(() => {
    loadPartnerData();
  }, []);

  const loadPartnerData = async () => {
    try {
      const data = await AsyncStorage.getItem('partner');
      if (data) {
        setPartner(JSON.parse(data));
      }
    } catch (error) {
      console.error('Error loading partner:', error);
    }
  };

  const handleLogout = async () => {
    Alert.alert('Logout', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          await AsyncStorage.clear();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  if (!partner) {
    return (
      <View style={styles.container}>
        <Text>Loading...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.partnerName}>{partner.name}</Text>
        <Text style={styles.rating}>Rating: {partner.rating} ⭐</Text>
        <Text style={styles.vehicleType}>Vehicle: {partner.vehicleType}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.statusLabel}>{isOnline ? '🟢 Online' : '⚫ Offline'}</Text>
        <TouchableOpacity
          style={[styles.statusButton, isOnline && styles.statusButtonActive]}
          onPress={() => setIsOnline(!isOnline)}
        >
          <Text style={styles.statusButtonText}>{isOnline ? 'Go Offline' : 'Go Online'}</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[styles.button, { backgroundColor: '#2E7D32' }]}
        onPress={() => router.push('/(delivery)/nearby-orders')}
      >
        <Text style={styles.buttonText}>View Nearby Orders</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, { backgroundColor: '#D32F2F' }]}
        onPress={handleLogout}
      >
        <Text style={styles.buttonText}>Logout</Text>
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
    marginBottom: 16,
  },
  partnerName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#333',
  },
  rating: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  vehicleType: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  statusLabel: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  statusButton: {
    backgroundColor: '#ccc',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  statusButtonActive: {
    backgroundColor: '#2E7D32',
  },
  statusButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  button: {
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
});
