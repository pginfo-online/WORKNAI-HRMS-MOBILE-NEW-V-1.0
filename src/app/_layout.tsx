import React, { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Toast from 'react-native-toast-message';
import { useAuthStore } from '../store/auth.store';
import { useUIStore } from '../store/ui.store';
import { UpdateManager } from '../components/UpdateManager';
import { ErrorBoundary } from '../components/ErrorBoundary';

import * as SplashScreen from 'expo-splash-screen';

SplashScreen.preventAutoHideAsync().catch(() => {});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 1000 * 60, // 1 minute
      refetchOnWindowFocus: false,
    },
  },
});

function RootLayoutNav() {
  const router = useRouter();
  const segments = useSegments();
  const { isAuthenticated, isLoading, loadAuthFromStorage } = useAuthStore();
  const { loadTheme, isDark } = useUIStore();

  useEffect(() => {
    async function init() {
      try {
        await Promise.all([loadAuthFromStorage(), loadTheme()]);
      } catch (_) {
      } finally {
        await SplashScreen.hideAsync().catch(() => {});
      }
    }
    init();
  }, []);

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inTabsGroup = segments[0] === '(tabs)';

    if (!isAuthenticated && !inAuthGroup) {
      // Redirect to login if unauthenticated and not in auth group
      router.replace('/(auth)/login');
    } else if (isAuthenticated && !inTabsGroup) {
      // Redirect to main tabs if authenticated and not in tabs group
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, isLoading, segments]);

  if (isLoading) {
    return null;
  }

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
      <Toast />
    </>
  );
}

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <UpdateManager>
          <RootLayoutNav />
        </UpdateManager>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
