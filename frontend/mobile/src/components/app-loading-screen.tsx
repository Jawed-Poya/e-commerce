import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { radii, type AppPalette } from '@/constants/theme';
import { Text } from '@/components/app-text';
import { useCompany } from '@/providers/company-provider';
import { useThemedStyles } from '@/providers/theme-provider';

export function AppLoadingScreen({ label = 'Preparing your shopping experience' }: { label?: string }) {
  const { company } = useCompany();
  const { colors: palette, styles } = useThemedStyles(createStyles);
  const pulse = useRef(new Animated.Value(0.94)).current;
  const fade = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    const animation = Animated.loop(Animated.parallel([
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.04, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.94, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
      Animated.sequence([
        Animated.timing(fade, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(fade, { toValue: 0.45, duration: 700, useNativeDriver: true }),
      ]),
    ]));
    animation.start();
    return () => animation.stop();
  }, [fade, pulse]);

  return (
    <LinearGradient colors={[palette.darkSurface, palette.primaryDark, palette.primary]} style={styles.background}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          <Animated.View style={[styles.logoHalo, { opacity: fade, transform: [{ scale: pulse }] }]}>
            <View style={styles.logo}><Ionicons name="bag-handle" size={39} color={palette.white} /></View>
          </Animated.View>
          <Text numberOfLines={1} adjustsFontSizeToFit style={styles.company}>{company?.name ?? 'EasyCart'}<Text style={styles.dot}>.</Text></Text>
          <Text style={styles.tagline}>SHOP • ORDER • TRACK</Text>
        </View>

        <View style={styles.footer}>
          <View style={styles.progress}><Animated.View style={[styles.progressFill, { opacity: fade }]} /></View>
          <Text style={styles.loadingText}>{label}</Text>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const createStyles = (palette: AppPalette) => StyleSheet.create({
  background: { flex: 1 },
  safeArea: { flex: 1, paddingHorizontal: 28 },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  logoHalo: { width: 104, height: 104, borderRadius: 38, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,.18)' },
  logo: { width: 76, height: 76, borderRadius: 26, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,.13)' },
  company: { maxWidth: '90%', marginTop: 24, color: palette.white, fontSize: 34, fontWeight: '900', letterSpacing: -1.3 },
  dot: { color: palette.amber },
  tagline: { marginTop: 8, color: 'rgba(255,255,255,.62)', fontSize: 9, fontWeight: '900', letterSpacing: 2.4 },
  footer: { alignItems: 'center', paddingBottom: 34 },
  progress: { width: 96, height: 4, overflow: 'hidden', borderRadius: radii.pill, backgroundColor: 'rgba(255,255,255,.17)' },
  progressFill: { width: '62%', height: '100%', alignSelf: 'center', borderRadius: radii.pill, backgroundColor: palette.amber },
  loadingText: { marginTop: 12, color: 'rgba(255,255,255,.68)', fontSize: 10, fontWeight: '700' },
});
