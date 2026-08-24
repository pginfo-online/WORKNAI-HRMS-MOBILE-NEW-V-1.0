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
  paidLeaveBalance: number;
  compOffBalance: number;
  geoBypass?: boolean;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setAuth: (user: User, accessToken: string, refreshToken?: string) => Promise<void>;
  updateUser: (updates: Partial<User>) => Promise<void>;
  logout: () => Promise<void>;
  loadAuthFromStorage: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,

  setAuth: async (user, accessToken, refreshToken) => {
    try {
      await SecureStore.setItemAsync('accessToken', accessToken);
      if (refreshToken) {
        await SecureStore.setItemAsync('refreshToken', refreshToken);
      }
      await AsyncStorage.setItem('authUser', JSON.stringify(user));
      set({ user, isAuthenticated: true, isLoading: false });
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
      await SecureStore.deleteItemAsync('accessToken');
      await SecureStore.deleteItemAsync('refreshToken');
      await AsyncStorage.removeItem('authUser');
    } catch (err) {
      console.error('Failed to clear storage during logout', err);
    }
    set({ user: null, isAuthenticated: false, isLoading: false });
  },

  loadAuthFromStorage: async () => {
    try {
      const [token, userJson] = await Promise.all([
        SecureStore.getItemAsync('accessToken'),
        AsyncStorage.getItem('authUser'),
      ]);

      if (token && userJson) {
        const user = JSON.parse(userJson);
        set({ user, isAuthenticated: true, isLoading: false });
      } else {
        set({ user: null, isAuthenticated: false, isLoading: false });
      }
    } catch (err) {
      console.error('Failed to load auth from storage', err);
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },
}));
