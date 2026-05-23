import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useDispatch, useSelector } from 'react-redux';
import { register, clearError } from '../../store/authSlice';
import Input  from '../../components/common/Input';
import Button from '../../components/common/Button';
import { Colors, Spacing, Typography } from '../../theme';

export default function RegisterScreen({ navigation }) {
  const dispatch = useDispatch();
  const { isLoading } = useSelector((s) => s.auth);

  const [form, setForm] = useState({
    name: '', email: '', phone: '', password: '', confirmPassword: '', role: 'user',
  });
  const [errors, setErrors] = useState({});

  const set = (key) => (val) => {
    setForm((p) => ({ ...p, [key]: val }));
    setErrors((e) => ({ ...e, [key]: '' }));
  };

  const validate = () => {
    const e = {};
    if (!form.name.trim())   e.name = 'Name is required';
    if (!form.email.trim())  e.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = 'Enter a valid email';
    if (!form.phone.trim())  e.phone = 'Phone is required';
    else if (!/^[0-9]{10,15}$/.test(form.phone)) e.phone = 'Enter a valid 10-15 digit phone number';
    if (!form.password)      e.password = 'Password is required';
    else if (form.password.length < 6) e.password = 'Password must be at least 6 characters';
    if (form.password !== form.confirmPassword) e.confirmPassword = 'Passwords do not match';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleRegister = async () => {
    if (!validate()) return;
    dispatch(clearError());
    const result = await dispatch(register({
      name: form.name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      password: form.password,
      role: form.role,
    }));
    if (register.rejected.match(result)) {
      if (Platform.OS === 'web') {
        window.alert(`Registration Failed: ${result.payload}`);
      } else {
        Alert.alert('Registration Failed', result.payload);
      }
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
              <MaterialCommunityIcons name="arrow-left" size={24} color={Colors.white} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Create Account</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.title}>Join ABTS</Text>
            <Text style={styles.subtitle}>Fill in the details below to get started</Text>

            <Input
              label="Full Name"
              value={form.name}
              onChangeText={set('name')}
              placeholder="John Doe"
              autoCapitalize="words"
              error={errors.name}
              leftIcon={<MaterialCommunityIcons name="account-outline" size={20} color={Colors.textMuted} />}
            />

            <Input
              label="Email Address"
              value={form.email}
              onChangeText={set('email')}
              placeholder="you@example.com"
              keyboardType="email-address"
              error={errors.email}
              leftIcon={<MaterialCommunityIcons name="email-outline" size={20} color={Colors.textMuted} />}
            />

            <Input
              label="Phone Number"
              value={form.phone}
              onChangeText={set('phone')}
              placeholder="9876543210"
              keyboardType="phone-pad"
              error={errors.phone}
              leftIcon={<MaterialCommunityIcons name="phone-outline" size={20} color={Colors.textMuted} />}
            />

            <Input
              label="Password"
              value={form.password}
              onChangeText={set('password')}
              placeholder="Min. 6 characters"
              secureTextEntry
              error={errors.password}
              leftIcon={<MaterialCommunityIcons name="lock-outline" size={20} color={Colors.textMuted} />}
            />

            <Input
              label="Confirm Password"
              value={form.confirmPassword}
              onChangeText={set('confirmPassword')}
              placeholder="Re-enter your password"
              secureTextEntry
              error={errors.confirmPassword}
              leftIcon={<MaterialCommunityIcons name="lock-check-outline" size={20} color={Colors.textMuted} />}
            />

            {/* Role selection */}
            <Text style={styles.roleLabel}>I am registering as</Text>
            <View style={styles.roleRow}>
              {[
                { label: 'Patient / User', value: 'user',   icon: 'account' },
                { label: 'Ambulance Driver', value: 'driver', icon: 'ambulance' },
              ].map((r) => (
                <TouchableOpacity
                  key={r.value}
                  style={[styles.roleChip, form.role === r.value && styles.roleChipActive]}
                  onPress={() => setForm((p) => ({ ...p, role: r.value }))}
                >
                  <MaterialCommunityIcons
                    name={r.icon}
                    size={20}
                    color={form.role === r.value ? Colors.white : Colors.textSecondary}
                  />
                  <Text style={[styles.roleText, form.role === r.value && styles.roleTextActive]}>
                    {r.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Button
              title="Create Account"
              onPress={handleRegister}
              loading={isLoading}
              size="lg"
              style={styles.btn}
            />
          </View>

          {/* Login Link */}
          <View style={styles.loginRow}>
            <Text style={styles.loginText}>Already have an account? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
              <Text style={styles.loginLink}>Sign In</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: Colors.primary },
  flex:      { flex: 1 },
  container: { flexGrow: 1, paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xl },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xl,
    gap: Spacing.md,
  },
  backBtn:     { padding: 4 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: Colors.white },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 24,
    padding: Spacing.xl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 10,
  },
  title:    { fontSize: 22, fontWeight: '700', color: Colors.text, marginBottom: 4 },
  subtitle: { fontSize: 14, color: Colors.textSecondary, marginBottom: Spacing.lg },
  roleLabel: { fontSize: 13, fontWeight: '600', color: Colors.text, marginBottom: 8 },
  roleRow:   { flexDirection: 'row', gap: 10, marginBottom: Spacing.lg },
  roleChip:  {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, padding: Spacing.sm,
    borderRadius: 10, borderWidth: 1.5, borderColor: Colors.border,
    backgroundColor: Colors.background,
  },
  roleChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  roleText:       { fontSize: 12, color: Colors.textSecondary, fontWeight: '500', textAlign: 'center' },
  roleTextActive: { color: Colors.white, fontWeight: '700' },
  btn: { marginTop: Spacing.sm },
  loginRow:  { flexDirection: 'row', justifyContent: 'center', marginTop: Spacing.xl },
  loginText: { fontSize: 14, color: 'rgba(255,255,255,0.9)' },
  loginLink: { fontSize: 14, color: Colors.white, fontWeight: '800' },
});
