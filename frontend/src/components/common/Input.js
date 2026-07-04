import React, { useState } from 'react';
import { View, TextInput, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors, BorderRadius, Spacing } from '../../theme';

export default function Input({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  keyboardType,
  autoCapitalize = 'none',
  error,
  leftIcon,
  rightIcon,
  multiline,
  numberOfLines,
  editable = true,
  style,
  inputStyle,
  ...props
}) {
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden]   = useState(secureTextEntry);

  return (
    <View style={[styles.wrapper, style]}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View
        style={[
          styles.container,
          focused && styles.focused,
          error   && styles.errorBorder,
          !editable && styles.disabled,
        ]}
      >
        {leftIcon && <View style={styles.iconLeft}>{leftIcon}</View>}

        <TextInput
          style={[styles.input, multiline && styles.multiline, inputStyle]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={Colors.textMuted}
          secureTextEntry={hidden}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          multiline={multiline}
          numberOfLines={numberOfLines}
          editable={editable}
          {...props}
        />

        {secureTextEntry && (
          <TouchableOpacity onPress={() => setHidden((h) => !h)} style={styles.iconRight}>
            <MaterialCommunityIcons
              name={hidden ? 'eye-off' : 'eye'}
              size={20}
              color={Colors.textMuted}
            />
          </TouchableOpacity>
        )}
        {rightIcon && !secureTextEntry && (
          <View style={styles.iconRight}>{rightIcon}</View>
        )}
      </View>
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: Spacing.md + 2 },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 6,
    letterSpacing: 0.2,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6', // Modern soft gray
    borderWidth: 1,
    borderColor: 'transparent', // Transparent border so layout doesn't shift on focus
    borderRadius: 14,
    paddingHorizontal: Spacing.md,
    minHeight: 52,
  },
  focused: {
    backgroundColor: '#FFFFFF',
    borderColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  errorBorder: { borderColor: Colors.error, backgroundColor: '#FFF8F8' },
  disabled:    { backgroundColor: '#F0F0F0', opacity: 0.7 },
  input: {
    flex: 1,
    fontSize: 15,
    color: Colors.text,
    paddingVertical: Spacing.sm + 2,
    // Remove default browser focus outline on web
    ...Platform.select({
      web: { outlineStyle: 'none' },
    }),
  },
  multiline: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  iconLeft:  { marginRight: Spacing.sm + 2 },
  iconRight: { marginLeft:  Spacing.sm },
  error: {
    flexDirection: 'row',
    alignItems: 'center',
    fontSize: 12,
    fontWeight: '500',
    color: Colors.error,
    marginTop: 4,
    paddingLeft: 2,
  },
});
