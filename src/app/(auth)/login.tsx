import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  Image,
  Keyboard,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Toast from 'react-native-toast-message';
import { useAuthStore } from '../../store/auth.store';
import { useUIStore } from '../../store/ui.store';
import { authApi } from '../../api/auth.api';
import { colors } from '../../constants/colors';
import { CONFIG } from '../../constants/config';

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { setAuth } = useAuthStore();
  const { isDark, theme } = useUIStore();

  const [employeeCode, setEmployeeCode] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  const [codeFocused, setCodeFocused] = useState(false);
  const [passFocused, setPassFocused] = useState(false);
  const [codeError, setCodeError] = useState('');
  const [passError, setPassError] = useState('');

  const isSubmittingRef = useRef(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const passwordInputRef = useRef<TextInput>(null);

  // Monitor keyboard visibility for smooth layout adjustments
  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setIsKeyboardVisible(true)
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setIsKeyboardVisible(false)
    );

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const handleInputFocus = (field: 'code' | 'pass') => {
    if (field === 'code') {
      setCodeFocused(true);
      if (codeError) setCodeError('');
    } else {
      setPassFocused(true);
      if (passError) setPassError('');
    }

    setTimeout(() => {
      scrollViewRef.current?.scrollTo({
        y: field === 'code' ? 30 : 80,
        animated: true,
      });
    }, 120);
  };

  const validateForm = (): boolean => {
    let isValid = true;
    const trimmedCode = employeeCode.trim();
    const trimmedPass = password.trim();

    if (!trimmedCode) {
      setCodeError('Employee code is required');
      isValid = false;
    } else {
      setCodeError('');
    }

    if (!trimmedPass) {
      setPassError('Password is required');
      isValid = false;
    } else {
      setPassError('');
    }

    return isValid;
  };

  const handleLogin = useCallback(async () => {
    if (isSubmittingRef.current || loading) return;

    Keyboard.dismiss();

    if (!validateForm()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    isSubmittingRef.current = true;
    setLoading(true);

    try {
      const res = await authApi.login({
        employeeCode: employeeCode.trim().toUpperCase(),
        password: password.trim(),
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const { employee, accessToken, refreshToken } = res.data.data;
      await setAuth(employee, accessToken, refreshToken);
    } catch (err: any) {
      isSubmittingRef.current = false;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const errorMsg =
        err.response?.data?.message ||
        (err.message === 'Network Error' || err.code === 'ERR_NETWORK' || !err.response
          ? `Cannot connect to server (${CONFIG.API_BASE_URL}). Please check connection.`
          : err.message) ||
        'Invalid employee code or password';

      Toast.show({
        type: 'error',
        text1: 'Authentication Failed',
        text2: errorMsg,
      });
    } finally {
      setLoading(false);
      isSubmittingRef.current = false;
    }
  }, [employeeCode, password, setAuth, loading]);

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: theme.background }]}
      edges={['top', 'bottom', 'left', 'right']}
    >
      <StatusBar style={isDark ? 'light' : 'dark'} />

      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          ref={scrollViewRef}
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop: isKeyboardVisible ? 12 : Math.max(insets.top > 0 ? 24 : 36, 24),
              paddingBottom: Math.max(insets.bottom + 20, 24),
            },
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* Centered Brand Hero */}
          <View style={[styles.heroSection, isKeyboardVisible && styles.heroSectionCompact]}>
            <View
              style={[
                styles.logoContainer,
                {
                  backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
                  borderColor: isDark ? 'rgba(255,255,255,0.1)' : theme.border,
                },
                isKeyboardVisible && styles.logoContainerCompact,
              ]}
            >
              <Image
                source={require('../../../assets/images/logo.png')}
                style={styles.logoImg}
                resizeMode="contain"
                accessibilityLabel="WorknAI HRMS Logo"
              />
            </View>
            <Text style={[styles.title, { color: theme.text }]}>WorknAI HRMS</Text>
            {!isKeyboardVisible && (
              <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
                Enterprise Employee Portal Sign-In
              </Text>
            )}
          </View>

          {/* Login Card */}
          <View
            style={[
              styles.formCard,
              {
                backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
                borderColor: isDark ? 'rgba(255,255,255,0.08)' : theme.border,
              },
            ]}
          >
            {/* Employee Code Input */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.text }]}>Employee Code</Text>
              <View
                style={[
                  styles.inputWrapper,
                  {
                    backgroundColor: isDark ? '#0F172A' : theme.surfaceAlt,
                    borderColor: codeError
                      ? colors.error
                      : codeFocused
                      ? colors.primary
                      : isDark
                      ? '#334155'
                      : theme.border,
                  },
                ]}
              >
                <Ionicons
                  name="person-outline"
                  size={18}
                  color={codeFocused ? colors.primary : theme.textTertiary}
                  style={styles.inputIcon}
                />
                <TextInput
                  value={employeeCode}
                  onChangeText={(text) => {
                    setEmployeeCode(text.toUpperCase());
                    if (codeError) setCodeError('');
                  }}
                  onFocus={() => handleInputFocus('code')}
                  onBlur={() => setCodeFocused(false)}
                  placeholder="e.g. EMP001"
                  placeholderTextColor={theme.textTertiary}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  autoComplete="username"
                  textContentType="username"
                  returnKeyType="next"
                  onSubmitEditing={() => passwordInputRef.current?.focus()}
                  blurOnSubmit={false}
                  style={[styles.input, { color: theme.text }]}
                  accessibilityLabel="Employee Code Input"
                />
                {employeeCode.length > 0 && (
                  <TouchableOpacity
                    onPress={() => {
                      Haptics.selectionAsync();
                      setEmployeeCode('');
                    }}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    accessibilityLabel="Clear Employee Code"
                    accessibilityRole="button"
                    style={styles.clearBtn}
                  >
                    <Ionicons name="close-circle" size={18} color={theme.textTertiary} />
                  </TouchableOpacity>
                )}
              </View>
              {codeError ? (
                <View style={styles.errorContainer}>
                  <Ionicons name="alert-circle" size={13} color={colors.error} />
                  <Text style={styles.errorText}>{codeError}</Text>
                </View>
              ) : null}
            </View>

            {/* Password Input */}
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.text }]}>Password</Text>
              <View
                style={[
                  styles.inputWrapper,
                  {
                    backgroundColor: isDark ? '#0F172A' : theme.surfaceAlt,
                    borderColor: passError
                      ? colors.error
                      : passFocused
                      ? colors.primary
                      : isDark
                      ? '#334155'
                      : theme.border,
                  },
                ]}
              >
                <Ionicons
                  name="lock-closed-outline"
                  size={18}
                  color={passFocused ? colors.primary : theme.textTertiary}
                  style={styles.inputIcon}
                />
                <TextInput
                  ref={passwordInputRef}
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    if (passError) setPassError('');
                  }}
                  onFocus={() => handleInputFocus('pass')}
                  onBlur={() => setPassFocused(false)}
                  placeholder="Enter account password"
                  placeholderTextColor={theme.textTertiary}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="current-password"
                  textContentType="password"
                  returnKeyType="done"
                  onSubmitEditing={handleLogin}
                  style={[styles.input, { color: theme.text }]}
                  accessibilityLabel="Password Input"
                />
                <TouchableOpacity
                  onPress={() => {
                    Haptics.selectionAsync();
                    setShowPassword((prev) => !prev);
                  }}
                  style={styles.eyeButton}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                  accessibilityRole="button"
                >
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={18}
                    color={passFocused ? colors.primary : theme.textTertiary}
                  />
                </TouchableOpacity>
              </View>
              {passError ? (
                <View style={styles.errorContainer}>
                  <Ionicons name="alert-circle" size={13} color={colors.error} />
                  <Text style={styles.errorText}>{passError}</Text>
                </View>
              ) : null}
            </View>

            {/* Sign In Submit Button */}
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={handleLogin}
              disabled={loading}
              style={[
                styles.submitButton,
                { backgroundColor: colors.primary, opacity: loading ? 0.75 : 1 },
              ]}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <View style={styles.btnInnerRow}>
                  <Ionicons name="log-in-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.submitBtnText}>Sign In to Account</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Footer Notice */}
          <View style={styles.footer}>
            <Ionicons name="shield-checkmark-outline" size={13} color={theme.textTertiary} />
            <Text style={[styles.footerText, { color: theme.textTertiary }]}>
              Enterprise Security & Biometrics Enabled · v1.0
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  keyboardAvoid: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 22,
    gap: 20,
    justifyContent: 'center',
  },
  heroSection: {
    alignItems: 'center',
    gap: 4,
  },
  heroSectionCompact: {
    gap: 2,
  },
  logoContainer: {
    width: 68,
    height: 68,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    padding: 8,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 12,
    elevation: 4,
  },
  logoContainerCompact: {
    width: 48,
    height: 48,
    borderRadius: 14,
    marginBottom: 4,
    padding: 6,
  },
  logoImg: {
    width: '100%',
    height: '100%',
  },
  title: {
    fontSize: 23,
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 2,
  },
  formCard: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 20,
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 3,
  },
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: -0.1,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1.2,
    paddingHorizontal: 14,
    height: 48,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    paddingVertical: 0,
  },
  clearBtn: {
    padding: 4,
  },
  eyeButton: {
    padding: 4,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  errorText: {
    fontSize: 11.5,
    color: colors.error,
    fontWeight: '600',
  },
  submitButton: {
    height: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  btnInnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 14.5,
    fontWeight: '800',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 2,
  },
  footerText: {
    fontSize: 11.5,
    textAlign: 'center',
    fontWeight: '500',
  },
});
