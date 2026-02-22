import { Redirect } from 'expo-router';

// This tab doesn't have its own screen - the Add button opens a modal
// If someone navigates here directly, redirect to home
export default function AddScreen() {
  return <Redirect href="/(tabs)" />;
}
