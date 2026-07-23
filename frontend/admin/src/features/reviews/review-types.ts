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
