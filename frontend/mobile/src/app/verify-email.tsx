import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Field, PrimaryButton } from '@/components/ui';
import { Text } from '@/components/app-text';
import { radii, shadow, spacing, type AppPalette } from '@/constants/theme';
import { ApiError } from '@/lib/api';
import { commerceApi } from '@/lib/commerce-api';
import { useAuth } from '@/providers/auth-provider';
import { useI18n } from '@/providers/i18n-provider';
import { useThemedStyles } from '@/providers/theme-provider';

export default function VerifyEmailScreen() {
  const router = useRouter();
  const auth = useAuth();
  const { t } = useI18n();
  const { colors: palette, styles, isRtl } = useThemedStyles(createStyles);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<'send' | 'confirm' | ''>('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const send = async () => {
    setBusy('send');
    setError('');
    setMessage('');
    try {
      const result = await commerceApi.sendVerification();
      if (result.alreadyVerified) {
        await auth.refresh();
        setMessage(t('Your email is already verified. You can continue shopping.'));
      } else {
        setMessage(result.developmentCode
          ? t('A development verification code is ready below.')
          : t('A six-digit code was sent to {destination}.', { destination: result.destination }));
        if (result.developmentCode) setCode(result.developmentCode);
      }
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : 'The verification email could not be sent.');
    } finally {
      setBusy('');
    }
  };

  const confirm = async () => {
    if (code.length !== 6) {
      setError('Enter the complete six-digit code.');
      return;
    }
    setBusy('confirm');
    setError('');
    try {
      await commerceApi.confirmVerification(code);
      await auth.refresh();
      setMessage(t('Email confirmed. Your account is ready for secure checkout.'));
      setCode('');
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : 'The verification code could not be confirmed.');
    } finally {
      setBusy('');
    }
  };

  if (!auth.user) {
    return (
      <SafeAreaView edges={['bottom']} style={styles.safeArea}>
        <View style={styles.centerCard}><View style={styles.largeIcon}><Ionicons name="lock-closed-outline" size={29} color={palette.primary} /></View><Text style={styles.centerTitle}>Sign in to verify your email</Text><Text style={styles.centerText}>Email confirmation is linked securely to your customer account.</Text><PrimaryButton title="Open sign in" icon="log-in" onPress={() => router.replace('/auth')} /></View>
      </SafeAreaView>
    );
  }

  const verified = auth.user.emailVerified;

  return (
    <SafeAreaView edges={['bottom']} style={styles.safeArea}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.shell}>
            <LinearGradient colors={[palette.darkSurface, palette.primaryDark]} style={styles.hero}>
              <View style={styles.heroIcon}><Ionicons name={verified ? 'checkmark-done' : 'mail-unread'} size={32} color={palette.amber} /></View>
              <Text style={styles.eyebrow}>SECURE ACCOUNT CONFIRMATION</Text>
              <Text style={styles.title}>{verified ? 'Email verified.' : 'Confirm it’s really you.'}</Text>
              <Text style={styles.heroText}>{verified
                ? 'Your account can now place orders and access protected checkout features.'
                : t('We’ll send a one-time code to {destination}.', { destination: auth.user.email ?? t('your account email') })}</Text>
            </LinearGradient>

            <View style={styles.card}>
              <View style={styles.steps}>
                <Step number="1" title="Send code" active={!verified} done={verified || Boolean(message)} />
                <View style={styles.stepLine} />
                <Step number="2" title="Confirm email" active={!verified && Boolean(message)} done={verified} />
              </View>

              {!verified ? (
                <>
                  <PrimaryButton title="Send verification code" icon="mail-outline" variant="secondary" onPress={() => void send()} loading={busy === 'send'} disabled={!auth.user.email} />
                  {message ? <StatusMessage>{message}</StatusMessage> : null}
                  <Field label="Six-digit confirmation code" value={code} onChangeText={(value) => { setCode(value.replace(/\D/g, '').slice(0, 6)); setError(''); }} keyboardType="number-pad" maxLength={6} autoComplete="one-time-code" placeholder="000000" error={error || undefined} />
                  <PrimaryButton title="Confirm my email" icon="shield-checkmark" onPress={() => void confirm()} loading={busy === 'confirm'} disabled={code.length !== 6} />
                  <Text style={styles.help}>The code expires for your protection. If it does not arrive, check spam or request a new one.</Text>
                </>
              ) : (
                <View style={styles.successPanel}><Ionicons name="shield-checkmark" size={28} color={palette.success} /><Text style={styles.successTitle}>Checkout protection enabled</Text><Text style={styles.successText}>Your verified account is ready to order and track deliveries.</Text></View>
              )}

              {error && code.length === 0 ? <StatusMessage error>{error}</StatusMessage> : null}
              <PrimaryButton title={verified ? 'Continue shopping' : 'I’ll do this later'} icon={isRtl ? 'arrow-back' : 'arrow-forward'} variant="outline" onPress={() => router.replace('/shop')} />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Step({ number, title, active, done }: { number: string; title: string; active: boolean; done: boolean }) {
  const { colors: palette, styles } = useThemedStyles(createStyles);
  return <View style={styles.step}><View style={[styles.stepNumber, active && styles.stepNumberActive, done && styles.stepNumberDone]}>{done ? <Ionicons name="checkmark" size={14} color={palette.white} /> : <Text style={[styles.stepNumberText, active && styles.stepNumberTextActive]}>{number}</Text>}</View><Text style={[styles.stepText, (active || done) && styles.stepTextActive]}>{title}</Text></View>;
}

