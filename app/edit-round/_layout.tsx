import { Stack } from 'expo-router';

export default function EditRoundLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="score" />
      <Stack.Screen name="rating" />
    </Stack>
  );
}
