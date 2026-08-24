import Ionicons from '@expo/vector-icons/Ionicons';
import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, InteractionManager, Pressable, ScrollView, StyleSheet, TextInput, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ProductCard } from '@/components/product-card';
import { Text } from '@/components/app-text';
import { EmptyState, ErrorState, PrimaryButton } from '@/components/ui';
import { radii, spacing, type AppPalette } from '@/constants/theme';
import { commerceApi } from '@/lib/commerce-api';
import { getConnectivitySnapshot, subscribeConnectivity } from '@/lib/connectivity';
import { imageUrl } from '@/lib/api';
import { getStoredJson, setStoredJson, storageKeys } from '@/lib/storage';
import { useI18n } from '@/providers/i18n-provider';
import { useNotifications } from '@/providers/notification-provider';
import { useThemedStyles } from '@/providers/theme-provider';
import type { Product, ProductLookups, StorefrontContent } from '@/types/domain';

export default function ShopScreen() {
  const { width } = useWindowDimensions();
  const { locale, t } = useI18n();
  const { trackProducts } = useNotifications();
  const { colors: palette, styles } = useThemedStyles(createStyles);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [categoryId, setCategoryId] = useState<number | undefined>();
  const [cachedProducts, setCachedProducts] = useState<Product[]>([]);
  const [cachedLookups, setCachedLookups] = useState<ProductLookups | null>(null);
  const [cachedContent, setCachedContent] = useState<StorefrontContent | null>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const listRef = useRef<FlashListRef<Product>>(null);
  const showScrollTopRef = useRef(false);
  const connectivity = useSyncExternalStore(subscribeConnectivity, getConnectivitySnapshot, getConnectivitySnapshot);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
    setShowScrollTop(false);
  }, [categoryId, debouncedSearch]);

  const lookups = useQuery({
    queryKey: ['product-lookups'],
    queryFn: commerceApi.lookups,
    staleTime: 5 * 60_000,
  });
  const storefrontContent = useQuery({
    queryKey: ['storefront-content'],
    queryFn: commerceApi.storefrontContent,
    staleTime: 5 * 60_000,
  });

  const products = useInfiniteQuery({
    queryKey: ['products', 'mobile', debouncedSearch, categoryId],
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) => commerceApi.products(pageParam, debouncedSearch, categoryId, signal),
    getNextPageParam: (lastPage) => lastPage.hasNextPage ? lastPage.page + 1 : undefined,
  });

  const serverItems = useMemo(() => products.data?.pages.flatMap((page) => page.items) ?? [], [products.data]);
  const hasServerResult = Boolean(products.data?.pages.length);
  const items = useMemo(() => {
    if (hasServerResult) return serverItems;
    const queryText = debouncedSearch.toLocaleLowerCase();
    return cachedProducts.filter((product) => {
      const matchesCategory = categoryId === undefined || product.categoryId === categoryId;
      const searchable = [product.name, product.genericName, product.formula, product.strength, product.categoryName]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase();
      return matchesCategory && (!queryText || searchable.includes(queryText));
    });
  }, [cachedProducts, categoryId, debouncedSearch, hasServerResult, serverItems]);
  const totalCount = hasServerResult ? products.data?.pages[0]?.totalCount ?? 0 : items.length;
  const categories = (lookups.data ?? cachedLookups)?.categories ?? [];
  const columns = width >= 720 ? 2 : 1;
  const content = storefrontContent.data ?? cachedContent;
  const hero = content?.[locale] ?? content?.en;

  useEffect(() => {
    void Promise.all([
      getStoredJson<Product[]>(storageKeys.catalogCache),
      getStoredJson<ProductLookups>(storageKeys.productLookupsCache),
      getStoredJson<StorefrontContent>(storageKeys.storefrontContentCache),
    ]).then(([storedProducts, storedLookups, storedContent]) => {
      if (storedProducts) setCachedProducts(storedProducts);
      if (storedLookups) setCachedLookups(storedLookups);
      if (storedContent) setCachedContent(storedContent);
    });
  }, []);

  useEffect(() => {
    if (!serverItems.length) return;
    const merged = new Map(cachedProducts.map((product) => [product.id, product]));
    serverItems.forEach((product) => merged.set(product.id, product));
    const next = [...merged.values()].slice(-240);
    if (JSON.stringify(next) === JSON.stringify(cachedProducts)) return;
    setCachedProducts(next);
    void setStoredJson(storageKeys.catalogCache, next);
  }, [cachedProducts, serverItems]);

  useEffect(() => {
    if (!lookups.data) return;
    setCachedLookups(lookups.data);
    void setStoredJson(storageKeys.productLookupsCache, lookups.data);
  }, [lookups.data]);

  useEffect(() => {
    if (!storefrontContent.data) return;
    setCachedContent(storefrontContent.data);
    void setStoredJson(storageKeys.storefrontContentCache, storefrontContent.data);
  }, [storefrontContent.data]);

  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      trackProducts(items.map((item) => item.id));
    });
    return () => task.cancel();
  }, [items, trackProducts]);

  const handleScroll = useCallback((offset: number) => {
    const next = offset > 720;
    if (showScrollTopRef.current === next) return;
    showScrollTopRef.current = next;
    setShowScrollTop(next);
  }, []);

  const header = (
    <View>
      <LinearGradient colors={[palette.darkSurface, palette.primaryDark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        {imageUrl(content?.heroImageUrl) ? <Image source={{ uri: imageUrl(content?.heroImageUrl)! }} style={styles.heroImage} contentFit="cover" transition={180} cachePolicy="memory-disk" priority="high" /> : null}
        {imageUrl(content?.heroImageUrl) ? <View style={styles.heroOverlay} /> : null}
        <View style={styles.heroGlow} />
        <View style={styles.heroTop}><View style={styles.heroCopy}><Text style={styles.eyebrow}>{hero?.eyebrow ?? 'MOBILE SHOPPING'}</Text><Text style={styles.heroTitle}>{hero?.title ?? 'Find it. Order it. We’ll handle the rest.'}</Text></View><View style={styles.heroIcon}><Ionicons name="bag-check" size={27} color={palette.amber} /></View></View>
        <Text style={styles.heroText}>{hero?.description ?? 'Live inventory, secure checkout, and simple delivery tracking.'}</Text>
        <View style={styles.trustRow}>
          <TrustItem icon="flash" label="Fast" />
          <TrustItem icon="shield-checkmark" label="Secure" />
          <TrustItem icon="location" label="Trackable" />
        </View>
      </LinearGradient>

      <View style={styles.searchWrap}>
        <Ionicons name="search" size={20} color={palette.muted} />
        <TextInput
          accessibilityLabel={t('Search products')}
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="while-editing"
          onChangeText={setSearch}
          placeholder={t('Search products, brands, formula…')}
          placeholderTextColor={palette.muted}
          returnKeyType="search"
          selectionColor={palette.primary}
          style={styles.searchInput}
          value={search}
        />
        {search && !products.isFetching ? (
          <Pressable hitSlop={10} onPress={() => setSearch('')}><Ionicons name="close-circle" size={19} color={palette.muted} /></Pressable>
        ) : products.isFetching && items.length ? <ActivityIndicator size="small" color={palette.primary} /> : null}
      </View>

      <ScrollView
        horizontal
        contentContainerStyle={styles.categories}
        showsHorizontalScrollIndicator={false}>
        <CategoryChip label="All products" active={categoryId === undefined} onPress={() => setCategoryId(undefined)} />
        {categories.map((category) => (
          <CategoryChip
            key={category.id}
            label={`${category.name}  ${category.productCount}`}
            active={categoryId === category.id}
            onPress={() => setCategoryId(category.id)}
          />
        ))}
      </ScrollView>

      <View style={styles.resultsHeader}>
        <View>
          <Text style={styles.resultsEyebrow}>OUR CATALOG</Text>
          <Text style={styles.resultsTitle}>{debouncedSearch ? 'Search results' : categoryId ? 'Category products' : 'Discover products'}</Text>
        </View>
        <View style={styles.countBadge}><Text style={styles.countText}>{t('{count} items', { count: totalCount })}</Text></View>
      </View>

      {products.isError && items.length && connectivity.status !== 'offline' ? <ErrorState message={products.error.message} onRetry={() => void products.refetch()} /> : null}
    </View>
  );

  return (
    <SafeAreaView edges={[]} style={styles.safeArea}>
      <FlashList
        ref={listRef}
        key={`catalog-${columns}`}
        data={items}
        numColumns={columns}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => <ProductCard product={item} />}
        ListHeaderComponent={header}
        ListEmptyComponent={products.isLoading
          ? <View style={styles.center}><ActivityIndicator size="large" color={palette.primary} /><Text style={styles.loadingText}>Loading fresh products…</Text></View>
          : products.isError
            ? connectivity.status === 'offline'
              ? <EmptyState icon="cloud-offline-outline" title="Your saved catalog is waiting" message="Connect once to save products for comfortable offline browsing." action={<PrimaryButton title="Try reconnecting" icon="refresh" onPress={() => void products.refetch()} />} />
              : <ErrorState message={products.error.message} onRetry={() => void products.refetch()} />
            : <EmptyState icon="search-outline" title="No products found" message="Try another search or choose a different category." />}
        ListFooterComponent={products.isFetchingNextPage
          ? <View style={styles.footer}><ActivityIndicator color={palette.primary} /><Text style={styles.loadingText}>Loading more products…</Text></View>
          : items.length && !products.hasNextPage
            ? <Text style={styles.endText}>You’ve reached the end of the catalog.</Text>
            : null}
        contentContainerStyle={styles.listContent}
        onEndReached={() => {
          if (products.hasNextPage && !products.isFetchingNextPage) void products.fetchNextPage();
        }}
        onEndReachedThreshold={0.55}
        onScroll={(event) => handleScroll(event.nativeEvent.contentOffset.y)}
        scrollEventThrottle={32}
        refreshing={products.isRefetching && !products.isFetchingNextPage}
        onRefresh={() => void products.refetch()}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      />
      {showScrollTop ? (
        <Pressable accessibilityRole="button" accessibilityLabel={t('Scroll to top')} onPress={() => listRef.current?.scrollToOffset({ offset: 0, animated: true })} style={({ pressed }) => [styles.scrollTop, pressed && styles.scrollTopPressed]}>
          <Ionicons name="arrow-up" size={21} color={palette.primaryForeground} />
        </Pressable>
      ) : null}
    </SafeAreaView>
  );
}

function CategoryChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const { styles } = useThemedStyles(createStyles);
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.categoryChip, active && styles.categoryChipActive, pressed && styles.pressed]}>
      <Text numberOfLines={1} style={[styles.categoryText, active && styles.categoryTextActive]}>{label}</Text>
    </Pressable>
  );
}

function TrustItem({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
  const { colors: palette, styles } = useThemedStyles(createStyles);
  return (
    <View style={styles.trustItem}><Ionicons name={icon} size={13} color={palette.amber} /><Text style={styles.trustText}>{label}</Text></View>
  );
}

const createStyles = (palette: AppPalette, isRtl: boolean) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.background },
  listContent: { paddingBottom: 26, maxWidth: 980, width: '100%', alignSelf: 'center' },
  hero: { margin: 12, padding: 19, minHeight: 178, overflow: 'hidden', borderRadius: radii.xl },
  heroImage: { ...StyleSheet.absoluteFillObject, opacity: 0.34 },
  heroOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,.45)' },
  heroGlow: { position: 'absolute', width: 230, height: 230, end: -90, top: -80, borderRadius: 150, backgroundColor: palette.amber, opacity: 0.12 },
  heroTop: { flexDirection: isRtl ? 'row-reverse' : 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  heroCopy: { flex: 1, minWidth: 0 },
  heroIcon: { width: 50, height: 50, flexShrink: 0, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.amberSoft, borderWidth: 1, borderColor: palette.amber },
  eyebrow: { color: palette.amber, fontSize: 10, fontWeight: '900', letterSpacing: 1.7 },
  heroTitle: { marginTop: 9, color: palette.white, fontSize: 22, lineHeight: 27, fontWeight: '900', letterSpacing: -0.75 },
  heroText: { maxWidth: 330, marginTop: 10, color: 'rgba(255,255,255,.7)', fontSize: 11, lineHeight: 17 },
  trustRow: { marginTop: 13, flexDirection: isRtl ? 'row-reverse' : 'row', flexWrap: 'wrap', gap: 14 },
  trustItem: { flexDirection: isRtl ? 'row-reverse' : 'row', alignItems: 'center', gap: 5 },
  trustText: { color: 'rgba(255,255,255,.78)', fontSize: 9, fontWeight: '700' },
  searchWrap: { minHeight: 52, marginHorizontal: 12, paddingHorizontal: 15, flexDirection: isRtl ? 'row-reverse' : 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: palette.border, borderRadius: radii.lg, backgroundColor: palette.card },
  searchInput: { flex: 1, color: palette.text, fontSize: 14, height: 52, writingDirection: isRtl ? 'rtl' : 'ltr', textAlign: isRtl ? 'right' : 'left' },
  categories: { paddingHorizontal: 12, paddingVertical: 13, gap: 8, flexDirection: isRtl ? 'row-reverse' : 'row' },
  categoryChip: { maxWidth: 190, height: 38, paddingHorizontal: 14, borderRadius: radii.pill, justifyContent: 'center', backgroundColor: palette.card, borderWidth: 1, borderColor: palette.border },
  categoryChipActive: { backgroundColor: palette.primary, borderColor: palette.primary },
  categoryText: { color: palette.muted, fontSize: 11, fontWeight: '800' },
  categoryTextActive: { color: palette.primaryForeground },
  resultsHeader: { paddingHorizontal: spacing.xl, paddingTop: 7, paddingBottom: 10, flexDirection: isRtl ? 'row-reverse' : 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  resultsEyebrow: { color: palette.primary, fontSize: 9, fontWeight: '900', letterSpacing: 1.5 },
  resultsTitle: { marginTop: 5, color: palette.text, fontSize: 22, fontWeight: '900', letterSpacing: -0.6 },
  countBadge: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: radii.pill, backgroundColor: palette.primarySoft },
  countText: { color: palette.primary, fontSize: 10, fontWeight: '800' },
  center: { minHeight: 300, alignItems: 'center', justifyContent: 'center', gap: 12 },
  footer: { padding: 22, flexDirection: isRtl ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  loadingText: { color: palette.muted, fontSize: 12, fontWeight: '600' },
  endText: { padding: 26, textAlign: 'center', color: palette.muted, fontSize: 11, fontWeight: '600' },
  pressed: { opacity: 0.75 },
  scrollTop: { position: 'absolute', end: 17, bottom: 18, width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.primary, borderWidth: 3, borderColor: palette.card, shadowColor: palette.black, shadowOpacity: 0.2, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 8 },
  scrollTopPressed: { opacity: 0.78, transform: [{ scale: 0.92 }] },
});
