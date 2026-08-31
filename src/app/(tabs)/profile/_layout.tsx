import React from 'react';
import { Stack } from 'expo-router';
import { useUIStore } from '../../../store/ui.store';

export default function ProfileLayout() {
  const { isDark } = useUIStore();
  const bgColor = isDark ? '#0B1120' : '#F8FAFC';

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        gestureEnabled: true,
        gestureDirection: 'horizontal',
        animationDuration: 200,
        freezeOnBlur: false,
        contentStyle: { backgroundColor: bgColor },
      }}
    >
      <Stack.Screen name="index" options={{ contentStyle: { backgroundColor: bgColor } }} />
      <Stack.Screen name="edit" options={{ contentStyle: { backgroundColor: bgColor } }} />
    </Stack>
  );
}
