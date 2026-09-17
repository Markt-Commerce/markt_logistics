import React from 'react';
import { StyleSheet, Text, TextStyle } from 'react-native';
import { colors, typography } from './theme';

interface SectionHeaderProps {
  title: string;
  style?: TextStyle;
}

/**
 * The one heading style every section of every screen should use --
 * replaces the old per-screen `sectionLabel` (tiny, uppercase,
 * light-gray `typography.label`) that read as a caption rather than a
 * section heading. See REFACTOR_NOTES.md, "UI pass" (2026-09-17, Joshua).
 */
export default function SectionHeader({ title, style }: SectionHeaderProps) {
  return <Text style={[styles.title, style]}>{title}</Text>;
}

const styles = StyleSheet.create({
  title: {
    ...typography.subtitle,
    color: colors.textPrimary,
    marginBottom: 14,
  },
});
