import { apiDelete, apiGet, apiPost } from "../../shared/api/api-client";

export interface ProductReview {
    id: number;
    productId: number;
    customerName: string;
    rating: number;
    comment: string | null;
    isApproved: boolean;
    isVerifiedPurchase: boolean;
    isOwn: boolean;
    createdAt: string;
    updatedAt: string | null;
}

export interface ProductReviewSummary {
    averageRating: number;
    reviewCount: number;
    distribution: Record<string, number>;
    myReview: ProductReview | null;
    items: ProductReview[];
}

export const reviewApi = {
    get: (productId: number) =>
        apiGet<ProductReviewSummary>(`/products/${productId}/reviews`),
    save: (productId: number, rating: number, comment: string) =>
        apiPost<ProductReview>(`/products/${productId}/reviews`, {
            rating,
            comment: comment.trim() || null,
        }),
    removeMine: (productId: number) =>
        apiDelete<object>(`/products/${productId}/reviews/mine`),
};
