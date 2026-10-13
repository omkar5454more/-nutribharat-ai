import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SplashScreen, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Text } from 'react-native';
import { Card, H1, Muted, Notice, Screen } from '@/components/ui';
import { useProfile } from '@/lib/data';
import { isConfigured } from '@/lib/supabase';
import { SessionProvider, useSession } from '@/state/session';

SplashScreen.preventAutoHideAsync();
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 30_000 } } });

function SetupNeeded() {
  return (
    <Screen>
      <H1>Almost ready</H1>
      <Notice>The app is not connected to a Supabase project yet.</Notice>
      <Card>
        <Text style={{ fontWeight: '700' }}>What to do</Text>
        <Muted>1. Create a free project at supabase.com.</Muted>
        <Muted>2. Copy .env.example to .env and paste your project URL and publishable key.</Muted>
        <Muted>3. Run the SQL in supabase/migrations/0001_init.sql in the Supabase SQL editor.</Muted>
        <Muted>4. Restart the app with: npx expo start --clear</Muted>
      </Card>
    </Screen>
  );
}

function Navigator() {
  const { session, isLoading } = useSession();
  const profile = useProfile(session?.user.id);
  const ready = !isLoading && (!session || !profile.isLoading);
  if (ready) SplashScreen.hide();
  if (!ready) return null;

  const signedIn = !!session;
  const hasProfile = !!profile.data;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="sign-in" />
        <Stack.Screen name="sign-up" />
        <Stack.Screen name="forgot-password" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && !hasProfile}>
        <Stack.Screen name="onboarding" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && hasProfile}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
    </Stack>
  );
}

export default function Root() {
  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="dark" />
      {isConfigured ? (
        <SessionProvider>
          <Navigator />
        </SessionProvider>
      ) : (
        <SetupNeeded />
      )}
    </QueryClientProvider>
  );
}
