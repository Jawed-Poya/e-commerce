import type Ionicons from '@expo/vector-icons/Ionicons';
import { HubConnectionBuilder, HubConnectionState, LogLevel } from '@microsoft/signalr';
import { useQuery } from '@tanstack/react-query';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { useRouter, type Href } from 'expo-router';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type PropsWithChildren,
} from 'react';
import { AppState, Linking, Platform } from 'react-native';

import { getApiOrigin } from '@/lib/runtime-config';
import { commerceApi } from '@/lib/commerce-api';
import {
  getStoredNotificationActivity,
  getStoredNotificationReads,
  getStoredTrackedProductIds,
  getOrCreatePushDeviceId,
  getToken,
  setStoredNotificationActivity,
  setStoredNotificationReads,
  setStoredTrackedProductIds,
} from '@/lib/storage';
import { useAuth } from '@/providers/auth-provider';
import { useCart } from '@/providers/cart-provider';
import { useI18n, type AppLocale } from '@/providers/i18n-provider';
import type { AccountOrder, OrderStatus, StoreNotification } from '@/types/domain';

type IoniconName = ComponentProps<typeof Ionicons>['name'];
export type NotificationTone = 'brand' | 'success' | 'warning' | 'danger';
export type RealtimeStatus = 'connecting' | 'live' | 'reconnecting' | 'polling';
export type NativeNotificationPermission = 'unsupported' | 'undetermined' | 'denied' | 'granted';
export type RemotePushStatus = 'unsupported' | 'unconfigured' | 'registering' | 'ready' | 'error';

export type AppNotification = {
  id: string;
  title: string;
  message: string;
  timestamp: string | null;
  icon: IoniconName;
  tone: NotificationTone;
  actionLabel: string;
  actionRequired?: boolean;
  destination: Href;
};

type NotificationContextValue = {
  notifications: AppNotification[];
  unreadCount: number;
  isLoading: boolean;
  isRefreshing: boolean;
  errorMessage: string | null;
  realtimeStatus: RealtimeStatus;
  nativePermission: NativeNotificationPermission;
  nativePermissionCanAskAgain: boolean;
  remotePushStatus: RemotePushStatus;
  liveNotification: AppNotification | null;
  isRead: (id: string) => boolean;
  markRead: (id: string) => void;
  markAllRead: () => void;
  dismissLiveNotification: () => void;
  trackProduct: (productId: number) => void;
  trackProducts: (productIds: number[]) => void;
  requestNativePermission: () => Promise<boolean>;
  refresh: () => Promise<void>;
};

const NotificationContext = createContext<NotificationContextValue | null>(null);
const readOwnerId = 'device';
const nativeNotificationChannelId = 'store-updates';
type Translate = (value: string, params?: Record<string, string | number>) => string;

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      priority: Notifications.AndroidNotificationPriority.HIGH,
    }),
  });
}

const orderCopy: Record<OrderStatus, {
  title: string;
  message: string;
  icon: IoniconName;
  tone: NotificationTone;
}> = {
  Pending: {
    title: 'Order received',
    message: 'We have received your order and will confirm it shortly.',
    icon: 'time-outline',
    tone: 'warning',
  },
  Confirmed: {
    title: 'Order confirmed',
    message: 'Your order has been confirmed and is moving to preparation.',
    icon: 'checkmark-circle-outline',
    tone: 'success',
  },
  Processing: {
    title: 'Order is being prepared',
    message: 'Your items are being prepared for delivery.',
    icon: 'cube-outline',
    tone: 'brand',
  },
  Delivered: {
    title: 'Order delivered',
    message: 'Your delivery is complete. Thank you for shopping with us.',
    icon: 'home-outline',
    tone: 'success',
  },
  Returned: {
    title: 'Return recorded',
    message: 'This order has been marked as returned. Open it for details.',
    icon: 'return-down-back-outline',
    tone: 'danger',
  },
  Cancelled: {
    title: 'Order cancelled',
    message: 'This order was cancelled. Open it to review the latest status.',
    icon: 'close-circle-outline',
    tone: 'danger',
  },
};

function notificationFromOrder(order: AccountOrder, t: Translate): AppNotification {
  const copy = orderCopy[order.status];
  const itemLabel = order.itemCount === 1 ? t('1 item') : t('{count} items', { count: order.itemCount });
  const payment = t(humanize(order.paymentStatus));

  return {
    id: `order:${order.id}:${order.status}:${order.paymentStatus}`,
    title: t(copy.title),
    message: `${order.orderNumber} · ${itemLabel}. ${t(copy.message)} ${t('Payment')} ${payment}.`,
    timestamp: order.createdAt,
    icon: copy.icon,
    tone: copy.tone,
    actionLabel: t(order.status === 'Delivered' ? 'View order' : 'Track order'),
    destination: {
      pathname: '/track',
      params: { orderNumber: order.orderNumber },
    },
  };
}

