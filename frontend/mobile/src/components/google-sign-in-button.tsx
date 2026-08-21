import Ionicons from '@expo/vector-icons/Ionicons';
import { ResponseType, makeRedirectUri } from 'expo-auth-session';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { radii, type AppPalette } from '@/constants/theme';
import { Text } from '@/components/app-text';
import { commerceApi } from '@/lib/commerce-api';
import { useI18n } from '@/providers/i18n-provider';
import { useThemedStyles } from '@/providers/theme-provider';

WebBrowser.maybeCompleteAuthSession();

export function GoogleSignInButton({ busy, onCredential, onError }: { busy?: boolean; onCredential: (credential: string) => void; onError: (message: string) => void }) {
  const { colors: palette, styles } = useThemedStyles(createStyles);
  const configuration = useQuery({
    queryKey: ['auth', 'google-configuration'],
    queryFn: commerceApi.googleConfiguration,
    staleTime: 10 * 60_000,
    retry: 1,
  });
  const clientId = configuration.data?.enabled ? configuration.data.clientId?.trim() : '';

  if (!clientId) {
    return (
      <View style={[styles.button, styles.buttonDisabled]}>
        {configuration.isLoading ? <ActivityIndicator size="small" color={palette.muted} /> : <GoogleMark />}
        <Text style={styles.disabledText}>{configuration.isLoading ? 'Loading Google sign-in…' : 'Google sign-in unavailable'}</Text>
      </View>
    );
  }

  return <GooglePrompt clientId={clientId} busy={busy} onCredential={onCredential} onError={onError} />;
}

function GooglePrompt({ clientId, busy, onCredential, onError }: { clientId: string; busy?: boolean; onCredential: (credential: string) => void; onError: (message: string) => void }) {
  const { t } = useI18n();
  const { colors: palette, styles } = useThemedStyles(createStyles);
  const handledCredential = useRef('');
  const redirectUri = makeRedirectUri({ scheme: 'easycart', path: 'oauthredirect' });
  const [request, response, promptAsync] = Google.useAuthRequest({
    clientId,
    redirectUri,
    responseType: ResponseType.IdToken,
    usePKCE: false,
    selectAccount: true,
    scopes: ['openid', 'profile', 'email'],
  });

  useEffect(() => {
    if (!response) return;
    if (response.type === 'success') {
      const credential = response.params.id_token || response.authentication?.idToken || '';
      if (credential && credential !== handledCredential.current) {
        handledCredential.current = credential;
        onCredential(credential);
      } else if (!credential) {
        onError('Google did not return a valid identity token. Try again.');
      }
    } else if (response.type === 'error') {
      onError(response.error?.description || 'Google sign-in could not be completed.');
    }
  }, [onCredential, onError, response]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('Continue with Google')}
      disabled={!request || busy}
      onPress={() => void promptAsync().catch(() => onError('Google sign-in could not be opened.'))}
      style={({ pressed }) => [styles.button, (!request || busy) && styles.buttonDisabled, pressed && styles.pressed]}>
      {busy ? <ActivityIndicator size="small" color={palette.text} /> : <GoogleMark />}
      <Text style={styles.buttonText}>{busy ? 'Connecting to Google…' : 'Continue with Google'}</Text>
      <Ionicons name="open-outline" size={15} color={palette.muted} />
    </Pressable>
  );
}

function GoogleMark() {
  const { styles } = useThemedStyles(createStyles);
  return <View style={styles.googleMark}><Text style={styles.googleLetter}>G</Text></View>;
}

const createStyles = (palette: AppPalette, isRtl: boolean) => StyleSheet.create({
  button: { minHeight: 50, paddingHorizontal: 15, borderRadius: radii.md, flexDirection: isRtl ? 'row-reverse' : 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: palette.card, borderWidth: 1, borderColor: palette.border },
  buttonDisabled: { opacity: 0.62, backgroundColor: palette.input },
  buttonText: { flex: 1, color: palette.text, textAlign: 'center', fontSize: 12, fontWeight: '900' },
  disabledText: { color: palette.muted, fontSize: 11, fontWeight: '800' },
  googleMark: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.white, borderWidth: 1, borderColor: '#DADCE0' },
  googleLetter: { color: '#4285F4', fontSize: 14, fontWeight: '900' },
  pressed: { opacity: 0.72, transform: [{ scale: 0.99 }] },
});
