/**
 * locationService.ts
 * Production-grade location service for attendance/geofencing.
 *
 * Features:
 *  - High-speed fast-path via last-known position (<30ms)
 *  - Adaptive accuracy (Balanced on Android, High on iOS)
 *  - Intelligent fallback: if fresh satellite fix times out (4s),
 *    gracefully falls back to recent last-known reading instead of failing
 *  - Deduplication: concurrent calls share the exact same in-flight promise
 *  - Non-blocking GPS services and permission checking
 */

import { Platform } from 'react-native';
import * as Location from 'expo-location';

// ── Types ────────────────────────────────────────────────────────────────────

export type LocationResultType =
  | 'success'
  | 'timeout'
  | 'gps_disabled'
  | 'permission_denied'
  | 'low_accuracy'
  | 'unavailable'
  | 'error';

export interface LocationResult {
  type: LocationResultType;
  coords?: {
    latitude: number;
    longitude: number;
    accuracy: number | null;
  };
  errorMessage?: string;
}

export interface LocationOptions {
  /** Max age (ms) of a last-known position to accept as fast path. Default: 60_000 */
  maxAge?: number;
  /** Timeout (ms) before giving up on fresh GPS fix. Default: 4_000 */
  timeout?: number;
  /** expo-location accuracy level. Default: Balanced */
  accuracy?: Location.Accuracy;
  /** If true, skip the last-known-position fast path. Default: false */
  forceRefresh?: boolean;
  /** Minimum acceptable accuracy (meters). Default: 200 */
  minAccuracyMeters?: number;
}

// ── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_TIMEOUT_MS = 4_000;
const DEFAULT_MAX_AGE_MS = 60_000;
const FALLBACK_MAX_AGE_MS = 300_000; // 5 minutes fallback
const DEFAULT_MIN_ACCURACY_M = 200;

// ── Singleton in-flight guard ────────────────────────────────────────────────

let _inflight: Promise<LocationResult> | null = null;
let _lastSuccessfulCoords: { latitude: number; longitude: number; accuracy: number | null; timestamp: number } | null = null;

// ── Core Helpers ─────────────────────────────────────────────────────────────

async function _checkGpsServices(): Promise<boolean> {
  try {
    return await Location.hasServicesEnabledAsync();
  } catch {
    return true;
  }
}

async function _checkPermission(): Promise<boolean> {
  try {
    const { status } = await Location.getForegroundPermissionsAsync();
    return status === Location.PermissionStatus.GRANTED;
  } catch {
    return false;
  }
}

function _withTimeout<T>(promise: Promise<T>, ms: number, onTimeout: () => T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => {
      const id = setTimeout(() => resolve(onTimeout()), ms);
      promise.then(() => clearTimeout(id)).catch(() => clearTimeout(id));
    }),
  ]);
}

// ── Public API ───────────────────────────────────────────────────────────────

export async function checkGpsEnabled(): Promise<boolean> {
  return _checkGpsServices();
}

export async function checkLocationPermission(): Promise<boolean> {
  return _checkPermission();
}

export async function requestLocationPermission(): Promise<boolean> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    return status === Location.PermissionStatus.GRANTED;
  } catch {
    return false;
  }
}

/**
 * Get current device location with sub-second fast path and robust fallbacks.
 */
export async function getLocation(options: LocationOptions = {}): Promise<LocationResult> {
  // Return active in-flight promise if one is already running
  if (_inflight) {
    return _inflight;
  }

  const timeout = options.timeout ?? DEFAULT_TIMEOUT_MS;
  // Bound the complete operation, including permission/service checks and fallback reads.
  // Native location calls cannot always be cancelled, so keep the shared guard until the
  // operation settles while ensuring callers always receive a terminal result.
  const operation = _fetchLocation(options);
  const timedOperation = _withTimeout(
    operation,
    timeout + 2_000,
    () => ({ type: 'timeout' as LocationResultType, errorMessage: `Location timed out after ${(timeout + 2_000) / 1000}s.` }),
  );
  _inflight = timedOperation;
  // Keep deduplication active until the native operation itself settles, even if
  // the caller has already received the bounded timeout result.
  operation.then(
    () => { if (_inflight === timedOperation) _inflight = null; },
    () => { if (_inflight === timedOperation) _inflight = null; },
  );

  return timedOperation;
}

