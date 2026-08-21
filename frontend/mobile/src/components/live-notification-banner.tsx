import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/app-text';
import { compactShadow, radii, spacing, type AppPalette } from '@/constants/theme';
import { useNotifications } from '@/providers/notification-provider';
import { useI18n } from '@/providers/i18n-provider';
import { useThemedStyles } from '@/providers/theme-provider';

export function LiveNotificationBanner() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const notifications = useNotifications();
  const { t } = useI18n();
  const { colors: palette, styles } = useThemedStyles(createStyles);
  const item = notifications.liveNotification;

  useEffect(() => {
    if (!item) return;
    const timer = setTimeout(notifications.dismissLiveNotification, 7_000);
    return () => clearTimeout(timer);
  }, [item, notifications.dismissLiveNotification]);

  if (!item) return null;

  const open = () => {
    notifications.markRead(item.id);
    notifications.dismissLiveNotification();
    router.push(item.destination);
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={item.title}
      onPress={open}
      style={({ pressed }) => [styles.banner, { top: insets.top + 58 }, pressed && styles.pressed]}>
      <View style={styles.icon}><Ionicons name={item.icon} size={20} color={palette.primaryForeground} /></View>
      <View style={styles.copy}>
        <View style={styles.titleRow}><View style={styles.liveDot} /><Text style={styles.live}>LIVE</Text><Text numberOfLines={1} style={styles.title}>{item.title}</Text></View>
        <Text numberOfLines={2} style={styles.message}>{item.message}</Text>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={t('Dismiss')} hitSlop={10} onPress={notifications.dismissLiveNotification} style={styles.close}>
        <Ionicons name="close" size={17} color={palette.muted} />
      </Pressable>
    </Pressable>
  );
}

const createStyles = (palette: AppPalette, isRtl: boolean) => StyleSheet.create({
  banner: { position: 'absolute', zIndex: 100, start: spacing.md, end: spacing.md, minHeight: 76, padding: 11, borderRadius: radii.lg, flexDirection: isRtl ? 'row-reverse' : 'row', alignItems: 'center', gap: 10, backgroundColor: palette.card, borderWidth: 1, borderColor: palette.primary, ...compactShadow },
  icon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.primary },
  copy: { flex: 1, minWidth: 0 },
  titleRow: { flexDirection: isRtl ? 'row-reverse' : 'row', alignItems: 'center', gap: 5 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: palette.success },
  live: { color: palette.success, fontSize: 7, fontWeight: '900', letterSpacing: 0.8 },
  title: { flex: 1, color: palette.text, fontSize: 12, fontWeight: '900' },
  message: { marginTop: 4, color: palette.muted, fontSize: 9.5, lineHeight: 14 },
  close: { width: 28, height: 36, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.9, transform: [{ scale: 0.99 }] },
});
