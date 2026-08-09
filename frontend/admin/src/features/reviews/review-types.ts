export interface AdminProductReview {
    id: number;
    productId: number;
    productName: string;
    customerId: number;
    customerName: string;
    rating: number;
    comment: string | null;
    isApproved: boolean;
    isVerifiedPurchase: boolean;
    createdAt: string;
    updatedAt: string | null;
}

export interface PagedResult<T> {
    items: T[];
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
    hasPreviousPage: boolean;
    hasNextPage: boolean;
}
