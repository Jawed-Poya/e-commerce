import Ionicons from '@expo/vector-icons/Ionicons';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/app-text';
import { compactShadow, radii, spacing, tabBarHeight, type AppPalette } from '@/constants/theme';
import { commerceApi } from '@/lib/commerce-api';
import { getConnectivitySnapshot, subscribeConnectivity } from '@/lib/connectivity';
import { useI18n } from '@/providers/i18n-provider';
import { useThemedStyles } from '@/providers/theme-provider';

export function ConnectivityBanner() {
  const snapshot = useSyncExternalStore(subscribeConnectivity, getConnectivitySnapshot, getConnectivitySnapshot);
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const { colors: palette, styles } = useThemedStyles(createStyles);
  const previousStatus = useRef(snapshot.status);
  const [restored, setRestored] = useState(false);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    if (previousStatus.current === 'offline' && snapshot.status === 'online') {
      setRestored(true);
      const timer = setTimeout(() => setRestored(false), 2800);
      previousStatus.current = snapshot.status;
      return () => clearTimeout(timer);
    }
    previousStatus.current = snapshot.status;
  }, [snapshot.status]);

  if (snapshot.status !== 'offline' && !restored) return null;

  const retry = async () => {
    setRetrying(true);
    try {
      await commerceApi.company();
      await queryClient.invalidateQueries({ refetchType: 'active' });
    } catch {
      // The shared API client keeps the global connectivity state accurate.
    } finally {
      setRetrying(false);
    }
  };

  return (
    <View pointerEvents="box-none" style={[styles.position, { bottom: tabBarHeight + 26 + insets.bottom }]}>
      <View style={[styles.banner, restored && styles.restoredBanner]}>
        <View style={[styles.icon, restored && styles.restoredIcon]}>
          <Ionicons name={restored ? 'cloud-done' : 'cloud-offline'} size={22} color={restored ? palette.success : palette.amberForeground} />
        </View>
        <View style={styles.copy}>
          <Text style={[styles.eyebrow, restored && styles.restoredEyebrow]}>{restored ? 'BACK ONLINE' : 'OFFLINE MODE'}</Text>
          <Text numberOfLines={1} style={[styles.title, restored && styles.restoredTitle]}>{restored ? 'Everything is connected again' : 'Your saved shop is still open'}</Text>
          {!restored ? <Text numberOfLines={2} style={styles.message}>{snapshot.reason === 'server' ? 'The store API is resting. Browse saved products and keep building your cart.' : 'No connection right now. Saved products and your cart remain available.'}</Text> : null}
        </View>
        {!restored ? (
          <Pressable accessibilityRole="button" accessibilityLabel={t('Try reconnecting')} disabled={retrying} onPress={() => void retry()} style={({ pressed }) => [styles.retry, pressed && styles.pressed]}>
            {retrying ? <ActivityIndicator size="small" color={palette.primaryForeground} /> : <Ionicons name="refresh" size={17} color={palette.primaryForeground} />}
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const createStyles = (palette: AppPalette, isRtl: boolean) => StyleSheet.create({
  position: { position: 'absolute', zIndex: 120, start: spacing.md, end: spacing.md, alignItems: 'center' },
  banner: { width: '100%', maxWidth: 560, minHeight: 84, padding: 11, borderRadius: radii.lg, flexDirection: isRtl ? 'row-reverse' : 'row', alignItems: 'center', gap: 10, backgroundColor: palette.darkSurface, borderWidth: 1, borderColor: palette.amber, ...compactShadow },
  restoredBanner: { minHeight: 66, backgroundColor: palette.card, borderColor: palette.success },
  icon: { width: 47, height: 47, flexShrink: 0, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.amber },
  restoredIcon: { backgroundColor: palette.successSoft },
  copy: { flex: 1, minWidth: 0 },
  eyebrow: { color: palette.amber, fontSize: 7.5, fontWeight: '900', letterSpacing: 1.2 },
  restoredEyebrow: { color: palette.success },
  title: { marginTop: 2, color: palette.white, fontSize: 12.5, fontWeight: '900' },
  restoredTitle: { color: palette.text },
  message: { marginTop: 3, color: 'rgba(255,255,255,.68)', fontSize: 9, lineHeight: 13 },
  retry: { width: 40, height: 40, flexShrink: 0, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.primary },
  pressed: { opacity: 0.72, transform: [{ scale: 0.95 }] },
});
