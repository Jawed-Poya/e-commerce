import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  TextInput,
  type TextInputProps,
  View,
  type ViewStyle,
} from 'react-native';

import { compactShadow, radii, spacing, type AppPalette } from '@/constants/theme';
import { Text } from '@/components/app-text';
import { useI18n } from '@/providers/i18n-provider';
import { useThemedStyles } from '@/providers/theme-provider';

export function BrandMark({ compact = false }: { compact?: boolean }) {
  const { colors: palette, styles } = useThemedStyles(createStyles);
  return (
    <View style={[styles.brandMark, compact && styles.brandMarkCompact]}>
      <Ionicons name="bag-handle" color={palette.primaryForeground} size={compact ? 17 : 22} />
    </View>
  );
}

export function BrandHeader({ name = 'EasyCart', subtitle }: { name?: string; subtitle?: string }) {
  const { t } = useI18n();
  const { styles } = useThemedStyles(createStyles);
  return (
    <View style={styles.brandHeader}>
      <BrandMark />
      <View style={styles.flex}>
        <Text numberOfLines={1} style={styles.brandName}>{name}<Text style={styles.brandAccent}>.</Text></Text>
        {subtitle ? <Text numberOfLines={1} style={styles.brandSubtitle}>{t(subtitle)}</Text> : null}
      </View>
    </View>
  );
}

export function PrimaryButton({
  title,
  onPress,
  icon,
  disabled,
  loading,
  variant = 'primary',
  style,
}: {
  title: string;
  onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'secondary' | 'outline' | 'danger';
  style?: ViewStyle;
}) {
  const { t } = useI18n();
  const { colors: palette, styles } = useThemedStyles(createStyles);
  const foreground = variant === 'primary'
    ? palette.primaryForeground
    : variant === 'danger' ? palette.white : palette.primary;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t(title)}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        styles[`button_${variant}`],
        (disabled || loading) && styles.buttonDisabled,
        pressed && styles.buttonPressed,
        style,
      ]}>
      {loading
        ? <ActivityIndicator color={foreground} size="small" />
        : icon ? <Ionicons name={icon} size={18} color={foreground} /> : null}
      <Text style={[styles.buttonText, { color: foreground }]}>{t(title)}</Text>
    </Pressable>
  );
}

export function Field({ label, error, multiline, ...props }: TextInputProps & { label: string; error?: string }) {
  const { t } = useI18n();
  const { colors: palette, styles } = useThemedStyles(createStyles);
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.label}>{t(label)}</Text>
      <TextInput
        placeholderTextColor={palette.muted}
        selectionColor={palette.primary}
        multiline={multiline}
        style={[styles.input, multiline && styles.inputMultiline, error && styles.inputError]}
        {...props}
        placeholder={props.placeholder ? t(props.placeholder) : undefined}
      />
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

export function StatusChip({ label, tone = 'neutral' }: { label: string; tone?: 'neutral' | 'success' | 'warning' | 'danger' }) {
  const { t } = useI18n();
  const { styles } = useThemedStyles(createStyles);
  return (
    <View style={[styles.chip, styles[`chip_${tone}`]]}>
      <Text style={[styles.chipText, styles[`chipText_${tone}`]]}>{t(label)}</Text>
    </View>
  );
}

export function EmptyState({ icon, title, message, action }: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  message: string;
  action?: ReactNode;
}) {
  const { t } = useI18n();
  const { colors: palette, styles } = useThemedStyles(createStyles);
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}><Ionicons name={icon} size={30} color={palette.primary} /></View>
      <Text style={styles.emptyTitle}>{t(title)}</Text>
      <Text style={styles.emptyMessage}>{t(message)}</Text>
      {action}
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { t } = useI18n();
  const { colors: palette, styles } = useThemedStyles(createStyles);
  return (
    <View style={styles.errorBox}>
      <Ionicons name="alert-circle" size={22} color={palette.danger} />
      <View style={styles.flex}><Text style={styles.errorTitle}>{t('Something went wrong')}</Text><Text style={styles.errorMessage}>{t(message)}</Text></View>
      {onRetry ? <Pressable hitSlop={10} onPress={onRetry}><Ionicons name="refresh" size={21} color={palette.primary} /></Pressable> : null}
    </View>
  );
}

