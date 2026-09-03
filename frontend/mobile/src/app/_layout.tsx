import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, usePathname, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { BackHandler, Platform, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { LiveNotificationBanner } from '@/components/live-notification-banner';
import { ConnectivityBanner } from '@/components/connectivity-banner';
import { AuthProvider } from '@/providers/auth-provider';
import { CartProvider } from '@/providers/cart-provider';
import { CompanyProvider, useCompany } from '@/providers/company-provider';
import { NotificationProvider } from '@/providers/notification-provider';
import { I18nProvider, useI18n } from '@/providers/i18n-provider';
import { RuntimeConfigProvider, useRuntimeConfig } from '@/providers/runtime-config-provider';
import { AppThemeProvider, useAppTheme } from '@/providers/theme-provider';

void SplashScreen.preventAutoHideAsync();
SplashScreen.setOptions({ duration: 450, fade: true });

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 10 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: { retry: 0 },
  },
});

export default function RootLayout() {
  return (
    <I18nProvider>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <RuntimeConfigProvider>
            <ConfiguredProviders />
          </RuntimeConfigProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </I18nProvider>
  );
}

function ConfiguredProviders() {
  const runtime = useRuntimeConfig();
  if (!runtime.ready) return <View style={{ flex: 1 }} />;

  return (
    <AuthProvider key={`auth-${runtime.revision}`}>
      <CompanyProvider>
        <AppThemeProvider>
          <CartProvider>
            <NotificationProvider>
              <RootNavigator />
            </NotificationProvider>
          </CartProvider>
        </AppThemeProvider>
      </CompanyProvider>
    </AuthProvider>
  );
}

function RootNavigator() {
  const { colors, dark } = useAppTheme();
  const { loading: companyLoading } = useCompany();
  const { isRtl, t } = useI18n();
  const baseTheme = dark ? DarkTheme : DefaultTheme;
  const navigationTheme = {
    ...baseTheme,
    colors: {
      ...baseTheme.colors,
      primary: colors.primary,
      background: colors.background,
      card: colors.card,
      text: colors.text,
      border: colors.border,
      notification: colors.amber,
    },
  };

  useEffect(() => {
    if (!companyLoading) void SplashScreen.hideAsync();
  }, [companyLoading]);

  return (
    <ThemeProvider value={navigationTheme}>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <View style={{ flex: 1 }}>
        <Stack
          screenOptions={{
            contentStyle: { backgroundColor: colors.background },
            headerStyle: { backgroundColor: colors.card },
            headerTintColor: colors.text,
            headerTitleStyle: { fontWeight: '800' },
            headerShadowVisible: false,
            animation: Platform.OS === 'android' ? (isRtl ? 'slide_from_left' : 'slide_from_right') : 'default',
          }}>
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="welcome" options={{ headerShown: false, animation: 'fade' }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="product/[id]" options={{ title: t('Product details') }} />
          <Stack.Screen name="auth" options={{ title: t('Your account'), presentation: 'modal' }} />
          <Stack.Screen name="verify-email" options={{ title: t('Verify your email') }} />
          <Stack.Screen name="reset-password" options={{ title: t('Reset password') }} />
          <Stack.Screen name="notifications" options={{ title: t('Notifications') }} />
          <Stack.Screen name="server-settings" options={{ title: t('Server settings') }} />
          <Stack.Screen name="checkout" options={{ title: t('Secure checkout') }} />
          <Stack.Screen name="track" options={{ title: t('Track order') }} />
          <Stack.Screen name="order-success" options={{ headerShown: false }} />
        </Stack>
        <AndroidBackButtonHandler />
        <LiveNotificationBanner />
        <ConnectivityBanner />
      </View>
    </ThemeProvider>
  );
}

const exitRootRoutes = new Set(['/', '/shop', '/welcome']);

function AndroidBackButtonHandler() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (exitRootRoutes.has(pathname)) {
        return true;
      }

      if (router.canGoBack()) {
        router.back();
        return true;
      }

      if (!exitRootRoutes.has(pathname)) {
        router.replace('/shop');
        return true;
      }

      return true;
    });

    return () => subscription.remove();
  }, [pathname, router]);

  return null;
}
