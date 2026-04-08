import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import apiService from '../../services/api';

const PRIMARY_COLOR = '#e26136';
const BG_LIGHT = '#f6f8f7';

export default function AvailabilityToggleScreen() {
  const router = useRouter();
  const [partner, setPartner] = useState<any>(null);
  const [isOnline, setIsOnline] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    loadPartnerData();
  }, []);

  const loadPartnerData = async () => {
    try {
      const partnerData = await AsyncStorage.getItem('partner');
      const sessionToken = await AsyncStorage.getItem('sessionToken');
      
      if (partnerData) {
        const parsedPartner = JSON.parse(partnerData);
        setPartner(parsedPartner);
        setIsOnline(parsedPartner.status === 'ONLINE');
      }
      
      if (sessionToken) {
        apiService.setSessionToken(sessionToken);
      }
    } catch (error) {
      console.error('Error loading partner:', error);
    }
  };

  const handleStatusToggle = async () => {
    const newStatus = isOnline ? 'OFFLINE' : 'ONLINE';
    setIsUpdating(true);
    
    try {
      await apiService.updatePartnerStatus(newStatus);
      setIsOnline(!isOnline);
      
      // Update partner data in storage
      const updatedPartner = { ...partner, status: newStatus };
      await AsyncStorage.setItem('partner', JSON.stringify(updatedPartner));
      setPartner(updatedPartner);
      
      Alert.alert('Success', `You are now ${newStatus}`);
    } catch (error) {
      Alert.alert('Error', 'Failed to update status. Please try again.');
      console.error('Status update error:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleLogout = async () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
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
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.avatar}>
              <MaterialIcons name="account-circle" size={48} color={PRIMARY_COLOR} />
            </View>
            <View>
              <Text style={styles.greeting}>Welcome back,</Text>
              <Text style={styles.partnerName}>{partner.name}</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.iconButton} onPress={() => Alert.alert('Notifications')}>
            <MaterialIcons name="notifications" size={24} color="#333" />
          </TouchableOpacity>
        </View>

        {/* Rating & Vehicle Pill */}
        <View style={styles.pillContainer}>
          <View style={styles.pill}>
            <MaterialIcons name="star" size={14} color={PRIMARY_COLOR} />
            <Text style={styles.pillText}>{partner.rating}</Text>
          </View>
          <View style={[styles.pill, styles.pillSecondary]}>
            <MaterialIcons name="electric-bolt" size={14} color={PRIMARY_COLOR} />
            <Text style={styles.pillText}>{partner.vehicleType}</Text>
          </View>
        </View>

        {/* Main Status Card */}
        <View style={[styles.statusCard, isOnline && styles.statusCardActive]}>
          <View style={styles.statusContent}>
            <View style={styles.statusDot}>
              <View style={[styles.dot, isOnline && styles.dotActive]} />
            </View>
            <View style={styles.statusTextContainer}>
              <Text style={styles.statusTitle}>{isOnline ? "YOU'RE ONLINE" : 'YOU ARE OFFLINE'}</Text>
              <Text style={styles.statusSubtitle}>
                {isOnline ? 'Actively scanning for nearby orders' : 'Go online to start receiving requests'}
              </Text>
            </View>
            {isOnline && (
              <View style={styles.boostBadge}>
                <MaterialIcons name="bolt" size={12} color={PRIMARY_COLOR} />
                <Text style={styles.boostText}>1.5x</Text>
              </View>
            )}
          </View>

          {isOnline && (
            <View style={styles.scanLine}>
              <View style={styles.scanProgress} />
            </View>
          )}
        </View>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <View style={styles.statIcon}>
              <MaterialIcons name="payments" size={20} color={PRIMARY_COLOR} />
            </View>
            <Text style={styles.statLabel}>Earnings</Text>
            <Text style={styles.statValue}>$0.00</Text>
          </View>

          <View style={styles.statCard}>
            <View style={styles.statIcon}>
              <MaterialIcons name="shopping-cart" size={20} color={PRIMARY_COLOR} />
            </View>
            <Text style={styles.statLabel}>Deliveries</Text>
            <Text style={styles.statValue}>0</Text>
          </View>
        </View>

        {/* Insight Card */}
        <View style={styles.insightCard}>
          <View style={styles.insightIcon}>
            <MaterialIcons name="tips-and-updates" size={20} color={PRIMARY_COLOR} />
          </View>
          <View style={styles.insightContent}>
            <Text style={styles.insightTitle}>Peak Hours Starting</Text>
            <Text style={styles.insightText}>Lunch rush expected to start in 20 mins. Higher demand means 1.5x earnings!</Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.mainButton, isOnline && styles.mainButtonOffline]}
            onPress={handleStatusToggle}
            disabled={isUpdating}
          >
            {isUpdating ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <MaterialIcons name="power-settings-new" size={20} color="#fff" />
                <Text style={styles.mainButtonText}>{isOnline ? 'GO OFFLINE' : 'GO ONLINE'}</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => router.push('/(delivery)/nearby-orders')}
            disabled={isUpdating}
          >
            <MaterialIcons name="explore" size={18} color="#fff" />
            <Text style={styles.secondaryButtonText}>VIEW NEARBY ORDERS</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => router.push('/(delivery)/current-assignments')}
            disabled={isUpdating}
          >
            <MaterialIcons name="assignment" size={18} color="#fff" />
            <Text style={styles.secondaryButtonText}>VIEW CURRENT ASSIGNMENTS</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.secondaryButton, styles.logoutButton]}
            onPress={handleLogout}
            disabled={isUpdating}
          >
            <MaterialIcons name="logout" size={18} color="#fff" />
            <Text style={styles.secondaryButtonText}>LOGOUT</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG_LIGHT,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  loadingText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    color: '#666',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  greeting: {
    fontSize: 12,
    color: '#999',
    fontWeight: '500',
  },
  partnerName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  iconButton: {
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
  pillContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: PRIMARY_COLOR + '20',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  pillSecondary: {
    backgroundColor: PRIMARY_COLOR + '10',
  },
  pillText: {
    fontSize: 12,
    fontWeight: '700',
    color: PRIMARY_COLOR,
  },
  statusCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  statusCardActive: {
    borderWidth: 1,
    borderColor: PRIMARY_COLOR + '30',
  },
  statusContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statusDot: {
    position: 'relative',
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#ccc',
  },
  dotActive: {
    backgroundColor: PRIMARY_COLOR,
  },
  statusTextContainer: {
    flex: 1,
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1a1a1a',
    letterSpacing: 0.5,
  },
  statusSubtitle: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  boostBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: PRIMARY_COLOR + '10',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
  },
  boostText: {
    fontSize: 11,
    fontWeight: '700',
    color: PRIMARY_COLOR,
  },
  scanLine: {
    height: 4,
    backgroundColor: '#f0f0f0',
    borderRadius: 2,
    marginTop: 16,
    overflow: 'hidden',
  },
  scanProgress: {
    width: '33%',
    height: '100%',
    backgroundColor: PRIMARY_COLOR,
    borderRadius: 2,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  statIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: PRIMARY_COLOR + '10',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statLabel: {
    fontSize: 11,
    color: '#999',
    fontWeight: '600',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1a1a1a',
  },
  insightCard: {
    backgroundColor: PRIMARY_COLOR + '08',
    borderWidth: 1,
    borderColor: PRIMARY_COLOR + '20',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    gap: 12,
    marginBottom: 28,
  },
  insightIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: PRIMARY_COLOR + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  insightContent: {
    flex: 1,
  },
  insightTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  insightText: {
    fontSize: 12,
    color: '#666',
    lineHeight: 16,
  },
  actionButtons: {
    gap: 12,
    paddingBottom: 20,
  },
  mainButton: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  mainButtonOffline: {
    backgroundColor: PRIMARY_COLOR,
  },
  mainButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  secondaryButton: {
    backgroundColor: PRIMARY_COLOR,
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    shadowColor: PRIMARY_COLOR,
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  secondaryButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  logoutButton: {
    backgroundColor: '#D32F2F',
    shadowColor: '#D32F2F',
  },
});
