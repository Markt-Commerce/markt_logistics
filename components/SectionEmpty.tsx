import { MaterialIcons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from './theme';

interface SectionEmptyProps {
  icon: keyof typeof MaterialIcons.glyphMap;
  title: string;
}

/**
 * A section's empty state -- icon + text, centered, no border. For one
 * section within a longer scroll (a sheet's "Available orders" list, a
 * wallet's "Withdrawal requests" list, ...); EmptyState.tsx is the
 * full-screen equivalent for when the whole screen has nothing to show.
 * Definition comes from whitespace (generous vertical padding), not a
 * border box -- see REFACTOR_NOTES.md, "UI pass" (2026-09-17, Joshua).
 */
export default function SectionEmpty({ icon, title }: SectionEmptyProps) {
  return (
    <View style={styles.container}>
      <MaterialIcons name={icon} size={28} color={colors.textMuted} />
      <Text style={styles.title}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    // Was spacing.lg (48) top and bottom, so two empty sections stacked
    // put nearly 200px of nothing between two headings and the screen read
    // as unfinished rather than as empty.
    paddingVertical: spacing.md,
    gap: 8,
    // A quiet ground, so an empty section reads as a placeholder with a
    // shape rather than as a gap where something failed to load.
    backgroundColor: colors.surface,
    borderRadius: radius,
  },
  title: {
    ...typography.secondary,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
