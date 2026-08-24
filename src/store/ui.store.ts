import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from '../constants/colors';

type ThemeMode = 'light' | 'dark' | 'system';

interface UIState {
  themeMode: ThemeMode;
  isDark: boolean;
  theme: typeof colors.light;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
  loadTheme: () => Promise<void>;
}

export const useUIStore = create<UIState>((set) => ({
  themeMode: 'light',
  isDark: false,
  theme: colors.light,

  setThemeMode: async (mode) => {
    const isDark = mode === 'dark';
    await AsyncStorage.setItem('themeMode', mode);
    set({
      themeMode: mode,
      isDark,
      theme: isDark ? colors.dark : colors.light,
    });
  },

  loadTheme: async () => {
    try {
      const saved = (await AsyncStorage.getItem('themeMode')) as ThemeMode | null;
      if (saved) {
        const isDark = saved === 'dark';
        set({
          themeMode: saved,
          isDark,
          theme: isDark ? colors.dark : colors.light,
        });
      }
    } catch (err) {
      console.error('Failed to load theme preference', err);
    }
  },
}));
