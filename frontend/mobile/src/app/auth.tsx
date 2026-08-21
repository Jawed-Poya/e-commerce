import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandMark, Field, PrimaryButton } from '@/components/ui';
import { Text } from '@/components/app-text';
import { GoogleSignInButton } from '@/components/google-sign-in-button';
import { radii, spacing, type AppPalette } from '@/constants/theme';
import { ApiError } from '@/lib/api';
import { commerceApi } from '@/lib/commerce-api';
import { useAuth } from '@/providers/auth-provider';
import { useCompany } from '@/providers/company-provider';
import { useThemedStyles } from '@/providers/theme-provider';

type Mode = 'login' | 'register' | 'forgot';

export default function AuthScreen() {
  const params = useLocalSearchParams<{ mode?: string; returnTo?: string }>();
  const router = useRouter();
  const auth = useAuth();
  const { company } = useCompany();
  const { colors: palette, styles, isRtl } = useThemedStyles(createStyles);
  const [mode, setMode] = useState<Mode>(params.mode === 'register' ? 'register' : 'login');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({
    identifier: '',
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  const update = (key: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
    setError('');
    setMessage('');
  };

  const changeMode = (next: Mode) => {
    setMode(next);
    setError('');
    setMessage('');
  };

  const submit = async () => {
    if (mode === 'forgot' && !form.email.trim()) {
      setError('Enter the email address connected to your account.');
      return;
    }
    if (mode === 'login' && (!form.identifier.trim() || !form.password)) {
      setError('Enter your email or phone and password.');
      return;
    }
    if (mode === 'register') {
      if (!form.firstName.trim() || !form.phone.trim() || !form.email.trim() || !form.password) {
        setError('First name, phone, email, and password are required.');
        return;
      }
      if (form.password.length < 6) {
        setError('Use a password with at least 6 characters.');
        return;
      }
      if (form.password !== form.confirmPassword) {
        setError('The passwords do not match.');
        return;
      }
    }

    setBusy(true);
    setError('');
    setMessage('');
    try {
      if (mode === 'forgot') {
        await commerceApi.forgotPassword(form.email.trim());
        setMessage('If an account exists for this email, a secure reset link has been sent.');
      } else if (mode === 'login') {
        await auth.login(form.identifier.trim(), form.password);
        router.replace(params.returnTo === 'checkout' ? '/checkout' : '/account');
      } else {
        await auth.register({
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim() || null,
          phone: form.phone.trim(),
          email: form.email.trim() || null,
          password: form.password,
        });
        router.replace('/verify-email');
      }
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : 'Authentication could not be completed.');
    } finally {
      setBusy(false);
    }
  };

  const handleGoogleCredential = useCallback(async (credential: string) => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await auth.googleSignIn(credential);
      router.replace(params.returnTo === 'checkout' ? '/checkout' : '/account');
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : 'Google sign-in could not be completed.');
    } finally {
      setBusy(false);
    }
  }, [auth, params.returnTo, router]);

  return (
    <SafeAreaView edges={['bottom']} style={styles.safeArea}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <LinearGradient colors={[palette.darkSurface, palette.primaryDark]} style={styles.hero}>
            <BrandMark />
            <Text style={styles.heroEyebrow}>{company?.name ?? 'EASYCART'} CUSTOMER</Text>
            <Text style={styles.heroTitle}>{mode === 'login' ? 'Welcome back.' : mode === 'register' ? 'Create your account.' : 'Reset securely.'}</Text>
            <Text style={styles.heroText}>{mode === 'login' ? 'Sign in to order faster and keep every delivery in one place.' : mode === 'register' ? 'One secure account for checkout, order history, and real-time tracking.' : 'We’ll email a private reset link to the address connected to your account.'}</Text>
            <View style={styles.benefits}>
              <Benefit icon="flash" text="Faster checkout" />
              <Benefit icon="receipt" text="Order history" />
              <Benefit icon="navigate" text="Live tracking" />
            </View>
          </LinearGradient>

          <View style={styles.card}>
            {mode === 'forgot' ? (
              <Pressable onPress={() => changeMode('login')} style={styles.forgotHeader}><Ionicons name={isRtl ? 'arrow-forward' : 'arrow-back'} size={17} color={palette.primary} /><Text style={styles.forgotHeaderText}>Back to secure sign in</Text></Pressable>
            ) : (
              <View style={styles.segment}>
                <ModeButton label="Sign in" active={mode === 'login'} onPress={() => changeMode('login')} />
                <ModeButton label="Create account" active={mode === 'register'} onPress={() => changeMode('register')} />
              </View>
            )}

            <View style={styles.form}>
              {mode === 'login' ? (
                <>
                  <Field label="Email or phone" value={form.identifier} onChangeText={(value) => update('identifier', value)} autoCapitalize="none" autoComplete="username" placeholder="you@example.com or 07…" />
                  <Field label="Password" value={form.password} onChangeText={(value) => update('password', value)} secureTextEntry autoComplete="current-password" placeholder="Your password" />
                  <Pressable accessibilityRole="button" onPress={() => changeMode('forgot')} style={styles.forgotLink}><Text style={styles.forgotLinkText}>Forgot your password?</Text><Ionicons name={isRtl ? 'arrow-back' : 'arrow-forward'} size={14} color={palette.primary} /></Pressable>
                </>
              ) : mode === 'register' ? (
                <>
                  <Field label="First name" value={form.firstName} onChangeText={(value) => update('firstName', value)} autoComplete="given-name" />
                  <Field label="Last name" value={form.lastName} onChangeText={(value) => update('lastName', value)} autoComplete="family-name" />
                  <Field label="Phone number" value={form.phone} onChangeText={(value) => update('phone', value)} keyboardType="phone-pad" autoComplete="tel" placeholder="07xxxxxxxx" />
                  <Field label="Email address" value={form.email} onChangeText={(value) => update('email', value)} keyboardType="email-address" autoCapitalize="none" autoComplete="email" placeholder="you@example.com" />
                  <Field label="Password" value={form.password} onChangeText={(value) => update('password', value)} secureTextEntry autoComplete="new-password" />
                  <Field label="Confirm password" value={form.confirmPassword} onChangeText={(value) => update('confirmPassword', value)} secureTextEntry autoComplete="new-password" />
                </>
              ) : (
                <>
                  <View style={styles.resetIntro}><View style={styles.resetIcon}><Ionicons name="mail-unread-outline" size={22} color={palette.primary} /></View><View style={styles.flex}><Text style={styles.resetTitle}>Receive your reset link</Text><Text style={styles.resetText}>For your security, the response won’t reveal whether an account exists.</Text></View></View>
                  <Field label="Account email" value={form.email} onChangeText={(value) => update('email', value)} keyboardType="email-address" autoCapitalize="none" autoComplete="email" placeholder="you@example.com" />
                </>
              )}

              {error ? <View style={styles.error}><Ionicons name="alert-circle" size={18} color={palette.danger} /><Text style={styles.errorText}>{error}</Text></View> : null}
              {message ? <View style={styles.message}><Ionicons name="checkmark-circle" size={18} color={palette.success} /><Text style={styles.messageText}>{message}</Text></View> : null}
              <PrimaryButton title={busy ? 'Please wait…' : mode === 'login' ? 'Sign in securely' : mode === 'register' ? 'Create my account' : 'Send reset link'} icon={mode === 'login' ? 'log-in' : mode === 'register' ? 'person-add' : 'mail'} onPress={() => void submit()} loading={busy} />
              {mode === 'forgot' && message ? <PrimaryButton title="Enter a reset token" icon="key-outline" variant="outline" onPress={() => router.push({ pathname: '/reset-password', params: { email: form.email.trim() } })} /> : null}

              {mode !== 'forgot' ? (
                <>
                  <View style={styles.divider}><View style={styles.dividerLine} /><Text style={styles.dividerText}>OR</Text><View style={styles.dividerLine} /></View>
                  <GoogleSignInButton busy={busy} onCredential={(credential) => void handleGoogleCredential(credential)} onError={setError} />
                </>
              ) : null}
              <Text style={styles.privacy}>Your session token is stored securely on this device. We never store your password.</Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Benefit({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  const { colors: palette, styles } = useThemedStyles(createStyles);
  return <View style={styles.benefit}><Ionicons name={icon} size={13} color={palette.amber} /><Text style={styles.benefitText}>{text}</Text></View>;
}

function ModeButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const { styles } = useThemedStyles(createStyles);
  return <Pressable onPress={onPress} style={[styles.modeButton, active && styles.modeButtonActive]}><Text style={[styles.modeText, active && styles.modeTextActive]}>{label}</Text></Pressable>;
}

const createStyles = (palette: AppPalette, isRtl: boolean) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.background },
  flex: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: 34 },
  hero: { padding: 24, minHeight: 250, borderRadius: radii.xl, overflow: 'hidden' },
  heroEyebrow: { marginTop: 24, color: palette.amber, fontSize: 9, fontWeight: '900', letterSpacing: 1.6 },
  heroTitle: { marginTop: 8, color: palette.white, fontSize: 31, fontWeight: '900', letterSpacing: -1 },
  heroText: { marginTop: 10, maxWidth: 350, color: 'rgba(255,255,255,.72)', fontSize: 13, lineHeight: 20 },
  benefits: { marginTop: 20, flexDirection: isRtl ? 'row-reverse' : 'row', flexWrap: 'wrap', gap: 13 },
  benefit: { flexDirection: isRtl ? 'row-reverse' : 'row', alignItems: 'center', gap: 5 },
  benefitText: { color: 'rgba(255,255,255,.8)', fontSize: 9, fontWeight: '700' },
  card: { marginTop: -20, marginHorizontal: 10, overflow: 'hidden', borderRadius: radii.xl, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.card },
  segment: { padding: 6, flexDirection: isRtl ? 'row-reverse' : 'row', backgroundColor: palette.input },
  forgotHeader: { minHeight: 53, paddingHorizontal: 18, flexDirection: isRtl ? 'row-reverse' : 'row', alignItems: 'center', gap: 8, backgroundColor: palette.input },
  forgotHeaderText: { color: palette.primary, fontSize: 11, fontWeight: '900' },
  modeButton: { flex: 1, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  modeButtonActive: { backgroundColor: palette.card },
  modeText: { color: palette.muted, fontSize: 12, fontWeight: '800' },
  modeTextActive: { color: palette.primary },
  form: { padding: 20, gap: 15 },
  forgotLink: { alignSelf: isRtl ? 'flex-start' : 'flex-end', marginTop: -5, flexDirection: isRtl ? 'row-reverse' : 'row', alignItems: 'center', gap: 5, paddingVertical: 4 },
  forgotLinkText: { color: palette.primary, fontSize: 10, fontWeight: '900' },
  resetIntro: { padding: 12, borderRadius: radii.md, flexDirection: isRtl ? 'row-reverse' : 'row', alignItems: 'center', gap: 10, backgroundColor: palette.primarySoft },
  resetIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.card },
  resetTitle: { color: palette.text, fontSize: 12, fontWeight: '900' },
  resetText: { marginTop: 3, color: palette.muted, fontSize: 9, lineHeight: 14 },
  error: { padding: 11, borderRadius: radii.md, backgroundColor: palette.dangerSoft, flexDirection: isRtl ? 'row-reverse' : 'row', alignItems: 'center', gap: 8 },
  errorText: { flex: 1, color: palette.danger, fontSize: 11, lineHeight: 16, fontWeight: '600' },
  message: { padding: 11, borderRadius: radii.md, backgroundColor: palette.successSoft, flexDirection: isRtl ? 'row-reverse' : 'row', alignItems: 'center', gap: 8 },
  messageText: { flex: 1, color: palette.success, fontSize: 10, lineHeight: 16, fontWeight: '700' },
  divider: { flexDirection: isRtl ? 'row-reverse' : 'row', alignItems: 'center', gap: 10 },
  dividerLine: { flex: 1, height: 1, backgroundColor: palette.border },
  dividerText: { color: palette.muted, fontSize: 8, fontWeight: '900', letterSpacing: 1 },
  privacy: { color: palette.muted, fontSize: 9, lineHeight: 15, textAlign: 'center' },
});
