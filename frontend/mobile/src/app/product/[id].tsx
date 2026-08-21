import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ErrorState, LoadingBlock, PrimaryButton, StatusChip } from '@/components/ui';
import { Text } from '@/components/app-text';
import { QuantitySelector } from '@/components/quantity-selector';
import { formatMoney, radii, shadow, spacing, type AppPalette } from '@/constants/theme';
import { imageUrl } from '@/lib/api';
import { commerceApi } from '@/lib/commerce-api';
import { cartQuickQuantities, useCart } from '@/providers/cart-provider';
import { useCompany } from '@/providers/company-provider';
import { useI18n } from '@/providers/i18n-provider';
import { useNotifications } from '@/providers/notification-provider';
import { useThemedStyles } from '@/providers/theme-provider';

export default function ProductDetailsScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const cart = useCart();
  const { trackProduct } = useNotifications();
  const { company, currency } = useCompany();
  const { t } = useI18n();
  const { colors: palette, styles } = useThemedStyles(createStyles);
  const [selectedQuantity, setSelectedQuantity] = useState(1);
  const productId = Number(params.id);
  const query = useQuery({
    queryKey: ['product', productId],
    queryFn: () => commerceApi.product(productId),
    enabled: Number.isFinite(productId) && productId > 0,
  });

  useEffect(() => {
    if (Number.isFinite(productId) && productId > 0) trackProduct(productId);
  }, [productId, trackProduct]);

  const loadedProduct = query.data;
  const loadedStep = loadedProduct?.orderQuantityStep && loadedProduct.orderQuantityStep > 0
    ? loadedProduct.orderQuantityStep
    : 1;
  const loadedProductId = loadedProduct?.id;
  const loadedCartItem = loadedProduct
    ? cart.items.find((item) => item.id === loadedProduct.id && item.unitId === (loadedProduct.unitId ?? null))
    : undefined;

  useEffect(() => {
    if (!loadedProductId) return;
    setSelectedQuantity(loadedCartItem?.quantity ?? loadedStep);
  }, [loadedCartItem?.quantity, loadedProductId, loadedStep]);

  if (query.isLoading) return <LoadingBlock label="Loading product details…" />;
  if (query.isError || !query.data) return <ErrorState message={query.error?.message ?? 'Product not found.'} onRetry={() => void query.refetch()} />;

  const product = query.data;
  const step = loadedStep;
  const orderable = product.price != null && product.stock >= step;
  const productImage = product.primaryImageUrl || product.images?.find((item) => item.isPrimary)?.url || product.images?.[0]?.url;
  const cartItem = loadedCartItem;
  const hasDiscount = product.price != null && product.oldPrice != null && product.oldPrice > product.price;
  const configuredQuickQuantities = product.quickOrderQuantities?.length
    ? product.quickOrderQuantities
    : company?.settings.defaultQuickOrderQuantities;
  const quickQuantities = cartQuickQuantities(
    { stock: product.stock, quantityStep: step },
    configuredQuickQuantities,
  );
  const selectedTotal = product.price == null ? null : product.price * selectedQuantity;

  const add = () => {
    cart.addProduct({ ...product, quickOrderQuantities: quickQuantities }, selectedQuantity);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  return (
    <SafeAreaView edges={['bottom']} style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.imageCard}>
          {imageUrl(productImage)
            ? <Image source={{ uri: imageUrl(productImage)! }} style={styles.image} contentFit="contain" transition={200} />
            : <View style={styles.placeholder}><Ionicons name="cube-outline" size={58} color={palette.primary} /></View>}
          <View style={styles.badges}>
            {product.isFeatured ? <StatusChip label="Featured" tone="warning" /> : null}
            <StatusChip label={orderable ? 'In stock' : 'Unavailable'} tone={orderable ? 'success' : 'danger'} />
          </View>
        </View>

        <View style={styles.details}>
          <Text style={styles.category}>{product.categoryName}</Text>
          <Text style={styles.title}>{product.name}</Text>
          <View style={styles.ratingRow}>
            <Ionicons name="star" size={16} color={palette.amber} />
            <Text style={styles.rating}>{product.reviewCount ? product.averageRating.toFixed(1) : 'New'}</Text>
            <Text style={styles.reviews}>· {t('{count} reviews', { count: product.reviewCount })}</Text>
            {product.unitName ? <Text style={styles.unit}>· {t('per {unit}', { unit: product.unitName })}</Text> : null}
          </View>

          <View style={styles.priceRow}>
            <Text style={styles.price}>{product.price == null ? 'Contact for price' : formatMoney(product.price, currency)}</Text>
            {hasDiscount ? <Text style={styles.oldPrice}>{formatMoney(product.oldPrice!, currency)}</Text> : null}
          </View>

          <View style={styles.divider} />
          <Text style={styles.sectionTitle}>About this product</Text>
          <Text style={styles.description}>{product.description || product.shortDescription || 'This product is available from our current catalog. Price and stock are validated by the store when you place your order.'}</Text>

          {orderable ? (
            <View style={styles.quantityCard}>
              <View style={styles.quantityHeader}>
                <View style={styles.quantityTitleWrap}>
                  <Text style={styles.quantityEyebrow}>ORDER QUANTITY</Text>
                  <Text style={styles.quantityTitle}>Choose how many you need</Text>
                </View>
                <View style={styles.stepBadge}>
                  <Text style={styles.stepBadgeLabel}>STEP</Text>
                  <Text style={styles.stepBadgeValue}>{step}</Text>
                </View>
              </View>
              <QuantitySelector
                value={selectedQuantity}
                stock={product.stock}
                quantityStep={step}
                quickQuantities={quickQuantities}
                productName={product.name}
                onChange={setSelectedQuantity}
              />
              <Text style={styles.quantityHelp}>{t('{count} available · values follow the store quantity step', { count: product.stock })}</Text>
            </View>
          ) : null}

          <View style={styles.features}>
            <Feature icon="shield-checkmark-outline" title="Server verified" text="Price and stock are checked again during checkout." />
            <Feature icon="cube-outline" title="Live inventory" text={t('{count} {unit} currently available.', { count: product.stock, unit: product.unitName ?? t('items') })} />
            <Feature icon="refresh-outline" title="Easy tracking" text="Follow every order status from your account." />
          </View>
        </View>
      </ScrollView>

      <View style={styles.bottomBar}>
        {cartItem ? (
          <Pressable onPress={() => router.push('/cart')} style={styles.inCart}>
            <Ionicons name="bag-check" size={20} color={palette.primary} />
            <View><Text style={styles.inCartLabel}>IN YOUR CART</Text><Text style={styles.inCartQuantity}>{cartItem.quantity} {product.unitName ?? ''}</Text></View>
          </Pressable>
        ) : <View style={styles.bottomPrice}><Text style={styles.bottomPriceLabel}>SELECTED TOTAL</Text><Text numberOfLines={1} adjustsFontSizeToFit style={styles.bottomPriceValue}>{selectedTotal == null ? '—' : formatMoney(selectedTotal, currency)}</Text></View>}
        <PrimaryButton title={cartItem ? 'Update cart quantity' : 'Add selected quantity'} icon={cartItem ? 'checkmark-circle' : 'bag-add'} onPress={add} disabled={!orderable} style={styles.addButton} />
      </View>
    </SafeAreaView>
  );
}

