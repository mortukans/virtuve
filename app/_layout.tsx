import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Stack } from 'expo-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@src/api/queryClient';
import { useAuth } from '@src/auth/store';
import { useActiveHousehold } from '@src/household/active';
import { HouseholdProvider } from '@src/household/context';
import { colors } from '@src/ui/theme';

export default function RootLayout() {
  useEffect(() => {
    void useAuth.getState().bootstrap();
    void useActiveHousehold.getState().hydrate();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <HouseholdProvider>
            <StatusBar style="light" />
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: colors.bg },
                animation: 'slide_from_right',
              }}
            >
              <Stack.Screen name="scan" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
              <Stack.Screen name="household/create" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
              <Stack.Screen name="household/join" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
              <Stack.Screen name="vote/[sessionId]" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
            </Stack>
          </HouseholdProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
