import { MaterialIcons } from '@expo/vector-icons';
import BottomSheet, { BottomSheetFlatList, BottomSheetTextInput, BottomSheetView } from '@gorhom/bottom-sheet';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Button from '../../components/Button';
import SectionEmpty from '../../components/SectionEmpty';
import EarningsSummary from '../../components/EarningsSummary';
import SectionHeader from '../../components/SectionHeader';
import StatusPill from '../../components/StatusPill';
import { colors, radius, spacing, typography } from '../../components/theme';
import apiService from '../../services/api';
import { Bank, WalletTransaction, Withdrawal } from '../../types';

type WithdrawStep = 'bank' | 'details';

/** What a ledger row means, in the rider's words.
 *
 * The row used to print `description ?? referenceType`, so when the backend
 * sent no description a rider read "delivery_earning" -- a column value. */
const REFERENCE_LABELS: Record<string, string> = {
  delivery_earning: 'Delivery earning',
  DELIVERY_EARNING: 'Delivery earning',
  withdrawal: 'Withdrawal to bank',
  WITHDRAWAL: 'Withdrawal to bank',
  refund: 'Refund',
  REFUND: 'Refund',
  adjustment: 'Adjustment',
  ADJUSTMENT: 'Adjustment',
};

function labelFor(tx: WalletTransaction): string {
  return (
    REFERENCE_LABELS[tx.referenceType] ??
    tx.description ??
    tx.referenceType.replace(/_/g, ' ')
  );
}

/** "Just now", "3h ago", "Yesterday", then the date.
 *
 * toLocaleString() printed the full date and time on every row, which is
 * both long and the least useful form for the rows a rider actually looks
 * at -- the ones from today. */
