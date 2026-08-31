import { Stack } from 'expo-router';
import { useUIStore } from '../../../store/ui.store';

export default function LeavesLayout() {
  const { isDark } = useUIStore();
  const bgColor = isDark ? '#0B1120' : '#F8FAFC';

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        gestureEnabled: true,
        gestureDirection: 'horizontal',
        fullScreenGestureEnabled: true,
        animationDuration: 220,
        contentStyle: { backgroundColor: bgColor },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen
        name="apply"
        options={{
          animation: 'slide_from_bottom',
          presentation: 'card',
          gestureDirection: 'vertical',
        }}
      />
      <Stack.Screen
        name="history"
        options={{
          animation: 'slide_from_right',
        }}
      />
    </Stack>
  );
}
