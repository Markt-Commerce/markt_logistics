import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useLocation } from '../contexts/LocationContext';

const AvailabilityToggleScreen: React.FC = () => {
  const [isOnline, setIsOnline] = useState(false);
  const navigation = useNavigation();
  const { startTracking, stopTracking } = useLocation();

  const handleToggle = () => {
    if (isOnline) {
      setIsOnline(false);
      stopTracking();
    } else {
      setIsOnline(true);
      startTracking();
      navigation.navigate('NearbyOrders');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Availability Toggle</Text>
      <Text>Status: {isOnline ? 'Online' : 'Offline'}</Text>
      <TouchableOpacity style={[styles.button, isOnline ? styles.offlineButton : styles.onlineButton]} onPress={handleToggle}>
        <Text style={styles.buttonText}>{isOnline ? 'Go Offline' : 'Go Online'}</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  button: {
    padding: 15,
    borderRadius: 5,
    alignItems: 'center',
    width: '80%',
  },
  onlineButton: {
    backgroundColor: '#28a745',
  },
  offlineButton: {
    backgroundColor: '#dc3545',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
  },
});

export default AvailabilityToggleScreen;
