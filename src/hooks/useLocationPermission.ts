/**
 * useLocationPermission.ts
 *
 * Fixes:
 *  - Alert promise that could silently hang: now uses `cancelable: true`
 *    and handles the `onDismiss` case explicitly.
 *  - Added `checkGpsEnabled` export for components that need to surface
 *    GPS-off state before attempting permission flows.
 *  - Removed the invalid `LinkedState` import (was a typo for `Linking`).
 *  - `canAskAgain` branch now always resolves the gate.
 */

import { useState, useCallback } from 'react';
import { Alert, Linking } from 'react-native';
import * as Location from 'expo-location';
import { checkGpsEnabled as _checkGpsEnabled } from '../services/locationService';

export function useLocationPermission() {
  const [permissionStatus, setPermissionStatus] = useState<
    Location.PermissionStatus | 'undetermined'
  >('undetermined');
  const [isRequesting, setIsRequesting] = useState(false);

  const checkPermission = useCallback(async () => {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      setPermissionStatus(status);
      return status;
    } catch (err) {
      console.error('[LocationPermission] Check error:', err);
      return Location.PermissionStatus.UNDETERMINED;
    }
  }, []);

  /** Re-exports the service-level GPS check so UI can use this hook as the one-stop-shop */
  const checkGpsEnabled = useCallback(async (): Promise<boolean> => {
    return _checkGpsEnabled();
  }, []);

  const openSettings = useCallback(() => {
    Linking.openSettings().catch((err) => {
      console.error('[LocationPermission] Cannot open settings:', err);
    });
  }, []);

  /**
   * Request permission with a user-facing rationale alert.
   *
   * Returns true if permission is (or becomes) granted.
   *
   * Fixes:
   *  - `cancelable: true` + explicit `onDismiss` handler prevents Promise from hanging
   *    when user dismisses the alert by tapping outside on Android.
   *  - `canAskAgain` false path now fully resolves to false.
   */
  const requestPermissionWithRationale = useCallback(
    async (customTitle?: string, customMessage?: string): Promise<boolean> => {
      setIsRequesting(true);
      try {
        const current = await Location.getForegroundPermissionsAsync();

        if (current.status === Location.PermissionStatus.GRANTED) {
          setPermissionStatus(Location.PermissionStatus.GRANTED);
          return true;
        }

        // Already permanently denied — direct to settings, don't try to ask again
        if (current.status === Location.PermissionStatus.DENIED && !current.canAskAgain) {
          setPermissionStatus(Location.PermissionStatus.DENIED);
          await new Promise<void>((resolve) => {
            Alert.alert(
              'Location Permission Blocked',
              'Location access was denied. Please enable it in App Settings to use office attendance.',
              [
                { text: 'Not Now', style: 'cancel', onPress: () => resolve() },
                { text: 'Open Settings', onPress: () => { openSettings(); resolve(); } },
              ],
              { cancelable: true, onDismiss: () => resolve() }
            );
          });
          return false;
        }

        // Show rationale then request system permission
        return new Promise<boolean>((resolve) => {
          const handleGrant = async () => {
            try {
              const res = await Location.requestForegroundPermissionsAsync();
              setPermissionStatus(res.status);
              resolve(res.status === Location.PermissionStatus.GRANTED);
            } catch (err) {
              console.error('[LocationPermission] Request error:', err);
              resolve(false);
            }
          };

          Alert.alert(
            customTitle || 'Location Access Required',
            customMessage ||
              'WorknAI HRMS needs your location to verify you are within office premises during check-in and check-out.',
            [
              { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
              { text: 'Continue', onPress: handleGrant },
            ],
            // cancelable: true so Android back-button / outside-tap resolves the promise
            { cancelable: true, onDismiss: () => resolve(false) }
          );
        });
      } catch (err) {
        console.error('[LocationPermission] Error:', err);
        return false;
      } finally {
        setIsRequesting(false);
      }
    },
    [openSettings]
  );

  return {
    permissionStatus,
    isRequesting,
    checkPermission,
    checkGpsEnabled,
    requestPermissionWithRationale,
    openSettings,
  };
}
