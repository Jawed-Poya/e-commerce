import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandMark, PrimaryButton } from '@/components/ui';
import { Text } from '@/components/app-text';
import { radii, shadow, spacing, type AppPalette } from '@/constants/theme';
import { setOnboardingComplete } from '@/lib/storage';
import { useCompany } from '@/providers/company-provider';
import { useThemedStyles } from '@/providers/theme-provider';

export default function WelcomeScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { company } = useCompany();
  const { colors: palette, styles, isRtl } = useThemedStyles(createStyles);
  const compact = width < 360;

  const continueTo = async (destination: '/shop' | '/auth') => {
    await setOnboardingComplete();
    router.replace(destination);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.shell}>
          <LinearGradient colors={[palette.darkSurface, palette.primaryDark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.hero, compact && styles.heroCompact]}>
            <View style={styles.glowOne} />
            <View style={styles.glowTwo} />
            <View style={styles.brandRow}>
              <BrandMark />
              <View style={styles.brandTextWrap}>
                <Text numberOfLines={1} style={styles.brandName}>{company?.name ?? 'EasyCart'}<Text style={styles.brandDot}>.</Text></Text>
                <Text numberOfLines={1} style={styles.brandSub}>Your trusted mobile store</Text>
              </View>
            </View>

            <View style={styles.heroCopy}>
              <View style={styles.eyebrowPill}><Ionicons name="sparkles" size={13} color={palette.amber} /><Text style={styles.eyebrow}>WELCOME TO SMARTER SHOPPING</Text></View>
              <Text style={[styles.title, compact && styles.titleCompact]}>Everything you need,{`\n`}delivered with confidence.</Text>
              <Text style={styles.description}>Browse live products, order securely, and follow every delivery—all from one beautifully simple app.</Text>
            </View>

            <View style={styles.previewCard}>
              <View style={styles.previewImage}><Ionicons name="bag-check" size={32} color={palette.primary} /></View>
              <View style={styles.previewBody}><Text style={styles.previewLabel}>READY WHEN YOU ARE</Text><Text style={styles.previewTitle}>Fast, secure checkout</Text><Text style={styles.previewText}>Live prices and stock from the EasyCart API.</Text></View>
              <View style={styles.previewAction}><Ionicons name={isRtl ? 'arrow-back' : 'arrow-forward'} size={18} color={palette.primaryForeground} /></View>
            </View>
          </LinearGradient>

          <View style={styles.benefits}>
            <Benefit icon="flash-outline" title="Quick ordering" text="Find products and add them to your cart in seconds." />
            <Benefit icon="shield-checkmark-outline" title="Secure account" text="Protected sign-in, verification, and private order history." />
            <Benefit icon="navigate-outline" title="Order tracking" text="Know when your order is confirmed, processed, and delivered." />
          </View>

          <View style={styles.actions}>
            <PrimaryButton title="Start shopping" icon={isRtl ? 'arrow-back' : 'arrow-forward'} onPress={() => void continueTo('/shop')} />
            <Pressable accessibilityRole="button" onPress={() => void continueTo('/auth')} style={({ pressed }) => [styles.signIn, pressed && styles.pressed]}>
              <Text style={styles.signInText}>I already have an account</Text><Ionicons name="log-in-outline" size={17} color={palette.primary} />
            </Pressable>
            <Text style={styles.terms}>By continuing, you agree to shop responsibly and provide accurate delivery information.</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Benefit({ icon, title, text }: { icon: keyof typeof Ionicons.glyphMap; title: string; text: string }) {
  const { colors: palette, styles } = useThemedStyles(createStyles);
  return <View style={styles.benefit}><View style={styles.benefitIcon}><Ionicons name={icon} size={22} color={palette.primary} /></View><View style={styles.benefitCopy}><Text style={styles.benefitTitle}>{title}</Text><Text style={styles.benefitText}>{text}</Text></View></View>;
}

const createStyles = (palette: AppPalette, isRtl: boolean) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: palette.background },
  scroll: { flexGrow: 1, padding: spacing.lg, paddingBottom: 28 },
  shell: { width: '100%', maxWidth: 620, alignSelf: 'center' },
  hero: { minHeight: 470, padding: spacing.xxl, overflow: 'hidden', borderRadius: 34 },
  heroCompact: { minHeight: 440, padding: spacing.xl },
  glowOne: { position: 'absolute', width: 260, height: 260, borderRadius: 150, end: -110, top: -90, backgroundColor: palette.amber, opacity: 0.12 },
  glowTwo: { position: 'absolute', width: 190, height: 190, borderRadius: 100, start: -105, bottom: 5, backgroundColor: 'rgba(255,255,255,.05)' },
  brandRow: { flexDirection: isRtl ? 'row-reverse' : 'row', alignItems: 'center', gap: 11 },
  brandTextWrap: { flex: 1, minWidth: 0 },
  brandName: { color: palette.white, fontSize: 18, fontWeight: '900', letterSpacing: -0.4 },
  brandDot: { color: palette.amber },
  brandSub: { marginTop: 2, color: 'rgba(255,255,255,.55)', fontSize: 9, fontWeight: '600' },
  heroCopy: { marginTop: 48 },
  eyebrowPill: { alignSelf: isRtl ? 'flex-end' : 'flex-start', flexDirection: isRtl ? 'row-reverse' : 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 7, borderRadius: radii.pill, backgroundColor: palette.amberSoft },
  eyebrow: { color: palette.amber, fontSize: 8, fontWeight: '900', letterSpacing: 1.2 },
  title: { marginTop: 15, color: palette.white, fontSize: 32, lineHeight: 38, fontWeight: '900', letterSpacing: -1.25 },
  titleCompact: { fontSize: 28, lineHeight: 34 },
  description: { marginTop: 13, maxWidth: 420, color: 'rgba(255,255,255,.7)', fontSize: 13, lineHeight: 21 },
  previewCard: { marginTop: 29, padding: 12, flexDirection: isRtl ? 'row-reverse' : 'row', alignItems: 'center', gap: 11, borderRadius: 20, backgroundColor: 'rgba(255,255,255,.96)' },
  previewImage: { width: 54, height: 54, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.primarySoft },
  previewBody: { flex: 1, minWidth: 0 },
  previewLabel: { color: palette.primary, fontSize: 7, fontWeight: '900', letterSpacing: 1 },
  previewTitle: { marginTop: 3, color: palette.text, fontSize: 13, fontWeight: '900' },
  previewText: { marginTop: 3, color: palette.muted, fontSize: 9, lineHeight: 13 },
  previewAction: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.primary },
  benefits: { marginTop: -18, marginHorizontal: 10, padding: spacing.lg, gap: 4, borderRadius: radii.xl, backgroundColor: palette.card, borderWidth: 1, borderColor: palette.border, ...shadow },
  benefit: { paddingVertical: 11, flexDirection: isRtl ? 'row-reverse' : 'row', alignItems: 'center', gap: 12 },
  benefitIcon: { width: 44, height: 44, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.primarySoft },
  benefitCopy: { flex: 1, minWidth: 0 },
  benefitTitle: { color: palette.text, fontSize: 13, fontWeight: '900' },
  benefitText: { marginTop: 3, color: palette.muted, fontSize: 10, lineHeight: 16 },
  actions: { marginTop: 18, gap: 10 },
  signIn: { minHeight: 48, flexDirection: isRtl ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  signInText: { color: palette.primary, fontSize: 12, fontWeight: '900' },
  terms: { marginTop: 1, paddingHorizontal: 18, color: palette.muted, textAlign: 'center', fontSize: 8, lineHeight: 13 },
  pressed: { opacity: 0.7 },
});
