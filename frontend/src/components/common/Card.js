import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Colors, BorderRadius, Shadow, Spacing } from '../../theme';

export default function Card({ children, style, shadow = 'light', padding = true }) {
  return (
    <View style={[styles.card, Shadow[shadow], padding && styles.padding, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
  },
  padding: {
    padding: Spacing.md,
  },
});
