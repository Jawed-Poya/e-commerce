import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton, StatusChip } from '@/components/ui';
import { Text } from '@/components/app-text';
import { formatMoney, radii, shadow, spacing, type AppPalette } from '@/constants/theme';
import { useThemedStyles } from '@/providers/theme-provider';

export default function OrderSuccessScreen() {
  const router = useRouter();
  const { colors: palette, styles } = useThemedStyles(createStyles);
  const params = useLocalSearchParams<{
    orderNumber: string;
    phone: string;
    total: string;
    currency: string;
    status: string;
    paymentMethod: string;
  }>();

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <LinearGradient colors={[palette.darkSurface, palette.primaryDark]} style={styles.hero}>
          <View style={styles.successIcon}><Ionicons name="checkmark" size={43} color={palette.primaryForeground} /></View>
          <Text style={styles.eyebrow}>ORDER RECEIVED</Text>
          <Text style={styles.title}>Thank you for your order.</Text>
          <Text style={styles.text}>Your products have been reserved. The store team will review the order and move it into processing.</Text>
        </LinearGradient>

        <View style={styles.card}>
          <Text style={styles.label}>YOUR ORDER NUMBER</Text>
          <Text selectable style={styles.orderNumber}>{params.orderNumber}</Text>
          <View style={styles.status}><StatusChip label={params.status ?? 'Pending'} tone="warning" /></View>
          <View style={styles.divider} />
          <SummaryRow label="Order total" value={formatMoney(Number(params.total || 0), params.currency || 'AFN')} />
          <SummaryRow label="Payment" value={params.paymentMethod === 'BankTransfer' ? 'Bank transfer' : 'Cash on delivery'} />
          <SummaryRow label="Contact phone" value={params.phone} />
          <View style={styles.note}><Ionicons name="information-circle" size={19} color={palette.primary} /><Text style={styles.noteText}>Keep your order number. It is also saved in your account order history.</Text></View>
          <PrimaryButton title="Track this order" icon="navigate" onPress={() => router.replace({ pathname: '/track', params: { orderNumber: params.orderNumber } })} />
          <PrimaryButton title="View my orders" icon="receipt" variant="outline" onPress={() => router.replace('/orders')} />
        </View>

        <View style={styles.nextCard}>
          <Text style={styles.nextTitle}>What happens next?</Text>
          <NextStep number="1" title="Store review" text="The team confirms pricing and available inventory." />
          <NextStep number="2" title="Processing" text="Your order is prepared and assigned for delivery." />
          <NextStep number="3" title="Delivery" text="Track status updates here and pay as selected." last />
        </View>

        <PrimaryButton title="Continue shopping" icon="storefront" variant="secondary" onPress={() => router.replace('/shop')} />
      </ScrollView>
    </SafeAreaView>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  const { styles } = useThemedStyles(createStyles);
  return <View style={styles.row}><Text style={styles.rowLabel}>{label}</Text><Text selectable style={styles.rowValue}>{value}</Text></View>;
}

function NextStep({ number, title, text, last }: { number: string; title: string; text: string; last?: boolean }) {
  const { styles } = useThemedStyles(createStyles);
  return <View style={styles.step}><View style={styles.stepRail}><View style={styles.stepNumber}><Text style={styles.stepNumberText}>{number}</Text></View>{!last ? <View style={styles.rail} /> : null}</View><View style={styles.stepBody}><Text style={styles.stepTitle}>{title}</Text><Text style={styles.stepText}>{text}</Text></View></View>;
}

const createStyles = (palette: AppPalette, isRtl: boolean) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.background },
  content: { padding: spacing.lg, paddingBottom: 34, gap: 14 },
  hero: { minHeight: 330, padding: 28, alignItems: 'center', justifyContent: 'center', borderRadius: radii.xl },
  successIcon: { width: 86, height: 86, borderRadius: 30, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.primary },
  eyebrow: { marginTop: 24, color: palette.amber, fontSize: 9, fontWeight: '900', letterSpacing: 1.6 },
  title: { marginTop: 8, color: palette.white, fontSize: 29, fontWeight: '900', textAlign: 'center', letterSpacing: -1 },
  text: { marginTop: 11, color: 'rgba(255,255,255,.7)', fontSize: 12, lineHeight: 19, textAlign: 'center' },
  card: { marginTop: -38, marginHorizontal: 10, padding: spacing.xl, borderRadius: radii.xl, backgroundColor: palette.card, borderWidth: 1, borderColor: palette.border, ...shadow },
  label: { color: palette.muted, fontSize: 8, fontWeight: '900', letterSpacing: 1.3, textAlign: 'center' },
  orderNumber: { marginTop: 6, color: palette.text, fontSize: 25, fontWeight: '900', textAlign: 'center', letterSpacing: 0.5 },
  status: { marginTop: 9, alignItems: 'center' },
  divider: { height: 1, marginVertical: 17, backgroundColor: palette.border },
  row: { paddingVertical: 8, flexDirection: isRtl ? 'row-reverse' : 'row', justifyContent: 'space-between', gap: 14 },
  rowLabel: { color: palette.muted, fontSize: 11 },
  rowValue: { flex: 1, color: palette.text, fontSize: 11, fontWeight: '900', textAlign: isRtl ? 'left' : 'right' },
  note: { marginVertical: 15, padding: 11, borderRadius: radii.sm, backgroundColor: palette.primarySoft, flexDirection: isRtl ? 'row-reverse' : 'row', gap: 8 },
  noteText: { flex: 1, color: palette.primaryDark, fontSize: 9, lineHeight: 15 },
  nextCard: { padding: spacing.xl, borderRadius: radii.xl, backgroundColor: palette.card, borderWidth: 1, borderColor: palette.border },
  nextTitle: { marginBottom: 14, color: palette.text, fontSize: 16, fontWeight: '900' },
  step: { minHeight: 70, flexDirection: isRtl ? 'row-reverse' : 'row', gap: 12 },
  stepRail: { width: 30, alignItems: 'center' },
  stepNumber: { width: 28, height: 28, zIndex: 2, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.primarySoft },
  stepNumberText: { color: palette.primary, fontSize: 10, fontWeight: '900' },
  rail: { position: 'absolute', top: 27, bottom: -2, width: 2, backgroundColor: palette.border },
  stepBody: { flex: 1, paddingTop: 3 },
  stepTitle: { color: palette.text, fontSize: 12, fontWeight: '900' },
  stepText: { marginTop: 4, color: palette.muted, fontSize: 10, lineHeight: 16 },
});
