import { MaterialIcons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import apiService from '../../services/api';

const PRIMARY_COLOR = '#e26136';
const BG_LIGHT = '#f6f8f7';

/**
 * 10.6 POD handshake, rider side: scan the code the buyer's app displays
 * (markt_mobile's app/orders/pod/[id].tsx), or fall back to typing it in
 * if scanning isn't practical (poor lighting, buyer showing the plain
 * text instead of the QR). Either way calls the same
 * POST /runs/{runId}/orders/{orderId}/pod-confirm.
 */
export default function PodScanScreen() {
  const router = useRouter();
  const { runId, orderId } = useLocalSearchParams<{ runId: string; orderId: string }>();
  const [permission, requestPermission] = useCameraPermissions();
  const [manualMode, setManualMode] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [scanned, setScanned] = useState(false);

  const confirm = async (code: string) => {
    if (!runId || !orderId || !code || submitting) return;
    setSubmitting(true);
    try {
      const result = await apiService.confirmRunOrderPod(runId, orderId, code.trim());
      Alert.alert(
        'Delivered',
        result.run_completed
          ? 'Order confirmed. That was the last one -- run complete!'
          : 'Order confirmed as delivered.',
        [{ text: 'OK', onPress: () => router.replace({ pathname: '/(delivery)/run-details', params: { runId } } as any) }]
      );
    } catch (error) {
      Alert.alert('Could not confirm', 'That code was rejected. Please try again.');
      setScanned(false);
      setSubmitting(false);
    }
  };

  const handleBarcodeScanned = ({ data }: { data: string }) => {
    if (scanned || submitting) return;
    setScanned(true);
    confirm(data);
  };

  if (manualMode) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setManualMode(false)} style={styles.backButton}>
            <MaterialIcons name="arrow-back" size={22} color="#1a1a1a" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Enter code</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.manualContainer}>
          <Text style={styles.manualLabel}>Ask the buyer to read out their delivery code</Text>
          <TextInput
            style={styles.manualInput}
            value={manualCode}
            onChangeText={setManualCode}
            placeholder="Delivery code"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity
            style={[styles.confirmButton, (!manualCode || submitting) && styles.confirmButtonDisabled]}
            disabled={!manualCode || submitting}
            onPress={() => confirm(manualCode)}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.confirmButtonText}>Confirm delivery</Text>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (!permission) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator color={PRIMARY_COLOR} style={{ flex: 1 }} />
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.permissionContainer}>
          <MaterialIcons name="qr-code-scanner" size={48} color={PRIMARY_COLOR} />
          <Text style={styles.permissionTitle}>Camera access needed</Text>
          <Text style={styles.permissionText}>
            To scan a buyer's delivery code, Markt Logistics needs camera access.
          </Text>
          <TouchableOpacity style={styles.confirmButton} onPress={requestPermission}>
            <Text style={styles.confirmButtonText}>Grant access</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.manualLink} onPress={() => setManualMode(true)}>
            <Text style={styles.manualLinkText}>Enter code manually instead</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={handleBarcodeScanned}
      />
      <SafeAreaView style={styles.overlay} edges={['top', 'bottom']}>
        <View style={styles.overlayHeader}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButtonLight}>
            <MaterialIcons name="close" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.overlayTitle}>Scan buyer's code</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.scanFrame} />

        {submitting && (
          <View style={styles.overlayLoading}>
            <ActivityIndicator color="#fff" size="large" />
          </View>
        )}

        <TouchableOpacity style={styles.manualLinkOverlay} onPress={() => setManualMode(true)}>
          <Text style={styles.manualLinkOverlayText}>Enter code manually instead</Text>
        </TouchableOpacity>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: BG_LIGHT,
  },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#1a1a1a' },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonLight: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlay: { flex: 1, justifyContent: 'space-between' },
  overlayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  overlayTitle: { fontSize: 15, fontWeight: '700', color: '#fff' },
  scanFrame: {
    alignSelf: 'center',
    width: 240,
    height: 240,
    borderRadius: 16,
    borderWidth: 3,
    borderColor: PRIMARY_COLOR,
  },
  overlayLoading: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  manualLinkOverlay: { alignSelf: 'center', marginBottom: 24, padding: 12 },
  manualLinkOverlayText: { color: '#fff', fontSize: 13, fontWeight: '700', textDecorationLine: 'underline' },
  manualContainer: { flex: 1, padding: 20, backgroundColor: BG_LIGHT },
  manualLabel: { fontSize: 14, color: '#666', marginBottom: 16 },
  manualInput: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    marginBottom: 20,
  },
  confirmButton: {
    backgroundColor: PRIMARY_COLOR,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  confirmButtonDisabled: { opacity: 0.5 },
  confirmButtonText: { color: '#fff', fontSize: 14, fontWeight: '700', letterSpacing: 0.5 },
  manualLink: { marginTop: 16, alignItems: 'center' },
  manualLinkText: { color: PRIMARY_COLOR, fontSize: 13, fontWeight: '700' },
  permissionContainer: { flex: 1, padding: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: BG_LIGHT },
  permissionTitle: { fontSize: 18, fontWeight: '800', color: '#1a1a1a', marginTop: 16, marginBottom: 8 },
  permissionText: { fontSize: 13, color: '#666', textAlign: 'center', marginBottom: 24 },
});
