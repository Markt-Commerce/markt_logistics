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
import Button from '../../components/Button';
import { colors, radius, typography } from '../../components/theme';
import apiService from '../../services/api';


/**
 * 10.6 POD handshake, rider side: scan the code the buyer's app displays
 * (markt_mobile's app/orders/pod/[id].tsx), or fall back to typing it in
 * if scanning isn't practical (poor lighting, buyer showing the plain
 * text instead of the QR). Shared by both delivery models -- `mode`
 * selects which backend confirm call to make, since their responses
 * aren't symmetric: confirmRunOrderPod() returns {run_completed} (used
 * for the run-complete vs order-confirmed messaging below);
 * confirmDelivery() (single-order) returns void, so order-mode always
 * shows the same simple message and returns to the dashboard rather than
 * back to active-delivery.tsx -- a confirmed assignment drops out of
 * getActiveAssignments(), so re-opening it there would 404.
 */
export default function PodScanScreen() {
  const router = useRouter();
  const { mode, runId, assignmentId, orderId } = useLocalSearchParams<{
    mode?: 'run' | 'order';
    runId?: string;
    assignmentId?: string;
    orderId: string;
  }>();
  const isOrderMode = mode === 'order';
  const [permission, requestPermission] = useCameraPermissions();
  const [manualMode, setManualMode] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [scanned, setScanned] = useState(false);

  const confirm = async (code: string) => {
    if (!orderId || !code || submitting) return;
    if (isOrderMode ? !assignmentId : !runId) return;
    setSubmitting(true);
    try {
      if (isOrderMode) {
        await apiService.confirmDelivery(orderId, code.trim());
        Alert.alert('Delivered', 'Delivery confirmed.', [
          { text: 'OK', onPress: () => router.replace('/(delivery)/availability-toggle') },
        ]);
      } else {
        const result = await apiService.confirmRunOrderPod(runId!, orderId, code.trim());
        Alert.alert(
          'Delivered',
          result.run_completed
            ? 'Order confirmed. That was the last one -- run complete!'
            : 'Order confirmed as delivered.',
          [
            {
              text: 'OK',
              onPress: () =>
                router.replace({ pathname: '/(delivery)/active-delivery', params: { kind: 'run', id: runId! } }),
            },
          ]
        );
      }
    } catch (error) {
      console.error('Error confirming delivery:', error);
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
            <MaterialIcons name="arrow-back" size={22} color={colors.textPrimary} />
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
          <Button
            label="Confirm delivery"
            onPress={() => confirm(manualCode)}
            loading={submitting}
            disabled={!manualCode.trim()}
          />
        </View>
      </SafeAreaView>
    );
  }

  if (!permission) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator color={colors.primary} style={{ flex: 1 }} />
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.permissionContainer}>
          <MaterialIcons name="qr-code-scanner" size={48} color={colors.primary} />
          <Text style={styles.permissionTitle}>Camera access needed</Text>
          <Text style={styles.permissionText}>
            To scan a buyer&apos;s delivery code, Markt Logistics needs camera access.
          </Text>
          <Button
            label="Grant access"
            onPress={requestPermission}
            style={styles.permissionButton}
          />
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
          <Text style={styles.overlayTitle}>Scan buyer&apos;s code</Text>
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
    backgroundColor: colors.background,
  },
  headerTitle: { ...typography.subtitle, color: colors.textPrimary },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
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
    borderColor: colors.primary,
  },
  overlayLoading: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  manualLinkOverlay: { alignSelf: 'center', marginBottom: 24, padding: 12 },
  manualLinkOverlayText: { color: '#fff', fontSize: 13, fontWeight: '700', textDecorationLine: 'underline' },
  manualContainer: { flex: 1, padding: 20, backgroundColor: colors.background },
  manualLabel: { ...typography.secondary, color: colors.textSecondary, marginBottom: 16 },
  manualInput: {
    backgroundColor: colors.surface,
    borderRadius: radius,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.textPrimary,
    marginBottom: 20,
  },
  permissionButton: { alignSelf: 'stretch' },
  manualLink: { marginTop: 16, alignItems: 'center' },
  manualLinkText: { ...typography.caption, fontWeight: '700', color: colors.primary },
  permissionContainer: { flex: 1, padding: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  permissionTitle: { ...typography.title, color: colors.textPrimary, marginTop: 16, marginBottom: 8 },
  permissionText: {
    ...typography.secondary,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
});
