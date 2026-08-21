import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/components/app-text';
import { compactShadow, radii, spacing, type AppPalette } from '@/constants/theme';
import { useI18n } from '@/providers/i18n-provider';
import { useThemedStyles } from '@/providers/theme-provider';

type ConfirmationTone = 'brand' | 'danger';

export function ConfirmationDialog({
  visible,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  icon = 'help-circle-outline',
  tone = 'brand',
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  tone?: ConfirmationTone;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { t } = useI18n();
  const { colors, styles } = useThemedStyles(createStyles);
  const destructive = tone === 'danger';
  const actionColor = destructive ? colors.danger : colors.primary;
  const actionForeground = destructive ? colors.white : colors.primaryForeground;
  const actionIcon = icon === 'help-circle-outline' ? 'checkmark' : icon;

  const confirm = () => {
    void Haptics.notificationAsync(
      destructive ? Haptics.NotificationFeedbackType.Warning : Haptics.NotificationFeedbackType.Success,
    );
    onConfirm();
  };

  return (
    <Modal
      animationType="fade"
      onRequestClose={onCancel}
      presentationStyle="overFullScreen"
      statusBarTranslucent
      transparent
      visible={visible}>
      <View accessibilityViewIsModal style={styles.overlay}>
        <Pressable accessibilityLabel={t('Dismiss')} onPress={onCancel} style={StyleSheet.absoluteFill} />
        <SafeAreaView edges={['bottom']} style={styles.safeArea}>
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <View style={styles.accentRow}><View style={styles.primaryAccent} /><View style={styles.secondaryAccent} /></View>

            <View style={styles.headingRow}>
              <View style={[styles.iconWrap, destructive && styles.iconWrapDanger]}>
                <Ionicons name={icon} size={27} color={actionColor} />
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel={t('Dismiss')} hitSlop={8} onPress={onCancel} style={styles.closeButton}>
                <Ionicons name="close" size={20} color={colors.muted} />
              </Pressable>
            </View>

            <Text style={styles.eyebrow}>PLEASE CONFIRM</Text>
            <Text style={styles.title}>{t(title)}</Text>
            <Text style={styles.message}>{t(message)}</Text>

            <View style={styles.actions}>
              <Pressable
                accessibilityRole="button"
                onPress={onCancel}
                style={({ pressed }) => [styles.cancelButton, pressed && styles.pressed]}>
                <Text style={styles.cancelText}>{t(cancelLabel)}</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={confirm}
                style={({ pressed }) => [styles.confirmButton, { backgroundColor: actionColor }, pressed && styles.pressed]}>
                <Ionicons name={actionIcon} size={18} color={actionForeground} />
                <Text style={[styles.confirmText, { color: actionForeground }]}>{t(confirmLabel)}</Text>
              </Pressable>
            </View>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const createStyles = (palette: AppPalette, isRtl: boolean) => StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.56)' },
  safeArea: { width: '100%', maxWidth: 560, alignSelf: 'center' },
  sheet: { overflow: 'hidden', padding: spacing.xl, paddingTop: 12, borderTopLeftRadius: 30, borderTopRightRadius: 30, backgroundColor: palette.card, borderWidth: 1, borderBottomWidth: 0, borderColor: palette.border, ...compactShadow },
  handle: { width: 42, height: 5, alignSelf: 'center', borderRadius: radii.pill, backgroundColor: palette.border },
  accentRow: { position: 'absolute', top: 0, start: 0, end: 0, height: 3, flexDirection: isRtl ? 'row-reverse' : 'row' },
  primaryAccent: { flex: 3, backgroundColor: palette.primary },
  secondaryAccent: { flex: 1, backgroundColor: palette.amber },
  headingRow: { marginTop: 18, flexDirection: isRtl ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconWrap: { width: 54, height: 54, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.primarySoft, borderWidth: 1, borderColor: palette.border },
  iconWrapDanger: { backgroundColor: palette.dangerSoft, borderColor: palette.danger },
  closeButton: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.input },
  eyebrow: { marginTop: 17, color: palette.amber, fontSize: 8, fontWeight: '900', letterSpacing: 1.7 },
  title: { marginTop: 5, color: palette.text, fontSize: 23, lineHeight: 29, fontWeight: '900', letterSpacing: -0.55 },
  message: { marginTop: 9, color: palette.muted, fontSize: 13, lineHeight: 20 },
  actions: { marginTop: 22, flexDirection: isRtl ? 'row-reverse' : 'row', gap: 10 },
  cancelButton: { flex: 1, minHeight: 52, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.input, borderWidth: 1, borderColor: palette.border },
  cancelText: { color: palette.text, fontSize: 13, fontWeight: '800' },
  confirmButton: { flex: 1.25, minHeight: 52, paddingHorizontal: 14, borderRadius: radii.md, flexDirection: isRtl ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  confirmText: { fontSize: 13, fontWeight: '900' },
  pressed: { opacity: 0.76, transform: [{ scale: 0.985 }] },
});
