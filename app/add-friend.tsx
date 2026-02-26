import { Redirect } from 'expo-router';

export default function AddFriendScreen() {
  // Redirect to profile - user search is now a modal on the profile page
  return <Redirect href="/(tabs)/profile" />;
}
