import { useState, useEffect, useCallback } from 'react';
import * as LocalAuthentication from 'expo-local-authentication';

export interface BiometricStatus {
  hasHardware: boolean;
  isEnrolled: boolean;
  supportedTypes: LocalAuthentication.AuthenticationType[];
  isSecurityLevelHigh: boolean;
  isLoading: boolean;
}

export interface BiometricAuthResult {
  success: boolean;
  error?: string;
  cancelled?: boolean;
  warning?: string;
}

export function useBiometricAuth() {
  const [status, setStatus] = useState<BiometricStatus>({
    hasHardware: false,
    isEnrolled: false,
    supportedTypes: [],
    isSecurityLevelHigh: false,
    isLoading: true,
  });

  const checkBiometricCapability = useCallback(async () => {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();
      let securityLevel = LocalAuthentication.SecurityLevel.NONE;

      try {
        securityLevel = await LocalAuthentication.getEnrolledLevelAsync();
      } catch (_) {
        // Fallback if security level is not accessible on web or certain platforms
      }

      setStatus({
        hasHardware,
        isEnrolled,
        supportedTypes,
        isSecurityLevelHigh: securityLevel === LocalAuthentication.SecurityLevel.BIOMETRIC,
        isLoading: false,
      });
    } catch (err) {
      console.error('[Biometric] Capability check error:', err);
      setStatus({
        hasHardware: false,
        isEnrolled: false,
        supportedTypes: [],
        isSecurityLevelHigh: false,
        isLoading: false,
      });
    }
  }, []);

  useEffect(() => {
    checkBiometricCapability();
  }, [checkBiometricCapability]);

  const authenticate = async (reason = 'Verify identity to perform attendance action'): Promise<BiometricAuthResult> => {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();

      // If hardware is missing or user has not enrolled biometrics, gracefully fallback
      if (!hasHardware || !isEnrolled) {
        return {
          success: true,
          warning: !hasHardware
            ? 'Biometric hardware not available on device.'
            : 'Biometrics not configured on device.',
        };
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: reason,
        cancelLabel: 'Cancel',
        fallbackLabel: 'Use Passcode',
        disableDeviceFallback: false,
      });

      if (result.success) {
        return { success: true };
      }

      if (result.error === 'user_cancel' || result.error === 'system_cancel' || result.error === 'app_cancel') {
        return { success: false, cancelled: true, error: 'Authentication cancelled' };
      }

      if (result.error?.includes('lockout')) {
        return { success: false, error: 'Biometrics locked due to failed attempts. Please unlock device.' };
      }

      return {
        success: false,
        error: result.error ? `Authentication failed (${result.error})` : 'Biometric authentication failed',
      };
    } catch (err: any) {
      console.error('[Biometric] Auth error:', err);
      return {
        success: false,
        error: err.message || 'Biometric authentication error',
      };
    }
  };

  return {
    ...status,
    refreshStatus: checkBiometricCapability,
    authenticate,
  };
}
