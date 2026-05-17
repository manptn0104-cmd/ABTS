import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useDispatch, useSelector } from 'react-redux';
import { login, clearError } from '../../store/authSlice';
import Input  from '../../components/common/Input';
import Button from '../../components/common/Button';
import { Colors, Spacing, Typography } from '../../theme';

export default function LoginScreen({ navigation }) {
  const dispatch = useDispatch();
  const { isLoading } = useSelector((s) => s.auth);

  const [tab, setTab] = useState('password'); // 'password' | 'otp'

  // Password tab state
  const [form, setForm]     = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});

  // OTP tab state
  const [phone, setPhone]           = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [otpSending, setOtpSending] = useState(false);

  const validatePassword = () => {
    const e = {};
    if (!form.email.trim())                    e.email    = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(form.email)) e.email    = 'Enter a valid email';
    if (!form.password)                        e.password = 'Password is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleLogin = async () => {
    if (!validatePassword()) return;
    dispatch(clearError());
    const result = await dispatch(login(form));
    if (login.rejected.match(result)) {
      if (Platform.OS === 'web') {
        window.alert('Login Failed\n\n' + result.payload);
      } else {
        Alert.alert('Login Failed', result.payload);
      }
    }
  };

  const handleSendOtp = async () => {
    const cleaned = phone.replace(/\D/g, '');
    if (!cleaned || cleaned.length < 10) {
      setPhoneError('Enter a valid 10-digit mobile number');
      return;
    }
    setPhoneError('');
    setOtpSending(true);
    try {
      const res = await fetch(
        (process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000') + '/api/auth/send-otp',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: cleaned }),
        }
      );
      const data = await res.json();
      if (!data.success) {
        setPhoneError(data.message || 'Failed to send OTP');
        return;
      }
      navigation.navigate('OtpVerification', { phone: cleaned, demoOtp: data.otp });
    } catch {
      setPhoneError('Network error. Please try again.');
    } finally {
      setOtpSending(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.hero}>
            <View style={styles.logoCircle}>
              <Text style={styles.logoEmoji}>??</Text>
            </View>
            <Text style={styles.appName}>ABTS</Text>
            <Text style={styles.tagline}>Ambulance Booking & Tracking</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.title}>Welcome Back</Text>

            <View style={styles.tabRow}>
              <TouchableOpacity
                style={[styles.tabBtn, tab === 'password' && styles.tabBtnActive]}
                onPress={() => setTab('password')}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons
                  name="lock-outline" size={15}
                  color={tab === 'password' ? Colors.white : Colors.textMuted}
                  style={{ marginRight: 4 }}
                />
                <Text style={[styles.tabBtnText, tab === 'password' && styles.tabBtnTextActive]}>Password</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tabBtn, tab === 'otp' && styles.tabBtnActive]}
                onPress={() => setTab('otp')}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons
                  name="message-text-outline" size={15}
                  color={tab === 'otp' ? Colors.white : Colors.textMuted}
                  style={{ marginRight: 4 }}
                />
                <Text style={[styles.tabBtnText, tab === 'otp' && styles.tabBtnTextActive]}>OTP</Text>
              </TouchableOpacity>
            </View>

            {tab === 'password' ? (
              <>
                <Input
                  label="Email"
                  value={form.email}
                  onChangeText={(v) => { setForm((p) => ({ ...p, email: v })); setErrors((e) => ({ ...e, email: '' })); }}
                  placeholder="you@example.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  error={errors.email}
                  leftIcon={<MaterialCommunityIcons name="email-outline" size={20} color={Colors.textMuted} />}
                />
                <Input
                  label="Password"
                  value={form.password}
                  onChangeText={(v) => { setForm((p) => ({ ...p, password: v })); setErrors((e) => ({ ...e, password: '' })); }}
                  placeholder="Enter your password"
                  secureTextEntry
                  error={errors.password}
                  leftIcon={<MaterialCommunityIcons name="lock-outline" size={20} color={Colors.textMuted} />}
                />
                <Button title="Sign In" onPress={handleLogin} loading={isLoading} size="lg" style={styles.btn} />
                <TouchableOpacity style={styles.forgotBtn}>
                  <Text style={styles.forgotText}>Forgot password?</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.otpHint}>
                  Enter your registered mobile number to receive a one-time password.
                </Text>
                <Input
                  label="Mobile Number"
                  value={phone}
                  onChangeText={(v) => { setPhone(v); setPhoneError(''); }}
                  placeholder="Enter 10-digit mobile number"
                  keyboardType="phone-pad"
                  maxLength={15}
                  error={phoneError}
                  leftIcon={<MaterialCommunityIcons name="phone-outline" size={20} color={Colors.textMuted} />}
                />
                <Button title="Send OTP" onPress={handleSendOtp} loading={otpSending} size="lg" style={styles.btn} />
              </>
            )}
          </View>

          <View style={styles.registerRow}>
            <Text style={styles.registerText}>Don't have an account? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Register')}>
              <Text style={styles.registerLink}>Register</Text>
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
  hero:      { alignItems: 'center', paddingTop: Spacing.xxl, paddingBottom: Spacing.xl },
  logoCircle: {
    width: 90, height: 90, borderRadius: 45,
    backgroundColor: Colors.white,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: Spacing.sm,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 8,
  },
  logoEmoji: { fontSize: 44 },
  appName:   { fontSize: 32, fontWeight: '800', color: Colors.white, letterSpacing: 2 },
  tagline:   { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 4 },
  card: {
    backgroundColor: Colors.surface, borderRadius: 24, padding: Spacing.xl,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15, shadowRadius: 16, elevation: 10,
  },
  title: { ...Typography.h2, marginBottom: Spacing.sm },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: '#f0f2f5',
    borderRadius: 12, padding: 4,
    marginBottom: Spacing.lg,
  },
  tabBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', paddingVertical: 8, borderRadius: 10,
  },
  tabBtnActive:     { backgroundColor: Colors.primary },
  tabBtnText:       { fontSize: 13, fontWeight: '600', color: Colors.textMuted },
  tabBtnTextActive: { color: Colors.white },
  otpHint: { fontSize: 13, color: Colors.textSecondary, marginBottom: Spacing.md, lineHeight: 20 },
  btn:         { marginTop: Spacing.sm },
  forgotBtn:   { alignItems: 'center', marginTop: Spacing.md },
  forgotText:  { fontSize: 13, color: Colors.primary, fontWeight: '600' },
  registerRow: { flexDirection: 'row', justifyContent: 'center', marginTop: Spacing.xl },
  registerText:{ fontSize: 14, color: 'rgba(255,255,255,0.9)' },
  registerLink:{ fontSize: 14, color: Colors.white, fontWeight: '800' },
});
