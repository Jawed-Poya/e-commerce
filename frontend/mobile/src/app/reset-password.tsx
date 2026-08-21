import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Field, PrimaryButton } from '@/components/ui';
import { Text } from '@/components/app-text';
import { radii, shadow, spacing, type AppPalette } from '@/constants/theme';
import { ApiError } from '@/lib/api';
import { commerceApi } from '@/lib/commerce-api';
import { useThemedStyles } from '@/providers/theme-provider';

export default function ResetPasswordScreen() {
  const params = useLocalSearchParams<{ email?: string; token?: string }>();
  const router = useRouter();
  const { colors: palette, styles } = useThemedStyles(createStyles);
  const [email, setEmail] = useState(params.email ?? '');
  const [token, setToken] = useState(params.token ?? '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [complete, setComplete] = useState(false);

  const submit = async () => {
    if (!email.trim() || !token.trim()) {
      setError('Enter your email and the secure token from the reset link.');
      return;
    }
    if (password.length < 6) {
      setError('Your new password must contain at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('The new passwords do not match.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await commerceApi.resetPassword(email.trim(), token.trim(), password);
      setComplete(true);
    } catch (requestError) {
      setError(requestError instanceof ApiError ? requestError.message : 'Your password could not be reset.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView edges={['bottom']} style={styles.safeArea}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.shell}>
            <LinearGradient colors={[palette.darkSurface, palette.primaryDark]} style={styles.hero}>
              <View style={styles.heroIcon}><Ionicons name={complete ? 'checkmark-done' : 'key'} size={31} color={palette.amber} /></View>
              <Text style={styles.eyebrow}>PROTECTED PASSWORD RECOVERY</Text>
              <Text style={styles.title}>{complete ? 'Password updated.' : 'Create a new password.'}</Text>
              <Text style={styles.heroText}>{complete ? 'You can now return to EasyCart and sign in securely.' : 'Use the private token in your reset email. It expires automatically for your safety.'}</Text>
            </LinearGradient>

            <View style={styles.card}>
              {complete ? (
                <View style={styles.complete}><View style={styles.completeIcon}><Ionicons name="shield-checkmark" size={30} color={palette.success} /></View><Text style={styles.completeTitle}>Your account is secure</Text><Text style={styles.completeText}>The old password is no longer valid.</Text><PrimaryButton title="Return to sign in" icon="log-in" onPress={() => router.replace('/auth')} /></View>
              ) : (
                <>
                  <Field label="Account email" value={email} onChangeText={(value) => { setEmail(value); setError(''); }} keyboardType="email-address" autoCapitalize="none" autoComplete="email" placeholder="you@example.com" />
                  <Field label="Reset token" value={token} onChangeText={(value) => { setToken(value); setError(''); }} autoCapitalize="none" autoCorrect={false} placeholder="Paste token from the email" />
                  <View>
                    <Field label="New password" value={password} onChangeText={(value) => { setPassword(value); setError(''); }} secureTextEntry={!showPassword} autoComplete="new-password" placeholder="At least 6 characters" />
                    <PrimaryButton title={showPassword ? 'Hide password' : 'Show password'} icon={showPassword ? 'eye-off-outline' : 'eye-outline'} variant="secondary" onPress={() => setShowPassword((current) => !current)} style={styles.showButton} />
                  </View>
                  <Field label="Confirm new password" value={confirmPassword} onChangeText={(value) => { setConfirmPassword(value); setError(''); }} secureTextEntry={!showPassword} autoComplete="new-password" placeholder="Repeat your password" />
                  {error ? <View style={styles.error}><Ionicons name="alert-circle" size={17} color={palette.danger} /><Text style={styles.errorText}>{error}</Text></View> : null}
                  <PrimaryButton title="Update my password" icon="shield-checkmark" onPress={() => void submit()} loading={busy} />
                  <Text style={styles.help}>Never share your reset token. EasyCart support will not ask for it.</Text>
                </>
              )}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (palette: AppPalette, isRtl: boolean) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.background },
  flex: { flex: 1 },
  content: { flexGrow: 1, padding: spacing.lg, paddingBottom: 34 },
  shell: { width: '100%', maxWidth: 560, alignSelf: 'center' },
  hero: { minHeight: 245, padding: spacing.xxl, borderRadius: radii.xl },
  heroIcon: { width: 62, height: 62, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.amberSoft },
  eyebrow: { marginTop: 25, color: palette.amber, fontSize: 8, fontWeight: '900', letterSpacing: 1.5 },
  title: { marginTop: 8, color: palette.white, fontSize: 28, fontWeight: '900', letterSpacing: -0.9 },
  heroText: { marginTop: 10, color: 'rgba(255,255,255,.7)', fontSize: 12, lineHeight: 19 },
  card: { marginTop: -18, marginHorizontal: 9, padding: spacing.xl, gap: 14, borderRadius: radii.xl, backgroundColor: palette.card, borderWidth: 1, borderColor: palette.border, ...shadow },
  showButton: { minHeight: 38, marginTop: 7, alignSelf: isRtl ? 'flex-start' : 'flex-end' },
  error: { padding: 11, borderRadius: radii.md, flexDirection: isRtl ? 'row-reverse' : 'row', alignItems: 'center', gap: 8, backgroundColor: palette.dangerSoft },
  errorText: { flex: 1, color: palette.danger, fontSize: 10, lineHeight: 16, fontWeight: '700' },
  help: { color: palette.muted, textAlign: 'center', fontSize: 8.5, lineHeight: 14 },
  complete: { alignItems: 'center', gap: 10 },
  completeIcon: { width: 68, height: 68, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.successSoft },
  completeTitle: { color: palette.text, fontSize: 18, fontWeight: '900' },
  completeText: { marginBottom: 5, color: palette.muted, fontSize: 11 },
});