function notificationFromStore(item: StoreNotification, t: Translate, locale: AppLocale): AppNotification {
  const isStock = item.kind === 'Stock';
  const isCart = item.kind === 'Cart';

  return {
    id: `store:${item.id}`,
    title: locale === 'en' ? item.title : `${t(isStock ? 'Back in stock' : isCart ? 'Cart' : 'Price updated')}: ${item.productName}`,
    message: locale === 'en'
      ? item.message
      : t(isStock
          ? '{product} is available again. Order while stock lasts.'
          : '{product} has a new price. Open the product to see the latest price.', { product: item.productName }),
    timestamp: item.createdAt,
    icon: isStock ? 'cube-outline' : isCart ? 'bag-handle-outline' : 'pricetag-outline',
    tone: isStock ? 'success' : isCart ? 'brand' : 'warning',
    actionLabel: t(isCart ? 'Open cart' : 'View product'),
    destination: isCart
      ? '/cart'
      : { pathname: '/product/[id]', params: { id: String(item.productId) } },
  };
}

function humanize(value: string) {
  const words = value.replace(/([a-z])([A-Z])/g, '$1 $2');
  return `${words.charAt(0).toUpperCase()}${words.slice(1).toLowerCase()}`;
}

export function NotificationProvider({ children }: PropsWithChildren) {
  const router = useRouter();
  const auth = useAuth();
  const cart = useCart();
  const { locale, t } = useI18n();
  const [readIds, setReadIds] = useState<Set<string>>(() => new Set());
  const [readStateReady, setReadStateReady] = useState(false);
  const [trackedProductIds, setTrackedProductIds] = useState<number[]>([]);
  const [storeItems, setStoreItems] = useState<StoreNotification[]>([]);
  const [storeStateReady, setStoreStateReady] = useState(false);
  const [storeRefreshing, setStoreRefreshing] = useState(false);
  const [storeError, setStoreError] = useState<string | null>(null);
  const [realtimeStatus, setRealtimeStatus] = useState<RealtimeStatus>('connecting');
  const [nativePermission, setNativePermission] = useState<NativeNotificationPermission>(
    Platform.OS === 'web' ? 'unsupported' : 'undetermined',
  );
  const [nativePermissionCanAskAgain, setNativePermissionCanAskAgain] = useState(true);
  const [remotePushStatus, setRemotePushStatus] = useState<RemotePushStatus>(
    Platform.OS === 'web' ? 'unsupported' : 'unconfigured',
  );
  const [liveStoreItem, setLiveStoreItem] = useState<StoreNotification | null>(null);
  const lastStoreCheck = useRef(new Date().toISOString());
  const storePollActive = useRef(false);
  const storeItemsRef = useRef<StoreNotification[]>([]);
  const nativePermissionGrantedRef = useRef(false);
  const observedOrderNotificationIds = useRef(new Set<string>());
  const orderNotificationsReady = useRef(false);
  const orders = useQuery({
    queryKey: ['account-orders', 'notifications', auth.user?.customerId],
    queryFn: ({ signal }) => commerceApi.accountOrders(1, signal),
    enabled: Boolean(auth.user?.customerId),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const refreshNativePermission = useCallback(async () => {
    if (Platform.OS === 'web') return false;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(nativeNotificationChannelId, {
        name: t('Store updates'),
        description: t('Order progress, price changes, and stock alerts.'),
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 180, 120, 180],
        lightColor: '#0F766E',
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
        showBadge: true,
        sound: 'default',
      });
    }

    const permission = await Notifications.getPermissionsAsync();
    const status: NativeNotificationPermission = permission.granted
      ? 'granted'
      : permission.status === 'denied'
        ? 'denied'
        : 'undetermined';
    nativePermissionGrantedRef.current = permission.granted;
    setNativePermission(status);
    setNativePermissionCanAskAgain(permission.canAskAgain);
    return permission.granted;
  }, [t]);

  const presentNativeNotification = useCallback(async (item: AppNotification) => {
    if (Platform.OS === 'web' || !nativePermissionGrantedRef.current) return false;
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: item.title,
          body: item.message,
          sound: 'default',
          data: { destination: hrefToString(item.destination) },
        },
        trigger: Platform.OS === 'android' ? { channelId: nativeNotificationChannelId } : null,
      });
      return true;
    } catch {
      return false;
    }
  }, []);

  const requestNativePermission = useCallback(async () => {
    if (Platform.OS === 'web') return false;
    await refreshNativePermission();
    let permission = await Notifications.getPermissionsAsync();

    if (!permission.granted && permission.canAskAgain) {
      permission = await Notifications.requestPermissionsAsync({
        ios: { allowAlert: true, allowBadge: true, allowSound: true },
      });
    } else if (!permission.granted && !permission.canAskAgain) {
      await Linking.openSettings();
      return false;
    }

    nativePermissionGrantedRef.current = permission.granted;
    setNativePermission(permission.granted ? 'granted' : permission.status === 'denied' ? 'denied' : 'undetermined');
    setNativePermissionCanAskAgain(permission.canAskAgain);

    if (permission.granted) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: t('Device alerts enabled'),
          body: t('EasyCart can now show important updates in your notification panel.'),
          sound: 'default',
          data: { destination: '/notifications' },
        },
        trigger: Platform.OS === 'android' ? { channelId: nativeNotificationChannelId } : null,
      });
    }
    return permission.granted;
  }, [refreshNativePermission, t]);

  useEffect(() => {
    if (Platform.OS === 'web') return;

    void refreshNativePermission();
    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refreshNativePermission();
    });
    const openDestination = (response: Notifications.NotificationResponse | null) => {
      const destination = response?.notification.request.content.data?.destination;
      if (typeof destination !== 'string' || !destination.startsWith('/')) return;
      Notifications.clearLastNotificationResponse();
      router.push(destination as Href);
    };
    const responseSubscription = Notifications.addNotificationResponseReceivedListener(openDestination);
    openDestination(Notifications.getLastNotificationResponse());

    return () => {
      appStateSubscription.remove();
      responseSubscription.remove();
    };
  }, [refreshNativePermission, router]);

  useEffect(() => {
    let active = true;
    void getStoredNotificationReads(readOwnerId)
      .then((ids) => {
        if (active) setReadIds(new Set(ids));
      })
      .catch(() => {
        if (active) setReadIds(new Set());
      })
      .finally(() => {
        if (active) setReadStateReady(true);
      });

    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!readStateReady) return;
    void setStoredNotificationReads(readOwnerId, [...readIds]).catch(() => undefined);
  }, [readIds, readStateReady]);

  useEffect(() => {
    let active = true;
    void Promise.all([
      getStoredTrackedProductIds(),
      getStoredNotificationActivity<{ lastCheck: string; items: StoreNotification[] }>(),
    ]).then(([trackedIds, activity]) => {
      if (!active) return;
      setTrackedProductIds(trackedIds);
      if (activity?.items && Array.isArray(activity.items)) {
        const restoredItems = activity.items.slice(0, 30);
        storeItemsRef.current = restoredItems;
        setStoreItems(restoredItems);
      }
      if (activity?.lastCheck) lastStoreCheck.current = activity.lastCheck;
    }).catch(() => undefined).finally(() => {
      if (active) setStoreStateReady(true);
    });

    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!storeStateReady || !cart.hydrated) return;
    setTrackedProductIds((current) => mergeProductIds(current, cart.items.map((item) => item.id)));
  }, [cart.hydrated, cart.items, storeStateReady]);

  useEffect(() => {
    if (!storeStateReady) return;
    void setStoredTrackedProductIds(trackedProductIds).catch(() => undefined);
  }, [storeStateReady, trackedProductIds]);

  const trackedKey = trackedProductIds.join(',');
  useEffect(() => {
    if (Platform.OS === 'web' || nativePermission !== 'granted' || !storeStateReady) return;
    let active = true;
    const timer = setTimeout(() => {
      void (async () => {
        const projectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID?.trim()
          || Constants.expoConfig?.extra?.eas?.projectId
          || Constants.easConfig?.projectId;
        if (!projectId || Constants.appOwnership === 'expo') {
          if (active) setRemotePushStatus('unconfigured');
          return;
        }

        if (active) setRemotePushStatus('registering');
        try {
          const [token, deviceId] = await Promise.all([
            Notifications.getExpoPushTokenAsync({ projectId }).then((result) => result.data),
            getOrCreatePushDeviceId(),
          ]);
          await commerceApi.saveMobilePushSubscription({
            token,
            deviceId,
            platform: Platform.OS,
            locale,
            productIds: trackedProductIds,
          });
          if (active) setRemotePushStatus('ready');
        } catch {
          if (active) setRemotePushStatus('error');
        }
      })();
    }, 700);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [auth.user?.customerId, auth.user?.customerTypeId, locale, nativePermission, storeStateReady, trackedKey, trackedProductIds]);

  const trackProducts = useCallback((productIds: number[]) => {
    setTrackedProductIds((current) => mergeProductIds(current, productIds));
  }, []);
  const trackProduct = useCallback((productId: number) => trackProducts([productId]), [trackProducts]);

  const receiveStoreItems = useCallback((incoming: StoreNotification[], announce = true) => {
    const freshItems = incoming.filter((item) => !storeItemsRef.current.some((current) => current.id === item.id));
    if (!freshItems.length) return;
    const byId = new Map([...freshItems, ...storeItemsRef.current].map((item) => [item.id, item]));
    const nextItems = [...byId.values()]
      .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
      .slice(0, 30);
    storeItemsRef.current = nextItems;
    setStoreItems(nextItems);
    if (announce) {
      if (AppState.currentState === 'active') {
        setLiveStoreItem(freshItems[freshItems.length - 1]);
      } else {
        freshItems.forEach((item) => {
          void presentNativeNotification(notificationFromStore(item, t, locale));
        });
      }
    }
    void setStoredNotificationActivity({ lastCheck: lastStoreCheck.current, items: nextItems }).catch(() => undefined);
  }, [locale, presentNativeNotification, t]);

  useEffect(() => {
    const current = auth.user
      ? (orders.data?.items ?? []).map((order) => notificationFromOrder(order, t))
      : [];
    if (!orderNotificationsReady.current) {
      current.forEach((item) => observedOrderNotificationIds.current.add(item.id));
      orderNotificationsReady.current = true;
      return;
    }

    const fresh = current.filter((item) => !observedOrderNotificationIds.current.has(item.id));
    current.forEach((item) => observedOrderNotificationIds.current.add(item.id));
    if (AppState.currentState !== 'active') {
      fresh.forEach((item) => void presentNativeNotification(item));
    }
  }, [auth.user, orders.data?.items, presentNativeNotification, t]);

  const pollStore = useCallback(async () => {
    if (!storeStateReady || !trackedProductIds.length || storePollActive.current) return;
    storePollActive.current = true;
    setStoreRefreshing(true);

    try {
      const response = await commerceApi.storeNotifications(lastStoreCheck.current, trackedProductIds);
      lastStoreCheck.current = response.serverTime;
      receiveStoreItems(response.items);
      setStoreError(null);
      await setStoredNotificationActivity({ lastCheck: response.serverTime, items: storeItemsRef.current });
    } catch (error) {
      setStoreError(error instanceof Error ? error.message : 'Product updates could not be refreshed.');
    } finally {
      storePollActive.current = false;
      setStoreRefreshing(false);
    }
  }, [receiveStoreItems, storeStateReady, trackedProductIds]);

  useEffect(() => {
    if (!storeStateReady) return;
    void pollStore();
    const timer = setInterval(() => void pollStore(), 30_000);
    return () => clearInterval(timer);
  }, [pollStore, storeStateReady]);

  useEffect(() => {
    if (!storeStateReady || !trackedProductIds.length) {
      setRealtimeStatus('polling');
      return;
    }

    let disposed = false;
    const connection = new HubConnectionBuilder()
      .withUrl(`${getApiOrigin()}/hubs/store-notifications`, {
        accessTokenFactory: async () => (await getToken()) ?? '',
      })
      .withAutomaticReconnect([0, 2_000, 5_000, 10_000, 30_000])
      .configureLogging(LogLevel.Warning)
      .build();

    connection.on('storeNotification', (item: StoreNotification) => receiveStoreItems([item], true));
    connection.onreconnecting(() => setRealtimeStatus('reconnecting'));
    connection.onreconnected(async () => {
      if (connection.state === HubConnectionState.Connected) {
        await connection.invoke('Subscribe', trackedProductIds);
        setRealtimeStatus('live');
        await pollStore();
      }
    });
    connection.onclose(() => {
      if (!disposed) setRealtimeStatus('polling');
    });

    const connect = async () => {
      setRealtimeStatus('connecting');
      try {
        await connection.start();
        if (disposed) return;
        await connection.invoke('Subscribe', trackedProductIds);
        setRealtimeStatus('live');
        await pollStore();
      } catch {
        if (!disposed) setRealtimeStatus('polling');
      }
    };

    void connect();
    return () => {
      disposed = true;
      void connection.stop();
    };
    // The joined key intentionally rebuilds the exact product subscription.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.user?.customerTypeId, auth.user?.userId, pollStore, receiveStoreItems, storeStateReady, trackedKey]);

  const notifications = useMemo(() => {
    const items = storeItems.map((item) => notificationFromStore(item, t, locale));

    if (auth.user) items.push(...(orders.data?.items ?? []).map((order) => notificationFromOrder(order, t)));

    if (auth.user?.email && !auth.user.emailVerified) {
      items.unshift({
        id: `account:${auth.user.userId}:verify-email`,
        title: t('Verify your email'),
        message: t('Confirm {email} to protect your account and enable checkout.', { email: auth.user.email }),
        timestamp: null,
        icon: 'shield-checkmark-outline',
        tone: 'warning',
        actionLabel: t('Verify now'),
        actionRequired: true,
        destination: '/verify-email',
      });
    }

    return items.sort((left, right) => {
      if (left.actionRequired !== right.actionRequired) return left.actionRequired ? -1 : 1;
      return Date.parse(right.timestamp ?? '') - Date.parse(left.timestamp ?? '');
    });
  }, [auth.user, locale, orders.data?.items, storeItems, t]);

  const isRead = useCallback((id: string) => readStateReady && readIds.has(id), [readIds, readStateReady]);
  const markRead = useCallback((id: string) => {
    if (!readStateReady) return;
    setReadIds((current) => {
      if (current.has(id)) return current;
      return new Set([...current, id]);
    });
  }, [readStateReady]);
  const markAllRead = useCallback(() => {
    if (!readStateReady) return;
    setReadIds((current) => new Set([...current, ...notifications.map((item) => item.id)]));
  }, [notifications, readStateReady]);
  const unreadCount = readStateReady ? notifications.filter((item) => !readIds.has(item.id)).length : 0;

  useEffect(() => {
    if (Platform.OS === 'web' || !readStateReady || nativePermission !== 'granted') return;
    void Notifications.setBadgeCountAsync(unreadCount).catch(() => undefined);
  }, [nativePermission, readStateReady, unreadCount]);
  const refresh = useCallback(async () => {
    await Promise.all([
      auth.user?.customerId ? orders.refetch() : Promise.resolve(),
      pollStore(),
    ]);
  }, [auth.user?.customerId, orders, pollStore]);

  const value = useMemo<NotificationContextValue>(() => ({
    notifications,
    unreadCount,
    isLoading: auth.loading || !readStateReady || !storeStateReady || Boolean(auth.user && orders.isLoading),
    isRefreshing: orders.isRefetching || storeRefreshing,
    errorMessage: storeError ?? (orders.isError ? orders.error.message : null),
    realtimeStatus,
    nativePermission,
    nativePermissionCanAskAgain,
    remotePushStatus,
    liveNotification: liveStoreItem ? notificationFromStore(liveStoreItem, t, locale) : null,
    isRead,
    markRead,
    markAllRead,
    dismissLiveNotification: () => setLiveStoreItem(null),
    trackProduct,
    trackProducts,
    requestNativePermission,
    refresh,
  }), [auth.loading, auth.user, isRead, liveStoreItem, locale, markAllRead, markRead, nativePermission, nativePermissionCanAskAgain, notifications, orders.error, orders.isError, orders.isLoading, orders.isRefetching, readStateReady, realtimeStatus, refresh, remotePushStatus, requestNativePermission, storeError, storeRefreshing, storeStateReady, t, trackProduct, trackProducts, unreadCount]);

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) throw new Error('useNotifications must be used inside NotificationProvider.');
  return context;
}

function mergeProductIds(current: number[], incoming: number[]) {
  const next = [...new Set([...current, ...incoming].filter((id) => Number.isInteger(id) && id > 0))].slice(-100);
  return next.length === current.length && next.every((id, index) => id === current[index])
    ? current
    : next;
}

function hrefToString(destination: Href) {
  if (typeof destination === 'string') return destination;
  const href = destination as { pathname: string; params?: Record<string, string | number | undefined> };
  const params = new URLSearchParams();
  Object.entries(href.params ?? {}).forEach(([key, value]) => {
    if (value !== undefined) params.set(key, String(value));
  });
  const query = params.toString();
  return query ? `${href.pathname}?${query}` : href.pathname;
}
