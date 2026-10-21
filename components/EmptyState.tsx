import { MaterialIcons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Button from './Button';
import { colors, radius, typography } from './theme';

interface EmptyStateProps {
  icon: keyof typeof MaterialIcons.glyphMap;
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
}

// markt_mobile's principle: a neutral icon tile, never bare "No X" text.
export default function EmptyState({ icon, title, subtitle, actionLabel, onAction }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <View style={styles.iconTile}>
        <MaterialIcons name={icon} size={32} color={colors.textMuted} />
      </View>
      <Text style={styles.title}>{title}</Text>
      {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      {!!actionLabel && !!onAction && (
        <Button label={actionLabel} onPress={onAction} style={styles.action} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  iconTile: {
    width: 64,
    height: 64,
    borderRadius: radius,
    backgroundColor: colors.bgMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    ...typography.subtitle,
    color: colors.textPrimary,
    marginBottom: 6,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.secondary,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  action: {
    marginTop: 20,
  },
});
