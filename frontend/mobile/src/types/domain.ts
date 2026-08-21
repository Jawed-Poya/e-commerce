export type ProductImage = {
  id: number;
  url: string;
  isPrimary: boolean;
  sortOrder: number;
};

export type Product = {
  id: number;
  name: string;
  barcode: string | null;
  strength: string | null;
  genericName: string | null;
  formula: string | null;
  shortDescription: string | null;
  description: string | null;
  slug: string | null;
  categoryId: number;
  categoryName: string;
  brandId: number | null;
  unitId: number | null;
  unitName: string | null;
  minimumValue: number | null;
  maximumValue: number | null;
  orderQuantityStep: number;
  quickOrderQuantities: number[];
  usesDisplayStock: boolean;
  displayStockQuantity: number | null;
  isFeatured: boolean;
  isActive: boolean;
  stock: number;
  inventoryStock: number;
  price: number | null;
  oldPrice: number | null;
  priceCustomerTypeName: string | null;
  isDefaultPrice: boolean;
  viewCount: number;
  averageRating: number;
  reviewCount: number;
  primaryImageUrl: string | null;
  images: ProductImage[];
};

export type PagedResult<T> = {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
};

export type CategoryLookup = {
  id: number;
  name: string;
  parentId: number | null;
  productCount: number;
  imageUrl: string | null;
};

export type ProductLookups = {
  categories: CategoryLookup[];
  brands: { id: number; name: string }[];
  units: { id: number; name: string }[];
  customerTypes: { id: number; name: string }[];
  defaultCustomerTypeId: number;
  minimumPrice: number;
  maximumPrice: number;
};

export type AuthUser = {
  userId: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  roles: string[];
  permissions: string[];
  customerId: number | null;
  customerTypeId: number | null;
  customerTypeName: string | null;
  isAdmin: boolean;
  branchId: number | null;
  emailVerified: boolean;
  phoneVerified?: boolean;
  canPlaceOrders: boolean;
  hasPassword: boolean;
};

export type AuthResponse = {
  token: string;
  expiresAt: string;
  user: AuthUser;
};

export type SyncedCartItem = {
  productId: number;
  name: string;
  image: string | null;
  price: number;
  stock: number;
  unitId: number | null;
  unitName: string | null;
  quantityStep: number;
  quickOrderQuantities: number[];
  quantity: number;
};

export type SyncedCart = {
  revision: number;
  updatedAt: string | null;
  items: SyncedCartItem[];
};

export type LocalizedHeroContent = {
  eyebrow: string;
  title: string;
  description: string;
  primaryButtonText: string;
  secondaryButtonText: string;
};

export type StorefrontContent = {
  heroImageUrl: string | null;
  primaryButtonUrl: string;
  secondaryButtonUrl: string;
  shippingEnabled: boolean;
  flatShippingFee: number;
  freeShippingThreshold: number;
  en: LocalizedHeroContent;
  ps: LocalizedHeroContent;
  dr: LocalizedHeroContent;
  updatedAt: string | null;
};

export type PaymentMethod = 'CashOnDelivery' | 'BankTransfer';
export type OrderStatus =
  | 'Pending'
  | 'Confirmed'
  | 'Processing'
  | 'Delivered'
  | 'Returned'
  | 'Cancelled';

export type PaymentStatus =
  | 'Pending'
  | 'Authorized'
  | 'Paid'
  | 'PartiallyRefunded'
  | 'Refunded'
  | 'Failed'
  | 'Cancelled';

export type BankDetails = {
  bankName: string;
  accountName: string;
  accountNumber: string;
  iban: string | null;
  instructions: string;
};

export type CheckoutConfiguration = {
  currency: string;
  shippingEnabled: boolean;
  flatShippingFee: number;
  freeShippingThreshold: number;
  paymentMethods: {
    method: PaymentMethod;
    name: string;
    description: string;
    requiresReference: boolean;
    bankDetails: BankDetails | null;
  }[];
};

export type CreateOrderRequest = {
  customer: {
    firstName: string;
    lastName: string | null;
    phone: string;
    email: string | null;
  };
  shippingAddress: {
    label: string;
    recipientName: string;
    phone: string;
    addressLine1: string;
    addressLine2: string | null;
    city: string;
    state: string | null;
    country: string;
    postalCode: string | null;
  };
  paymentMethod: PaymentMethod;
  bankTransferReference: string | null;
  notes: string | null;
  items: { productId: number; quantity: number; unitId: number | null }[];
};

export type OrderConfirmation = {
  id: number;
  orderNumber: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  subtotal: number;
  shippingTotal: number;
  total: number;
  currency: string;
  createdAt: string;
  reservationExpiresAt: string | null;
  bankDetails: BankDetails | null;
};

export type AccountOrder = {
  id: number;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  total: number;
  currency: string;
  itemCount: number;
  createdAt: string;
};

export type StoreNotification = {
  id: number;
  title: string;
  message: string;
  kind: 'Price' | 'Stock' | 'Cart';
  productId: number;
  productName: string;
  link: string;
  createdAt: string;
};

export type StoreNotificationsResponse = {
  serverTime: string;
  items: StoreNotification[];
};

export type OrderTimelineItem = {
  id: number;
  fromStatus: OrderStatus;
  toStatus: OrderStatus;
  note: string | null;
  changedByUserId: string | null;
  createdAt: string;
};

export type OrderTracking = {
  orderNumber: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  fulfillmentStatus:
    | 'Unfulfilled'
    | 'Processing'
    | 'PartiallyFulfilled'
    | 'Fulfilled'
    | 'Returned'
    | 'Cancelled';
  total: number;
  currency: string;
  createdAt: string;
  updatedAt: string | null;
  timeline: OrderTimelineItem[];
};

export type CompanyProfile = {
  id: number;
  name: string;
  legalName: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  logoUrl: string | null;
  settings: {
    mainCurrencyCode: string;
    currencySymbol: string;
    currencyPosition: 'before' | 'after';
    currencyDecimalPlaces: number;
    storefrontPrimaryColor: string;
    storefrontSecondaryColor: string;
    defaultQuickOrderQuantities: number[];
  };
};
