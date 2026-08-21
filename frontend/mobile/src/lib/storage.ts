import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const tokenKey = 'easycart-customer-token';
const sessionKey = 'easycart-customer-session';
const notificationReadsPrefix = 'easycart-mobile-notification-reads';

export const storageKeys = {
  cart: 'easycart-mobile-cart',
  recentOrder: 'easycart-mobile-recent-order',
  onboardingComplete: 'easycart-mobile-onboarding-complete',
  trackedProducts: 'easycart-mobile-tracked-products',
  notificationActivity: 'easycart-mobile-notification-activity',
  catalogCache: 'easycart-mobile-catalog-cache-v1',
  productLookupsCache: 'easycart-mobile-product-lookups-cache-v1',
  companyCache: 'easycart-mobile-company-cache-v1',
  storefrontContentCache: 'easycart-mobile-storefront-content-cache-v1',
  pushDeviceId: 'easycart-mobile-push-device-id-v1',
} as const;

export async function getStoredJson<T>(key: string) {
  const value = await AsyncStorage.getItem(key);
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

export async function setStoredJson(key: string, value: unknown) {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

export async function getOnboardingComplete() {
  return (await AsyncStorage.getItem(storageKeys.onboardingComplete)) === 'true';
}

export async function setOnboardingComplete() {
  await AsyncStorage.setItem(storageKeys.onboardingComplete, 'true');
}

export async function getStoredNotificationReads(ownerId: string) {
  const value = await AsyncStorage.getItem(`${notificationReadsPrefix}:${ownerId}`);
  if (!value) return [];

  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string')
      : [];
  } catch {
    return [];
  }
}

export async function setStoredNotificationReads(ownerId: string, ids: string[]) {
  await AsyncStorage.setItem(
    `${notificationReadsPrefix}:${ownerId}`,
    JSON.stringify(ids.slice(-100)),
  );
}

export async function getStoredTrackedProductIds() {
  const value = await AsyncStorage.getItem(storageKeys.trackedProducts);
  if (!value) return [];

  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((item): item is number => Number.isInteger(item) && item > 0).slice(-100)
      : [];
  } catch {
    return [];
  }
}

export async function setStoredTrackedProductIds(ids: number[]) {
  await AsyncStorage.setItem(
    storageKeys.trackedProducts,
    JSON.stringify([...new Set(ids.filter((id) => Number.isInteger(id) && id > 0))].slice(-100)),
  );
}

export async function getStoredNotificationActivity<T>() {
  const value = await AsyncStorage.getItem(storageKeys.notificationActivity);
  if (!value) return null;

  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

export async function setStoredNotificationActivity(value: unknown) {
  await AsyncStorage.setItem(storageKeys.notificationActivity, JSON.stringify(value));
}

export async function getOrCreatePushDeviceId() {
  const existing = await AsyncStorage.getItem(storageKeys.pushDeviceId);
  if (existing) return existing;
  const created = Crypto.randomUUID();
  await AsyncStorage.setItem(storageKeys.pushDeviceId, created);
  return created;
}

export async function getToken() {
  return Platform.OS === 'web'
    ? AsyncStorage.getItem(tokenKey)
    : SecureStore.getItemAsync(tokenKey);
}

export async function setToken(token: string) {
  if (Platform.OS === 'web') return AsyncStorage.setItem(tokenKey, token);
  return SecureStore.setItemAsync(tokenKey, token);
}

export async function clearToken() {
  if (Platform.OS === 'web') return AsyncStorage.removeItem(tokenKey);
  return SecureStore.deleteItemAsync(tokenKey);
}

export async function getStoredSession<T>() {
  const value = await AsyncStorage.getItem(sessionKey);
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

export async function setStoredSession(value: unknown) {
  await AsyncStorage.setItem(sessionKey, JSON.stringify(value));
}

export async function clearStoredSession() {
  await AsyncStorage.removeItem(sessionKey);
}

export async function clearServerScopedStorage() {
  await Promise.all([
    clearToken(),
    AsyncStorage.multiRemove([
      sessionKey,
      storageKeys.cart,
      storageKeys.recentOrder,
      storageKeys.trackedProducts,
      storageKeys.notificationActivity,
      storageKeys.catalogCache,
      storageKeys.productLookupsCache,
      storageKeys.companyCache,
      storageKeys.storefrontContentCache,
    ]),
  ]);
}
