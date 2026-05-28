import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, useFonts } from '@expo-google-fonts/inter';
import { Session } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import * as Notifications from 'expo-notifications';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ErrorBoundary } from '../components/ErrorBoundary';
import {
  getNavigationFromNotification,
  registerForPushNotifications,
  savePushToken,
  setupNotificationHandlers,
} from '../lib/notifications';
import { supabase } from '../lib/supabase';
import { ToastProvider } from '../lib/toast';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const segments = useSegments();
  const router = useRouter();
  const notificationResponseRef = useRef<Notifications.NotificationResponse | null>(null);

  let [fontsLoaded] = useFonts({
    Inter: Inter_400Regular,
    'Inter-Medium': Inter_500Medium,
    'Inter-SemiBold': Inter_600SemiBold,
    'Inter-Bold': Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      // Reset onboarding check when session changes (login/logout)
      setOnboardingChecked(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Register for push notifications when user is authenticated
  useEffect(() => {
    if (!session?.user?.id) return;

    const setupPushNotifications = async () => {
      const token = await registerForPushNotifications();
      if (token) {
        await savePushToken(session.user.id, token);
      }
    };

    setupPushNotifications();
  }, [session?.user?.id]);

  // Set up notification handlers
  useEffect(() => {
    const handleNotificationResponse = (response: Notifications.NotificationResponse) => {
      // If app isn't ready yet, store the response to handle later
      if (loading || !fontsLoaded || !session) {
        notificationResponseRef.current = response;
        return;
      }

      const navigation = getNavigationFromNotification(response);
      if (navigation?.params?.id) {
        router.push(navigation.route.replace('[id]', navigation.params.id) as any);
      }
    };

    // Check for notification that launched the app
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) {
        handleNotificationResponse(response);
      }
    });

    const cleanup = setupNotificationHandlers(undefined, handleNotificationResponse);

    return cleanup;
  }, [loading, fontsLoaded, session, router]);

  // Handle pending notification response after app is ready
  useEffect(() => {
    if (loading || !fontsLoaded || !session) return;

    if (notificationResponseRef.current) {
      const navigation = getNavigationFromNotification(notificationResponseRef.current);
      if (navigation?.params?.id) {
        router.push(navigation.route.replace('[id]', navigation.params.id) as any);
      }
      notificationResponseRef.current = null;
    }
  }, [loading, fontsLoaded, session, router]);

  useEffect(() => {
    if (loading || !fontsLoaded) return;

    const inAuthGroup = segments[0] === 'auth';
    const inOnboarding = segments[0] === 'onboarding';
    const inTabs = segments[0] === '(tabs)';
    // These are valid authenticated screens outside of tabs
    const inValidAuthenticatedScreen = ['followers', 'user', 'course', 'round', 'tagged', 'bookmarks', 'edit-profile', 'add-round', 'edit-round'].includes(segments[0] as string);

    if (!session && !inAuthGroup) {
      // Not logged in - redirect to login
      setOnboardingChecked(false);
      router.replace('/auth/login');
    } else if (session && !onboardingChecked && inAuthGroup) {
      // Logged in but in auth screens - check onboarding
      checkOnboarding();
    } else if (session && !onboardingChecked && !inOnboarding && !inTabs && !inValidAuthenticatedScreen) {
      // Logged in, not in any valid screen - check onboarding
      checkOnboarding();
    }
  }, [session, segments, loading, fontsLoaded, onboardingChecked]);

  const checkOnboarding = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('onboarding_completed')
        .eq('id', user.id)
        .single();

      setOnboardingChecked(true);

      if (profile?.onboarding_completed) {
        router.replace('/(tabs)');
      } else {
        router.replace('/onboarding');
      }
    } catch (error) {
      // If profile doesn't exist or error, go to onboarding
      setOnboardingChecked(true);
      router.replace('/onboarding');
    }
  };

  // Handle deep links
  useEffect(() => {
    if (loading || !fontsLoaded || !session) return;

    const handleDeepLink = (url: string) => {
      try {
        const parsed = Linking.parse(url);
        const path = parsed.path;

        // Validate UUID format for IDs
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

        if (path?.startsWith('user/')) {
          const userId = path.replace('user/', '');
          if (uuidRegex.test(userId)) {
            router.push(`/user/${userId}`);
          }
        } else if (path?.startsWith('round/')) {
          const roundId = path.replace('round/', '');
          if (uuidRegex.test(roundId)) {
            router.push(`/round/${roundId}`);
          }
        } else if (path?.startsWith('course/')) {
          const courseId = path.replace('course/', '');
          if (uuidRegex.test(courseId)) {
            router.push(`/course/${courseId}`);
          }
        }
      } catch (error) {
        // Silently ignore invalid deep links
        console.error('Invalid deep link:', error);
      }
    };

    // Handle app opened from deep link
    Linking.getInitialURL().then((url) => {
      if (url) handleDeepLink(url);
    });

    // Handle deep link while app is open
    const subscription = Linking.addEventListener('url', ({ url }) => {
      handleDeepLink(url);
    });

    return () => subscription.remove();
  }, [loading, fontsLoaded, session]);

  if (!fontsLoaded || loading) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ErrorBoundary>
        <ToastProvider>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="auth/login" />
            <Stack.Screen name="auth/signup" />
            <Stack.Screen name="onboarding" />
            <Stack.Screen name="(tabs)" />
          </Stack>
        </ToastProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}