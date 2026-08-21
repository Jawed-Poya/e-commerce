import { api } from '@/lib/api';
import type {
  AccountOrder,
  AuthResponse,
  AuthUser,
  CheckoutConfiguration,
  CompanyProfile,
  CreateOrderRequest,
  OrderConfirmation,
  OrderTracking,
  PagedResult,
  Product,
  ProductLookups,
  StoreNotificationsResponse,
  StorefrontContent,
  SyncedCart,
  SyncedCartItem,
} from '@/types/domain';

export const commerceApi = {
  products: (page: number, search: string, categoryId?: number, signal?: AbortSignal) =>
    api.get<PagedResult<Product>>('/products', {
      page,
      pageSize: 20,
      search: search.trim() || undefined,
      categoryId,
      isActive: true,
    }, signal),
  product: (id: number) => api.get<Product>(`/products/${id}`),
  lookups: () => api.get<ProductLookups>('/products/lookups'),
  company: () => api.get<CompanyProfile>('/company/public-profile'),
  storefrontContent: () => api.get<StorefrontContent>('/storefront/content'),
  cart: () => api.get<SyncedCart>('/account/cart'),
  updateCart: (request: { baseRevision: number | null; merge: boolean; items: SyncedCartItem[] }) =>
    api.put<SyncedCart>('/account/cart', request),
  login: (identifier: string, password: string) =>
    api.post<AuthResponse>('/auth/customer/login', { identifier, password }),
  register: (request: {
    firstName: string;
    lastName: string | null;
    phone: string;
    email: string | null;
    password: string;
  }) => api.post<AuthResponse>('/auth/customer/register', request),
  googleConfiguration: () => api.get<{ enabled: boolean; clientId: string | null }>('/auth/customer/google/config'),
  googleSignIn: (credential: string) => api.post<AuthResponse>('/auth/customer/google', { credential }),
  forgotPassword: (email: string) => api.post<Record<string, never>>('/auth/customer/forgot-password', { email }),
  resetPassword: (email: string, token: string, newPassword: string) =>
    api.post<Record<string, never>>('/auth/customer/reset-password', { email, token, newPassword }),
  currentUser: () => api.get<AuthUser>('/auth/me'),
  sendVerification: () =>
    api.post<{
      channel: 'Email';
      destination: string;
      expiresAt: string;
      alreadyVerified: boolean;
      developmentCode: string | null;
    }>('/auth/verification/send', { channel: 'Email' }),
  confirmVerification: (code: string) =>
    api.post<AuthUser>('/auth/verification/confirm', { channel: 'Email', code }),
  checkoutConfiguration: () =>
    api.get<CheckoutConfiguration>('/checkout/configuration'),
  createOrder: (request: CreateOrderRequest) =>
    api.post<OrderConfirmation>('/checkout/orders', request),
  accountOrders: (page: number, signal?: AbortSignal) =>
    api.get<PagedResult<AccountOrder>>('/account/orders', { page, pageSize: 12 }, signal),
  storeNotifications: (after: string, productIds: number[], signal?: AbortSignal) =>
    api.get<StoreNotificationsResponse>('/store/notifications', { after, productIds }, signal),
  saveMobilePushSubscription: (request: {
    token: string;
    deviceId: string;
    platform: string;
    locale: string;
    productIds: number[];
  }) => api.post<{ subscribed: boolean }>('/store/notifications/push/mobile/subscription', request),
  removeMobilePushSubscription: (token: string, deviceId: string) =>
    api.post<{ subscribed: boolean }>('/store/notifications/push/mobile/unsubscribe', { token, deviceId }),
  trackOrder: (orderNumber: string, phone?: string) =>
    api.get<OrderTracking>('/checkout/track', { orderNumber, phone }),
};
