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
  const [successMessage, setSuccessMessage] = useState('');

  const set = (key) => (val) => {
    setForm((p) => ({ ...p, [key]: val }));
    setErrors((e) => ({ ...e, [key]: '' }));
  };

  const validate = () => {
    const e = {};
    
    const trimmedName = form.name.trim();
    if (!trimmedName) {
      e.name = 'Name is required';
    } else if (trimmedName.length < 2) {
      e.name = 'Name must be at least 2 characters';
    } else if (!/^[a-zA-Z\s]+$/.test(trimmedName)) {
      e.name = 'Name must contain only alphabets and spaces';
    }

    const trimmedEmail = form.email.trim();
    if (!trimmedEmail) {
      e.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(trimmedEmail)) {
      e.email = 'Enter a valid email';
    }

    const cleanedPhone = form.phone.replace(/\D/g, '');
    if (!form.phone.trim()) {
      e.phone = 'Phone number is required';
    } else if (!/^[0-9]{10,15}$/.test(cleanedPhone)) {
      e.phone = 'Enter a valid 10-15 digit phone number';
    }

    if (!form.password) {
      e.password = 'Password is required';
    } else if (form.password.length < 6) {
      e.password = 'Password must be at least 6 characters';
    }

    if (form.password !== form.confirmPassword) {
      e.confirmPassword = 'Passwords do not match';
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleRegister = async () => {
    if (!validate()) return;
    dispatch(clearError());
    
    const cleanedPhone = form.phone.replace(/\D/g, '');
    const result = await dispatch(register({
      name: form.name.trim(),
      email: form.email.trim().toLowerCase(),
      phone: cleanedPhone,
      password: form.password,
      role: form.role,
    }));
    if (register.fulfilled.match(result)) {
      setSuccessMessage('Registration successful! Please sign in with your registered credentials.');
    } else if (register.rejected.match(result)) {
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
            <View style={styles.headerCenter}>
              <MaterialCommunityIcons name="ambulance" size={22} color={Colors.white} style={{ marginRight: 8 }} />
              <Text style={styles.headerTitle}>Create Account</Text>
            </View>
            <View style={{ width: 36 }} />
          </View>

          {/* Progress indicator */}
          {!successMessage && (
            <View style={styles.stepRow}>
              <View style={styles.stepDot}>
                <Text style={styles.stepDotText}>1</Text>
              </View>
              <View style={styles.stepLine} />
              <View style={[styles.stepDot, styles.stepDotInactive]}>
                <Text style={[styles.stepDotText, styles.stepDotTextInactive]}>2</Text>
              </View>
              <View style={styles.stepLine} />
              <View style={[styles.stepDot, styles.stepDotInactive]}>
                <MaterialCommunityIcons name="check" size={14} color="rgba(255,255,255,0.4)" />
              </View>
            </View>
          )}

          {/* Main Card */}
          <View style={styles.card}>
            {successMessage ? (
              <View style={styles.successContainer}>
                <View style={styles.successIconBg}>
                  <MaterialCommunityIcons name="checkbox-marked-circle" size={64} color={Colors.success} />
                </View>
                <Text style={styles.successTitle}>Registration Successful!</Text>
                <Text style={styles.successSub}>
                  Your account has been created successfully.
                </Text>
                <Text style={styles.successDetail}>
                  You can now log in to the application using your registered credentials.
                </Text>

                {/* Quick info */}
                <View style={styles.successInfoBox}>
                  <MaterialCommunityIcons name="information-outline" size={16} color={Colors.secondary} />
                  <Text style={styles.successInfoText}>
                    Your account is ready. Sign in to book your first ambulance.
                  </Text>
                </View>

                <Button
                  title="Sign In Now"
                  onPress={() => navigation.navigate('Login')}
                  size="lg"
                  style={styles.successBtn}
                  icon={<MaterialCommunityIcons name="login" size={20} color="#fff" />}
                />
              </View>
            ) : (
              <>
                <View style={styles.cardHeader}>
                  <Text style={styles.title}>Join ABTS</Text>
                  <Text style={styles.subtitle}>Register to access emergency ambulance services</Text>
                </View>

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
                  placeholder="Min. 6 chars"
                  secureTextEntry
                  error={errors.password}
                  leftIcon={<MaterialCommunityIcons name="lock-outline" size={20} color={Colors.textMuted} />}
                />
                
                <Input
                  label="Confirm Password"
                  value={form.confirmPassword}
                  onChangeText={set('confirmPassword')}
                  placeholder="Re-enter password"
                  secureTextEntry
                  error={errors.confirmPassword}
                  leftIcon={<MaterialCommunityIcons name="lock-check-outline" size={20} color={Colors.textMuted} />}
                />

                {/* Role selection */}
                <Text style={styles.roleLabel}>I am registering as</Text>
                <View style={styles.roleRow}>
                  {[
                    { label: 'Patient / User', value: 'user', icon: 'account', desc: 'Book ambulances' },
                    { label: 'Driver', value: 'driver', icon: 'ambulance', desc: 'Provide services' },
                  ].map((r) => (
                    <TouchableOpacity
                      key={r.value}
                      style={[styles.roleCard, form.role === r.value && styles.roleCardActive]}
                      onPress={() => setForm((p) => ({ ...p, role: r.value }))}
                      activeOpacity={0.8}
                    >
                      <View style={[styles.roleIconCircle, form.role === r.value && styles.roleIconCircleActive]}>
                        <MaterialCommunityIcons
                          name={r.icon}
                          size={22}
                          color={form.role === r.value ? Colors.white : Colors.primary}
                        />
                      </View>
                      <Text style={[styles.roleText, form.role === r.value && styles.roleTextActive]}>
                        {r.label}
                      </Text>
                      <Text style={[styles.roleDesc, form.role === r.value && styles.roleDescActive]}>
                        {r.desc}
                      </Text>
                      {form.role === r.value && (
                        <View style={styles.roleCheck}>
                          <MaterialCommunityIcons name="check-circle" size={18} color={Colors.primary} />
                        </View>
                      )}
                    </TouchableOpacity>
                  ))}
                </View>

                <Button
                  title="Create Account"
                  onPress={handleRegister}
                  loading={isLoading}
                  size="lg"
                  style={styles.btn}
                  icon={<MaterialCommunityIcons name="account-plus" size={20} color="#fff" />}
                />

                {/* Terms notice */}
                <Text style={styles.termsText}>
                  By creating an account, you agree to our{' '}
                  <Text style={styles.termsLink}>Terms of Service</Text> and{' '}
                  <Text style={styles.termsLink}>Privacy Policy</Text>
                </Text>
              </>
            )}
          </View>

          {/* Login Link */}
          {!successMessage && (
            <View style={styles.loginRow}>
              <Text style={styles.loginText}>Already have an account? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                <Text style={styles.loginLink}>Sign In</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.primary },
  flex: { flex: 1 },
  container: { flexGrow: 1, paddingHorizontal: 20, paddingBottom: 24 },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 12, paddingBottom: 20,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center', alignItems: 'center',
  },
  headerCenter: { flexDirection: 'row', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: Colors.white, letterSpacing: 0.5 },

  // Steps
  stepRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    marginBottom: 20, gap: 4,
  },
  stepDot: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: Colors.white,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15, shadowRadius: 4, elevation: 4,
  },
  stepDotInactive: { backgroundColor: 'rgba(255,255,255,0.2)', shadowOpacity: 0, elevation: 0 },
  stepDotText: { fontSize: 12, fontWeight: '800', color: Colors.primary },
  stepDotTextInactive: { color: 'rgba(255,255,255,0.7)' },
  stepLine: {
    width: 30, height: 3,
    backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 1.5,
  },

  // Card
  card: {
    backgroundColor: Colors.surface, borderRadius: 22, padding: 22,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15, shadowRadius: 20, elevation: 12,
  },
  cardHeader: { marginBottom: 16 },
  title: { fontSize: 21, fontWeight: '800', color: Colors.text, marginBottom: 4 },
  subtitle: { fontSize: 13, color: Colors.textSecondary },

  // Role selection
  roleLabel: { fontSize: 13, fontWeight: '700', color: Colors.text, marginBottom: 10, marginTop: 4 },
  roleRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  roleCard: {
    flex: 1, alignItems: 'center', padding: 14,
    borderRadius: 14, borderWidth: 1.5, borderColor: '#E8ECF0',
    backgroundColor: '#F8F9FA', position: 'relative',
  },
  roleCardActive: {
    borderColor: Colors.primary, backgroundColor: '#FFF5F5',
  },
  roleIconCircle: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#E8ECF0',
    justifyContent: 'center', alignItems: 'center', marginBottom: 8,
  },
  roleIconCircleActive: { backgroundColor: Colors.primary },
  roleText: { fontSize: 13, fontWeight: '700', color: Colors.text, textAlign: 'center' },
  roleTextActive: { color: Colors.primary },
  roleDesc: { fontSize: 11, color: Colors.textMuted, marginTop: 2, textAlign: 'center' },
  roleDescActive: { color: Colors.textSecondary },
  roleCheck: { position: 'absolute', top: 8, right: 8 },

  btn: { marginTop: 8 },

  // Terms
  termsText: { fontSize: 11, color: Colors.textMuted, textAlign: 'center', marginTop: 16, lineHeight: 16 },
  termsLink: { color: Colors.primary, fontWeight: '600' },

  // Login Link
  loginRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 24 },
  loginText: { fontSize: 14, color: 'rgba(255,255,255,0.85)' },
  loginLink: { fontSize: 14, color: Colors.white, fontWeight: '800', textDecorationLine: 'underline' },

  // Success
  successContainer: { alignItems: 'center', paddingVertical: 16 },
  successIconBg: {
    width: 90, height: 90, borderRadius: 45,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 22, fontWeight: '800', color: Colors.success,
    marginBottom: 8, textAlign: 'center',
  },
  successSub: {
    fontSize: 15, fontWeight: '600', color: Colors.text,
    textAlign: 'center', marginBottom: 6,
  },
  successDetail: {
    fontSize: 13, color: Colors.textSecondary,
    textAlign: 'center', marginBottom: 20, lineHeight: 18,
  },
  successInfoBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#E3F2FD', borderRadius: 12, padding: 12,
    marginBottom: 20, width: '100%',
  },
  successInfoText: { flex: 1, fontSize: 12, color: Colors.secondary, lineHeight: 16 },
  successBtn: { width: '100%' },
});
