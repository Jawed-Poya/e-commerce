import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState, PrimaryButton } from '@/components/ui';
import { Text } from '@/components/app-text';
import { ConfirmationDialog } from '@/components/confirmation-dialog';
import { QuantitySelector } from '@/components/quantity-selector';
import { formatMoney, radii, shadow, spacing, type AppPalette } from '@/constants/theme';
import { imageUrl } from '@/lib/api';
import { useCart, type CartItem } from '@/providers/cart-provider';
import { useCompany } from '@/providers/company-provider';
import { useI18n } from '@/providers/i18n-provider';
import { useThemedStyles } from '@/providers/theme-provider';

export default function CartScreen() {
  const router = useRouter();
  const cart = useCart();
  const { currency } = useCompany();
  const { isRtl, t } = useI18n();
  const { colors: palette, styles } = useThemedStyles(createStyles);
  const [showClearConfirmation, setShowClearConfirmation] = useState(false);

  return (
    <>
      <SafeAreaView edges={[]} style={styles.safeArea}>
      {!cart.items.length ? (
        <EmptyState
          icon="bag-handle-outline"
          title="Your cart is empty"
          message="Browse the catalog and add the products you want to order."
          action={<PrimaryButton title="Start shopping" icon="storefront" onPress={() => router.push('/shop')} />}
        />
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.screenTitleRow}>
            <View style={styles.titleCopy}>
              <Text style={styles.screenEyebrow}>YOUR BASKET</Text>
              <Text style={styles.screenTitle}>{t(cart.itemCount === 1 ? '1 item ready' : '{count} items ready', { count: cart.itemCount })}</Text>
              <View style={styles.syncRow}>
                <View style={[styles.syncDot, cart.syncStatus === 'synced' && styles.syncDotReady, cart.syncStatus === 'offline' && styles.syncDotOffline]} />
                <Text style={styles.syncText}>{cart.syncStatus === 'synced' ? 'Synced with web and mobile' : cart.syncStatus === 'syncing' ? 'Syncing your cart…' : cart.syncStatus === 'offline' ? 'Cart saved on this device' : 'Sign in to sync across devices'}</Text>
              </View>
            </View>
            <Pressable
              hitSlop={10}
              onPress={() => setShowClearConfirmation(true)}
              style={styles.clearButton}>
              <Ionicons name="trash-outline" size={15} color={palette.danger} /><Text style={styles.clear}>Clear</Text>
            </Pressable>
          </View>
          <View style={styles.items}>
            {cart.items.map((item) => <CartLine key={item.lineKey} item={item} currency={currency} />)}
          </View>

          <View style={styles.summary}>
            <View style={styles.summaryHeader}>
              <View style={styles.summaryIcon}><Ionicons name="receipt-outline" size={21} color={palette.primary} /></View>
              <View><Text style={styles.summaryTitle}>Order summary</Text><Text style={styles.summarySub}>Shipping is calculated at checkout</Text></View>
            </View>
            <SummaryRow label="Items" value={String(cart.itemCount)} />
            <SummaryRow label="Subtotal" value={formatMoney(cart.subtotal, currency)} strong />
            <View style={styles.secureNote}><Ionicons name="shield-checkmark" size={17} color={palette.success} /><Text style={styles.secureText}>Prices and inventory are securely revalidated by the server before your order is placed.</Text></View>
            <PrimaryButton title="Continue to checkout" icon={isRtl ? 'arrow-back' : 'arrow-forward'} onPress={() => router.push('/checkout')} />
          </View>

          <Pressable onPress={() => router.push('/shop')} style={styles.continueButton}>
            <Ionicons name={isRtl ? 'arrow-forward' : 'arrow-back'} size={16} color={palette.primary} />
            <Text style={styles.continueText}>Continue shopping</Text>
          </Pressable>
        </ScrollView>
      )}
      </SafeAreaView>
      <ConfirmationDialog
        visible={showClearConfirmation}
        title="Clear cart?"
        message="All items will be removed from your cart."
        confirmLabel="Clear cart"
        icon="trash-outline"
        tone="danger"
        onCancel={() => setShowClearConfirmation(false)}
        onConfirm={() => {
          setShowClearConfirmation(false);
          cart.clear();
        }}
      />
    </>
  );
}

function CartLine({ item, currency }: { item: CartItem; currency: string }) {
  const cart = useCart();
  const { company } = useCompany();
  const { t } = useI18n();
  const { colors: palette, styles } = useThemedStyles(createStyles);
  const quickQuantities = item.quickOrderQuantities.length
    ? item.quickOrderQuantities
    : company?.settings.defaultQuickOrderQuantities;
  return (
    <View style={styles.line}>
      <View style={styles.lineImageWrap}>
        {imageUrl(item.image)
          ? <Image source={{ uri: imageUrl(item.image)! }} style={styles.lineImage} contentFit="contain" />
          : <Ionicons name="cube-outline" size={28} color={palette.primary} />}
      </View>
      <View style={styles.lineBody}>
        <View style={styles.lineTop}>
          <View style={styles.lineNameWrap}><Text numberOfLines={2} style={styles.lineName}>{item.name}</Text><Text style={styles.lineUnit}>{formatMoney(item.price, currency)} {item.unitName ? `· ${item.unitName}` : ''}</Text></View>
          <Pressable accessibilityLabel={t(`Remove ${item.name}`)} hitSlop={10} onPress={() => cart.removeItem(item.lineKey)}><Ionicons name="trash-outline" size={19} color={palette.danger} /></Pressable>
        </View>
        <View style={styles.lineBottom}>
          <View style={styles.lineTotalRow}>
            <Text style={styles.lineTotalLabel}>ITEM TOTAL</Text>
            <Text numberOfLines={1} adjustsFontSizeToFit style={styles.lineTotal}>{formatMoney(item.price * item.quantity, currency)}</Text>
          </View>
          <QuantitySelector
            value={item.quantity}
            stock={item.stock}
            quantityStep={item.quantityStep}
            quickQuantities={quickQuantities}
            productName={item.name}
            allowRemove
            compact
            onChange={(quantity) => cart.updateQuantity(item.lineKey, quantity)}
          />
        </View>
      </View>
    </View>
  );
}

function SummaryRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  const { styles } = useThemedStyles(createStyles);
  return <View style={styles.summaryRow}><Text style={[styles.summaryLabel, strong && styles.strong]}>{label}</Text><Text style={[styles.summaryValue, strong && styles.strong]}>{value}</Text></View>;
}

const createStyles = (palette: AppPalette, isRtl: boolean) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.background },
  screenTitleRow: { marginBottom: 14, flexDirection: isRtl ? 'row-reverse' : 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10 },
  titleCopy: { flex: 1, minWidth: 0 },
  screenEyebrow: { color: palette.primary, fontSize: 8, fontWeight: '900', letterSpacing: 1.4 },
  screenTitle: { marginTop: 4, color: palette.text, fontSize: 22, fontWeight: '900', letterSpacing: -0.6 },
  syncRow: { marginTop: 5, flexDirection: isRtl ? 'row-reverse' : 'row', alignItems: 'center', gap: 5 },
  syncDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: palette.muted },
  syncDotReady: { backgroundColor: palette.success },
  syncDotOffline: { backgroundColor: palette.amber },
  syncText: { flexShrink: 1, color: palette.muted, fontSize: 8.5, fontWeight: '700' },
  clearButton: { minHeight: 36, paddingHorizontal: 11, borderRadius: 12, flexDirection: isRtl ? 'row-reverse' : 'row', alignItems: 'center', gap: 5, backgroundColor: palette.dangerSoft },
  clear: { color: palette.danger, fontSize: 12, fontWeight: '800' },
  content: { padding: spacing.lg, paddingBottom: 34 },
  items: { gap: 10 },
  line: { padding: 12, borderRadius: radii.lg, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.card, flexDirection: isRtl ? 'row-reverse' : 'row', gap: 12 },
  lineImageWrap: { width: 84, height: 92, borderRadius: radii.md, backgroundColor: palette.input, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  lineImage: { width: '100%', height: '100%' },
  lineBody: { flex: 1, justifyContent: 'space-between' },
  lineTop: { flexDirection: isRtl ? 'row-reverse' : 'row', gap: 8 },
  lineNameWrap: { flex: 1 },
  lineName: { color: palette.text, fontSize: 14, lineHeight: 19, fontWeight: '900' },
  lineUnit: { marginTop: 4, color: palette.muted, fontSize: 10 },
  lineBottom: { marginTop: 10, gap: 8 },
  lineTotalRow: { minHeight: 30, paddingHorizontal: 2, flexDirection: isRtl ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  lineTotalLabel: { color: palette.muted, fontSize: 7.5, fontWeight: '900', letterSpacing: 0.8 },
  lineTotal: { flex: 1, textAlign: isRtl ? 'left' : 'right', color: palette.primary, fontSize: 15, fontWeight: '900' },
  summary: { marginTop: 18, padding: spacing.xl, borderRadius: radii.xl, backgroundColor: palette.card, borderWidth: 1, borderColor: palette.border, ...shadow },
  summaryHeader: { marginBottom: 18, flexDirection: isRtl ? 'row-reverse' : 'row', alignItems: 'center', gap: 11 },
  summaryIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: palette.primarySoft, alignItems: 'center', justifyContent: 'center' },
  summaryTitle: { color: palette.text, fontSize: 16, fontWeight: '900' },
  summarySub: { marginTop: 2, color: palette.muted, fontSize: 10 },
  summaryRow: { paddingVertical: 9, flexDirection: isRtl ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: palette.border },
  summaryLabel: { color: palette.muted, fontSize: 13 },
  summaryValue: { color: palette.text, fontSize: 13, fontWeight: '700' },
  strong: { color: palette.text, fontSize: 17, fontWeight: '900' },
  secureNote: { marginVertical: 16, padding: 12, borderRadius: radii.md, backgroundColor: palette.successSoft, flexDirection: isRtl ? 'row-reverse' : 'row', alignItems: 'flex-start', gap: 8 },
  secureText: { flex: 1, color: palette.success, fontSize: 10, lineHeight: 16, fontWeight: '600' },
  continueButton: { alignSelf: 'center', marginTop: 22, padding: 10, flexDirection: isRtl ? 'row-reverse' : 'row', alignItems: 'center', gap: 6 },
  continueText: { color: palette.primary, fontSize: 12, fontWeight: '800' },
});