async function _fetchLocation(options: LocationOptions): Promise<LocationResult> {
  const {
    maxAge = DEFAULT_MAX_AGE_MS,
    timeout = DEFAULT_TIMEOUT_MS,
    accuracy = Platform.OS === 'ios' ? Location.Accuracy.High : Location.Accuracy.Balanced,
    forceRefresh = false,
    minAccuracyMeters = DEFAULT_MIN_ACCURACY_M,
  } = options;

  // ── Step 1: GPS services ──────────────────────────────────────────────────
  const gpsEnabled = await _checkGpsServices();
  if (!gpsEnabled) {
    return { type: 'gps_disabled', errorMessage: 'Location services are disabled on this device.' };
  }

  // ── Step 2: Permission ────────────────────────────────────────────────────
  const permitted = await _checkPermission();
  if (!permitted) {
    return { type: 'permission_denied', errorMessage: 'Location permission has not been granted.' };
  }

  // ── Step 3: Fast-path: Recent memory cache ────────────────────────────────
  if (!forceRefresh && _lastSuccessfulCoords) {
    const age = Date.now() - _lastSuccessfulCoords.timestamp;
    if (age <= maxAge && (_lastSuccessfulCoords.accuracy == null || _lastSuccessfulCoords.accuracy <= minAccuracyMeters)) {
      return {
        type: 'success',
        coords: {
          latitude: _lastSuccessfulCoords.latitude,
          longitude: _lastSuccessfulCoords.longitude,
          accuracy: _lastSuccessfulCoords.accuracy,
        },
      };
    }
  }

  // ── Step 4: Fast-path: OS last-known position ─────────────────────────────
  if (!forceRefresh) {
    try {
      const last = await Location.getLastKnownPositionAsync({ maxAge, requiredAccuracy: minAccuracyMeters });
      if (last?.coords && (last.coords.accuracy == null || last.coords.accuracy <= minAccuracyMeters)) {
        _lastSuccessfulCoords = {
          latitude: last.coords.latitude,
          longitude: last.coords.longitude,
          accuracy: last.coords.accuracy,
          timestamp: last.timestamp || Date.now(),
        };
        return {
          type: 'success',
          coords: {
            latitude: last.coords.latitude,
            longitude: last.coords.longitude,
            accuracy: last.coords.accuracy,
          },
        };
      }
    } catch {
      // Fall through to fresh position
    }
  }

  // ── Step 5: Fresh position with adaptive timeout ──────────────────────────
  const freshResult = await _withTimeout(
    _getFreshPosition(accuracy, minAccuracyMeters),
    timeout,
    () => ({ type: 'timeout' as LocationResultType, errorMessage: `Location timed out after ${timeout / 1000}s.` })
  );

  if (freshResult.type === 'success') {
    return freshResult;
  }

  // ── Step 6: Graceful Fallback if fresh fix timed out ──────────────────────
  if (freshResult.type === 'timeout' || freshResult.type === 'unavailable' || freshResult.type === 'low_accuracy') {
    try {
      const fallback = await Location.getLastKnownPositionAsync({ maxAge: FALLBACK_MAX_AGE_MS });
      if (fallback?.coords) {
        _lastSuccessfulCoords = {
          latitude: fallback.coords.latitude,
          longitude: fallback.coords.longitude,
          accuracy: fallback.coords.accuracy,
          timestamp: fallback.timestamp || Date.now(),
        };
        return {
          type: 'success',
          coords: {
            latitude: fallback.coords.latitude,
            longitude: fallback.coords.longitude,
            accuracy: fallback.coords.accuracy,
          },
        };
      }
    } catch (_) {}

    if (_lastSuccessfulCoords && Date.now() - _lastSuccessfulCoords.timestamp < FALLBACK_MAX_AGE_MS) {
      return {
        type: 'success',
        coords: {
          latitude: _lastSuccessfulCoords.latitude,
          longitude: _lastSuccessfulCoords.longitude,
          accuracy: _lastSuccessfulCoords.accuracy,
        },
      };
    }
  }

  return freshResult;
}

async function _getFreshPosition(
  accuracy: Location.Accuracy,
  minAccuracyMeters: number
): Promise<LocationResult> {
  try {
    const position = await Location.getCurrentPositionAsync({ accuracy });

    if (!position?.coords) {
      return { type: 'unavailable', errorMessage: 'Location data unavailable.' };
    }

    const { latitude, longitude, accuracy: posAccuracy } = position.coords;

    _lastSuccessfulCoords = {
      latitude,
      longitude,
      accuracy: posAccuracy,
      timestamp: position.timestamp || Date.now(),
    };

    if (posAccuracy != null && posAccuracy > minAccuracyMeters) {
      return {
        type: 'low_accuracy',
        coords: { latitude, longitude, accuracy: posAccuracy },
        errorMessage: `Location accuracy too low: ${Math.round(posAccuracy)}m (max ${minAccuracyMeters}m).`,
      };
    }

    return {
      type: 'success',
      coords: { latitude, longitude, accuracy: posAccuracy },
    };
  } catch (err: any) {
    const message: string = err?.message || 'Unknown location error';

    if (message.includes('Location services are disabled')) {
      return { type: 'gps_disabled', errorMessage: message };
    }
    if (message.includes('Not authorized') || message.includes('permission')) {
      return { type: 'permission_denied', errorMessage: message };
    }

    return { type: 'error', errorMessage: message };
  }
}

