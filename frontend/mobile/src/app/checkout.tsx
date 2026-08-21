import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Redirect, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ErrorState, Field, LoadingBlock, PrimaryButton } from '@/components/ui';
import { Text } from '@/components/app-text';
import { formatMoney, radii, shadow, spacing, type AppPalette } from '@/constants/theme';
import { ApiError } from '@/lib/api';
import { commerceApi } from '@/lib/commerce-api';
import { storageKeys } from '@/lib/storage';
import { useAuth } from '@/providers/auth-provider';
import { useCart } from '@/providers/cart-provider';
import { useI18n } from '@/providers/i18n-provider';
import { useThemedStyles } from '@/providers/theme-provider';
import type { PaymentMethod } from '@/types/domain';

const initialForm = {
  firstName: null as string | null,
  lastName: null as string | null,
  phone: null as string | null,
  email: null as string | null,
  recipientName: null as string | null,
  addressLine1: '',
  addressLine2: '',
  city: '',
  state: '',
  country: 'Afghanistan',
  postalCode: '',
  notes: '',
  paymentMethod: 'CashOnDelivery' as PaymentMethod,
  bankTransferReference: '',
};

export default function CheckoutScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const auth = useAuth();
  const cart = useCart();
  const { t } = useI18n();
  const { colors: palette, styles } = useThemedStyles(createStyles);
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const config = useQuery({ queryKey: ['checkout-configuration'], queryFn: commerceApi.checkoutConfiguration });

  const shipping = useMemo(() => {
    if (!config.data?.shippingEnabled) return 0;
    if (config.data.freeShippingThreshold > 0 && cart.subtotal >= config.data.freeShippingThreshold) return 0;
    return config.data.flatShippingFee;
  }, [cart.subtotal, config.data]);
  const currency = config.data?.currency ?? 'AFN';
  const total = cart.subtotal + shipping;
  const bankOption = config.data?.paymentMethods.find((option) => option.method === 'BankTransfer');

  if (!cart.hydrated || auth.loading) return <LoadingBlock label="Preparing secure checkout…" />;
  if (!cart.items.length) return <Redirect href="/cart" />;

  if (!auth.user) {
    return (
      <SafeAreaView edges={['bottom']} style={styles.safeArea}>
        <View style={styles.gate}>
          <View style={styles.gateIcon}><Ionicons name="lock-closed" size={31} color={palette.primary} /></View>
          <Text style={styles.gateEyebrow}>SECURE CHECKOUT</Text>
          <Text style={styles.gateTitle}>Sign in to place your order.</Text>
          <Text style={styles.gateText}>Your customer account connects this checkout to order history and delivery tracking.</Text>
          <PrimaryButton title="Sign in" icon="log-in" onPress={() => router.push({ pathname: '/auth', params: { returnTo: 'checkout' } })} style={styles.fullWidth} />
          <PrimaryButton title="Create account" icon="person-add" variant="outline" onPress={() => router.push({ pathname: '/auth', params: { mode: 'register', returnTo: 'checkout' } })} style={styles.fullWidth} />
        </View>
      </SafeAreaView>
    );
  }

  if (!auth.user.canPlaceOrders) {
    return (
      <SafeAreaView edges={['bottom']} style={styles.safeArea}>
        <View style={styles.gate}>
          <View style={styles.gateIcon}><Ionicons name="mail-unread" size={31} color={palette.primary} /></View>
          <Text style={styles.gateEyebrow}>ONE MORE STEP</Text>
          <Text style={styles.gateTitle}>Verify your email first.</Text>
          <Text style={styles.gateText}>Email verification protects your account and is required by the backend before an order can be placed.</Text>
          <PrimaryButton title="Verify my account" icon="shield-checkmark" onPress={() => router.push('/account')} style={styles.fullWidth} />
        </View>
      </SafeAreaView>
    );
  }

  const names = auth.user.fullName.trim().split(/\s+/);
  const resolvedForm = {
    ...form,
    firstName: form.firstName ?? names[0] ?? '',
    lastName: form.lastName ?? names.slice(1).join(' '),
    recipientName: form.recipientName ?? auth.user.fullName,
    phone: form.phone ?? auth.user.phone ?? '',
    email: form.email ?? auth.user.email ?? '',
  };

  const update = (key: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
    setError('');
  };

  const submit = async () => {
    if (!resolvedForm.firstName.trim() || !resolvedForm.phone.trim() || !resolvedForm.recipientName.trim() || !resolvedForm.addressLine1.trim() || !resolvedForm.city.trim() || !resolvedForm.country.trim()) {
      setError('Complete all required contact and delivery fields.');
      return;
    }
    if (resolvedForm.paymentMethod === 'BankTransfer' && !resolvedForm.bankTransferReference.trim()) {
      setError('Enter the bank transfer reference number.');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const confirmation = await commerceApi.createOrder({
        customer: {
          firstName: resolvedForm.firstName.trim(),
          lastName: nullable(resolvedForm.lastName),
          phone: resolvedForm.phone.trim(),
          email: nullable(resolvedForm.email),
        },
        shippingAddress: {
          label: 'Home',
          recipientName: resolvedForm.recipientName.trim(),
          phone: resolvedForm.phone.trim(),
          addressLine1: resolvedForm.addressLine1.trim(),
          addressLine2: nullable(resolvedForm.addressLine2),
          city: resolvedForm.city.trim(),
          state: nullable(resolvedForm.state),
          country: resolvedForm.country.trim(),
          postalCode: nullable(resolvedForm.postalCode),
        },
        paymentMethod: resolvedForm.paymentMethod,
        bankTransferReference: resolvedForm.paymentMethod === 'BankTransfer' ? resolvedForm.bankTransferReference.trim() : null,
        notes: nullable(resolvedForm.notes),
        items: cart.items.map((item) => ({ productId: item.id, quantity: item.quantity, unitId: item.unitId })),
      });
      await AsyncStorage.setItem(storageKeys.recentOrder, JSON.stringify({ confirmation, phone: resolvedForm.phone.trim() }));
      cart.clear();
      await auth.refresh();
      await queryClient.invalidateQueries({ queryKey: ['account-orders'] });
      router.replace({
        pathname: '/order-success',
        params: {
          orderNumber: confirmation.orderNumber,
          phone: resolvedForm.phone.trim(),
          total: String(confirmation.total),
          currency: confirmation.currency,
          status: confirmation.status,
          paymentMethod: confirmation.paymentMethod,
        },
      });
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : 'The order could not be created. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView edges={['bottom']} style={styles.safeArea}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.intro}>
            <View style={styles.introIcon}><Ionicons name="shield-checkmark" size={23} color={palette.success} /></View>
            <View style={styles.flex}><Text style={styles.introEyebrow}>SECURE CHECKOUT</Text><Text style={styles.introTitle}>Complete your order</Text><Text style={styles.introText}>{t('Signed in as {name} · {group} pricing', { name: auth.user.fullName, group: auth.user.customerTypeName ?? t('General') })}</Text></View>
          </View>

          {config.isError ? <ErrorState message={config.error.message} onRetry={() => void config.refetch()} /> : null}

          <CheckoutSection icon="person-outline" title="Contact information" subtitle="Used for delivery updates and order tracking.">
            <View style={styles.row}><View style={styles.flex}><Field label="First name *" value={resolvedForm.firstName} onChangeText={(value) => update('firstName', value)} /></View><View style={styles.flex}><Field label="Last name" value={resolvedForm.lastName} onChangeText={(value) => update('lastName', value)} /></View></View>
            <Field label="Phone number *" value={resolvedForm.phone} onChangeText={(value) => update('phone', value)} keyboardType="phone-pad" />
            <Field label="Email" value={resolvedForm.email} onChangeText={(value) => update('email', value)} keyboardType="email-address" autoCapitalize="none" editable={!auth.user.emailVerified} />
          </CheckoutSection>

          <CheckoutSection icon="location-outline" title="Delivery address" subtitle="A copy of this address is saved with the order.">
            <Field label="Recipient name *" value={resolvedForm.recipientName} onChangeText={(value) => update('recipientName', value)} />
            <Field label="Address line 1 *" value={form.addressLine1} onChangeText={(value) => update('addressLine1', value)} placeholder="Street, district, building, house number" />
            <Field label="Address line 2" value={form.addressLine2} onChangeText={(value) => update('addressLine2', value)} placeholder="Landmark or apartment (optional)" />
            <View style={styles.row}><View style={styles.flex}><Field label="City *" value={form.city} onChangeText={(value) => update('city', value)} /></View><View style={styles.flex}><Field label="Province" value={form.state} onChangeText={(value) => update('state', value)} /></View></View>
            <View style={styles.row}><View style={styles.flex}><Field label="Country *" value={form.country} onChangeText={(value) => update('country', value)} /></View><View style={styles.flex}><Field label="Postal code" value={form.postalCode} onChangeText={(value) => update('postalCode', value)} /></View></View>
          </CheckoutSection>

          <CheckoutSection icon="card-outline" title="Payment method" subtitle="Choose one of the methods configured by the store.">
            {(config.data?.paymentMethods ?? []).map((option) => (
              <PaymentOption key={option.method} method={option.method} title={option.name} description={option.description} active={form.paymentMethod === option.method} onPress={() => update('paymentMethod', option.method)} />
            ))}
            {!config.isLoading && !config.data?.paymentMethods.length ? (
              <PaymentOption method="CashOnDelivery" title="Cash on delivery" description="Pay when your order arrives." active={form.paymentMethod === 'CashOnDelivery'} onPress={() => update('paymentMethod', 'CashOnDelivery')} />
            ) : null}
            {form.paymentMethod === 'BankTransfer' ? (
              <View style={styles.bankBox}>
                {bankOption?.bankDetails ? (
                  <>
                    <BankLine label="Bank" value={bankOption.bankDetails.bankName} />
                    <BankLine label="Account name" value={bankOption.bankDetails.accountName} />
                    <BankLine label="Account number" value={bankOption.bankDetails.accountNumber} />
                    {bankOption.bankDetails.iban ? <BankLine label="IBAN" value={bankOption.bankDetails.iban} /> : null}
                    <Text style={styles.bankInstructions}>{bankOption.bankDetails.instructions}</Text>
                  </>
                ) : <Text style={styles.bankInstructions}>Bank account details have not been configured.</Text>}
                <Field label="Transfer reference *" value={form.bankTransferReference} onChangeText={(value) => update('bankTransferReference', value)} placeholder="Example: TRX-984725" />
              </View>
            ) : null}
          </CheckoutSection>

          <CheckoutSection icon="document-text-outline" title="Order notes" subtitle="Optional instructions for the store or delivery team.">
            <Field label="Notes" value={form.notes} onChangeText={(value) => update('notes', value)} multiline numberOfLines={4} placeholder="Call before delivery, preferred time, landmark…" />
          </CheckoutSection>

          <View style={styles.summary}>
            <Text style={styles.summaryTitle}>Order summary</Text>
            <SummaryRow label={t('{count} items', { count: cart.itemCount })} value={formatMoney(cart.subtotal, currency)} />
            <SummaryRow label="Delivery" value={shipping ? formatMoney(shipping, currency) : 'Free'} />
            <View style={styles.totalRow}><Text style={styles.totalLabel}>Estimated total</Text><Text style={styles.totalValue}>{formatMoney(total, currency)}</Text></View>
            <View style={styles.serverNote}><Ionicons name="lock-closed" size={16} color={palette.success} /><Text style={styles.serverText}>The backend rechecks price and reserves stock atomically when you place the order.</Text></View>
            {error ? <View style={styles.error}><Ionicons name="alert-circle" size={18} color={palette.danger} /><Text style={styles.errorText}>{error}</Text></View> : null}
            <PrimaryButton title="Place order securely" icon="checkmark-circle" onPress={() => void submit()} loading={submitting} disabled={config.isError} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function nullable(value: string) { return value.trim() || null; }

function CheckoutSection({ icon, title, subtitle, children }: { icon: keyof typeof Ionicons.glyphMap; title: string; subtitle: string; children: React.ReactNode }) {
  const { colors: palette, styles } = useThemedStyles(createStyles);
  return <View style={styles.section}><View style={styles.sectionHeader}><View style={styles.sectionIcon}><Ionicons name={icon} size={20} color={palette.primary} /></View><View style={styles.flex}><Text style={styles.sectionTitle}>{title}</Text><Text style={styles.sectionSubtitle}>{subtitle}</Text></View></View><View style={styles.sectionBody}>{children}</View></View>;
}

function PaymentOption({ method, title, description, active, onPress }: { method: PaymentMethod; title: string; description: string; active: boolean; onPress: () => void }) {
  const { colors: palette, styles } = useThemedStyles(createStyles);
  return <Pressable onPress={onPress} style={[styles.payment, active && styles.paymentActive]}><View style={[styles.radio, active && styles.radioActive]}>{active ? <View style={styles.radioDot} /> : null}</View><Ionicons name={method === 'CashOnDelivery' ? 'cash-outline' : 'business-outline'} size={22} color={active ? palette.primary : palette.muted} /><View style={styles.flex}><Text style={styles.paymentTitle}>{title}</Text><Text style={styles.paymentText}>{description}</Text></View></Pressable>;
}

function BankLine({ label, value }: { label: string; value: string }) {
  const { styles } = useThemedStyles(createStyles);
  return <View style={styles.bankLine}><Text style={styles.bankLabel}>{label}</Text><Text selectable style={styles.bankValue}>{value}</Text></View>;
}
function SummaryRow({ label, value }: { label: string; value: string }) {
  const { styles } = useThemedStyles(createStyles);
  return <View style={styles.summaryRow}><Text style={styles.summaryLabel}>{label}</Text><Text style={styles.summaryValue}>{value}</Text></View>;
}

const createStyles = (palette: AppPalette, isRtl: boolean) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.background },
  flex: { flex: 1 },
  fullWidth: { alignSelf: 'stretch' },
  content: { padding: spacing.lg, paddingBottom: 38, gap: 13 },
  gate: { flex: 1, paddingHorizontal: 30, alignItems: 'center', justifyContent: 'center', gap: 12 },
  gateIcon: { width: 70, height: 70, marginBottom: 5, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.primarySoft },
  gateEyebrow: { color: palette.primary, fontSize: 9, fontWeight: '900', letterSpacing: 1.5 },
  gateTitle: { color: palette.text, fontSize: 26, fontWeight: '900', textAlign: 'center', letterSpacing: -0.8 },
  gateText: { marginBottom: 8, color: palette.muted, fontSize: 13, lineHeight: 21, textAlign: 'center' },
  intro: { padding: spacing.lg, borderRadius: radii.lg, backgroundColor: palette.successSoft, flexDirection: isRtl ? 'row-reverse' : 'row', alignItems: 'center', gap: 11 },
  introIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: palette.card, alignItems: 'center', justifyContent: 'center' },
  introEyebrow: { color: palette.success, fontSize: 8, fontWeight: '900', letterSpacing: 1.2 },
  introTitle: { marginTop: 3, color: palette.text, fontSize: 17, fontWeight: '900' },
  introText: { marginTop: 3, color: palette.muted, fontSize: 9 },
  section: { overflow: 'hidden', borderRadius: radii.lg, backgroundColor: palette.card, borderWidth: 1, borderColor: palette.border },
  sectionHeader: { padding: spacing.lg, flexDirection: isRtl ? 'row-reverse' : 'row', alignItems: 'center', gap: 11, backgroundColor: palette.input, borderBottomWidth: 1, borderBottomColor: palette.border },
  sectionIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.primarySoft },
  sectionTitle: { color: palette.text, fontSize: 14, fontWeight: '900' },
  sectionSubtitle: { marginTop: 3, color: palette.muted, fontSize: 9, lineHeight: 14 },
  sectionBody: { padding: spacing.lg, gap: 13 },
  row: { flexDirection: isRtl ? 'row-reverse' : 'row', gap: 10 },
  payment: { minHeight: 72, padding: 13, borderRadius: radii.md, borderWidth: 1, borderColor: palette.border, flexDirection: isRtl ? 'row-reverse' : 'row', alignItems: 'center', gap: 11 },
  paymentActive: { borderColor: palette.primary, backgroundColor: palette.primarySoft },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: palette.border, alignItems: 'center', justifyContent: 'center' },
  radioActive: { borderColor: palette.primary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: palette.primary },
  paymentTitle: { color: palette.text, fontSize: 12, fontWeight: '900' },
  paymentText: { marginTop: 3, color: palette.muted, fontSize: 9, lineHeight: 14 },
  bankBox: { padding: 13, gap: 8, borderRadius: radii.md, backgroundColor: palette.amberSoft },
  bankLine: { flexDirection: isRtl ? 'row-reverse' : 'row', justifyContent: 'space-between', gap: 10 },
  bankLabel: { color: palette.amber, fontSize: 9, fontWeight: '700' },
  bankValue: { flex: 1, color: palette.text, fontSize: 10, fontWeight: '900', textAlign: isRtl ? 'left' : 'right' },
  bankInstructions: { paddingVertical: 7, color: palette.amber, fontSize: 9, lineHeight: 15 },
  summary: { padding: spacing.xl, gap: 11, borderRadius: radii.xl, backgroundColor: palette.card, borderWidth: 1, borderColor: palette.border, ...shadow },
  summaryTitle: { color: palette.text, fontSize: 17, fontWeight: '900' },
  summaryRow: { paddingTop: 10, borderTopWidth: 1, borderTopColor: palette.border, flexDirection: isRtl ? 'row-reverse' : 'row', justifyContent: 'space-between' },
  summaryLabel: { color: palette.muted, fontSize: 12 },
  summaryValue: { color: palette.text, fontSize: 12, fontWeight: '800' },
  totalRow: { paddingTop: 12, borderTopWidth: 1, borderTopColor: palette.border, flexDirection: isRtl ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'space-between' },
  totalLabel: { color: palette.text, fontSize: 15, fontWeight: '900' },
  totalValue: { color: palette.primary, fontSize: 21, fontWeight: '900', letterSpacing: -0.6 },
  serverNote: { padding: 11, borderRadius: radii.sm, backgroundColor: palette.successSoft, flexDirection: isRtl ? 'row-reverse' : 'row', gap: 8 },
  serverText: { flex: 1, color: palette.success, fontSize: 9, lineHeight: 15, fontWeight: '600' },
  error: { padding: 11, borderRadius: radii.sm, backgroundColor: palette.dangerSoft, flexDirection: isRtl ? 'row-reverse' : 'row', gap: 8 },
  errorText: { flex: 1, color: palette.danger, fontSize: 10, lineHeight: 16, fontWeight: '600' },
});
