import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useDispatch, useSelector } from 'react-redux';
import { loginWithOtp } from '../../store/authSlice';
import { Colors, Spacing, Typography } from '../../theme';

const OTP_LENGTH = 6;
const RESEND_SECONDS = 30;

export default function OtpVerificationScreen({ route, navigation }) {
  const { phone, demoOtp } = route.params;
  const dispatch = useDispatch();
  const { isLoading } = useSelector((s) => s.auth);

  const [digits, setDigits]       = useState(Array(OTP_LENGTH).fill(''));
  const [error, setError]         = useState('');
  const [countdown, setCountdown] = useState(RESEND_SECONDS);
  const [resending, setResending] = useState(false);

  const inputRefs = useRef([]);

  // Countdown timer
  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const handleDigitChange = (text, idx) => {
    // Allow paste of full OTP
    if (text.length > 1) {
      const pasted = text.replace(/\D/g, '').slice(0, OTP_LENGTH);
      const arr = Array(OTP_LENGTH).fill('');
      for (let i = 0; i < pasted.length; i++) arr[i] = pasted[i];
      setDigits(arr);
      const focusIdx = Math.min(pasted.length, OTP_LENGTH - 1);
      inputRefs.current[focusIdx]?.focus();
      return;
    }
    const val = text.replace(/\D/g, '');
    const arr = [...digits];
    arr[idx] = val;
    setDigits(arr);
    setError('');
    if (val && idx < OTP_LENGTH - 1) {
      inputRefs.current[idx + 1]?.focus();
    }
  };

  const handleKeyPress = (e, idx) => {
    if (e.nativeEvent.key === 'Backspace' && !digits[idx] && idx > 0) {
      inputRefs.current[idx - 1]?.focus();
    }
  };

  const handleVerify = async () => {
    const code = digits.join('');
    if (code.length < OTP_LENGTH) {
      setError('Please enter the complete 6-digit OTP.');
      return;
    }
    setError('');
    const result = await dispatch(loginWithOtp({ phone, code }));
    if (loginWithOtp.rejected.match(result)) {
      setError(result.payload || 'Invalid OTP. Please try again.');
    }
  };

  const handleResend = async () => {
    setResending(true);
    setDigits(Array(OTP_LENGTH).fill(''));
    setError('');
    try {
      const res = await fetch(
        (process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000') + '/api/auth/send-otp',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone }),
        }
      );
      const data = await res.json();
      if (data.success) {
        setCountdown(RESEND_SECONDS);
        // Update demo OTP in navigation params
        navigation.setParams({ demoOtp: data.otp });
      } else {
        setError(data.message || 'Failed to resend OTP.');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setResending(false);
    }
  };

  const maskedPhone = phone.replace(/(\d{2})\d{6}(\d{2})/, '$1xxxxxx$2');

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">

          {/* Back button */}
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <MaterialCommunityIcons name="arrow-left" size={22} color={Colors.white} />
          </TouchableOpacity>

          {/* Header */}
          <View style={styles.hero}>
            <View style={styles.iconCircle}>
              <MaterialCommunityIcons name="message-text-lock-outline" size={42} color={Colors.primary} />
            </View>
            <Text style={styles.heroTitle}>OTP Verification</Text>
            <Text style={styles.heroSub}>
              Enter the 6-digit code sent to{'\n'}
              <Text style={styles.heroPhone}>+91 {maskedPhone}</Text>
            </Text>
          </View>

          {/* Demo OTP banner */}
          {demoOtp ? (
            <View style={styles.demoBanner}>
              <MaterialCommunityIcons name="information-outline" size={16} color="#1565c0" style={{ marginRight: 6 }} />
              <Text style={styles.demoText}>Demo OTP: <Text style={styles.demoCode}>{demoOtp}</Text></Text>
            </View>
          ) : null}

          {/* OTP Boxes */}
          <View style={styles.otpRow}>
            {digits.map((d, idx) => (
              <TextInput
                key={idx}
                ref={(r) => { inputRefs.current[idx] = r; }}
                style={[styles.otpBox, d ? styles.otpBoxFilled : null, error ? styles.otpBoxError : null]}
                value={d}
                onChangeText={(t) => handleDigitChange(t, idx)}
                onKeyPress={(e) => handleKeyPress(e, idx)}
                keyboardType="number-pad"
                maxLength={OTP_LENGTH} // allows paste
                selectTextOnFocus
                caretHidden
              />
            ))}
          </View>

          {/* Error */}
          {error ? (
            <Text style={styles.errorText}>{error}</Text>
          ) : null}

          {/* Verify Button */}
          <TouchableOpacity
            style={[styles.verifyBtn, isLoading && styles.verifyBtnDisabled]}
            onPress={handleVerify}
            disabled={isLoading}
            activeOpacity={0.85}
          >
            {isLoading ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <>
                <MaterialCommunityIcons name="check-circle-outline" size={20} color={Colors.white} style={{ marginRight: 8 }} />
                <Text style={styles.verifyBtnText}>Verify & Login</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Resend */}
          <View style={styles.resendRow}>
            {countdown > 0 ? (
              <Text style={styles.resendWait}>
                Resend OTP in <Text style={styles.resendTimer}>{countdown}s</Text>
              </Text>
            ) : (
              <TouchableOpacity onPress={handleResend} disabled={resending}>
                {resending ? (
                  <ActivityIndicator size="small" color={Colors.white} />
                ) : (
                  <Text style={styles.resendLink}>Resend OTP</Text>
                )}
              </TouchableOpacity>
            )}
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
  backBtn:   { marginTop: Spacing.md, alignSelf: 'flex-start', padding: 4 },

  hero: { alignItems: 'center', paddingTop: Spacing.xl, paddingBottom: Spacing.xl },
  iconCircle: {
    width: 90, height: 90, borderRadius: 45,
    backgroundColor: Colors.white,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: Spacing.md,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2, shadowRadius: 8, elevation: 6,
  },
  heroTitle: { fontSize: 24, fontWeight: '800', color: Colors.white, marginBottom: 8 },
  heroSub:   { fontSize: 14, color: 'rgba(255,255,255,0.8)', textAlign: 'center', lineHeight: 22 },
  heroPhone: { fontWeight: '700', color: Colors.white },

  demoBanner: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#e3f2fd', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 10,
    marginBottom: Spacing.lg,
  },
  demoText: { fontSize: 13, color: '#1565c0' },
  demoCode: { fontWeight: '800', fontSize: 15, letterSpacing: 2 },

  otpRow: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginBottom: Spacing.md },
  otpBox: {
    width: 48, height: 56,
    borderRadius: 12,
    backgroundColor: Colors.white,
    textAlign: 'center',
    fontSize: 22,
    fontWeight: '700',
    color: Colors.text,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  otpBoxFilled: { borderColor: Colors.primary },
  otpBoxError:  { borderColor: '#ef5350' },

  errorText: {
    color: '#ffcdd2',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },

  verifyBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.white,
    paddingVertical: 16, borderRadius: 14,
    marginBottom: Spacing.lg,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15, shadowRadius: 8, elevation: 4,
  },
  verifyBtnDisabled: { opacity: 0.7 },
  verifyBtnText: { fontSize: 16, fontWeight: '700', color: Colors.primary },

  resendRow:   { alignItems: 'center' },
  resendWait:  { fontSize: 13, color: 'rgba(255,255,255,0.7)' },
  resendTimer: { fontWeight: '700', color: Colors.white },
  resendLink:  { fontSize: 14, fontWeight: '700', color: Colors.white, textDecorationLine: 'underline' },
});
