/**
 * Prompts for a store update when Remote Config says this build is behind.
 * Renders nothing otherwise. See services/appUpdate.ts for the parameters.
 * Mirrors markt_mobile's components/UpdateGate.tsx.
 *
 *  - Below the minimum version: a full-screen block with only "Update". There
 *    is no way past it, and hardware back does nothing -- an old build that
 *    talks to a changed API is the thing this exists to stop.
 *  - Below the latest version: a dismissible card, shown once per version.
 *
 * Checks on launch and whenever the app returns to the foreground (at most
 * hourly), so a rider who leaves the app open all week still gets told.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Modal, StyleSheet, Text, View } from 'react-native';

import Button from './Button';
import { colors, radius, spacing, typography } from './theme';
import {
  UpdateStatus,
  dismiss,
  evaluate,
  fetchEntries,
  openStore,
  readCachedEntries,
  wasDismissed,
} from '../services/appUpdate';

const RECHECK_MS = 60 * 60 * 1000;

export default function UpdateGate() {
  const [status, setStatus] = useState<UpdateStatus>({ kind: 'none' });
  const lastFetch = useRef(0);

  const apply = useCallback(async (next: UpdateStatus) => {
    if (next.kind === 'optional' && (await wasDismissed(next.latest))) {
      setStatus({ kind: 'none' });
      return;
    }
    setStatus(next);
  }, []);

  const check = useCallback(async () => {
    lastFetch.current = Date.now();
    const entries = await fetchEntries();
    // null = fetch failed: keep whatever the cache already decided.
    if (entries) await apply(evaluate(entries));
  }, [apply]);

  useEffect(() => {
    // Cache first, so a required update blocks immediately and offline --
    // then the network, in that order, so a slow cache read can never land
    // on top of the fresh answer.
    (async () => {
      await apply(evaluate(await readCachedEntries()));
      await check();
    })();

    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active' && Date.now() - lastFetch.current > RECHECK_MS) check();
    });
    return () => sub.remove();
  }, [apply, check]);

  if (status.kind === 'none') return null;

  const required = status.kind === 'required';
  const onLater = async () => {
    if (status.kind === 'optional') await dismiss(status.latest);
    setStatus({ kind: 'none' });
  };

  return (
    <Modal
      visible
      transparent={!required}
      animationType="fade"
      statusBarTranslucent
      onRequestClose={required ? () => {} : onLater}
    >
      <View style={[styles.backdrop, required ? styles.blocking : styles.scrim]}>
        <View style={styles.card}>
          <Text style={styles.title}>{required ? 'Update required' : 'Update available'}</Text>
          <Text style={styles.body}>
            {status.message ??
              (required
                ? 'This version of Logistics is no longer supported. Update to keep receiving deliveries.'
                : 'A new version of Logistics is available with the latest improvements.')}
          </Text>
          <View style={styles.actions}>
            <Button label="Update" onPress={() => openStore(status.storeUrl)} />
            {!required && <Button label="Not now" variant="secondary" onPress={onLater} />}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  blocking: { backgroundColor: colors.background },
  // A dim is black regardless of theme; same value markt_mobile's scrim uses.
  scrim: { backgroundColor: 'rgba(0,0,0,0.45)' },
  card: {
    width: '100%',
    maxWidth: 400,
    borderRadius: radius,
    padding: spacing.md,
    backgroundColor: colors.background,
  },
  title: { ...typography.title, color: colors.textPrimary },
  body: { ...typography.body, color: colors.textSecondary, marginTop: spacing.base },
  actions: { marginTop: spacing.md, gap: spacing.sm },
});
