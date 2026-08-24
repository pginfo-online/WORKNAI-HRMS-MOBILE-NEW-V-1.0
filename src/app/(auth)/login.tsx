import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useAuthStore } from '../../store/auth.store';
import { useUIStore } from '../../store/ui.store';
import { authApi } from '../../api/auth.api';
import { colors } from '../../constants/colors';
import { Button } from '../../components/ui/Button';

export default function LoginScreen() {
  const { setAuth } = useAuthStore();
  const { isDark, theme } = useUIStore();

  const [employeeCode, setEmployeeCode] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const passwordInputRef = React.useRef<TextInput>(null);

  const handleLogin = async () => {
    if (!employeeCode.trim() || !password.trim()) {
      return Toast.show({
        type: 'error',
        text1: 'Validation Error',
        text2: 'Please enter your employee code and password',
      });
    }

    setLoading(true);
    try {
      const res = await authApi.login({
        employeeCode: employeeCode.trim().toUpperCase(),
        password: password.trim(),
      });

      const { employee, accessToken, refreshToken } = res.data.data;
      await setAuth(employee, accessToken, refreshToken);
      Toast.show({
        type: 'success',
        text1: 'Welcome back!',
        text2: `Logged in as ${employee.name}`,
      });
    } catch (err: any) {
      Toast.show({
        type: 'error',
        text1: 'Login Failed',
        text2: err.response?.data?.message || 'Invalid credentials',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.container, { backgroundColor: theme.background }]}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} bounces={false}>
        {/* Header Hero */}
        <View style={styles.heroSection}>
          <LinearGradient
            colors={colors.gradients.primary}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.logoBadge}
          >
            <Ionicons name="briefcase" size={32} color="#FFFFFF" />
          </LinearGradient>
          <Text style={[styles.title, { color: theme.text }]}>WorknAI HRMS</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            Sign in to access your employee portal
          </Text>
        </View>

        {/* Card Form */}
        <View style={[styles.formCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          {/* Employee Code */}
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: theme.text }]}>Employee Code</Text>
            <View style={[styles.inputWrapper, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}>
              <Ionicons name="person-outline" size={18} color={theme.textTertiary} style={styles.inputIcon} />
              <TextInput
                value={employeeCode}
                onChangeText={setEmployeeCode}
                placeholder="e.g. WA00001"
                placeholderTextColor={theme.textTertiary}
                autoCapitalize="characters"
                autoCorrect={false}
                returnKeyType="next"
                onSubmitEditing={() => passwordInputRef.current?.focus()}
                blurOnSubmit={false}
                style={[styles.input, { color: theme.text }]}
              />
            </View>
          </View>

          {/* Password */}
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: theme.text }]}>Password</Text>
            <View style={[styles.inputWrapper, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}>
              <Ionicons name="lock-closed-outline" size={18} color={theme.textTertiary} style={styles.inputIcon} />
              <TextInput
                ref={passwordInputRef}
                value={password}
                onChangeText={setPassword}
                placeholder="Enter password"
                placeholderTextColor={theme.textTertiary}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                returnKeyType="done"
                onSubmitEditing={handleLogin}
                style={[styles.input, { color: theme.text }]}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={18}
                  color={theme.textTertiary}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Sign In Button */}
          <Button
            title="Sign In"
            onPress={handleLogin}
            variant="gradient"
            size="lg"
            loading={loading}
            style={styles.loginBtn}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoBadge: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 4,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    marginTop: 6,
    textAlign: 'center',
  },
  formCard: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 24,
    gap: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.05,
    shadowRadius: 20,
    elevation: 3,
  },
  inputGroup: {
    gap: 8,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    height: 50,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
  },
  eyeBtn: {
    padding: 4,
  },
  loginBtn: {
    marginTop: 8,
  },
});