export function LoadingBlock({ label = 'Loading…' }: { label?: string }) {
  const { t } = useI18n();
  const { colors: palette, styles } = useThemedStyles(createStyles);
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={palette.primary} />
      <Text style={styles.loadingText}>{t(label)}</Text>
    </View>
  );
}

const createStyles = (palette: AppPalette, isRtl: boolean) => StyleSheet.create({
  flex: { flex: 1 },
  brandMark: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.primary },
  brandMarkCompact: { width: 34, height: 34, borderRadius: 10 },
  brandHeader: { flexDirection: isRtl ? 'row-reverse' : 'row', alignItems: 'center', gap: 11 },
  brandName: { color: palette.text, fontSize: 21, fontWeight: '900', letterSpacing: -0.8 },
  brandAccent: { color: palette.amber },
  brandSubtitle: { color: palette.muted, fontSize: 11, marginTop: 1 },
  button: { minHeight: 50, paddingHorizontal: 18, borderRadius: radii.md, flexDirection: isRtl ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  button_primary: { backgroundColor: palette.primary },
  button_secondary: { backgroundColor: palette.primarySoft },
  button_outline: { backgroundColor: palette.card, borderWidth: 1, borderColor: palette.border },
  button_danger: { backgroundColor: palette.danger },
  buttonDisabled: { opacity: 0.48 },
  buttonPressed: { opacity: 0.78, transform: [{ scale: 0.985 }] },
  buttonText: { fontSize: 14, fontWeight: '800' },
  fieldWrap: { gap: 7 },
  label: { color: palette.text, fontSize: 12, fontWeight: '800' },
  input: { minHeight: 50, borderWidth: 1, borderColor: palette.border, backgroundColor: palette.card, color: palette.text, borderRadius: radii.md, paddingHorizontal: 14, fontSize: 15, writingDirection: isRtl ? 'rtl' : 'ltr', textAlign: isRtl ? 'right' : 'left' },
  inputMultiline: { minHeight: 96, paddingTop: 14, textAlignVertical: 'top' },
  inputError: { borderColor: palette.danger },
  errorText: { color: palette.danger, fontSize: 11, fontWeight: '600' },
  chip: { alignSelf: isRtl ? 'flex-end' : 'flex-start', borderRadius: radii.pill, paddingHorizontal: 10, paddingVertical: 6 },
  chip_neutral: { backgroundColor: palette.input },
  chip_success: { backgroundColor: palette.successSoft },
  chip_warning: { backgroundColor: palette.amberSoft },
  chip_danger: { backgroundColor: palette.dangerSoft },
  chipText: { fontSize: 10, fontWeight: '800' },
  chipText_neutral: { color: palette.muted },
  chipText_success: { color: palette.success },
  chipText_warning: { color: palette.amber },
  chipText_danger: { color: palette.danger },
  empty: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xxl, paddingVertical: 56 },
  emptyIcon: { width: 64, height: 64, borderRadius: 22, backgroundColor: palette.primarySoft, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyTitle: { color: palette.text, fontSize: 20, fontWeight: '900', textAlign: 'center' },
  emptyMessage: { color: palette.muted, fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: 8, marginBottom: 20 },
  errorBox: { flexDirection: isRtl ? 'row-reverse' : 'row', alignItems: 'center', gap: 12, margin: spacing.lg, padding: spacing.lg, borderRadius: radii.md, backgroundColor: palette.dangerSoft, borderWidth: 1, borderColor: palette.danger, ...compactShadow },
  errorTitle: { color: palette.danger, fontSize: 13, fontWeight: '900' },
  errorMessage: { color: palette.danger, fontSize: 12, lineHeight: 17, marginTop: 2 },
  loading: { minHeight: 160, alignItems: 'center', justifyContent: 'center', gap: 10 },
  loadingText: { color: palette.muted, fontSize: 13, fontWeight: '600' },
});