function whenFor(iso: string | null): string {
  if (!iso) return '';
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return '';

  const minutes = Math.floor((Date.now() - at.getTime()) / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 60 * 24) return `${Math.floor(minutes / 60)}h ago`;
  if (minutes < 60 * 48) return 'Yesterday';
  return at.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

/**
 * Rider payout screen -- balance, withdraw-to-bank, and a combined
 * activity view (wallet ledger + withdrawal request status). Hits the
 * same /wallet/* routes buyers/sellers use (see services/api.ts and
 * REFACTOR_NOTES.md, "No rider payout functionality", 2026-09-17) --
 * nothing rider-specific on the backend beyond which FK a DeliveryUser's
 * wallet row uses.
 */
export default function EarningsScreen() {
  const router = useRouter();
  const [balance, setBalance] = useState<number | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [banks, setBanks] = useState<Bank[]>([]);
  const [banksLoading, setBanksLoading] = useState(false);
  const [withdrawStep, setWithdrawStep] = useState<WithdrawStep>('bank');
  const [selectedBank, setSelectedBank] = useState<Bank | null>(null);
  const [accountNumber, setAccountNumber] = useState('');
  const [resolvedName, setResolvedName] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const sheetRef = useRef<BottomSheet>(null);

  // No synchronous setState before the first await -- `loading` already
  // initializes to true, same pattern as the rest of this app's screens.
  const load = useCallback(async () => {
    try {
      const [walletBalance, txResult, wdResult] = await Promise.all([
        apiService.getWalletBalance().catch((error) => {
          console.error('Error loading wallet balance:', error);
          return null;
        }),
        // A bigger page than the list needs: EarningsSummary derives the
        // week from these rows, so a 20-row default would quietly
        // under-count a busy rider's week.
        apiService.getWalletTransactions(1, 100).catch((error) => {
          console.error('Error loading wallet transactions:', error);
          return { transactions: [] as WalletTransaction[] };
        }),
        apiService.getWithdrawals().catch((error) => {
          console.error('Error loading withdrawals:', error);
          return { withdrawals: [] as Withdrawal[] };
        }),
      ]);
      if (walletBalance) {
        setBalance(walletBalance.availableBalance);
      }
      setTransactions(txResult.transactions);
      setWithdrawals(wdResult.withdrawals);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleRefresh = () => {
    setRefreshing(true);
    load();
  };

  const resetWithdrawForm = () => {
    setWithdrawStep('bank');
    setSelectedBank(null);
    setAccountNumber('');
    setResolvedName(null);
    setAmount('');
  };

  const openWithdraw = async () => {
    resetWithdrawForm();
    sheetRef.current?.snapToIndex(0);
    if (banks.length === 0) {
      setBanksLoading(true);
      try {
        setBanks(await apiService.getBanks());
      } catch (error) {
        console.error('Error loading banks:', error);
      } finally {
        setBanksLoading(false);
      }
    }
  };

  const closeWithdraw = () => {
    sheetRef.current?.close();
    resetWithdrawForm();
  };

  const pickBank = (bank: Bank) => {
    setSelectedBank(bank);
    setResolvedName(null);
    setWithdrawStep('details');
  };

  const handleVerify = async () => {
    if (!selectedBank || accountNumber.length < 10) return;
    setVerifying(true);
    setResolvedName(null);
    try {
      const resolved = await apiService.resolveBankAccount(accountNumber, selectedBank.code);
      if (resolved.resolved && resolved.accountName) {
        setResolvedName(resolved.accountName);
      }
    } catch (error) {
      console.error('Error resolving account:', error);
    } finally {
      setVerifying(false);
    }
  };

  const handleWithdraw = async () => {
    if (!selectedBank || !resolvedName) return;
    const numericAmount = Number(amount);
    if (!numericAmount || numericAmount <= 0) return;
    setSubmitting(true);
    try {
      await apiService.requestWithdrawal({
        amount: numericAmount,
        bankCode: selectedBank.code,
        accountNumber,
        accountName: resolvedName,
      });
      closeWithdraw();
      load();
    } catch (error) {
      console.error('Error requesting withdrawal:', error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* The balance carried in a brand-filled header rather than a card on
          a white page -- the same shape the shopper wallet uses, so the two
          apps read as one product. */}
      <View style={styles.hero}>
        <View style={styles.heroBar}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <MaterialIcons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.heroTitle}>Earnings</Text>
          <View style={{ width: 36 }} />
        </View>

        <Text style={styles.heroLabel}>Available to withdraw</Text>
        {loading ? (
          <ActivityIndicator color="#fff" style={{ marginVertical: 10 }} />
        ) : (
          <Text style={styles.heroValue}>
            ₦{(balance ?? 0).toLocaleString()}
          </Text>
        )}

        <Button
          label="Withdraw to bank"
          onPress={openWithdraw}
          disabled={!balance}
          variant="secondary"
          style={styles.heroButton}
          icon={
            <MaterialIcons
              name="account-balance"
              size={18}
              color={colors.textPrimary}
            />
          }
        />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
      >
        <EarningsSummary transactions={transactions} />

        <View style={styles.section}>
          <SectionHeader title="Withdrawal requests" />
          {withdrawals.length === 0 && !loading && (
            <SectionEmpty icon="account-balance" title="No withdrawals yet." />
          )}
          {withdrawals.map((w) => (
            <View key={w.id} style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>₦{w.amount.toLocaleString()}</Text>
                <Text style={styles.rowMeta}>
                  {w.accountName ?? 'Bank transfer'}
                  {w.accountNumber ? ` · ${w.accountNumber}` : ''}
                </Text>
              </View>
              <StatusPill status={w.status} />
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <SectionHeader title="Wallet activity" />
          {transactions.length === 0 && !loading && (
            <SectionEmpty icon="receipt-long" title="Earnings from completed deliveries will show up here." />
          )}
          {transactions.map((t) => {
            const credit = t.type === 'credit';
            return (
              <View key={t.id} style={styles.row}>
                <View
                  style={[
                    styles.txIcon,
                    credit ? styles.txIconCredit : styles.txIconDebit,
                  ]}
                >
                  <MaterialIcons
                    name={credit ? 'arrow-downward' : 'arrow-upward'}
                    size={16}
                    color={credit ? colors.success : colors.textSecondary}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {labelFor(t)}
                  </Text>
                  <Text style={styles.rowMeta}>{whenFor(t.createdAt)}</Text>
                </View>
                <Text
                  style={[
                    styles.txAmount,
                    credit ? styles.txCredit : styles.txDebit,
                  ]}
                >
                  {credit ? '+' : '-'}₦{t.amount.toLocaleString()}
                </Text>
              </View>
            );
          })}
        </View>
      </ScrollView>

      <BottomSheet
        ref={sheetRef}
        index={-1}
        snapPoints={['62%']}
        enableDynamicSizing={false}
        enablePanDownToClose
        onClose={resetWithdrawForm}
      >
        {withdrawStep === 'bank' ? (
          <BottomSheetView style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Choose your bank</Text>
            {banksLoading ? (
              <ActivityIndicator color={colors.primary} style={{ marginTop: 20 }} />
            ) : (
              <BottomSheetFlatList
                data={banks}
                keyExtractor={(item) => item.code}
                contentContainerStyle={{ paddingBottom: 20 }}
                renderItem={({ item }) => (
                  <TouchableOpacity style={styles.bankRow} onPress={() => pickBank(item)}>
                    <Text style={styles.bankName}>{item.name}</Text>
                    <MaterialIcons name="chevron-right" size={20} color={colors.textMuted} />
                  </TouchableOpacity>
                )}
              />
            )}
          </BottomSheetView>
        ) : (
          <BottomSheetView style={styles.sheetHeader}>
            <TouchableOpacity onPress={() => setWithdrawStep('bank')} style={styles.backRow}>
              <MaterialIcons name="arrow-back" size={18} color={colors.textSecondary} />
              <Text style={styles.backText}>{selectedBank?.name}</Text>
            </TouchableOpacity>

            <Text style={styles.inputLabel}>Account number</Text>
            <BottomSheetTextInput
              style={styles.input}
              value={accountNumber}
              onChangeText={(text) => {
                setAccountNumber(text);
                setResolvedName(null);
              }}
              keyboardType="number-pad"
              maxLength={10}
              placeholder="0123456789"
            />
            <Button
              label={verifying ? 'Verifying...' : 'Verify account'}
              onPress={handleVerify}
              disabled={accountNumber.length < 10 || verifying}
              loading={verifying}
              variant="outline"
              style={{ marginTop: 10 }}
            />
            {resolvedName && (
              <View style={styles.resolvedRow}>
                <MaterialIcons name="check-circle" size={16} color={colors.success} />
                <Text style={styles.resolvedText}>{resolvedName}</Text>
              </View>
            )}

            <Text style={[styles.inputLabel, { marginTop: 18 }]}>Amount</Text>
            <BottomSheetTextInput
              style={styles.input}
              value={amount}
              onChangeText={setAmount}
              keyboardType="number-pad"
              placeholder="₦"
            />

            <Button
              label="Confirm withdrawal"
              onPress={handleWithdraw}
              loading={submitting}
              disabled={!resolvedName || !amount || submitting}
              style={{ marginTop: 20 }}
            />
          </BottomSheetView>
        )}
      </BottomSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  hero: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.screenX,
    paddingBottom: spacing.md,
  },
  heroBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 48,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: { ...typography.subtitle, color: '#fff' },
  heroLabel: {
    ...typography.caption,
    color: 'rgba(255,255,255,0.8)',
    marginTop: spacing.md,
  },
  heroValue: {
    ...typography.title,
    fontSize: 38,
    color: '#fff',
    marginTop: 4,
  },
  heroButton: { alignSelf: 'stretch', marginTop: spacing.md },

  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: spacing.section,
    paddingBottom: 40,
  },
  section: { marginBottom: 32 },

  txIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txIconCredit: { backgroundColor: '#E7F6EC' },
  txIconDebit: { backgroundColor: colors.surface },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  rowTitle: { ...typography.bodyBold, color: colors.textPrimary },
  rowMeta: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  txAmount: { ...typography.bodyBold },
  txCredit: { color: colors.success },
  txDebit: { color: colors.textPrimary },
  sheetHeader: { flex: 1, paddingHorizontal: 20, paddingTop: 8 },
  sheetTitle: { ...typography.subtitle, color: colors.textPrimary, marginBottom: 12 },
  bankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  bankName: { ...typography.body, color: colors.textPrimary },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 18 },
  backText: { ...typography.bodyBold, color: colors.textPrimary },
  inputLabel: { ...typography.label, color: colors.textMuted, marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius,
    paddingHorizontal: 14,
    height: 48,
    ...typography.body,
    color: colors.textPrimary,
  },
  resolvedRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  resolvedText: { ...typography.bodyBold, color: colors.textPrimary },
});
