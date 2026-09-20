/**
 * useLocationVerification.ts
 *
 * Encapsulates ALL location verification logic for attendance.
 *
 * Fixes & Performance Upgrades:
 *  1. Concurrent calls share the in-flight Promise<GeoStatus> — if verification is
 *     already in progress when user taps "Check In", it awaits the active check and
 *     returns the real GeoStatus instead of returning 'checking' and causing false errors.
 *  2. Stable callback with memoized office coordinates avoids duplicate runs
 *     on query refetches.
 *  3. Fast-path memory caching returns 'valid' immediately if verified <30s ago.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { Alert, Linking } from 'react-native';
import * as Location from 'expo-location';
import {
  getLocation,
  checkGpsEnabled,
  requestLocationPermission,
  checkLocationPermission,
  LocationOptions,
} from '../services/locationService';
import { calculateDistance } from '../utils/geoUtils';

// ── Types ────────────────────────────────────────────────────────────────────

export type GeoStatus =
  | 'idle'
  | 'checking'
  | 'valid'
  | 'invalid'
  | 'permission_denied'
  | 'gps_disabled'
  | 'timeout'
  | 'low_accuracy'
  | 'error';

export interface OfficeGeofence {
  lat: number;
  lng: number;
  radius: number;
}

export interface LocationVerificationResult {
  status: GeoStatus;
  distance?: number;
  coords?: { latitude: number; longitude: number };
}

export interface UseLocationVerificationReturn {
  geoStatus: GeoStatus;
  geoDistance: number;
  userLocation: { latitude: number; longitude: number } | null;
  verifyLocation: (
    office: OfficeGeofence | null | undefined,
    options?: { forceRefresh?: boolean }
  ) => Promise<GeoStatus>;
  resetGeoStatus: (status?: GeoStatus) => void;
  openSettings: () => void;
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useLocationVerification(): UseLocationVerificationReturn {
  const [geoStatus, setGeoStatus] = useState<GeoStatus>('idle');
  const [geoDistance, setGeoDistance] = useState(0);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  // In-flight promise ref so multiple callers (mount effect, user tap, AppState) share the active run
  const inflightPromiseRef = useRef<Promise<GeoStatus> | null>(null);
  const lastVerifiedAtRef = useRef<number>(0);
  const lastStatusRef = useRef<GeoStatus>('idle');

  // Track mounted state to prevent state updates after unmount
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const openSettings = useCallback(() => {
    Linking.openSettings().catch(() => {});
  }, []);

  const resetGeoStatus = useCallback((status: GeoStatus = 'idle') => {
    lastStatusRef.current = status;
    if (isMountedRef.current) {
      setGeoStatus(status);
    }
  }, []);

  /**
   * verifyLocation — shared promise, fast caching, stable reference.
   */
  const verifyLocation = useCallback(
    async (
      office: OfficeGeofence | null | undefined,
      options: { forceRefresh?: boolean } = {}
    ): Promise<GeoStatus> => {
      // ── No office: always valid (WFH / bypass) ───────────────────
      if (!office) {
        lastStatusRef.current = 'valid';
        if (isMountedRef.current) setGeoStatus('valid');
        return 'valid';
      }

      // Fast-path: if verified within last 25 seconds and was valid
      const now = Date.now();
      if (!options.forceRefresh && lastStatusRef.current === 'valid' && now - lastVerifiedAtRef.current < 25_000) {
        return 'valid';
      }

      // ── If verification is already running, await that exact in-flight promise ──
      if (inflightPromiseRef.current) {
        return inflightPromiseRef.current;
      }

      const verificationTask = (async (): Promise<GeoStatus> => {
        if (isMountedRef.current) setGeoStatus('checking');

        try {
          // ── Check GPS enabled ───────────────────────────────────────────
          const gpsOn = await checkGpsEnabled();
          if (!gpsOn) {
            lastStatusRef.current = 'gps_disabled';
            if (isMountedRef.current) setGeoStatus('gps_disabled');
            return 'gps_disabled';
          }

          // ── Check/request permission ────────────────────────────────────
          const alreadyGranted = await checkLocationPermission();

          if (!alreadyGranted) {
            const shouldRequest = await new Promise<boolean>((resolve) => {
              Alert.alert(
                'Location Access Required',
                'WorknAI HRMS needs your location to verify you are within office premises for attendance.',
                [
                  { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
                  {
                    text: 'Allow',
                    onPress: async () => {
                      const granted = await requestLocationPermission();
                      resolve(granted);
                    },
                  },
                ],
                { cancelable: true, onDismiss: () => resolve(false) }
              );
            });

            if (!shouldRequest) {
              lastStatusRef.current = 'permission_denied';
              if (isMountedRef.current) setGeoStatus('permission_denied');
              return 'permission_denied';
            }

            const granted = await checkLocationPermission();
            if (!granted) {
              lastStatusRef.current = 'permission_denied';
              if (isMountedRef.current) setGeoStatus('permission_denied');
              return 'permission_denied';
            }
          }

          // ── Get location ────────────────────────────────────────────────
          const locationOpts: LocationOptions = {
            forceRefresh: options.forceRefresh ?? false,
            accuracy: Location.Accuracy.Balanced,
            timeout: 4_000,
            maxAge: 60_000,
            minAccuracyMeters: 200,
          };

          const result = await getLocation(locationOpts);

          if (!isMountedRef.current) return 'idle';

          if (result.type === 'gps_disabled') {
            lastStatusRef.current = 'gps_disabled';
            setGeoStatus('gps_disabled');
            return 'gps_disabled';
          }
          if (result.type === 'permission_denied') {
            lastStatusRef.current = 'permission_denied';
            setGeoStatus('permission_denied');
            return 'permission_denied';
          }
          if (result.type === 'timeout') {
            lastStatusRef.current = 'timeout';
            setGeoStatus('timeout');
            return 'timeout';
          }
          if (result.type === 'error' || result.type === 'unavailable') {
            lastStatusRef.current = 'error';
            setGeoStatus('error');
            return 'error';
          }

          if (result.coords) {
            const { latitude, longitude } = result.coords;
            setUserLocation({ latitude, longitude });

            const dist = calculateDistance(latitude, longitude, office.lat, office.lng);
            const distRounded = Math.round(dist);
            setGeoDistance(distRounded);

            const finalStatus: GeoStatus = distRounded <= office.radius ? 'valid' : 'invalid';
            lastStatusRef.current = finalStatus;
            lastVerifiedAtRef.current = Date.now();
            setGeoStatus(finalStatus);
            return finalStatus;
          }

          lastStatusRef.current = 'error';
          setGeoStatus('error');
          return 'error';
        } catch (err: any) {
          console.error('[useLocationVerification] Unexpected error:', err?.message);
          lastStatusRef.current = 'error';
          if (isMountedRef.current) setGeoStatus('error');
          return 'error';
        }
      })();

      inflightPromiseRef.current = verificationTask;

      try {
        return await verificationTask;
      } finally {
        inflightPromiseRef.current = null;
      }
    },
    []
  );

  return {
    geoStatus,
    geoDistance,
    userLocation,
    verifyLocation,
    resetGeoStatus,
    openSettings,
  };
}

