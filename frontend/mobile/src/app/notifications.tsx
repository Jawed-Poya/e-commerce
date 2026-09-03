import Ionicons from '@expo/vector-icons/Ionicons';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState, ErrorState, LoadingBlock, PrimaryButton } from '@/components/ui';
import { Text } from '@/components/app-text';
import { compactShadow, radii, spacing, type AppPalette } from '@/constants/theme';
import { useAuth } from '@/providers/auth-provider';
import { useI18n } from '@/providers/i18n-provider';
import {
  useNotifications,
  type AppNotification,
  type NotificationTone,
} from '@/providers/notification-provider';
import { useThemedStyles } from '@/providers/theme-provider';

type InboxFilter = 'all' | 'unread';

export default function NotificationsScreen() {
  const router = useRouter();
  const auth = useAuth();
  const inbox = useNotifications();
  const { t } = useI18n();
  const { colors: palette, styles } = useThemedStyles(createStyles);
  const [filter, setFilter] = useState<InboxFilter>('all');
  const [permissionRequesting, setPermissionRequesting] = useState(false);
  const visibleNotifications = useMemo(
    () => filter === 'unread'
      ? inbox.notifications.filter((item) => !inbox.isRead(item.id))
      : inbox.notifications,
    [filter, inbox],
  );

  const openNotification = (item: AppNotification) => {
    inbox.markRead(item.id);
    router.push(item.destination);
  };

  const enableDeviceAlerts = async () => {
    setPermissionRequesting(true);
    try {
      await inbox.requestNativePermission();
    } finally {
      setPermissionRequesting(false);
    }
  };

  const listHeader = (
    <View>
      <View style={styles.hero}>
        <View style={styles.heroIcon}>
          <Ionicons name="notifications" size={26} color={palette.primaryForeground} />
        </View>
        <View style={styles.flex}>
          <Text style={styles.eyebrow}>ACTIVITY CENTER</Text>
          <Text style={styles.heroTitle}>Updates that matter</Text>
          <Text style={styles.heroText}>Order progress and important account actions, all in one place.</Text>
          <View style={styles.realtime}><View style={[styles.realtimeDot, inbox.realtimeStatus !== 'live' && styles.realtimeDotPolling]} /><Text style={styles.realtimeText}>{inbox.realtimeStatus === 'live' ? 'LIVE' : 'POLLING'}</Text></View>
        </View>
        <View style={styles.unreadBadge}>
          <Text style={styles.unreadNumber}>{inbox.unreadCount}</Text>
          <Text style={styles.unreadLabel}>UNREAD</Text>
        </View>
      </View>

      {inbox.nativePermission !== 'unsupported' ? (
        <View style={[
          styles.deviceAlerts,
          inbox.nativePermission === 'granted' && inbox.remotePushStatus === 'ready' && styles.deviceAlertsEnabled,
        ]}>
          <View style={[
            styles.deviceAlertsIcon,
            inbox.nativePermission === 'granted' && inbox.remotePushStatus === 'ready' && styles.deviceAlertsIconEnabled,
          ]}>
            <Ionicons
              name={inbox.nativePermission === 'granted' && inbox.remotePushStatus === 'ready' ? 'notifications-circle' : inbox.nativePermission === 'granted' ? 'cloud-offline-outline' : 'notifications-off-outline'}
              size={23}
              color={inbox.nativePermission === 'granted' && inbox.remotePushStatus === 'ready' ? palette.success : palette.amber}
            />
          </View>
          <View style={styles.deviceAlertsCopy}>
            <Text style={styles.deviceAlertsTitle}>
              {t(inbox.nativePermission === 'granted' && inbox.remotePushStatus === 'ready'
                ? 'Background alerts are ready'
                : inbox.nativePermission === 'granted' && inbox.remotePushStatus === 'registering'
                  ? 'Connecting background alerts…'
                  : inbox.nativePermission === 'granted'
                    ? 'Background alerts need setup'
                    : 'Device alerts are off')}
            </Text>
            <Text style={styles.deviceAlertsText}>
              {t(inbox.nativePermission === 'granted' && inbox.remotePushStatus === 'ready'
                ? 'New order, price, and stock updates can appear even when EasyCart is closed.'
                : inbox.nativePermission === 'granted'
                  ? inbox.remotePushError ?? 'Notification permission is allowed, but this build is not connected to the production push service yet.'
                : 'Allow EasyCart to show important updates in your Android notification panel.')}
            </Text>
          </View>
          {inbox.nativePermission !== 'granted' ? (
            <Pressable
              accessibilityRole="button"
              disabled={permissionRequesting}
              onPress={() => void enableDeviceAlerts()}
              style={({ pressed }) => [styles.deviceAlertsAction, pressed && styles.pressed]}>
              <Ionicons name={inbox.nativePermissionCanAskAgain ? 'notifications' : 'settings-outline'} size={16} color={palette.primaryForeground} />
              <Text style={styles.deviceAlertsActionText}>
                {t(inbox.nativePermissionCanAskAgain ? 'Enable' : 'Settings')}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <View style={styles.toolbar}>
        <View style={styles.filters}>
          <FilterButton active={filter === 'all'} label="All" onPress={() => setFilter('all')} />
          <FilterButton active={filter === 'unread'} label={`${t('Unread')} ${inbox.unreadCount}`} onPress={() => setFilter('unread')} />
        </View>
        {inbox.unreadCount ? (
          <Pressable accessibilityRole="button" onPress={inbox.markAllRead} hitSlop={8} style={({ pressed }) => [styles.markAll, pressed && styles.pressed]}>
            <Ionicons name="checkmark-done" size={15} color={palette.primary} />
            <Text style={styles.markAllText}>Mark all read</Text>
          </Pressable>
        ) : (
          <View style={styles.caughtUp}>
            <Ionicons name="checkmark-circle" size={15} color={palette.success} />
            <Text style={styles.caughtUpText}>All caught up</Text>
          </View>
        )}
      </View>

      {inbox.errorMessage && inbox.notifications.length ? (
        <ErrorState message={inbox.errorMessage} onRetry={() => void inbox.refresh()} />
      ) : null}
    </View>
  );

  return (
    <SafeAreaView edges={['bottom']} style={styles.safeArea}>
      <FlashList
        data={visibleNotifications}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <NotificationCard
            item={item}
            read={inbox.isRead(item.id)}
            onPress={() => openNotification(item)}
          />
        )}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={
          auth.loading || inbox.isLoading
            ? <LoadingBlock label="Checking for new activity…" />
            : !auth.user
              ? <EmptyState
                  icon="notifications-outline"
                  title="Your updates live here"
                  message="Sign in to receive order progress and important account notifications."
                  action={<PrimaryButton title="Sign in to continue" icon="log-in" onPress={() => router.push('/auth')} />}
                />
              : inbox.errorMessage && !inbox.notifications.length
                ? <ErrorState message={inbox.errorMessage} onRetry={() => void inbox.refresh()} />
                : filter === 'unread'
                  ? <EmptyState icon="checkmark-done-circle-outline" title="Nothing unread" message="You are up to date. New order activity will appear here automatically." />
                  : <EmptyState icon="sparkles-outline" title="You’re all caught up" message="New order and account updates will appear here." />
        }
        contentContainerStyle={styles.content}
        refreshing={inbox.isRefreshing}
        onRefresh={() => void inbox.refresh()}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

function FilterButton({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  const { styles } = useThemedStyles(createStyles);
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.filter, active && styles.filterActive, pressed && styles.pressed]}>
      <Text style={[styles.filterText, active && styles.filterTextActive]}>{label}</Text>
    </Pressable>
  );
}

function NotificationCard({ item, read, onPress }: { item: AppNotification; read: boolean; onPress: () => void }) {
  const { colors: palette, styles, isRtl } = useThemedStyles(createStyles);
  const tone = toneColors(item.tone, palette);
  const { languageTag, t } = useI18n();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${read ? '' : `${t('Unread notification.')} `}${item.title}`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, !read && styles.cardUnread, pressed && styles.cardPressed]}>
      <View style={[styles.iconWrap, { backgroundColor: tone.background }]}>
        <Ionicons name={item.icon} size={22} color={tone.foreground} />
      </View>

      <View style={styles.cardBody}>
        <View style={styles.cardTitleRow}>
          <Text numberOfLines={1} style={[styles.cardTitle, !read && styles.cardTitleUnread]}>{item.title}</Text>
          {!read ? <View style={styles.unreadDot} /> : null}
        </View>
        <Text style={styles.cardMessage}>{item.message}</Text>
        <View style={styles.cardFooter}>
          <Text style={[styles.cardTime, item.actionRequired && styles.actionRequired]}>{relativeTime(item.timestamp, languageTag)}</Text>
          <View style={styles.cardAction}>
            <Text style={styles.cardActionText}>{item.actionLabel}</Text>
            <Ionicons name={isRtl ? 'chevron-back' : 'chevron-forward'} size={14} color={palette.primary} />
          </View>
        </View>
      </View>
    </Pressable>
  );
}

function toneColors(tone: NotificationTone, palette: AppPalette) {
  if (tone === 'success') return { background: palette.successSoft, foreground: palette.success };
  if (tone === 'warning') return { background: palette.amberSoft, foreground: palette.amber };
  if (tone === 'danger') return { background: palette.dangerSoft, foreground: palette.danger };
  return { background: palette.primarySoft, foreground: palette.primary };
}

function relativeTime(timestamp: string | null, locale: string) {
  if (!timestamp) return relativeFallback(locale, 0, 'action');
  const value = new Date(timestamp).getTime();
  if (!Number.isFinite(value)) return relativeFallback(locale, 0, 'now');
  const elapsed = Math.max(0, Date.now() - value);
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 1) return formatRelative(locale, 0, 'minute');
  if (minutes < 60) return formatRelative(locale, -minutes, 'minute');
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return formatRelative(locale, -hours, 'hour');
  const days = Math.floor(hours / 24);
  if (days < 7) return formatRelative(locale, -days, 'day');

  try {
    return new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }).format(new Date(value));
  } catch {
    return new Date(value).toLocaleDateString();
  }
}

function formatRelative(locale: string, value: number, unit: 'minute' | 'hour' | 'day') {
  const RelativeTimeFormat = Intl.RelativeTimeFormat;
  if (typeof RelativeTimeFormat === 'function') {
    try {
      return new RelativeTimeFormat(locale, { numeric: 'auto', style: 'short' }).format(value, unit);
    } catch {
      // Older Hermes/Android builds can expose Intl without RelativeTimeFormat support.
    }
  }

  return relativeFallback(locale, Math.abs(value), unit);
}

function relativeFallback(locale: string, value: number, unit: 'minute' | 'hour' | 'day' | 'now' | 'action') {
  const language = locale.toLowerCase();
  if (unit === 'action') {
    if (language.startsWith('ps')) return 'اقدام ته اړتیا لري';
    if (language.startsWith('fa') || language.startsWith('dr')) return 'نیاز به اقدام';
    return 'Action needed';
  }
  if (unit === 'now' || value === 0) {
    if (language.startsWith('ps')) return 'همدا اوس';
    if (language.startsWith('fa') || language.startsWith('dr')) return 'همین حالا';
    return 'Now';
  }

  const suffix = language.startsWith('ps')
    ? unit === 'minute' ? 'دقیقې مخکې' : unit === 'hour' ? 'ساعته مخکې' : 'ورځې مخکې'
    : language.startsWith('fa') || language.startsWith('dr')
      ? unit === 'minute' ? 'دقیقه پیش' : unit === 'hour' ? 'ساعت پیش' : 'روز پیش'
      : unit === 'minute' ? 'min ago' : unit === 'hour' ? 'hr ago' : 'd ago';
  return `${value} ${suffix}`;
}

const createStyles = (palette: AppPalette, isRtl: boolean) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.background },
  flex: { flex: 1 },
  content: { paddingBottom: spacing.xxl },
  hero: { margin: spacing.lg, marginBottom: spacing.md, padding: spacing.lg, borderRadius: radii.lg, flexDirection: isRtl ? 'row-reverse' : 'row', alignItems: 'center', gap: 12, backgroundColor: palette.darkSurface, ...compactShadow },
  heroIcon: { width: 50, height: 50, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.primary },
  eyebrow: { color: palette.amber, fontSize: 8, fontWeight: '900', letterSpacing: 1.2 },
  heroTitle: { marginTop: 4, color: palette.white, fontSize: 18, fontWeight: '900', letterSpacing: -0.35 },
  heroText: { marginTop: 4, color: '#C6D8D3', fontSize: 10, lineHeight: 15 },
  realtime: { marginTop: 7, alignSelf: isRtl ? 'flex-end' : 'flex-start', flexDirection: isRtl ? 'row-reverse' : 'row', alignItems: 'center', gap: 4 },
  realtimeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#4FD1A1' },
  realtimeDotPolling: { backgroundColor: palette.amber },
  realtimeText: { color: '#B5CEC7', fontSize: 7, fontWeight: '900', letterSpacing: 0.8 },
  unreadBadge: { minWidth: 48, paddingHorizontal: 8, paddingVertical: 9, borderRadius: radii.md, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.09)' },
  unreadNumber: { color: palette.white, fontSize: 18, fontWeight: '900' },
  unreadLabel: { marginTop: 1, color: '#99B9B2', fontSize: 6.5, fontWeight: '900', letterSpacing: 0.8 },
  deviceAlerts: { marginHorizontal: spacing.lg, marginBottom: spacing.sm, padding: 12, borderRadius: radii.lg, flexDirection: isRtl ? 'row-reverse' : 'row', alignItems: 'center', gap: 10, backgroundColor: palette.amberSoft, borderWidth: 1, borderColor: palette.amber },
  deviceAlertsEnabled: { backgroundColor: palette.successSoft, borderColor: palette.success },
  deviceAlertsIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.card },
  deviceAlertsIconEnabled: { backgroundColor: palette.card },
  deviceAlertsCopy: { flex: 1, minWidth: 0 },
  deviceAlertsTitle: { color: palette.text, fontSize: 11, fontWeight: '900' },
  deviceAlertsText: { marginTop: 2, color: palette.muted, fontSize: 8.5, lineHeight: 13 },
  deviceAlertsAction: { minHeight: 36, paddingHorizontal: 11, borderRadius: radii.md, flexDirection: isRtl ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: palette.primary },
  deviceAlertsActionText: { color: palette.primaryForeground, fontSize: 9, fontWeight: '900' },
  toolbar: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, flexDirection: isRtl ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  filters: { flexDirection: isRtl ? 'row-reverse' : 'row', gap: 6 },
  filter: { minHeight: 34, paddingHorizontal: 14, borderRadius: radii.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.input, borderWidth: 1, borderColor: palette.border },
  filterActive: { backgroundColor: palette.primary, borderColor: palette.primary },
  filterText: { color: palette.muted, fontSize: 11, fontWeight: '800' },
  filterTextActive: { color: palette.primaryForeground },
  markAll: { minHeight: 34, flexDirection: isRtl ? 'row-reverse' : 'row', alignItems: 'center', gap: 4 },
  markAllText: { color: palette.primary, fontSize: 10, fontWeight: '900' },
  caughtUp: { minHeight: 34, flexDirection: isRtl ? 'row-reverse' : 'row', alignItems: 'center', gap: 4 },
  caughtUpText: { color: palette.success, fontSize: 10, fontWeight: '800' },
  card: { marginHorizontal: spacing.lg, marginVertical: 6, padding: 14, borderRadius: radii.lg, flexDirection: isRtl ? 'row-reverse' : 'row', alignItems: 'flex-start', gap: 12, backgroundColor: palette.card, borderWidth: 1, borderColor: palette.border, ...compactShadow },
  cardUnread: { backgroundColor: palette.primarySoft, borderColor: palette.primary },
  cardPressed: { opacity: 0.76, transform: [{ scale: 0.99 }] },
  iconWrap: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  cardBody: { flex: 1, minWidth: 0 },
  cardTitleRow: { flexDirection: isRtl ? 'row-reverse' : 'row', alignItems: 'center', gap: 7 },
  cardTitle: { flex: 1, color: palette.text, fontSize: 14, fontWeight: '800' },
  cardTitleUnread: { fontWeight: '900' },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: palette.primary },
  cardMessage: { marginTop: 5, color: palette.muted, fontSize: 11, lineHeight: 17 },
  cardFooter: { marginTop: 10, flexDirection: isRtl ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  cardTime: { color: palette.muted, fontSize: 9, fontWeight: '700' },
  actionRequired: { color: palette.amber },
  cardAction: { flexDirection: isRtl ? 'row-reverse' : 'row', alignItems: 'center', gap: 1 },
  cardActionText: { color: palette.primary, fontSize: 10, fontWeight: '900' },
  pressed: { opacity: 0.68 },
});
