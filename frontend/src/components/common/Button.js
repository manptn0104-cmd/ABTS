import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator, StyleSheet, View } from 'react-native';
import { Colors, BorderRadius, Spacing } from '../../theme';

export default function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon,
  style,
  textStyle,
}) {
  const isDisabled = disabled || loading;

  const containerStyle = [
    styles.base,
    styles[`variant_${variant}`],
    styles[`size_${size}`],
    isDisabled && styles.disabled,
    style,
  ];

  const labelStyle = [
    styles.label,
    styles[`label_${variant}`],
    styles[`labelSize_${size}`],
    textStyle,
  ];

  return (
    <TouchableOpacity
      style={containerStyle}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'primary' || variant === 'danger' ? Colors.white : Colors.primary}
          size="small"
        />
      ) : (
        <View style={styles.content}>
          {icon && <View style={styles.icon}>{icon}</View>}
          <Text style={labelStyle}>{title}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: BorderRadius.lg,
    flexDirection: 'row',
  },
  content: { flexDirection: 'row', alignItems: 'center' },
  icon:    { marginRight: Spacing.xs },

  // variants
  variant_primary:  { backgroundColor: Colors.primary },
  variant_secondary:{ backgroundColor: Colors.secondary },
  variant_outline:  { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: Colors.primary },
  variant_ghost:    { backgroundColor: 'transparent' },
  variant_danger:   { backgroundColor: Colors.error },
  variant_success:  { backgroundColor: Colors.success },

  // labels
  label:           { fontWeight: '700', textAlign: 'center' },
  label_primary:   { color: Colors.white },
  label_secondary: { color: Colors.white },
  label_outline:   { color: Colors.primary },
  label_ghost:     { color: Colors.primary },
  label_danger:    { color: Colors.white },
  label_success:   { color: Colors.white },

  // sizes
  size_sm:       { paddingVertical: Spacing.xs,  paddingHorizontal: Spacing.md },
  size_md:       { paddingVertical: Spacing.sm + 2, paddingHorizontal: Spacing.lg },
  size_lg:       { paddingVertical: Spacing.md,  paddingHorizontal: Spacing.xl },
  labelSize_sm:  { fontSize: 13 },
  labelSize_md:  { fontSize: 15 },
  labelSize_lg:  { fontSize: 17 },

  disabled: { opacity: 0.5 },
});