function Feature({ icon, title, text }: { icon: keyof typeof Ionicons.glyphMap; title: string; text: string }) {
  const { colors: palette, styles } = useThemedStyles(createStyles);
  return (
    <View style={styles.feature}>
      <View style={styles.featureIcon}><Ionicons name={icon} size={19} color={palette.primary} /></View>
      <View style={styles.featureText}><Text style={styles.featureTitle}>{title}</Text><Text style={styles.featureDescription}>{text}</Text></View>
    </View>
  );
}

const createStyles = (palette: AppPalette, isRtl: boolean) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.background },
  content: { paddingBottom: 114 },
  imageCard: { height: 350, margin: spacing.lg, borderRadius: radii.xl, overflow: 'hidden', backgroundColor: palette.card, borderWidth: 1, borderColor: palette.border, position: 'relative', ...shadow },
  image: { width: '100%', height: '100%' },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.primarySoft },
  badges: { position: 'absolute', top: 14, start: 14, flexDirection: isRtl ? 'row-reverse' : 'row', gap: 7 },
  details: { paddingHorizontal: spacing.xl },
  category: { color: palette.primary, fontSize: 10, fontWeight: '900', letterSpacing: 1.5, textTransform: 'uppercase' },
  title: { marginTop: 8, color: palette.text, fontSize: 29, lineHeight: 35, fontWeight: '900', letterSpacing: -1 },
  ratingRow: { marginTop: 12, flexDirection: isRtl ? 'row-reverse' : 'row', alignItems: 'center', gap: 5 },
  rating: { color: palette.text, fontSize: 13, fontWeight: '800' },
  reviews: { color: palette.muted, fontSize: 12 },
  unit: { flex: 1, color: palette.muted, fontSize: 12 },
  priceRow: { marginTop: 18, flexDirection: isRtl ? 'row-reverse' : 'row', alignItems: 'baseline', gap: 10 },
  price: { color: palette.primary, fontSize: 27, fontWeight: '900', letterSpacing: -1 },
  oldPrice: { color: palette.muted, fontSize: 13, textDecorationLine: 'line-through', textDecorationColor: palette.amber },
  divider: { height: 1, backgroundColor: palette.border, marginVertical: 24 },
  sectionTitle: { color: palette.text, fontSize: 17, fontWeight: '900' },
  description: { marginTop: 9, color: palette.muted, fontSize: 14, lineHeight: 23 },
  quantityCard: { marginTop: 22, padding: 15, borderRadius: radii.lg, backgroundColor: palette.card, borderWidth: 1, borderColor: palette.primary, gap: 12, ...shadow },
  quantityHeader: { flexDirection: isRtl ? 'row-reverse' : 'row', alignItems: 'center', gap: 10 },
  quantityTitleWrap: { flex: 1 },
  quantityEyebrow: { color: palette.primary, fontSize: 8, fontWeight: '900', letterSpacing: 1.15 },
  quantityTitle: { marginTop: 3, color: palette.text, fontSize: 15, fontWeight: '900' },
  stepBadge: { minWidth: 50, height: 42, paddingHorizontal: 8, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.primarySoft },
  stepBadgeLabel: { color: palette.muted, fontSize: 7, fontWeight: '900', letterSpacing: 0.8 },
  stepBadgeValue: { marginTop: 1, color: palette.primary, fontSize: 14, fontWeight: '900', writingDirection: 'ltr' },
  quantityHelp: { color: palette.muted, fontSize: 10, lineHeight: 15 },
  features: { marginTop: 24, gap: 10 },
  feature: { padding: 14, borderRadius: radii.md, backgroundColor: palette.card, borderWidth: 1, borderColor: palette.border, flexDirection: isRtl ? 'row-reverse' : 'row', gap: 12 },
  featureIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.primarySoft },
  featureText: { flex: 1 },
  featureTitle: { color: palette.text, fontSize: 13, fontWeight: '900' },
  featureDescription: { marginTop: 3, color: palette.muted, fontSize: 11, lineHeight: 17 },
  bottomBar: { position: 'absolute', start: 0, end: 0, bottom: 0, minHeight: 86, paddingHorizontal: spacing.lg, paddingVertical: 12, borderTopWidth: 1, borderTopColor: palette.border, backgroundColor: palette.card, flexDirection: isRtl ? 'row-reverse' : 'row', alignItems: 'center', gap: 12 },
  inCart: { flex: 1, flexDirection: isRtl ? 'row-reverse' : 'row', alignItems: 'center', gap: 8 },
  inCartLabel: { color: palette.primary, fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  inCartQuantity: { marginTop: 2, color: palette.text, fontSize: 14, fontWeight: '900' },
  bottomPrice: { flex: 1 },
  bottomPriceLabel: { color: palette.muted, fontSize: 8, fontWeight: '900', letterSpacing: 1.2 },
  bottomPriceValue: { marginTop: 2, color: palette.text, fontSize: 19, fontWeight: '900' },
  addButton: { flex: 1.35 },
});
