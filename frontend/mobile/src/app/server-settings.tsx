import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/components/app-text';
import { ConfirmationDialog } from '@/components/confirmation-dialog';
import { PrimaryButton } from '@/components/ui';
import { radii, spacing, type AppPalette } from '@/constants/theme';
import { testRuntimeApi } from '@/lib/runtime-config';
import { useRuntimeConfig } from '@/providers/runtime-config-provider';
import { useI18n } from '@/providers/i18n-provider';
import { useThemedStyles } from '@/providers/theme-provider';

export default function ServerSettingsScreen() {
  const router = useRouter();
  const runtime = useRuntimeConfig();
  const { t } = useI18n();
  const { colors, styles } = useThemedStyles(createStyles);
  const [value, setValue] = useState(runtime.apiUrl);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [verifiedUrl, setVerifiedUrl] = useState<string | null>(null);

  const verify = async () => {
    setBusy(true);
    setError('');
    try {
      setVerifiedUrl(await testRuntimeApi(value));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The server could not be reached.');
    } finally {
      setBusy(false);
    }
  };

  const apply = async () => {
    if (!verifiedUrl) return;
    setBusy(true);
    try {
      await runtime.useServer(verifiedUrl);
      setVerifiedUrl(null);
      router.replace('/shop');
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    setBusy(true);
    try {
      await runtime.useManagedServer();
      router.replace('/shop');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView edges={['bottom']} style={styles.safeArea}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.heroIcon}><Ionicons name="server-outline" size={27} color={colors.primaryForeground} /></View>
          <Text style={styles.title}>Store connection</Text>
          <Text style={styles.subtitle}>Change which EasyCart backend this app uses without rebuilding the application.</Text>

          <View style={styles.statusCard}>
            <View style={styles.statusRow}>
              <View style={styles.liveDot} />
              <Text style={styles.statusLabel}>{runtime.source === 'manual' ? 'CUSTOM SERVER' : runtime.source === 'remote' ? 'REMOTELY MANAGED' : 'BUILD DEFAULT'}</Text>
            </View>
            <Text selectable style={styles.currentUrl}>{runtime.apiUrl}</Text>
          </View>

          <View style={styles.formCard}>
            <Text style={styles.label}>EasyCart API address</Text>
            <View style={[styles.inputWrap, Boolean(error) && styles.inputError]}>
              <Ionicons name="link-outline" size={19} color={colors.muted} />
              <TextInput
                value={value}
                onChangeText={(next) => { setValue(next); setError(''); setVerifiedUrl(null); }}
                placeholder="https://shop.example.com/api"
                placeholderTextColor={colors.muted}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                style={styles.input}
              />
            </View>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Text style={styles.help}>For Play Store releases, use a public HTTPS address. Local HTTP addresses are intended only for development on your Wi-Fi network.</Text>
            <PrimaryButton title="Test connection" icon="pulse-outline" onPress={() => void verify()} loading={busy} />
            {runtime.source === 'manual' ? (
              <PrimaryButton title="Use managed default" icon="refresh-outline" variant="outline" disabled={busy} onPress={() => void reset()} />
            ) : null}
          </View>

          <View style={styles.securityNote}>
            <Ionicons name="shield-checkmark-outline" size={21} color={colors.primary} />
            <Text style={styles.securityText}>Changing servers securely signs you out and clears server-specific cart and cached product data so accounts cannot cross between stores.</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <ConfirmationDialog
        visible={Boolean(verifiedUrl)}
        title="Switch store server?"
        message={t('The connection was verified. EasyCart will sign out and reload data from {url}.', { url: verifiedUrl ?? value })}
        confirmLabel="Switch server"
        icon="server-outline"
        onCancel={() => setVerifiedUrl(null)}
        onConfirm={() => void apply()}
      />
    </SafeAreaView>
  );
}

const createStyles = (palette: AppPalette, isRtl: boolean) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.background },
  flex: { flex: 1 },
  content: { padding: spacing.xl, paddingBottom: 40 },
  heroIcon: { width: 54, height: 54, borderRadius: radii.lg, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.primary },
  title: { marginTop: 18, color: palette.text, fontSize: 26, fontWeight: '900', textAlign: isRtl ? 'right' : 'left' },
  subtitle: { marginTop: 7, color: palette.muted, fontSize: 13, lineHeight: 20, textAlign: isRtl ? 'right' : 'left' },
  statusCard: { marginTop: 22, padding: 16, borderRadius: radii.lg, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.card },
  statusRow: { flexDirection: isRtl ? 'row-reverse' : 'row', alignItems: 'center', gap: 7 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: palette.success },
  statusLabel: { color: palette.success, fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  currentUrl: { marginTop: 9, color: palette.text, fontSize: 12, fontWeight: '700' },
  formCard: { marginTop: 12, padding: 16, gap: 12, borderRadius: radii.lg, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.card },
  label: { color: palette.text, fontSize: 12, fontWeight: '900', textAlign: isRtl ? 'right' : 'left' },
  inputWrap: { minHeight: 52, paddingHorizontal: 13, flexDirection: isRtl ? 'row-reverse' : 'row', alignItems: 'center', gap: 9, borderRadius: radii.md, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.input },
  inputError: { borderColor: palette.danger },
  input: { flex: 1, color: palette.text, fontSize: 13, textAlign: isRtl ? 'right' : 'left' },
  error: { color: palette.danger, fontSize: 11, lineHeight: 17 },
  help: { color: palette.muted, fontSize: 10, lineHeight: 16, textAlign: isRtl ? 'right' : 'left' },
  securityNote: { marginTop: 13, padding: 14, flexDirection: isRtl ? 'row-reverse' : 'row', alignItems: 'flex-start', gap: 10, borderRadius: radii.md, backgroundColor: palette.primarySoft },
  securityText: { flex: 1, color: palette.text, fontSize: 10, lineHeight: 16, textAlign: isRtl ? 'right' : 'left' },
});
