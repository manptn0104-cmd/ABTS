import React, { useState } from 'react';
import {
  Modal, View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput, Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useDispatch, useSelector } from 'react-redux';
import { setFilters, resetFilters } from '../store/ambulanceSlice';
import { Colors, Spacing, BorderRadius, Shadow } from '../theme';
import { FACILITIES, AMBULANCE_TYPES } from '../utils/constants';
import Button from './common/Button';

export default function FilterModal({ visible, onClose, onApply }) {
  const dispatch       = useDispatch();
  const savedFilters   = useSelector((s) => s.ambulance.filters);
  const [local, setLocal] = useState({ ...savedFilters });

  const toggleFacility = (key) =>
    setLocal((p) => ({ ...p, [key]: !p[key] }));

  const selectType = (value) =>
    setLocal((p) => ({ ...p, type: p.type === value ? '' : value }));

  const handleReset = () => {
    dispatch(resetFilters());
    setLocal({
      oxygen: false, saline: false, stretcher: false, nurse: false, doctor: false,
      minPrice: '', maxPrice: '', type: '', available: 'true',
    });
  };

  const handleApply = () => {
    dispatch(setFilters(local));
    onApply?.(local);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          {/* Handle */}
          <View style={styles.handle} />

          <View style={styles.titleRow}>
            <Text style={styles.title}>Filter Ambulances</Text>
            <TouchableOpacity onPress={onClose}>
              <MaterialCommunityIcons name="close" size={24} color={Colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Availability */}
            <Text style={styles.sectionTitle}>Availability</Text>
            <View style={styles.row}>
              {[
                { label: 'Available', value: 'true' },
                { label: 'All',       value: 'all'  },
              ].map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.chip, local.available === opt.value && styles.chipActive]}
                  onPress={() => setLocal((p) => ({ ...p, available: opt.value }))}
                >
                  <Text style={[styles.chipText, local.available === opt.value && styles.chipTextActive]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Type */}
            <Text style={styles.sectionTitle}>Ambulance Type</Text>
            <View style={styles.row}>
              {AMBULANCE_TYPES.map((t) => (
                <TouchableOpacity
                  key={t.value}
                  style={[styles.chip, local.type === t.value && { backgroundColor: t.color, borderColor: t.color }]}
                  onPress={() => selectType(t.value)}
                >
                  <Text style={[styles.chipText, local.type === t.value && styles.chipTextActive]}>
                    {t.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Facilities */}
            <Text style={styles.sectionTitle}>Required Facilities</Text>
            <View style={styles.facilitiesGrid}>
              {FACILITIES.map((f) => (
                <TouchableOpacity
                  key={f.key}
                  style={[styles.facilityItem, local[f.key] && styles.facilityActive]}
                  onPress={() => toggleFacility(f.key)}
                >
                  <MaterialCommunityIcons
                    name={f.icon}
                    size={20}
                    color={local[f.key] ? Colors.white : Colors.secondary}
                  />
                  <Text style={[styles.facilityLabel, local[f.key] && styles.facilityLabelActive]}>
                    {f.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Price Range */}
            <Text style={styles.sectionTitle}>Price Range (Base ₹)</Text>
            <View style={styles.priceRow}>
              <TextInput
                style={styles.priceInput}
                placeholder="Min"
                value={local.minPrice}
                onChangeText={(v) => setLocal((p) => ({ ...p, minPrice: v }))}
                keyboardType="numeric"
                placeholderTextColor={Colors.textMuted}
              />
              <Text style={styles.priceDash}>—</Text>
              <TextInput
                style={styles.priceInput}
                placeholder="Max"
                value={local.maxPrice}
                onChangeText={(v) => setLocal((p) => ({ ...p, maxPrice: v }))}
                keyboardType="numeric"
                placeholderTextColor={Colors.textMuted}
              />
            </View>
          </ScrollView>

          {/* Actions */}
          <View style={styles.actions}>
            <Button title="Reset" variant="outline" onPress={handleReset} style={styles.btnHalf} />
            <Button title="Apply Filters" onPress={handleApply} style={styles.btnHalf} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: Colors.overlay, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: Spacing.lg,
    maxHeight: '85%',
  },
  handle: {
    width: 40, height: 4,
    backgroundColor: Colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: Spacing.md,
  },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.lg },
  title: { fontSize: 18, fontWeight: '700', color: Colors.text },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: Colors.textSecondary, marginBottom: Spacing.sm, textTransform: 'uppercase' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: Spacing.lg },
  chip: {
    paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: BorderRadius.full,
    borderWidth: 1.5, borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText:       { fontSize: 13, color: Colors.text, fontWeight: '500' },
  chipTextActive: { color: Colors.white },
  facilitiesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: Spacing.lg },
  facilityItem: {
    width: '30%',
    alignItems: 'center',
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    gap: 4,
  },
  facilityActive: { backgroundColor: Colors.secondary, borderColor: Colors.secondary },
  facilityLabel:       { fontSize: 11, color: Colors.text, fontWeight: '500', textAlign: 'center' },
  facilityLabelActive: { color: Colors.white },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: Spacing.lg },
  priceInput: {
    flex: 1, borderWidth: 1.5, borderColor: Colors.border,
    borderRadius: BorderRadius.md, padding: Spacing.sm,
    fontSize: 15, color: Colors.text,
    ...Platform.select({ web: { outlineStyle: 'none' } })
  },
  priceDash: { fontSize: 18, color: Colors.textMuted },
  actions: { flexDirection: 'row', gap: 12, paddingTop: Spacing.md },
  btnHalf: { flex: 1 },
});
