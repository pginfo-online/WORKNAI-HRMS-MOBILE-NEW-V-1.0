import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface User {
  _id: string;
  employeeCode: string;
  name: string;
  email: string;
  role: string;
  department?: string;
  position?: string;
  profileImageUrl?: string;
  mobileNumber?: string;
  alternateMobileNumber?: string;
  gender?: string;
  dateOfBirth?: string;
  bloodGroup?: string;
  maritalStatus?: string;
  fatherName?: string;
  motherName?: string;
  currentAddress?: string;
  permanentAddress?: string;
  district?: string;
  state?: string;
  pincode?: string;
  emergencyContactName?: string;
  emergencyContactRelationship?: string;
  emergencyContactMobile?: string;
  emergencyContactAddress?: string;
  paidLeaveBalance: number;
  compOffBalance: number;
  geoBypass?: boolean;
}

interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setAuth: (user: User, accessToken: string, refreshToken?: string) => Promise<void>;
  updateUser: (updates: Partial<User>) => Promise<void>;
  logout: () => Promise<void>;
  loadAuthFromStorage: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  refreshToken: null,
  isAuthenticated: false,
  isLoading: true,

  setAuth: async (user, accessToken, refreshToken) => {
    try {
      try {
        await SecureStore.setItemAsync('accessToken', accessToken);
        if (refreshToken) {
          await SecureStore.setItemAsync('refreshToken', refreshToken);
        }
      } catch {}

      try {
        await AsyncStorage.setItem('accessToken', accessToken);
        if (refreshToken) {
          await AsyncStorage.setItem('refreshToken', refreshToken);
        }
      } catch {}

      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem('accessToken', accessToken);
        if (refreshToken) window.localStorage.setItem('refreshToken', refreshToken);
      }
      await AsyncStorage.setItem('authUser', JSON.stringify(user));
      set({
        user,
        token: accessToken,
        refreshToken: refreshToken || null,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (err) {
      console.error('Failed to save auth to storage', err);
    }
  },

  updateUser: async (updates) => {
    const currentUser = get().user;
    if (!currentUser) return;
    const updated = { ...currentUser, ...updates };
    await AsyncStorage.setItem('authUser', JSON.stringify(updated));
    set({ user: updated });
  },

  logout: async () => {
    try {
      try {
        await SecureStore.deleteItemAsync('accessToken');
        await SecureStore.deleteItemAsync('refreshToken');
      } catch {}

      try {
        await AsyncStorage.removeItem('accessToken');
        await AsyncStorage.removeItem('refreshToken');
      } catch {}

      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem('accessToken');
        window.localStorage.removeItem('refreshToken');
      }
      await AsyncStorage.removeItem('authUser');
    } catch (err) {
      console.error('Failed to clear storage during logout', err);
    }
    set({
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
    });
  },

  loadAuthFromStorage: async () => {
    try {
      let token: string | null = null;
      try {
        token = await SecureStore.getItemAsync('accessToken');
      } catch {}

      if (!token) {
        try {
          token = await AsyncStorage.getItem('accessToken');
        } catch {}
      }

      if (!token && typeof window !== 'undefined' && window.localStorage) {
        token = window.localStorage.getItem('accessToken');
      }

      let refreshToken: string | null = null;
      try {
        refreshToken = await SecureStore.getItemAsync('refreshToken');
      } catch {}

      if (!refreshToken) {
        try {
          refreshToken = await AsyncStorage.getItem('refreshToken');
        } catch {}
      }

      if (!refreshToken && typeof window !== 'undefined' && window.localStorage) {
        refreshToken = window.localStorage.getItem('refreshToken');
      }

      const userJson = await AsyncStorage.getItem('authUser');

      if (token && userJson) {
        const user = JSON.parse(userJson);
        set({
          user,
          token,
          refreshToken,
          isAuthenticated: true,
          isLoading: false,
        });
      } else {
        set({
          user: null,
          token: null,
          refreshToken: null,
          isAuthenticated: false,
          isLoading: false,
        });
      }
    } catch (err) {
      console.error('Failed to load auth from storage', err);
      set({
        user: null,
        token: null,
        refreshToken: null,
        isAuthenticated: false,
        isLoading: false,
      });
    }
  },
}));
