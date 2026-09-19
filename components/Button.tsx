import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { colors, radius, typography } from './theme';

// 'danger' is an outline that reads as destructive -- reporting a failed
// run, abandoning a delivery. Same shape as the others so it never looks
// like a different control, only a differently-weighted one.
type Variant = 'primary' | 'secondary' | 'outline' | 'danger';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle;
}

// Mirrors markt_mobile's button.tsx: h-12 (48px), 8px radius, one
// consistent shape across variants, loading state replaces the label.
export default function Button({
  label,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  icon,
  style,
}: ButtonProps) {
  const isDisabled = disabled || loading;

  const containerStyle = [
    styles.base,
    variant === 'primary' && styles.primary,
    variant === 'secondary' && styles.secondary,
    variant === 'outline' && styles.outline,
    variant === 'danger' && styles.danger,
    isDisabled && styles.disabled,
    style,
  ];

  const textStyle = [
    styles.text,
    variant === 'primary' && styles.textOnPrimary,
    (variant === 'secondary' || variant === 'outline') && styles.textOnMuted,
    variant === 'danger' && styles.textOnDanger,
    isDisabled && styles.textDisabled,
  ];

  return (
    <TouchableOpacity
      style={containerStyle}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? '#fff' : colors.textPrimary} size="small" />
      ) : (
        <View style={styles.content}>
          {icon}
          <Text style={textStyle}>{label}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 48,
    borderRadius: radius,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  primary: {
    backgroundColor: colors.primary,
  },
  secondary: {
    backgroundColor: colors.surface,
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.border,
  },
  danger: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.error,
  },
  disabled: {
    backgroundColor: colors.surfaceDim,
    borderColor: colors.surfaceDim,
  },
  text: {
    ...typography.bodyBold,
    letterSpacing: 0.3,
  },
  textOnPrimary: {
    color: '#fff',
  },
  textOnMuted: {
    color: colors.textPrimary,
  },
  textOnDanger: {
    color: colors.error,
  },
  textDisabled: {
    color: colors.textMuted,
  },
});
