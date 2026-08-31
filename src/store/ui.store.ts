import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Appearance, ColorSchemeName } from 'react-native';
import { colors } from '../constants/colors';

export type ThemeMode = 'light' | 'dark' | 'system';

interface UIState {
  themeMode: ThemeMode;
  isDark: boolean;
  theme: typeof colors.light;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
  loadTheme: () => Promise<void>;
  updateSystemTheme: () => void;
}

const getIsDark = (mode: ThemeMode): boolean => {
  if (mode === 'dark') return true;
  if (mode === 'light') return false;
  const sys = Appearance.getColorScheme();
  return sys === 'dark';
};

export const useUIStore = create<UIState>((set, get) => ({
  themeMode: 'system',
  isDark: Appearance.getColorScheme() === 'dark',
  theme: Appearance.getColorScheme() === 'dark' ? colors.dark : colors.light,

  setThemeMode: async (mode) => {
    const isDark = getIsDark(mode);
    await AsyncStorage.setItem('themeMode', mode);
    set({
      themeMode: mode,
      isDark,
      theme: isDark ? colors.dark : colors.light,
    });
  },

  updateSystemTheme: () => {
    const { themeMode } = get();
    if (themeMode === 'system') {
      const isDark = Appearance.getColorScheme() === 'dark';
      set({
        isDark,
        theme: isDark ? colors.dark : colors.light,
      });
    }
  },

  loadTheme: async () => {
    try {
      const saved = (await AsyncStorage.getItem('themeMode')) as ThemeMode | null;
      const mode = saved || 'system';
      const isDark = getIsDark(mode);
      set({
        themeMode: mode,
        isDark,
        theme: isDark ? colors.dark : colors.light,
      });

      // Listen to OS theme changes
      Appearance.addChangeListener(({ colorScheme }) => {
        const currentMode = get().themeMode;
        if (currentMode === 'system') {
          const dark = colorScheme === 'dark';
          set({
            isDark: dark,
            theme: dark ? colors.dark : colors.light,
          });
        }
      });
    } catch (err) {
      console.error('Failed to load theme preference', err);
    }
  },
}));
