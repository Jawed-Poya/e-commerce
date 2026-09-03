import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Field, LoadingBlock, PrimaryButton, StatusChip } from '@/components/ui';
import { Text } from '@/components/app-text';
import { ConfirmationDialog } from '@/components/confirmation-dialog';
import { radii, shadow, spacing, type AppPalette } from '@/constants/theme';
import { ApiError } from '@/lib/api';
import { commerceApi } from '@/lib/commerce-api';
import { useAuth } from '@/providers/auth-provider';
import { useI18n, type AppLocale } from '@/providers/i18n-provider';
import { useThemedStyles } from '@/providers/theme-provider';

export default function AccountScreen() {
  const router = useRouter();
  const auth = useAuth();
  const { t } = useI18n();
  const { colors: palette, styles } = useThemedStyles(createStyles);
  const [verificationCode, setVerificationCode] = useState('');
  const [verificationMessage, setVerificationMessage] = useState('');
  const [verificationError, setVerificationError] = useState('');
  const [verificationBusy, setVerificationBusy] = useState(false);
  const [showSignOutConfirmation, setShowSignOutConfirmation] = useState(false);
  const orders = useQuery({
    queryKey: ['account-orders', 'summary', auth.user?.customerId],
    queryFn: () => commerceApi.accountOrders(1),
    enabled: Boolean(auth.user?.customerId),
  });

  if (auth.loading) return <LoadingBlock label="Restoring your secure session…" />;

  if (!auth.user) {
    return (
      <SafeAreaView edges={[]} style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.guestContent}>
          <LinearGradient colors={[palette.darkSurface, palette.primaryDark]} style={styles.guestHero}>
            <View style={styles.guestIcon}><Ionicons name="person" size={31} color={palette.amber} /></View>
            <Text style={styles.guestEyebrow}>YOUR SHOPPING, ORGANIZED</Text>
            <Text style={styles.guestTitle}>One account.{`\n`}Every order in reach.</Text>
            <Text style={styles.guestText}>Create a free customer account to check out securely, save your order history, and track deliveries from your phone.</Text>
          </LinearGradient>
          <View style={styles.guestCard}>
            <AccountBenefit icon="bag-check-outline" title="Secure checkout" text="The backend validates live prices and stock." />
            <AccountBenefit icon="receipt-outline" title="Order history" text="Every account order stays easy to find." />
            <AccountBenefit icon="navigate-outline" title="Status tracking" text="Follow confirmation, processing, and delivery." />
            <PrimaryButton title="Sign in" icon="log-in" onPress={() => router.push('/auth')} />
            <PrimaryButton title="Create free account" icon="person-add" variant="outline" onPress={() => router.push({ pathname: '/auth', params: { mode: 'register' } })} />
          </View>
          <LanguageSection />
        </ScrollView>
      </SafeAreaView>
    );
  }

  const user = auth.user;
  const sendCode = async () => {
    setVerificationBusy(true);
    setVerificationError('');
    setVerificationMessage('');
    try {
      const result = await commerceApi.sendVerification();
      if (result.alreadyVerified) {
        setVerificationMessage(t('Your email is already verified.'));
        await auth.refresh();
      } else {
        setVerificationMessage(result.developmentCode
          ? t('Development code: {code}', { code: result.developmentCode })
          : t('A six-digit code was sent to {destination}.', { destination: result.destination }));
        if (result.developmentCode) setVerificationCode(result.developmentCode);
      }
    } catch (error) {
      setVerificationError(error instanceof ApiError ? error.message : 'The verification code could not be sent.');
    } finally {
      setVerificationBusy(false);
    }
  };

  const confirmCode = async () => {
    if (verificationCode.trim().length !== 6) {
      setVerificationError('Enter the six-digit verification code.');
      return;
    }
    setVerificationBusy(true);
    setVerificationError('');
    try {
      await commerceApi.confirmVerification(verificationCode.trim());
      await auth.refresh();
      setVerificationCode('');
      setVerificationMessage(t('Email verified. Your account is ready for checkout.'));
    } catch (error) {
      setVerificationError(error instanceof ApiError ? error.message : 'The code could not be confirmed.');
    } finally {
      setVerificationBusy(false);
    }
  };

  return (
    <>
      <SafeAreaView edges={[]} style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <LinearGradient colors={[palette.darkSurface, palette.primaryDark]} style={styles.profileHero}>
          <View style={styles.avatar}><Text style={styles.avatarText}>{user.fullName.slice(0, 2).toUpperCase()}</Text></View>
          <Text style={styles.profileName}>{user.fullName}</Text>
          <Text style={styles.profileContact}>{user.email ?? user.phone}</Text>
          <View style={styles.profileChips}>
            <StatusChip label={user.customerTypeName ?? 'General customer'} tone="neutral" />
            <StatusChip label={user.canPlaceOrders ? 'Checkout ready' : 'Verification required'} tone={user.canPlaceOrders ? 'success' : 'warning'} />
          </View>
        </LinearGradient>

        <View style={styles.stats}>
          <Stat value={String(orders.data?.totalCount ?? '—')} label="Orders" />
          <Stat value={user.emailVerified ? 'Yes' : 'No'} label="Email verified" />
          <Stat value={user.canPlaceOrders ? 'Ready' : 'Action'} label="Checkout" />
        </View>

        {!user.emailVerified ? (
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}><View style={styles.sectionIcon}><Ionicons name="shield-checkmark-outline" size={21} color={palette.primary} /></View><View style={styles.flex}><Text style={styles.sectionTitle}>Verify your email</Text><Text style={styles.sectionText}>Verification is required before placing an order.</Text></View></View>
            <PrimaryButton title="Send verification code" icon="mail" variant="secondary" onPress={() => void sendCode()} loading={verificationBusy && !verificationCode} />
            {verificationMessage ? <Text style={styles.successMessage}>{verificationMessage}</Text> : null}
            <Field label="Six-digit code" value={verificationCode} onChangeText={(value) => { setVerificationCode(value.replace(/\D/g, '').slice(0, 6)); setVerificationError(''); }} keyboardType="number-pad" maxLength={6} placeholder="000000" error={verificationError || undefined} />
            <PrimaryButton title="Confirm email" icon="checkmark-circle" onPress={() => void confirmCode()} loading={verificationBusy && Boolean(verificationCode)} disabled={verificationCode.length !== 6} />
          </View>
        ) : null}

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Account information</Text>
          <InfoRow icon="person-outline" label="Full name" value={user.fullName} />
          <InfoRow icon="mail-outline" label="Email" value={user.email ?? 'Not set'} />
          <InfoRow icon="call-outline" label="Phone" value={user.phone ?? 'Not set'} />
          <InfoRow icon="pricetag-outline" label="Price group" value={user.customerTypeName ?? 'General'} />
        </View>

        <LanguageSection />

        <View style={styles.actions}>
          <PrimaryButton title="View my orders" icon="receipt" onPress={() => router.push('/orders')} />
          <PrimaryButton title="Track an order" icon="navigate" variant="outline" onPress={() => router.push('/track')} />
          <PrimaryButton title="Sign out" icon="log-out" variant="danger" onPress={() => setShowSignOutConfirmation(true)} />
        </View>
        </ScrollView>
      </SafeAreaView>
      <ConfirmationDialog
        visible={showSignOutConfirmation}
        title="Sign out?"
        message="Your cart will stay on this device."
        confirmLabel="Sign out"
        icon="log-out-outline"
        tone="danger"
        onCancel={() => setShowSignOutConfirmation(false)}
        onConfirm={() => {
          setShowSignOutConfirmation(false);
          void auth.logout();
        }}
      />
    </>
  );
}

