import Ionicons from '@expo/vector-icons/Ionicons';
import { FlashList } from '@shopify/flash-list';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState, ErrorState, PrimaryButton, StatusChip } from '@/components/ui';
import { Text } from '@/components/app-text';
import { formatDate, formatMoney, radii, spacing, type AppPalette } from '@/constants/theme';
import { commerceApi } from '@/lib/commerce-api';
import { useAuth } from '@/providers/auth-provider';
import { useThemedStyles } from '@/providers/theme-provider';
import type { AccountOrder, OrderStatus } from '@/types/domain';

export default function OrdersScreen() {
  const router = useRouter();
  const auth = useAuth();
  const { colors: palette, styles, isRtl } = useThemedStyles(createStyles);
  const orders = useInfiniteQuery({
    queryKey: ['account-orders', 'mobile', auth.user?.customerId],
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) => commerceApi.accountOrders(pageParam, signal),
    getNextPageParam: (lastPage) => lastPage.hasNextPage ? lastPage.page + 1 : undefined,
    enabled: auth.isAuthenticated,
  });
  const items = orders.data?.pages.flatMap((page) => page.items) ?? [];

  const header = (
    <View>
      <Pressable onPress={() => router.push('/track')} style={({ pressed }) => [styles.trackCard, pressed && styles.pressed]}>
        <View style={styles.trackIcon}><Ionicons name="navigate" size={24} color={palette.primary} /></View>
        <View style={styles.flex}><Text style={styles.trackEyebrow}>QUICK TRACKING</Text><Text style={styles.trackTitle}>Track with order number</Text><Text style={styles.trackText}>{auth.isAuthenticated ? 'Your account securely verifies the order.' : 'Use the phone number entered at checkout.'}</Text></View>
        <Ionicons name={isRtl ? 'chevron-back' : 'chevron-forward'} size={20} color={palette.primary} />
      </Pressable>
      {auth.user && items.length ? (
        <View style={styles.listTitle}><View><Text style={styles.eyebrow}>ORDER HISTORY</Text><Text style={styles.title}>Your recent orders</Text></View><Text style={styles.count}>{orders.data?.pages[0]?.totalCount ?? items.length}</Text></View>
      ) : null}
      {orders.isError && items.length ? <ErrorState message={orders.error.message} onRetry={() => void orders.refetch()} /> : null}
    </View>
  );

  return (
    <SafeAreaView edges={[]} style={styles.safeArea}>
      <FlashList
        data={items}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => <OrderCard order={item} onPress={() => router.push({ pathname: '/track', params: { orderNumber: item.orderNumber } })} />}
        ListHeaderComponent={header}
        ListEmptyComponent={!auth.user
          ? <EmptyState icon="person-circle-outline" title="Sign in for order history" message="Your account keeps all orders together. You can also track an order without signing in." action={<View style={styles.emptyActions}><PrimaryButton title="Sign in" icon="log-in" onPress={() => router.push('/auth')} /><PrimaryButton title="Track as guest" icon="navigate" variant="outline" onPress={() => router.push('/track')} /></View>} />
          : orders.isLoading
            ? <EmptyState icon="hourglass-outline" title="Loading your orders" message="Your latest purchases are being retrieved securely." />
            : orders.isError
              ? <ErrorState message={orders.error.message} onRetry={() => void orders.refetch()} />
              : <EmptyState icon="receipt-outline" title="No orders yet" message="Your completed checkouts will appear here." action={<PrimaryButton title="Start shopping" icon="storefront" onPress={() => router.push('/shop')} />} />}
        ListFooterComponent={orders.isFetchingNextPage ? <Text style={styles.footer}>Loading more orders…</Text> : null}
        contentContainerStyle={styles.content}
        onEndReached={() => {
          if (orders.hasNextPage && !orders.isFetchingNextPage) void orders.fetchNextPage();
        }}
        onEndReachedThreshold={0.5}
        refreshing={orders.isRefetching && !orders.isFetchingNextPage}
        onRefresh={() => void orders.refetch()}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

