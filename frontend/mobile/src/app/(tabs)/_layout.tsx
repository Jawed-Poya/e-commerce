import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { Tabs } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import { AppHeader } from '@/components/app-header';
import { Text } from '@/components/app-text';
import { tabBarHeight } from '@/constants/theme';
import { useCart } from '@/providers/cart-provider';
import { useI18n } from '@/providers/i18n-provider';
import { useAppTheme } from '@/providers/theme-provider';

const icons = {
  shop: ['storefront-outline', 'storefront'],
  cart: ['bag-handle-outline', 'bag-handle'],
  orders: ['receipt-outline', 'receipt'],
  account: ['person-circle-outline', 'person-circle'],
} as const;

type TabKey = keyof typeof icons;

type AnimatedTabIconProps = {
  icon: (typeof icons)[TabKey];
  focused: boolean;
  color: string;
  size: number;
  showCartBadge: boolean;
  itemCount: number;
  colors: ReturnType<typeof useAppTheme>['colors'];
  dark: boolean;
};

function AnimatedTabIcon({ icon, focused, color, size, showCartBadge, itemCount, colors, dark }: AnimatedTabIconProps) {
  const progress = useRef(new Animated.Value(focused ? 1 : 0)).current;

  useEffect(() => {
    const animation = Animated.spring(progress, {
      toValue: focused ? 1 : 0,
      stiffness: 290,
      damping: 22,
      mass: 0.76,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [focused, progress]);

  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [0, -1] });
  const shellScale = progress.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] });
  const bubbleScale = progress.interpolate({ inputRange: [0, 1], outputRange: [0.78, 1] });
  const outlineOpacity = progress.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 0.12, 0] });
  const filledOpacity = progress.interpolate({ inputRange: [0, 0.45, 1], outputRange: [0, 0.15, 1] });
  const outlineScale = progress.interpolate({ inputRange: [0, 1], outputRange: [1, 0.78] });
  const filledScale = progress.interpolate({ inputRange: [0, 1], outputRange: [0.78, 1] });

  return (
    <Animated.View style={[tabStyles.iconShell, { transform: [{ translateY }, { scale: shellScale }] }]}>
      <Animated.View style={[
        tabStyles.bubbleActive,
        {
          opacity: progress,
          backgroundColor: colors.primarySoft,
          transform: [{ scale: bubbleScale }],
        },
      ]} />
      <Animated.View style={[tabStyles.iconLayer, { opacity: outlineOpacity, transform: [{ scale: outlineScale }] }]}>
        <Ionicons name={icon[0]} size={size} color={color} />
      </Animated.View>
      <Animated.View style={[tabStyles.iconLayer, { opacity: filledOpacity, transform: [{ scale: filledScale }] }]}>
        <Ionicons name={icon[1]} size={size + 2} color={color} />
      </Animated.View>
      {showCartBadge && itemCount ? (
        <View style={[
          tabStyles.cartBadge,
          {
            borderColor: colors.card,
            backgroundColor: colors.amber,
            shadowColor: colors.black,
            shadowOpacity: dark ? 0.34 : 0.16,
          },
        ]}>
          <Text style={{ color: colors.amberForeground, fontSize: 9, lineHeight: 13, fontWeight: '900' }}>
            {itemCount > 99 ? '99+' : itemCount}
          </Text>
        </View>
      ) : null}
    </Animated.View>
  );
}

function AnimatedTabLabel({ focused, color, label, isRtl }: { focused: boolean; color: string; label: string; isRtl: boolean }) {
  const progress = useRef(new Animated.Value(focused ? 1 : 0)).current;

  useEffect(() => {
    const animation = Animated.timing(progress, {
      toValue: focused ? 1 : 0,
      duration: 190,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [focused, progress]);

  return (
    <Animated.Text
      numberOfLines={1}
      style={{
        color,
        fontSize: 10,
        fontWeight: '800',
        writingDirection: isRtl ? 'rtl' : 'ltr',
        opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [0.74, 1] }),
        transform: [
          { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [1, 1.02] }) },
        ],
      }}>
      {label}
    </Animated.Text>
  );
}

export default function TabsLayout() {
  const { itemCount } = useCart();
  const { isRtl, t } = useI18n();
  const { colors, dark } = useAppTheme();
  const labels: Record<TabKey, string> = {
    shop: t('Shop'),
    cart: t('Cart'),
    orders: t('Orders'),
    account: t('Account'),
  };

  return (
    <Tabs
      initialRouteName="shop"
      backBehavior="history"
      screenListeners={{
        tabPress: () => {
          void Haptics.selectionAsync().catch(() => undefined);
        },
      }}
      screenOptions={({ route }) => ({
        headerShown: true,
        header: () => <AppHeader />,
        animation: 'shift',
        transitionSpec: {
          animation: 'timing',
          config: {
            duration: 210,
            easing: Easing.out(Easing.cubic),
          },
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelPosition: 'below-icon',
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          flexDirection: isRtl ? 'row-reverse' : 'row',
          height: tabBarHeight,
          marginHorizontal: 12,
          marginBottom: 9,
          paddingTop: 7,
          paddingBottom: 6,
          backgroundColor: 'transparent',
          borderTopWidth: 0,
          borderRadius: 22,
          shadowOpacity: 0,
          elevation: 0,
          overflow: 'visible',
        },
        tabBarBackground: () => (
          <View style={[
            tabStyles.dock,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
          ]}>
          </View>
        ),
        tabBarLabel: ({ focused, color }) => {
          const key = route.name as TabKey;
          return <AnimatedTabLabel focused={focused} color={color} label={labels[key] ?? labels.shop} isRtl={isRtl} />;
        },
        tabBarItemStyle: { paddingTop: 1, overflow: 'visible' },
        tabBarIconStyle: { overflow: 'visible' },
        tabBarIcon: ({ color, size, focused }) => {
          const key = route.name as TabKey;
          const icon = icons[key] ?? icons.shop;
          return (
            <AnimatedTabIcon
              icon={icon}
              focused={focused}
              color={color}
              size={size}
              showCartBadge={key === 'cart'}
              itemCount={itemCount}
              colors={colors}
              dark={dark}
            />
          );
        },
      })}>
      <Tabs.Screen name="shop" options={{ title: t('Shop') }} />
      <Tabs.Screen name="cart" options={{ title: t('Cart') }} />
      <Tabs.Screen name="orders" options={{ title: t('Orders') }} />
      <Tabs.Screen name="account" options={{ title: t('Account') }} />
    </Tabs>
  );
}

const tabStyles = StyleSheet.create({
  iconShell: { width: 54, height: 38, marginBottom: 3, alignItems: 'center', justifyContent: 'center' },
  dock: { ...StyleSheet.absoluteFillObject, overflow: 'hidden', borderRadius: 22, borderWidth: StyleSheet.hairlineWidth },
  bubbleActive: { position: 'absolute', top: 2, bottom: 2, start: 1, end: 1, borderRadius: 18 },
  iconLayer: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  cartBadge: { position: 'absolute', top: -4, end: -3, minWidth: 21, height: 21, paddingHorizontal: 4, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center', shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 5 },
});
