import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { formatMoney, radii, type AppPalette } from '@/constants/theme';
import { Text } from '@/components/app-text';
import { imageUrl } from '@/lib/api';
import { useCart } from '@/providers/cart-provider';
import { useCompany } from '@/providers/company-provider';
import { useI18n } from '@/providers/i18n-provider';
import { useThemedStyles } from '@/providers/theme-provider';
import type { Product } from '@/types/domain';

function ProductCardComponent({ product }: { product: Product }) {
  const router = useRouter();
  const cart = useCart();
  const { currency } = useCompany();
  const { t } = useI18n();
  const { colors: palette, styles } = useThemedStyles(createStyles);
  const quantityStep = product.orderQuantityStep > 0 ? product.orderQuantityStep : 1;
  const orderable = product.price != null && product.stock >= quantityStep;
  const hasDiscount = product.price != null && product.oldPrice != null && product.oldPrice > product.price;
  const discount = hasDiscount ? Math.round(((product.oldPrice! - product.price!) / product.oldPrice!) * 100) : 0;
  const inCart = cart.items.find((item) => item.id === product.id && item.unitId === (product.unitId ?? null));
  const source = imageUrl(product.primaryImageUrl);
  const descriptor = product.strength || product.genericName || product.shortDescription || product.unitName || 'Quality product';

  const openDetails = () => router.push({ pathname: '/product/[id]', params: { id: String(product.id) } });
  const add = () => {
    if (!orderable) return;
    cart.addProduct(product);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };
  const decrease = () => {
    if (!inCart) return;
    if (inCart.quantity <= inCart.quantityStep + Number.EPSILON) cart.removeItem(inCart.lineKey);
    else cart.updateQuantity(inCart.lineKey, inCart.quantity - inCart.quantityStep);
    void Haptics.selectionAsync();
  };

  return (
    <View style={styles.card}>
      <Pressable accessibilityRole="button" accessibilityLabel={t(`View ${product.name}`)} onPress={openDetails} style={({ pressed }) => [styles.imageWrap, pressed && styles.pressed]}>
        {source
          ? <Image source={{ uri: source }} style={styles.image} contentFit="contain" transition={120} cachePolicy="memory-disk" priority="low" recyclingKey={String(product.id)} />
          : <View style={styles.placeholder}><Ionicons name="cube-outline" size={34} color={palette.primary} /></View>}
        <View style={styles.badges}>
          {hasDiscount ? <View style={styles.discount}><Text style={styles.discountText}>-{discount}%</Text></View> : null}
          {product.isFeatured ? <View style={styles.featured}><Ionicons name="sparkles" size={10} color={palette.primary} /></View> : null}
        </View>
        {inCart ? <View style={styles.inCart}><Ionicons name="bag-check" size={12} color={palette.primaryForeground} /><Text style={styles.inCartText}>{inCart.quantity}</Text></View> : null}
      </Pressable>

      <View style={styles.body}>
        <View style={styles.metaRow}>
          <Text numberOfLines={1} style={styles.category}>{product.categoryName || 'Product'}</Text>
          {product.reviewCount ? <View style={styles.rating}><Ionicons name="star" size={11} color={palette.amber} /><Text style={styles.ratingText}>{product.averageRating.toFixed(1)}</Text></View> : null}
        </View>

        <Pressable accessibilityRole="button" onPress={openDetails} style={({ pressed }) => pressed && styles.pressed}>
          <Text numberOfLines={2} style={styles.name}>{product.name}</Text>
          <Text numberOfLines={1} style={styles.description}>{descriptor}</Text>
        </Pressable>

        <View style={styles.availabilityRow}>
          <View style={[styles.stock, !orderable && styles.stockUnavailable]}>
            <View style={[styles.stockDot, !orderable && styles.stockDotUnavailable]} />
            <Text numberOfLines={1} style={[styles.stockText, !orderable && styles.stockTextUnavailable]}>{orderable ? 'Ready to order' : 'Unavailable'}</Text>
          </View>
          {product.unitName ? <Text numberOfLines={1} style={styles.unit}>{product.unitName}</Text> : null}
        </View>

        <View style={styles.priceRow}>
          <View style={styles.priceCopy}>
            <Text numberOfLines={1} adjustsFontSizeToFit style={styles.price}>{product.price == null ? 'Ask for price' : formatMoney(product.price, currency)}</Text>
            {hasDiscount ? <Text numberOfLines={1} style={styles.oldPrice}>{formatMoney(product.oldPrice!, currency)}</Text> : <Text style={styles.priceHint}>{t('Price per {unit}', { unit: product.unitName?.toLowerCase() || t('unit') })}</Text>}
          </View>
          {inCart ? (
            <View style={styles.inCartControl}>
              <Pressable accessibilityRole="button" accessibilityLabel={t('Decrease quantity')} onPress={decrease} style={({ pressed }) => [styles.cartStepButton, pressed && styles.cartStepPressed]}>
                <Ionicons name="remove" size={17} color={palette.primary} />
              </Pressable>
              <View style={styles.inCartQuantity}><Text style={styles.inCartQuantityText}>{inCart.quantity}</Text></View>
              <Pressable accessibilityRole="button" accessibilityLabel={t(`Add ${product.name} to cart`)} onPress={add} style={({ pressed }) => [styles.plusButton, pressed && styles.addButtonPressed]}>
                <Ionicons name="add" size={19} color={palette.primaryForeground} />
              </Pressable>
            </View>
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={orderable ? t(`Add ${product.name} to cart`) : t(`${product.name} is unavailable`)}
              disabled={!orderable}
              onPress={add}
              style={({ pressed }) => [styles.addButton, !orderable && styles.addButtonDisabled, pressed && styles.addButtonPressed]}>
              <Ionicons name="bag-add-outline" size={18} color={palette.primaryForeground} />
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}

export const ProductCard = memo(ProductCardComponent);

const createStyles = (palette: AppPalette, isRtl: boolean) => StyleSheet.create({
  card: { flex: 1, minHeight: 146, marginHorizontal: 11, marginVertical: 5, overflow: 'hidden', flexDirection: isRtl ? 'row-reverse' : 'row', backgroundColor: palette.card, borderRadius: radii.lg, borderWidth: 1, borderColor: palette.border },
  imageWrap: { width: 108, minHeight: 144, position: 'relative', overflow: 'hidden', backgroundColor: palette.input, borderEndWidth: 1, borderEndColor: palette.border },
  image: { width: '100%', height: '100%' },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.primarySoft },
  badges: { position: 'absolute', top: 7, start: 7, flexDirection: isRtl ? 'row-reverse' : 'row', alignItems: 'center', gap: 4 },
  discount: { paddingHorizontal: 6, paddingVertical: 4, borderRadius: 7, backgroundColor: palette.amber },
  discountText: { color: palette.amberForeground, fontSize: 8, fontWeight: '900' },
  featured: { width: 23, height: 23, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,.94)' },
  inCart: { position: 'absolute', start: 7, bottom: 7, minWidth: 38, height: 23, paddingHorizontal: 6, borderRadius: radii.pill, flexDirection: isRtl ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'center', gap: 3, backgroundColor: palette.primary },
  inCartText: { color: palette.primaryForeground, fontSize: 8, fontWeight: '900' },
  body: { flex: 1, minWidth: 0, padding: 9 },
  metaRow: { minHeight: 14, flexDirection: isRtl ? 'row-reverse' : 'row', alignItems: 'center', gap: 6 },
  category: { flex: 1, color: palette.primary, fontSize: 8, fontWeight: '900', letterSpacing: 0.8, textTransform: 'uppercase' },
  rating: { flexDirection: isRtl ? 'row-reverse' : 'row', alignItems: 'center', gap: 2 },
  ratingText: { color: palette.text, fontSize: 9, fontWeight: '800' },
  name: { minHeight: 32, marginTop: 2, color: palette.text, fontSize: 13, lineHeight: 16, fontWeight: '900', letterSpacing: -0.15 },
  description: { marginTop: 0, color: palette.muted, fontSize: 8.5, lineHeight: 11.5 },
  availabilityRow: { minHeight: 21, marginTop: 3, flexDirection: isRtl ? 'row-reverse' : 'row', alignItems: 'center', gap: 5 },
  stock: { maxWidth: '74%', paddingHorizontal: 6, paddingVertical: 4, borderRadius: radii.pill, flexDirection: isRtl ? 'row-reverse' : 'row', alignItems: 'center', gap: 3, backgroundColor: palette.successSoft },
  stockUnavailable: { backgroundColor: palette.dangerSoft },
  stockDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: palette.success },
  stockDotUnavailable: { backgroundColor: palette.danger },
  stockText: { flexShrink: 1, color: palette.success, fontSize: 7.5, fontWeight: '900' },
  stockTextUnavailable: { color: palette.danger },
  unit: { flex: 1, color: palette.muted, textAlign: isRtl ? 'left' : 'right', fontSize: 8, fontWeight: '700' },
  priceRow: { flex: 1, minHeight: 38, marginTop: 2, flexDirection: isRtl ? 'row-reverse' : 'row', alignItems: 'flex-end', gap: 5 },
  priceCopy: { flex: 1, minWidth: 0 },
  price: { color: palette.primary, fontSize: 14, fontWeight: '900', letterSpacing: -0.4 },
  oldPrice: { marginTop: 1, color: palette.muted, fontSize: 8, textDecorationLine: 'line-through', textDecorationColor: palette.amber },
  priceHint: { marginTop: 1, color: palette.muted, fontSize: 7.5 },
  addButton: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.primary },
  inCartControl: { width: 101, height: 34, borderRadius: 11, overflow: 'hidden', direction: 'ltr', flexDirection: 'row', alignItems: 'center', backgroundColor: palette.primarySoft, borderWidth: 1, borderColor: palette.primary },
  cartStepButton: { width: 32, height: 34, alignItems: 'center', justifyContent: 'center' },
  cartStepPressed: { backgroundColor: palette.input },
  inCartQuantity: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderStartWidth: 1, borderEndWidth: 1, borderColor: palette.primary },
  inCartQuantityText: { color: palette.primary, fontSize: 9, fontWeight: '900' },
  plusButton: { width: 33, height: 34, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.primary },
  addButtonDisabled: { backgroundColor: palette.muted },
  addButtonPressed: { transform: [{ scale: 0.92 }], opacity: 0.8 },
  pressed: { opacity: 0.72 },
});