function OrderCard({ order, onPress }: { order: AccountOrder; onPress: () => void }) {
  const { colors: palette, styles, isRtl } = useThemedStyles(createStyles);
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.orderCard, pressed && styles.pressed]}>
      <View style={styles.orderTop}>
        <View style={styles.orderIcon}><Ionicons name="cube" size={21} color={palette.primary} /></View>
        <View style={styles.flex}><Text style={styles.orderNumber}>{order.orderNumber}</Text><Text style={styles.orderDate}>{formatDate(order.createdAt)}</Text></View>
        <StatusChip label={order.status} tone={statusTone(order.status)} />
      </View>
      <View style={styles.orderDivider} />
      <View style={styles.orderBottom}>
        <View><Text style={styles.orderMetaLabel}>ITEMS</Text><Text style={styles.orderMetaValue}>{order.itemCount}</Text></View>
        <View><Text style={styles.orderMetaLabel}>PAYMENT</Text><Text style={styles.orderMetaValue}>{order.paymentStatus}</Text></View>
        <View style={styles.totalWrap}><Text style={styles.orderMetaLabel}>TOTAL</Text><Text style={styles.orderTotal}>{formatMoney(order.total, order.currency)}</Text></View>
        <Ionicons name={isRtl ? 'chevron-back' : 'chevron-forward'} size={18} color={palette.muted} />
      </View>
    </Pressable>
  );
}

function statusTone(status: OrderStatus): 'neutral' | 'success' | 'warning' | 'danger' {
  if (status === 'Delivered' || status === 'Confirmed') return 'success';
  if (status === 'Cancelled' || status === 'Returned') return 'danger';
  if (status === 'Pending' || status === 'Processing') return 'warning';
  return 'neutral';
}

const createStyles = (palette: AppPalette, isRtl: boolean) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.background },
  flex: { flex: 1 },
  content: { paddingBottom: 30 },
  trackCard: { margin: spacing.lg, padding: spacing.lg, borderRadius: radii.lg, backgroundColor: palette.primarySoft, borderWidth: 1, borderColor: palette.primary, flexDirection: isRtl ? 'row-reverse' : 'row', alignItems: 'center', gap: 12 },
  trackIcon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.card },
  trackEyebrow: { color: palette.primary, fontSize: 8, fontWeight: '900', letterSpacing: 1.2 },
  trackTitle: { marginTop: 4, color: palette.text, fontSize: 15, fontWeight: '900' },
  trackText: { marginTop: 2, color: palette.muted, fontSize: 10 },
  listTitle: { paddingHorizontal: spacing.xl, paddingTop: 5, paddingBottom: 9, flexDirection: isRtl ? 'row-reverse' : 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  eyebrow: { color: palette.primary, fontSize: 8, fontWeight: '900', letterSpacing: 1.3 },
  title: { marginTop: 4, color: palette.text, fontSize: 21, fontWeight: '900' },
  count: { minWidth: 30, paddingHorizontal: 9, paddingVertical: 6, borderRadius: radii.pill, overflow: 'hidden', backgroundColor: palette.primarySoft, color: palette.primary, textAlign: 'center', fontSize: 10, fontWeight: '900' },
  orderCard: { marginHorizontal: spacing.lg, marginVertical: 6, padding: spacing.lg, borderRadius: radii.lg, backgroundColor: palette.card, borderWidth: 1, borderColor: palette.border },
  orderTop: { flexDirection: isRtl ? 'row-reverse' : 'row', alignItems: 'center', gap: 11 },
  orderIcon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.primarySoft },
  orderNumber: { color: palette.text, fontSize: 14, fontWeight: '900' },
  orderDate: { marginTop: 3, color: palette.muted, fontSize: 9 },
  orderDivider: { height: 1, marginVertical: 13, backgroundColor: palette.border },
  orderBottom: { flexDirection: isRtl ? 'row-reverse' : 'row', alignItems: 'center', gap: 18 },
  orderMetaLabel: { color: palette.muted, fontSize: 7, fontWeight: '900', letterSpacing: 0.8 },
  orderMetaValue: { marginTop: 3, color: palette.text, fontSize: 11, fontWeight: '800' },
  totalWrap: { flex: 1 },
  orderTotal: { marginTop: 3, color: palette.primary, fontSize: 13, fontWeight: '900' },
  emptyActions: { gap: 9, minWidth: 220 },
  footer: { padding: 20, textAlign: 'center', color: palette.muted, fontSize: 11 },
  pressed: { opacity: 0.72 },
});
