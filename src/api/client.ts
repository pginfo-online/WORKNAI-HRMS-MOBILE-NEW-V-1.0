import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CONFIG } from '../constants/config';
import { useAuthStore } from '../store/auth.store';

const client = axios.create({
  baseURL: CONFIG.API_BASE_URL,
  timeout: CONFIG.TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach Token
client.interceptors.request.use(async (config) => {
  try {
    // 1. Primary: Instant synchronous read from in-memory Zustand store
    let token: string | null = useAuthStore.getState().token;

    // 2. Secondary fallback: Storage
    if (!token) {
      try {
        token = await SecureStore.getItemAsync('accessToken');
      } catch {}
    }

    if (!token) {
      try {
        token = await AsyncStorage.getItem('accessToken');
      } catch {}
    }

    if (!token && typeof window !== 'undefined' && window.localStorage) {
      token = window.localStorage.getItem('accessToken');
    }

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch (err) {
    console.error('Failed to get token from storage', err);
  }
  return config;
});

// Refresh token interceptor
let isRefreshing = false;
let failedQueue: Array<{ resolve: (token: string) => void; reject: (err: any) => void }> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) prom.reject(error);
    else if (token) prom.resolve(token);
  });
  failedQueue = [];
};

client.interceptors.response.use(
  (res) => res,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (originalRequest.url?.includes('/auth/login') || originalRequest.url?.includes('/auth/refresh')) {
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return client(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // 1. Primary: In-memory refresh token
        let refreshToken: string | null = useAuthStore.getState().refreshToken;

        // 2. Secondary: Storage lookup
        if (!refreshToken) {
          try {
            refreshToken = await SecureStore.getItemAsync('refreshToken');
          } catch {}
        }

        if (!refreshToken) {
          try {
            refreshToken = await AsyncStorage.getItem('refreshToken');
          } catch {}
        }

        if (!refreshToken && typeof window !== 'undefined' && window.localStorage) {
          refreshToken = window.localStorage.getItem('refreshToken');
        }

        if (!refreshToken) throw new Error('No refresh token');

        const { data } = await axios.post(`${CONFIG.API_BASE_URL}/auth/refresh`, { refreshToken });
        const newToken = data.data.accessToken;
        const newRefreshToken = data.data.refreshToken;

        // Sync with Zustand store & storage
        const currentUser = useAuthStore.getState().user;
        if (currentUser) {
          await useAuthStore.getState().setAuth(currentUser, newToken, newRefreshToken);
        }

        processQueue(null, newToken);
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return client(originalRequest);
      } catch (err: any) {
        processQueue(err, null);
        // Only log out if refresh token endpoint explicitly confirmed token is invalid/expired
        const isAuthRejection = err?.response?.status === 401 || err?.response?.status === 403 || err?.message === 'No refresh token';
        if (isAuthRejection) {
          try {
            await useAuthStore.getState().logout();
          } catch (_) {}
        }
        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error);
  }
);

export default client;
