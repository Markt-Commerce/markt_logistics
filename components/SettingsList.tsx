import { MaterialIcons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { colors, spacing, typography } from './theme';

/**
 * The list language for the rider app's settings-shaped screens.
 *
 * Ported from markt_mobile's components/SettingsList.tsx, which arrived
 * at this shape after the same mistake: an inset card with a rounded
 * border and a border on every row is a bordered box inside a bordered
 * screen, so each row is outlined twice and 48px of width is given away
 * on every line.
 *
 * The shape: a tinted full-bleed band names a group, rows run edge to
 * edge, and the hairline between them is inset to start under the label
 * -- so the eye reads a list rather than a stack of boxes. Nothing is
 * outlined.
 */

export function SettingsSection({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.band}>
        <Text style={styles.bandText}>{title}</Text>
      </View>
      <View style={styles.rows}>{children}</View>
    </View>
  );
}

/** The hairline between rows, inset so it lines up under the label. */
export function RowDivider() {
  return <View style={styles.divider} />;
}

export function SettingsRow({
  icon,
  title,
  subtitle,
  value,
  onPress,
  last = false,
  destructive = false,
}: {
  icon: React.ComponentProps<typeof MaterialIcons>['name'];
  title: string;
  /** Only when it says something the label doesn't. Most rows don't. */
  subtitle?: string;
  value?: string;
  /** Omitted for a row that only reports something. It then renders
   *  without a chevron and without a press target, rather than as a
   *  button that does nothing when tapped. */
  onPress?: () => void;
  last?: boolean;
  destructive?: boolean;
}) {
  const tint = destructive ? colors.error : colors.textSecondary;
  const body = (
    <>
      <MaterialIcons name={icon} size={20} color={tint} />
      <View style={styles.rowBody}>
        <Text style={[styles.rowTitle, destructive && styles.rowTitleBad]}>{title}</Text>
        {!!subtitle && <Text style={styles.rowSubtitle}>{subtitle}</Text>}
      </View>
      {!!value && (
        <Text style={styles.rowValue} numberOfLines={1}>
          {value}
        </Text>
      )}
      {!!onPress && (
        <MaterialIcons name="chevron-right" size={20} color={colors.textMuted} />
      )}
    </>
  );

  return (
    <>
      {onPress ? (
        <TouchableOpacity
          onPress={onPress}
          activeOpacity={0.6}
          accessibilityRole="button"
          accessibilityLabel={value ? `${title}, ${value}` : title}
          style={styles.row}
        >
          {body}
        </TouchableOpacity>
      ) : (
        <View style={styles.row}>{body}</View>
      )}
      {last ? null : <RowDivider />}
    </>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: spacing.base },
  band: {
    paddingHorizontal: spacing.screenX,
    paddingVertical: 10,
    backgroundColor: colors.surface,
  },
  bandText: { ...typography.caption, fontSize: 13, color: colors.textSecondary, fontWeight: '700' },
  rows: { backgroundColor: colors.background },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.screenX,
    minHeight: 56,
    paddingVertical: 12,
  },
  rowBody: { flex: 1, marginLeft: 16, paddingRight: 12 },
  rowTitle: { ...typography.body, color: colors.textPrimary },
  rowTitleBad: { color: colors.error },
  rowSubtitle: { ...typography.caption, color: colors.textMuted, marginTop: 2, lineHeight: 18 },
  rowValue: { ...typography.secondary, color: colors.textMuted, marginRight: 8, maxWidth: 170 },
  // Starts under the label, not at the screen edge, so the rows read as
  // one list rather than as separate blocks.
  divider: { height: 1, marginLeft: 52, backgroundColor: colors.borderLight },
});
