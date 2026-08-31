import axios from 'axios';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { CONFIG } from '../constants/config';

export interface VersionCheckParams {
  platform?: string;
  version?: string;
  versionCode?: number;
  deviceId?: string;
}

export interface VersionCheckResult {
  updateRequired: boolean;
  updateType?: 'optional' | 'recommended' | 'important' | 'critical' | 'maintenance';
  title?: string;
  description?: string;
  updateLink?: string;
  releaseNotes?: string[];
  latestVersion?: string;
  versionCode?: number;
  minVersion?: string;
  maintenanceMode?: boolean;
}

// Lightweight non-blocking API call with short timeout so it never impacts app launch performance
export const appVersionApi = {
  checkVersion: (params: VersionCheckParams) => {
    const defaultPlatform = Platform.OS === 'ios' ? 'ios' : 'android';
    const appVersion = Constants.expoConfig?.version || '1.0.0';
    return axios.get(`${CONFIG.API_BASE_URL}/app-version/check`, {
      params: {
        platform: params.platform || defaultPlatform,
        version: params.version || appVersion,
        deviceId: params.deviceId || '',
        versionCode: params.versionCode,
      },
      timeout: 5000, // 5s fast timeout to guarantee non-blocking execution
    });
  },
};

export default appVersionApi;

