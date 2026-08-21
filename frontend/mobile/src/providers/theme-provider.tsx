import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SystemUI from 'expo-system-ui';
import {
  Appearance,
  Platform,
  useColorScheme,
} from 'react-native';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';

import { createStorefrontPalette, type AppPalette } from '@/constants/theme';
import { useCompany } from '@/providers/company-provider';
import { useI18n } from '@/providers/i18n-provider';

type ThemeMode = 'light' | 'dark';

type AppThemeContextValue = {
  mode: ThemeMode;
  dark: boolean;
  colors: AppPalette;
  toggleTheme: () => void;
};

const themeStorageKey = 'easycart-mobile-theme';
const AppThemeContext = createContext<AppThemeContextValue | null>(null);

export function AppThemeProvider({ children }: PropsWithChildren) {
  const { company } = useCompany();
  const systemScheme = useColorScheme();
  const [preference, setPreference] = useState<ThemeMode | null>(null);
  const mode: ThemeMode = preference ?? (systemScheme === 'dark' ? 'dark' : 'light');
  const dark = mode === 'dark';
  const storefrontPrimary = company?.settings.storefrontPrimaryColor;
  const storefrontSecondary = company?.settings.storefrontSecondaryColor;
  const colors = useMemo(
    () => createStorefrontPalette(storefrontPrimary, storefrontSecondary, dark),
    [dark, storefrontPrimary, storefrontSecondary],
  );

  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(themeStorageKey).then((stored) => {
      if (!active || (stored !== 'light' && stored !== 'dark')) return;
      setPreference(stored);
      if (Platform.OS !== 'web') Appearance.setColorScheme(stored);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'ios') {
      void SystemUI.setBackgroundColorAsync(colors.background);
    }
  }, [colors.background]);

  const toggleTheme = useCallback(() => {
    const next: ThemeMode = mode === 'dark' ? 'light' : 'dark';
    setPreference(next);
    if (Platform.OS !== 'web') Appearance.setColorScheme(next);
    void AsyncStorage.setItem(themeStorageKey, next);
  }, [mode]);

  const value = useMemo<AppThemeContextValue>(() => ({
    mode,
    dark,
    colors,
    toggleTheme,
  }), [colors, dark, mode, toggleTheme]);

  return <AppThemeContext.Provider value={value}>{children}</AppThemeContext.Provider>;
}

export function useAppTheme() {
  const context = useContext(AppThemeContext);
  if (!context) throw new Error('useAppTheme must be used inside AppThemeProvider.');
  return context;
}

export function useThemedStyles<T>(factory: (colors: AppPalette, isRtl: boolean) => T) {
  const { colors } = useAppTheme();
  const { isRtl } = useI18n();
  const styles = useMemo(() => factory(colors, isRtl), [colors, factory, isRtl]);
  return { colors, styles, isRtl };
}
