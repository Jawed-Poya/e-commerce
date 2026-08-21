import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { Text } from '@/components/app-text';
import { radii, type AppPalette } from '@/constants/theme';
import {
  cartQuantityStep,
  cartQuickQuantities,
  maximumCartQuantity,
  normalizeCartQuantity,
} from '@/providers/cart-provider';
import { useI18n } from '@/providers/i18n-provider';
import { useThemedStyles } from '@/providers/theme-provider';

type QuantitySelectorProps = {
  value: number;
  stock: number;
  quantityStep: number;
  quickQuantities?: number[];
  productName: string;
  onChange: (quantity: number) => void;
  allowRemove?: boolean;
  compact?: boolean;
};

export function QuantitySelector({
  value,
  stock,
  quantityStep,
  quickQuantities,
  productName,
  onChange,
  allowRemove = false,
  compact = false,
}: QuantitySelectorProps) {
  const { t } = useI18n();
  const { colors: palette, styles } = useThemedStyles(createStyles);
  const item = { stock, quantityStep };
  const step = cartQuantityStep(item);
  const maximum = maximumCartQuantity(item);
  const presets = cartQuickQuantities(item, quickQuantities);
  const [draft, setDraft] = useState(String(value));
  const canIncrease = value + step <= maximum + Number.EPSILON;

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  const setNormalized = (quantity: number) => {
    const normalized = normalizeCartQuantity(item, quantity);
    onChange(normalized);
    setDraft(String(normalized || step));
  };

  const commit = () => {
    const parsed = Number(draft.replace(',', '.'));
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setDraft(String(value));
      return;
    }
    setNormalized(parsed);
  };

  const decrease = () => {
    if (allowRemove && value <= step + Number.EPSILON) {
      onChange(0);
      return;
    }
    setNormalized(Math.max(step, value - step));
  };

  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]}>
      <View style={[styles.control, compact && styles.controlCompact]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('Decrease quantity')}
          hitSlop={6}
          onPress={decrease}
          style={({ pressed }) => [styles.button, compact && styles.buttonCompact, pressed && styles.pressed]}>
          <Ionicons name="remove" size={compact ? 16 : 19} color={palette.primary} />
        </Pressable>
        <TextInput
          accessibilityLabel={t('Quantity for {product}', { product: productName })}
          value={draft}
          keyboardType={step % 1 === 0 ? 'number-pad' : 'decimal-pad'}
          inputMode="decimal"
          maxLength={10}
          onChangeText={(next) => {
            if (/^\d*(?:[.,]\d{0,3})?$/.test(next)) setDraft(next);
          }}
          onBlur={commit}
          onSubmitEditing={commit}
          selectTextOnFocus
          selectionColor={palette.primary}
          style={[styles.input, compact && styles.inputCompact]}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('Increase quantity')}
          disabled={!canIncrease}
          hitSlop={6}
          onPress={() => setNormalized(value + step)}
          style={({ pressed }) => [styles.button, compact && styles.buttonCompact, !canIncrease && styles.disabled, pressed && styles.pressed]}>
          <Ionicons name="add" size={compact ? 16 : 19} color={palette.primary} />
        </Pressable>
      </View>

      {presets.length ? (
        <View style={styles.quickArea}>
          {!compact ? <Text style={styles.quickLabel}>Quick quantities</Text> : null}
          <ScrollView
            horizontal
            keyboardShouldPersistTaps="handled"
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.quickList}>
            {presets.map((quantity) => {
              const selected = Math.abs(value - quantity) < 0.0001;
              return (
                <Pressable
                  key={quantity}
                  accessibilityRole="button"
                  accessibilityLabel={t('Set quantity to {count}', { count: quantity })}
                  onPress={() => setNormalized(quantity)}
                  style={({ pressed }) => [
                    styles.quickBadge,
                    compact && styles.quickBadgeCompact,
                    selected && styles.quickBadgeSelected,
                    pressed && styles.pressed,
                  ]}>
                  {selected ? <Ionicons name="checkmark" size={11} color={palette.primaryForeground} /> : null}
                  <Text style={[styles.quickText, selected && styles.quickTextSelected]}>{quantity}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}

const createStyles = (palette: AppPalette, isRtl: boolean) => StyleSheet.create({
  wrap: { gap: 10 },
  wrapCompact: { gap: 7 },
  control: { height: 48, overflow: 'hidden', direction: 'ltr', flexDirection: 'row', borderRadius: radii.md, borderWidth: 1, borderColor: palette.primary, backgroundColor: palette.card },
  controlCompact: { width: 150, height: 38, borderRadius: 12 },
  button: { width: 48, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.primarySoft },
  buttonCompact: { width: 38 },
  input: { flex: 1, minWidth: 58, paddingHorizontal: 8, color: palette.text, backgroundColor: palette.input, fontSize: 16, fontWeight: '900', textAlign: 'center', writingDirection: 'ltr' },
  inputCompact: { minWidth: 54, fontSize: 13 },
  disabled: { opacity: 0.35 },
  pressed: { opacity: 0.68 },
  quickArea: { gap: 6 },
  quickLabel: { color: palette.muted, fontSize: 10, fontWeight: '800' },
  quickList: { flexDirection: isRtl ? 'row-reverse' : 'row', gap: 6 },
  quickBadge: { minWidth: 48, height: 31, paddingHorizontal: 11, borderRadius: radii.pill, flexDirection: isRtl ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'center', gap: 3, borderWidth: 1, borderColor: palette.primary, backgroundColor: palette.primarySoft },
  quickBadgeCompact: { minWidth: 40, height: 27, paddingHorizontal: 8 },
  quickBadgeSelected: { backgroundColor: palette.primary, borderColor: palette.primary },
  quickText: { color: palette.primary, fontSize: 11, fontWeight: '900', writingDirection: 'ltr' },
  quickTextSelected: { color: palette.primaryForeground },
});