function StatusMessage({ children, error: isError = false }: { children: React.ReactNode; error?: boolean }) {
  const { colors: palette, styles } = useThemedStyles(createStyles);
  return <View style={[styles.status, isError && styles.statusError]}><Ionicons name={isError ? 'alert-circle' : 'checkmark-circle'} size={17} color={isError ? palette.danger : palette.success} /><Text style={[styles.statusText, isError && styles.statusTextError]}>{children}</Text></View>;
}

const createStyles = (palette: AppPalette, isRtl: boolean) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.background },
  flex: { flex: 1 },
  content: { flexGrow: 1, padding: spacing.lg, paddingBottom: 34 },
  shell: { width: '100%', maxWidth: 560, alignSelf: 'center' },
  hero: { minHeight: 250, padding: spacing.xxl, borderRadius: radii.xl },
  heroIcon: { width: 62, height: 62, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.amberSoft },
  eyebrow: { marginTop: 25, color: palette.amber, fontSize: 8, fontWeight: '900', letterSpacing: 1.5 },
  title: { marginTop: 8, color: palette.white, fontSize: 28, fontWeight: '900', letterSpacing: -0.9 },
  heroText: { marginTop: 10, color: 'rgba(255,255,255,.7)', fontSize: 12, lineHeight: 19 },
  card: { marginTop: -18, marginHorizontal: 9, padding: spacing.xl, gap: 14, borderRadius: radii.xl, backgroundColor: palette.card, borderWidth: 1, borderColor: palette.border, ...shadow },
  steps: { marginBottom: 4, flexDirection: isRtl ? 'row-reverse' : 'row', alignItems: 'flex-start' },
  step: { width: 84, alignItems: 'center', gap: 6 },
  stepLine: { flex: 1, height: 1, marginTop: 15, backgroundColor: palette.border },
  stepNumber: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.input, borderWidth: 1, borderColor: palette.border },
  stepNumberActive: { backgroundColor: palette.primarySoft, borderColor: palette.primary },
  stepNumberDone: { backgroundColor: palette.success, borderColor: palette.success },
  stepNumberText: { color: palette.muted, fontSize: 10, fontWeight: '900' },
  stepNumberTextActive: { color: palette.primary },
  stepText: { color: palette.muted, textAlign: 'center', fontSize: 8, fontWeight: '800' },
  stepTextActive: { color: palette.text },
  status: { padding: 11, borderRadius: radii.md, flexDirection: isRtl ? 'row-reverse' : 'row', alignItems: 'center', gap: 8, backgroundColor: palette.successSoft },
  statusError: { backgroundColor: palette.dangerSoft },
  statusText: { flex: 1, color: palette.success, fontSize: 10, lineHeight: 16, fontWeight: '700' },
  statusTextError: { color: palette.danger },
  help: { color: palette.muted, textAlign: 'center', fontSize: 8.5, lineHeight: 14 },
  successPanel: { padding: 20, alignItems: 'center', borderRadius: radii.lg, backgroundColor: palette.successSoft },
  successTitle: { marginTop: 9, color: palette.success, fontSize: 15, fontWeight: '900' },
  successText: { marginTop: 5, color: palette.success, textAlign: 'center', fontSize: 10, lineHeight: 16 },
  centerCard: { width: '90%', maxWidth: 420, margin: 'auto', padding: 24, alignSelf: 'center', alignItems: 'center', gap: 12, borderRadius: radii.xl, backgroundColor: palette.card, borderWidth: 1, borderColor: palette.border },
  largeIcon: { width: 62, height: 62, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.primarySoft },
  centerTitle: { color: palette.text, fontSize: 18, fontWeight: '900' },
  centerText: { color: palette.muted, textAlign: 'center', fontSize: 11, lineHeight: 18 },
});
