import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors, BorderRadius, Spacing } from '../../theme';

/**
 * Formik-friendly input — use with field.value, field.onChange, field.onBlur.
 * Expo Web safe: no raw text nodes inside View wrappers.
 */
export default function AppInput({
  label,
  value,
  onChangeText,
  onBlur,
  placeholder,
  secureTextEntry = false,
  keyboardType = 'default',
  autoCapitalize = 'none',
  error,
  touched,
  leftIcon,
  editable = true,
  multiline = false,
  maxLength,
  style,
  testID,
}) {
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(secureTextEntry);
  const showError = Boolean(touched && error);

  return (
    <View style={[styles.wrapper, style]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View
        style={[
          styles.container,
          focused && styles.focused,
          showError && styles.errorBorder,
          !editable && styles.disabled,
        ]}
      >
        {leftIcon ? <View style={styles.iconLeft}>{leftIcon}</View> : null}
        <TextInput
          testID={testID}
          style={[styles.input, multiline && styles.multiline]}
          value={value ?? ''}
          onChangeText={onChangeText}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          onFocus={() => setFocused(true)}
          placeholder={placeholder}
          placeholderTextColor={Colors.textMuted}
          secureTextEntry={hidden}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          editable={editable}
          multiline={multiline}
          maxLength={maxLength}
          autoCorrect={false}
          {...(Platform.OS === 'web' ? { outlineStyle: 'none' } : {})}
        />
        {secureTextEntry ? (
          <TouchableOpacity
            onPress={() => setHidden((h) => !h)}
            style={styles.iconRight}
            accessibilityLabel={hidden ? 'Show password' : 'Hide password'}
          >
            <MaterialCommunityIcons
              name={hidden ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color={Colors.textMuted}
            />
          </TouchableOpacity>
        ) : null}
      </View>
      {showError ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: Spacing.md, width: '100%' },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.sm,
    minHeight: 48,
    width: '100%',
  },
  focused: { borderColor: Colors.primary },
  errorBorder: { borderColor: Colors.error },
  disabled: { backgroundColor: '#F5F5F5', opacity: 0.8 },
  input: {
    flex: 1,
    fontSize: 15,
    color: Colors.text,
    paddingVertical: Spacing.sm,
    ...(Platform.OS === 'web' ? { outlineWidth: 0 } : {}),
  },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  iconLeft: { marginRight: Spacing.sm },
  iconRight: { marginLeft: Spacing.sm, padding: 4 },
  errorText: { fontSize: 12, color: Colors.error, marginTop: Spacing.xs },
});
