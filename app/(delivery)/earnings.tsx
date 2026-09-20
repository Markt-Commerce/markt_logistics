import { MaterialIcons } from '@expo/vector-icons';
import BottomSheet, { BottomSheetScrollView, BottomSheetTextInput, BottomSheetView } from '@gorhom/bottom-sheet';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Button from '../../components/Button';
import SectionEmpty from '../../components/SectionEmpty';
import EarningsSummary from '../../components/EarningsSummary';
import StatusPill from '../../components/StatusPill';
import { colors, radius, shadow, spacing, tones, typography } from '../../components/theme';
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
  const [bankQuery, setBankQuery] = useState('');
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
  const canWithdraw = (balance ?? 0) > 0;
  const [walletTab, setWalletTab] = useState<'activity' | 'withdrawals'>('activity');

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
    // Otherwise reopening the sheet shows last time's search still
    // applied, over a list that looks like it is missing most banks.
    setBankQuery('');
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

  /** Paystack returns 284 banks, alphabetically, so the list opens on
   *  "5TT MFB" and the rider scrolls past two hundred microfinance banks
   *  to reach the one they use. Matching anywhere in the name rather
   *  than only at the start, because "GTBank" is how people look for
   *  "Guaranty Trust Bank". */
  const visibleBanks = useMemo(() => {
    const query = bankQuery.trim().toLowerCase();
    if (!query) return banks;
    return banks.filter((bank) => bank.name.toLowerCase().includes(query));
  }, [banks, bankQuery]);

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

        {/* Centred, and the balance is the thing -- same shape as the
            shopper wallet, so the two apps read as one product. The
            withdraw action was a full-width grey slab when there was
            nothing to withdraw, which is most of the time for a new rider
            and made the whole screen look broken. */}
        <View style={styles.heroBody}>
          <Text style={styles.heroLabel}>Available to withdraw</Text>
          {loading ? (
            <ActivityIndicator color="#fff" style={{ marginVertical: 12 }} />
          ) : (
            <Text style={styles.heroValue} numberOfLines={1} adjustsFontSizeToFit>
              ₦{(balance ?? 0).toLocaleString()}
            </Text>
          )}

          <TouchableOpacity
            style={[styles.heroAction, !canWithdraw && styles.heroActionOff]}
            onPress={openWithdraw}
            disabled={!canWithdraw}
            accessibilityRole="button"
            accessibilityState={{ disabled: !canWithdraw }}
          >
            <MaterialIcons
              name="account-balance"
              size={17}
              color={canWithdraw ? colors.primary : 'rgba(255,255,255,0.75)'}
            />
            <Text
              style={[
                styles.heroActionText,
                !canWithdraw && styles.heroActionTextOff,
              ]}
            >
              Withdraw to bank
            </Text>
          </TouchableOpacity>

          {!canWithdraw && !loading && (
            <Text style={styles.heroHint}>
              Money lands here as soon as a delivery is confirmed.
            </Text>
          )}
        </View>
      </View>

      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
      >
        <EarningsSummary transactions={transactions} />

        {/* Two tabs, not two stacked lists. Withdrawals and activity are
            alternative views of the same money, and stacked they meant
            scrolling past one empty section to reach another. */}
        <View style={styles.segment}>
          {(['activity', 'withdrawals'] as const).map((key) => {
            const active = walletTab === key;
            const count = key === 'activity' ? transactions.length : withdrawals.length;
            return (
              <TouchableOpacity
                key={key}
                style={[styles.segmentTab, active && styles.segmentTabOn]}
                onPress={() => setWalletTab(key)}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
              >
                <Text style={[styles.segmentText, active && styles.segmentTextOn]}>
                  {key === 'activity' ? 'Activity' : 'Withdrawals'}
                </Text>
                <View style={[styles.segmentCount, active && styles.segmentCountOn]}>
                  <Text
                    style={[
                      styles.segmentCountText,
                      active && styles.segmentCountTextOn,
                    ]}
                  >
                    {count}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {walletTab === 'withdrawals' ? (
          <View style={styles.section}>
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
        ) : (
          <View style={styles.section}>
            {transactions.length === 0 && !loading && (
              <SectionEmpty
                icon="receipt-long"
                title="Earnings from completed deliveries will show up here."
              />
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
        )}
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

            {/* 284 banks, alphabetically. Without this the list opens on
                "5TT MFB" and finding GTBank is a scroll, not a task. */}
            <View style={styles.searchRow}>
              <MaterialIcons name="search" size={18} color={colors.textMuted} />
              <BottomSheetTextInput
                value={bankQuery}
                onChangeText={setBankQuery}
                placeholder="Search banks"
                placeholderTextColor={colors.textMuted}
                style={styles.searchInput}
                autoCorrect={false}
                autoCapitalize="none"
                returnKeyType="search"
              />
              {bankQuery.length > 0 && (
                <TouchableOpacity onPress={() => setBankQuery('')} hitSlop={8}>
                  <MaterialIcons name="close" size={18} color={colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>

            {banksLoading ? (
              <ActivityIndicator color={colors.primary} style={{ marginTop: 20 }} />
            ) : (
              // Not BottomSheetFlatList. Under Reanimated 4 it is an
              // Animated-wrapped FlatList and it throws on render here;
              // the ScrollView-based sheets elsewhere in this app are
              // fine. The list is filtered by the search above, and a
              // few hundred one-line rows is well within what a
              // ScrollView handles.
              <BottomSheetScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingBottom: 20 }}
                keyboardShouldPersistTaps="handled"
              >
                {visibleBanks.length === 0 ? (
                  <Text style={styles.bankEmpty}>
                    No bank matches “{bankQuery.trim()}”.
                  </Text>
                ) : (
                  visibleBanks.map((bank) => (
                    <TouchableOpacity
                      key={bank.code}
                      style={styles.bankRow}
                      onPress={() => pickBank(bank)}
                    >
                      <Text style={styles.bankName}>{bank.name}</Text>
                      <MaterialIcons name="chevron-right" size={20} color={colors.textMuted} />
                    </TouchableOpacity>
                  ))
                )}
              </BottomSheetScrollView>
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
  // The safe-area inset is painted in the container's own colour. White
  // put a white band above the orange hero, which the shopper wallet does
  // not have -- there the colour runs under the status bar.
  container: { flex: 1, backgroundColor: colors.primary },
  body: { flex: 1, backgroundColor: colors.background },

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
  heroBody: { alignItems: 'center', paddingTop: spacing.sm },
  heroLabel: {
    ...typography.caption,
    color: 'rgba(255,255,255,0.85)',
  },
  heroValue: {
    ...typography.title,
    fontSize: 40,
    color: '#fff',
    marginTop: 2,
  },
  // A pill, not a full-width slab: it is one action, and when there is
  // nothing to withdraw it should read as unavailable rather than as a
  // grey block filling the screen.
  heroAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    alignSelf: 'center',
    marginTop: spacing.md,
    paddingHorizontal: 22,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fff',
  },
  heroActionOff: {
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  heroActionText: { ...typography.bodyBold, fontSize: 15, color: colors.primary },
  heroActionTextOff: { color: 'rgba(255,255,255,0.75)' },
  heroHint: {
    ...typography.caption,
    color: 'rgba(255,255,255,0.75)',
    marginTop: spacing.sm,
    textAlign: 'center',
  },

  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: spacing.md,
    paddingBottom: 40,
  },
  section: { marginBottom: spacing.section },

  segment: {
    flexDirection: 'row',
    gap: 6,
    backgroundColor: colors.surface,
    borderRadius: radius,
    padding: 4,
    marginBottom: spacing.md,
  },
  segmentTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 38,
    borderRadius: 6,
  },
  segmentTabOn: { backgroundColor: colors.background, ...shadow },
  segmentText: { ...typography.caption, fontWeight: '600', color: colors.textSecondary },
  segmentTextOn: { color: colors.textPrimary, fontWeight: '700' },
  segmentCount: {
    minWidth: 20,
    paddingHorizontal: 5,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceDim,
  },
  segmentCountOn: { backgroundColor: colors.primary },
  segmentCountText: { fontSize: 11, fontWeight: '700', color: colors.textSecondary },
  segmentCountTextOn: { color: '#fff' },

  txIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txIconCredit: { backgroundColor: tones.positive.bg },
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
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 44,
    paddingHorizontal: 12,
    borderRadius: radius,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 8,
  },
  searchInput: { flex: 1, ...typography.body, color: colors.textPrimary, padding: 0 },
  bankEmpty: {
    ...typography.caption,
    color: colors.textSecondary,
    paddingVertical: 20,
    textAlign: 'center',
  },
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
