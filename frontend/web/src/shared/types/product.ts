export type ProductImage = {
  id: number;
  url: string;
  isPrimary: boolean;
  sortOrder: number;
  originalFileName?: string | null;
  contentType?: string;
  size?: number;
};
export type Product = {
  id: number;
  name: string;
  barcode: string | null;
  shortDescription: string | null;
  description: string | null;
  slug: string | null;
  categoryId: number;
  categoryName: string;
  brandId: number | null;
  unitId: number | null;
  minimumValue: number | null;
  maximumValue: number | null;
  isFeatured: boolean;
  isActive: boolean;
  stock: number;
  price: number | null;
  oldPrice: number | null;
  primaryImageUrl: string | null;
  images: ProductImage[];
};
export type ProductDetails = Omit<
  Product,
  "stock" | "price" | "primaryImageUrl"
> & {
  brandName: string | null;
  unitName: string | null;
  viewCount: number;
  createdAt: string;
  updatedAt: string | null;
  inventory: {
    quantity: number;
    reservedQuantity: number;
    availableQuantity: number;
    minimumQuantity: number;
    expireDate: string | null;
  } | null;
  prices: {
    id: number;
    customerTypeId: number;
    customerTypeName: string;
    regularPrice: number;
    salePrice: number | null;
    startDate: string | null;
    endDate: string | null;
  }[];
};
export type PagedProducts = {
  items: Product[];
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
export type Lookups = {
  categories: CategoryLookup[];
  brands: { id: number; name: string }[];
  units: { id: number; name: string }[];
  customerTypes: { id: number; name: string }[];
  minimumPrice: number;
  maximumPrice: number;
};
