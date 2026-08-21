import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { Animated, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useRef } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandMark } from '@/components/ui';
import { Text } from '@/components/app-text';
import { spacing, type AppPalette } from '@/constants/theme';
import { useCart } from '@/providers/cart-provider';
import { useCompany } from '@/providers/company-provider';
import { useI18n } from '@/providers/i18n-provider';
import { useNotifications } from '@/providers/notification-provider';
import { useAppTheme, useThemedStyles } from '@/providers/theme-provider';

export function AppHeader() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { company } = useCompany();
  const { itemCount } = useCart();
  const { unreadCount } = useNotifications();
  const { t } = useI18n();
  const { colors, dark, toggleTheme } = useAppTheme();
  const { styles } = useThemedStyles(createStyles);
  const veryCompact = width < 350;
  const subtitle = company?.phone || company?.email || t('Shop smarter • delivered faster');

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <View style={[styles.header, veryCompact && styles.headerCompact]}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('Open shop')} onPress={() => router.push('/shop')} style={({ pressed }) => [styles.brand, pressed && styles.pressed]}>
          <BrandMark compact />
          <View style={styles.brandCopy}>
            <Text numberOfLines={1} style={[styles.companyName, veryCompact && styles.companyNameCompact]}>{company?.name ?? 'EasyCart'}<Text style={styles.dot}>.</Text></Text>
            <Text numberOfLines={1} style={styles.companyInfo}>{subtitle}</Text>
          </View>
        </Pressable>

        <View style={styles.actions}>
          <HeaderAction label={t('Notifications')} icon="notifications-outline" badge={unreadCount} color={colors.muted} onPress={() => router.push('/notifications')} />
          <HeaderAction label={t(dark ? 'Use light mode' : 'Use dark mode')} icon={dark ? 'sunny-outline' : 'moon-outline'} color={colors.primary} highlighted onPress={toggleTheme} />
          <HeaderAction label={t('Open cart')} icon="bag-handle-outline" badge={itemCount} color={colors.muted} onPress={() => router.push('/cart')} />
        </View>
      </View>
    </SafeAreaView>
  );
}

function HeaderAction({ label, icon, badge, color, highlighted = false, onPress }: { label: string; icon: keyof typeof Ionicons.glyphMap; badge?: number; color: string; highlighted?: boolean; onPress: () => void }) {
  const { styles } = useThemedStyles(createStyles);
  const pressProgress = useRef(new Animated.Value(0)).current;

  const animatePress = (toValue: number) => {
    Animated.spring(pressProgress, {
      toValue,
      stiffness: 380,
      damping: 24,
      mass: 0.6,
      useNativeDriver: true,
    }).start();
  };

  const handlePress = () => {
    void Haptics.selectionAsync().catch(() => undefined);
    onPress();
  };

  return (
    <Animated.View style={{
      transform: [
        { scale: pressProgress.interpolate({ inputRange: [0, 1], outputRange: [1, 0.9] }) },
        { translateY: pressProgress.interpolate({ inputRange: [0, 1], outputRange: [0, 1] }) },
      ],
    }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        hitSlop={4}
        onPress={handlePress}
        onPressIn={() => animatePress(1)}
        onPressOut={() => animatePress(0)}
        style={({ pressed }) => [styles.action, highlighted && styles.actionHighlighted, pressed && styles.actionPressed]}>
        <Ionicons name={icon} size={19} color={color} />
        {badge ? <View style={styles.badge}><Text style={styles.badgeText}>{badge > 99 ? '99+' : badge}</Text></View> : null}
      </Pressable>
    </Animated.View>
  );
}

const createStyles = (palette: AppPalette, isRtl: boolean) => StyleSheet.create({
  safeArea: { backgroundColor: palette.card, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: palette.border },
  header: { minHeight: 66, paddingHorizontal: spacing.lg, flexDirection: isRtl ? 'row-reverse' : 'row', alignItems: 'center', gap: 10, backgroundColor: palette.card },
  headerCompact: { paddingHorizontal: 11, gap: 7 },
  brand: { flex: 1, minWidth: 0, flexDirection: isRtl ? 'row-reverse' : 'row', alignItems: 'center', gap: 9 },
  brandCopy: { flex: 1, minWidth: 0 },
  companyName: { color: palette.text, fontSize: 16, fontWeight: '900', letterSpacing: -0.45 },
  companyNameCompact: { fontSize: 14 },
  dot: { color: palette.primary },
  companyInfo: { marginTop: 2, color: palette.muted, fontSize: 8.5, fontWeight: '600' },
  actions: { flexShrink: 0, flexDirection: isRtl ? 'row-reverse' : 'row', alignItems: 'center', gap: 1, padding: 3, borderRadius: 23, backgroundColor: palette.input, borderWidth: 1, borderColor: palette.border },
  action: { width: 35, height: 35, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  actionHighlighted: { backgroundColor: palette.card, borderWidth: StyleSheet.hairlineWidth, borderColor: palette.border },
  actionPressed: { backgroundColor: palette.primarySoft },
  badge: { position: 'absolute', top: -5, end: -5, minWidth: 19, height: 19, paddingHorizontal: 4, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.amber, borderWidth: 2, borderColor: palette.card, shadowColor: palette.black, shadowOpacity: 0.16, shadowRadius: 3, shadowOffset: { width: 0, height: 2 }, elevation: 4 },
  badgeText: { color: palette.amberForeground, fontSize: 7.5, lineHeight: 11, fontWeight: '900' },
  pressed: { opacity: 0.72 },
});
