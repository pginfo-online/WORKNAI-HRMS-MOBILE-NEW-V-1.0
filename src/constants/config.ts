import { Platform } from 'react-native';

// For local testing: on Android emulator use 10.0.2.2, for physical device use LAN IP, for web use localhost
const DEV_URL = Platform.select({
  android: 'http://10.81.59.7:5001/api',
  ios: 'http://10.81.59.7:5001/api',
  default: 'http://10.81.59.7:5001/api',
});

export const CONFIG = {
  APP_NAME: 'WorknAI HRMS',
  API_BASE_URL: process.env.EXPO_PUBLIC_API_URL || DEV_URL,
  TIMEOUT: 15000,
};
