import { Stack } from 'expo-router';

export default function AttendanceLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="check-in-tasks" />
      <Stack.Screen name="check-out-tasks" />
      <Stack.Screen name="tasks" />
      <Stack.Screen name="summary" />
      <Stack.Screen name="correction" />
      <Stack.Screen name="day-detail" />
    </Stack>
  );
}