function AccountBenefit({ icon, title, text }: { icon: keyof typeof Ionicons.glyphMap; title: string; text: string }) {
  const { colors: palette, styles } = useThemedStyles(createStyles);
  return <View style={styles.benefit}><View style={styles.benefitIcon}><Ionicons name={icon} size={21} color={palette.primary} /></View><View style={styles.flex}><Text style={styles.benefitTitle}>{title}</Text><Text style={styles.benefitText}>{text}</Text></View></View>;
}

function Stat({ value, label }: { value: string; label: string }) {
  const { styles } = useThemedStyles(createStyles);
  return <View style={styles.stat}><Text numberOfLines={1} adjustsFontSizeToFit style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>;
}

function InfoRow({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  const { colors: palette, styles } = useThemedStyles(createStyles);
  return <View style={styles.infoRow}><Ionicons name={icon} size={18} color={palette.primary} /><View style={styles.flex}><Text style={styles.infoLabel}>{label}</Text><Text style={styles.infoValue}>{value}</Text></View></View>;
}

const languageOptions: { value: AppLocale; label: string; nativeLabel: string }[] = [
  { value: 'en', label: 'English', nativeLabel: 'EN' },
  { value: 'ps', label: 'Pashto', nativeLabel: 'پښتو' },
  { value: 'dr', label: 'Dari', nativeLabel: 'دری' },
];

function LanguageSection() {
  const { locale, setLocale } = useI18n();
  const { colors: palette, styles } = useThemedStyles(createStyles);
  return (
    <View style={styles.sectionCard}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionIcon}><Ionicons name="language-outline" size={21} color={palette.primary} /></View>
        <View style={styles.flex}><Text style={styles.sectionTitle}>App language</Text><Text style={styles.sectionText}>Choose the language used throughout the mobile app.</Text></View>
      </View>
      <View style={styles.languageRow}>
        {languageOptions.map((option) => {
          const active = locale === option.value;
          return (
            <Pressable key={option.value} accessibilityRole="button" onPress={() => setLocale(option.value)} style={({ pressed }) => [styles.languageOption, active && styles.languageOptionActive, pressed && styles.languagePressed]}>
              <Text style={[styles.languageNative, active && styles.languageNativeActive]}>{option.nativeLabel}</Text>
              <Text numberOfLines={1} style={[styles.languageLabel, active && styles.languageLabelActive]}>{option.label}</Text>
              {active ? <Ionicons name="checkmark-circle" size={16} color={palette.primaryForeground} /> : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const createStyles = (palette: AppPalette, isRtl: boolean) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.background },
  flex: { flex: 1 },
  guestContent: { padding: spacing.lg, paddingBottom: 34 },
  guestHero: { minHeight: 300, padding: spacing.xxl, borderRadius: radii.xl },
  guestIcon: { width: 58, height: 58, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(142,232,220,.12)' },
  guestEyebrow: { marginTop: 27, color: palette.amber, fontSize: 9, fontWeight: '900', letterSpacing: 1.6 },
  guestTitle: { marginTop: 9, color: palette.white, fontSize: 31, lineHeight: 37, fontWeight: '900', letterSpacing: -1.1 },
  guestText: { marginTop: 12, color: 'rgba(255,255,255,.72)', fontSize: 13, lineHeight: 21 },
  guestCard: { marginTop: -20, marginHorizontal: 10, padding: spacing.xl, gap: 13, borderRadius: radii.xl, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.card, ...shadow },
  benefit: { paddingBottom: 12, flexDirection: isRtl ? 'row-reverse' : 'row', gap: 12, borderBottomWidth: 1, borderBottomColor: palette.border },
  benefitIcon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.primarySoft },
  benefitTitle: { color: palette.text, fontSize: 13, fontWeight: '900' },
  benefitText: { marginTop: 3, color: palette.muted, fontSize: 10, lineHeight: 16 },
  content: { padding: spacing.lg, paddingBottom: 34 },
  profileHero: { padding: spacing.xxl, alignItems: 'center', borderRadius: radii.xl },
  avatar: { width: 72, height: 72, borderRadius: 25, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.primary },
  avatarText: { color: palette.primaryForeground, fontSize: 23, fontWeight: '900' },
  profileName: { marginTop: 13, color: palette.white, fontSize: 24, fontWeight: '900' },
  profileContact: { marginTop: 5, color: 'rgba(255,255,255,.68)', fontSize: 12 },
  profileChips: { marginTop: 14, flexDirection: isRtl ? 'row-reverse' : 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 7 },
  stats: { marginTop: 12, flexDirection: isRtl ? 'row-reverse' : 'row', gap: 8 },
  stat: { flex: 1, padding: 13, alignItems: 'center', borderRadius: radii.md, backgroundColor: palette.card, borderWidth: 1, borderColor: palette.border },
  statValue: { color: palette.primary, fontSize: 18, fontWeight: '900' },
  statLabel: { marginTop: 3, color: palette.muted, fontSize: 8, fontWeight: '700', textAlign: 'center' },
  sectionCard: { marginTop: 14, padding: spacing.lg, gap: 13, borderRadius: radii.lg, backgroundColor: palette.card, borderWidth: 1, borderColor: palette.border },
  sectionHeader: { flexDirection: isRtl ? 'row-reverse' : 'row', gap: 11, alignItems: 'center' },
  sectionIcon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.primarySoft },
  sectionTitle: { color: palette.text, fontSize: 15, fontWeight: '900' },
  sectionText: { marginTop: 3, color: palette.muted, fontSize: 10, lineHeight: 15 },
  successMessage: { padding: 10, borderRadius: radii.sm, color: palette.success, backgroundColor: palette.successSoft, fontSize: 10, lineHeight: 16, fontWeight: '600' },
  infoRow: { paddingVertical: 10, flexDirection: isRtl ? 'row-reverse' : 'row', alignItems: 'center', gap: 11, borderBottomWidth: 1, borderBottomColor: palette.border },
  infoLabel: { color: palette.muted, fontSize: 9, fontWeight: '700' },
  infoValue: { marginTop: 2, color: palette.text, fontSize: 13, fontWeight: '800' },
  actions: { marginTop: 16, gap: 10 },
  languageRow: { flexDirection: isRtl ? 'row-reverse' : 'row', gap: 7 },
  languageOption: { flex: 1, minWidth: 0, minHeight: 66, paddingHorizontal: 8, paddingVertical: 9, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center', gap: 3, backgroundColor: palette.input, borderWidth: 1, borderColor: palette.border },
  languageOptionActive: { backgroundColor: palette.primary, borderColor: palette.primary },
  languageNative: { color: palette.text, fontSize: 13, fontWeight: '900', textAlign: 'center' },
  languageNativeActive: { color: palette.primaryForeground },
  languageLabel: { color: palette.muted, fontSize: 8, fontWeight: '700', textAlign: 'center' },
  languageLabelActive: { color: palette.primaryForeground },
  languagePressed: { opacity: 0.75, transform: [{ scale: 0.98 }] },
});
