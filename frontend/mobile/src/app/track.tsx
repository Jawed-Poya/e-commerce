import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ErrorState, Field, PrimaryButton, StatusChip } from '@/components/ui';
import { Text } from '@/components/app-text';
import { formatDate, formatMoney, radii, spacing, type AppPalette } from '@/constants/theme';
import { commerceApi } from '@/lib/commerce-api';
import { useAuth } from '@/providers/auth-provider';
import { useThemedStyles } from '@/providers/theme-provider';

type TrackLookup = { orderNumber: string; phone?: string };

export default function TrackOrderScreen() {
  const params = useLocalSearchParams<{ orderNumber?: string; phone?: string }>();
  const auth = useAuth();
  const { colors: palette, styles } = useThemedStyles(createStyles);
  const [form, setForm] = useState({ orderNumber: params.orderNumber ?? '', phone: params.phone ?? '' });
  const [lookup, setLookup] = useState<TrackLookup | null>(null);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    const orderNumber = params.orderNumber?.trim();
    const phone = params.phone?.trim();
    if (lookup || auth.loading || !orderNumber || (!auth.isAuthenticated && !phone)) return;
    setLookup({ orderNumber, phone: auth.isAuthenticated ? undefined : phone });
  }, [auth.isAuthenticated, auth.loading, lookup, params.orderNumber, params.phone]);

  const query = useQuery({
    queryKey: ['track-order', lookup?.orderNumber, auth.isAuthenticated ? 'account' : lookup?.phone],
    queryFn: () => commerceApi.trackOrder(lookup!.orderNumber, lookup!.phone),
    enabled: !auth.loading && Boolean(lookup && (auth.isAuthenticated || lookup.phone)),
    retry: false,
  });

  const submit = () => {
    if (!form.orderNumber.trim()) {
      setFormError('Enter the order number.');
      return;
    }
    if (!auth.isAuthenticated && !form.phone.trim()) {
      setFormError('Enter both the order number and checkout phone number.');
      return;
    }
    setFormError('');
    setLookup({ orderNumber: form.orderNumber.trim(), phone: auth.isAuthenticated ? undefined : form.phone.trim() });
  };

  return (
    <SafeAreaView edges={['bottom']} style={styles.safeArea}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <LinearGradient colors={[palette.darkSurface, palette.primaryDark]} style={styles.hero}>
            <View style={styles.heroIcon}><Ionicons name="navigate" size={26} color={palette.amber} /></View>
            <Text style={styles.eyebrow}>ORDER TRACKING</Text>
            <Text style={styles.heroTitle}>Know where your order stands.</Text>
            <Text style={styles.heroText}>{auth.isAuthenticated
              ? 'Enter your order number. Your signed-in account will securely verify it.'
              : 'Enter the order number and the phone used at checkout. No account is required.'}</Text>
          </LinearGradient>

          <View style={styles.formCard}>
            <Field label="Order number" value={form.orderNumber} onChangeText={(value) => { setForm((current) => ({ ...current, orderNumber: value })); setFormError(''); }} autoCapitalize="characters" placeholder="Example: ORD-000123" error={auth.isAuthenticated ? formError || undefined : undefined} />
            {!auth.isAuthenticated && !auth.loading ? <Field label="Checkout phone number" value={form.phone} onChangeText={(value) => { setForm((current) => ({ ...current, phone: value })); setFormError(''); }} keyboardType="phone-pad" placeholder="07xxxxxxxx" error={formError || undefined} /> : null}
            {auth.isAuthenticated ? <Text style={styles.accountHint}>Your signed-in account securely verifies this order.</Text> : null}
            <PrimaryButton title="Track my order" icon="search" onPress={submit} loading={query.isFetching} disabled={auth.loading} />
          </View>

          {query.isError ? <ErrorState message={query.error.message} onRetry={() => void query.refetch()} /> : null}

          {query.data ? (
            <View style={styles.result}>
              <View style={styles.resultHeader}>
                <View style={styles.resultIcon}><Ionicons name="cube" size={24} color={palette.primary} /></View>
                <View style={styles.flex}><Text style={styles.resultEyebrow}>ORDER NUMBER</Text><Text style={styles.orderNumber}>{query.data.orderNumber}</Text></View>
                <StatusChip label={query.data.status} tone={query.data.status === 'Delivered' ? 'success' : query.data.status === 'Cancelled' ? 'danger' : 'warning'} />
              </View>
              <View style={styles.metrics}>
                <Metric label="TOTAL" value={formatMoney(query.data.total, query.data.currency)} />
                <Metric label="PAYMENT" value={query.data.paymentStatus} />
                <Metric label="FULFILLMENT" value={query.data.fulfillmentStatus} />
              </View>
              <View style={styles.timelineHeader}><Text style={styles.timelineTitle}>Order timeline</Text><Text style={styles.timelineDate}>{formatDate(query.data.createdAt)}</Text></View>
              <TimelineItem title="Order received" date={query.data.createdAt} first />
              {query.data.timeline.map((item, index) => (
                <TimelineItem key={item.id} title={item.toStatus} date={item.createdAt} note={item.note} last={index === query.data!.timeline.length - 1} />
              ))}
              {!query.data.timeline.length ? <Text style={styles.pendingText}>The store has received your order. New updates will appear here.</Text> : null}
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  const { styles } = useThemedStyles(createStyles);
  return <View style={styles.metric}><Text style={styles.metricLabel}>{label}</Text><Text numberOfLines={1} adjustsFontSizeToFit style={styles.metricValue}>{value}</Text></View>;
}

function TimelineItem({ title, date, note, first, last }: { title: string; date: string; note?: string | null; first?: boolean; last?: boolean }) {
  const { styles } = useThemedStyles(createStyles);
  return (
    <View style={styles.timelineItem}>
      <View style={styles.timelineRail}>{!first ? <View style={styles.railTop} /> : null}<View style={[styles.timelineDot, last && styles.timelineDotActive]} />{!last ? <View style={styles.railBottom} /> : null}</View>
      <View style={styles.timelineBody}><Text style={styles.timelineItemTitle}>{title}</Text><Text style={styles.timelineItemDate}>{formatDate(date)}</Text>{note ? <Text style={styles.timelineNote}>{note}</Text> : null}</View>
    </View>
  );
}

const createStyles = (palette: AppPalette, isRtl: boolean) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.background },
  flex: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: 36 },
  hero: { minHeight: 240, padding: spacing.xxl, borderRadius: radii.xl },
  heroIcon: { width: 52, height: 52, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.amberSoft },
  eyebrow: { marginTop: 24, color: palette.amber, fontSize: 9, fontWeight: '900', letterSpacing: 1.5 },
  heroTitle: { marginTop: 8, maxWidth: 330, color: palette.white, fontSize: 28, lineHeight: 34, fontWeight: '900', letterSpacing: -0.9 },
  heroText: { marginTop: 10, color: 'rgba(255,255,255,.7)', fontSize: 12, lineHeight: 19 },
  formCard: { marginTop: -18, marginHorizontal: 10, padding: spacing.xl, gap: 14, borderRadius: radii.xl, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.card },
  accountHint: { marginTop: -4, color: palette.muted, fontSize: 10, lineHeight: 16 },
  result: { marginTop: 16, padding: spacing.xl, borderRadius: radii.xl, backgroundColor: palette.card, borderWidth: 1, borderColor: palette.border },
  resultHeader: { flexDirection: isRtl ? 'row-reverse' : 'row', alignItems: 'center', gap: 11 },
  resultIcon: { width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.primarySoft },
  resultEyebrow: { color: palette.muted, fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  orderNumber: { marginTop: 3, color: palette.text, fontSize: 15, fontWeight: '900' },
  metrics: { marginTop: 18, paddingVertical: 14, borderTopWidth: 1, borderBottomWidth: 1, borderColor: palette.border, flexDirection: isRtl ? 'row-reverse' : 'row', gap: 8 },
  metric: { flex: 1 },
  metricLabel: { color: palette.muted, fontSize: 7, fontWeight: '900', letterSpacing: 0.7 },
  metricValue: { marginTop: 4, color: palette.text, fontSize: 11, fontWeight: '900' },
  timelineHeader: { marginTop: 21, marginBottom: 8, flexDirection: isRtl ? 'row-reverse' : 'row', justifyContent: 'space-between', alignItems: 'center' },
  timelineTitle: { color: palette.text, fontSize: 15, fontWeight: '900' },
  timelineDate: { color: palette.muted, fontSize: 8 },
  timelineItem: { minHeight: 62, flexDirection: isRtl ? 'row-reverse' : 'row', gap: 12 },
  timelineRail: { width: 18, alignItems: 'center' },
  railTop: { position: 'absolute', top: 0, width: 2, height: 12, backgroundColor: palette.border },
  railBottom: { position: 'absolute', top: 16, bottom: 0, width: 2, backgroundColor: palette.border },
  timelineDot: { width: 12, height: 12, marginTop: 10, zIndex: 2, borderRadius: 6, backgroundColor: palette.primarySoft, borderWidth: 3, borderColor: palette.primary },
  timelineDotActive: { backgroundColor: palette.primary },
  timelineBody: { flex: 1, paddingTop: 7, paddingBottom: 14 },
  timelineItemTitle: { color: palette.text, fontSize: 12, fontWeight: '900' },
  timelineItemDate: { marginTop: 3, color: palette.muted, fontSize: 8 },
  timelineNote: { marginTop: 4, color: palette.muted, fontSize: 10, lineHeight: 15 },
  pendingText: { padding: 12, borderRadius: radii.sm, backgroundColor: palette.amberSoft, color: palette.amber, fontSize: 10, lineHeight: 16 },
});
