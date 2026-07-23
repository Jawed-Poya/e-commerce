import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    BadgeCheck,
    Check,
    ExternalLink,
    LoaderCircle,
    MessageSquareText,
    ShieldCheck,
    Star,
    Trash2,
    X,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

import { ConfirmActionDialog } from "@/components/confirm-action-dialog";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { reviewService } from "@/features/reviews/review-service";
import type { AdminProductReview } from "@/features/reviews/review-types";

const filters = [
    { label: "Pending", value: false as boolean | undefined },
    { label: "Approved", value: true as boolean | undefined },
    { label: "All", value: undefined },
];

export default function ReviewsPage() {
    const queryClient = useQueryClient();
    const [approved, setApproved] = useState<boolean | undefined>(false);

    const reviews = useQuery({
        queryKey: ["admin-reviews", approved],
        queryFn: () => reviewService.list(approved),
    });

    const approval = useMutation({
        mutationFn: ({ id, value }: { id: number; value: boolean }) =>
            reviewService.setApproval(id, value),
        onSuccess: async (_, variables) => {
            toast.success(variables.value ? "Review approved." : "Review hidden.");
            await queryClient.invalidateQueries({ queryKey: ["admin-reviews"] });
        },
        onError: (error) => toast.error(errorMessage(error)),
    });

    const remove = useMutation({
        mutationFn: reviewService.remove,
        onSuccess: async () => {
            toast.success("Review deleted.");
            await queryClient.invalidateQueries({ queryKey: ["admin-reviews"] });
        },
        onError: (error) => toast.error(errorMessage(error)),
    });

    return (
        <div className="space-y-5">
            <PageHeader
                title="Product reviews"
                description="Moderate customer ratings before they appear on the public storefront."
                actions={
                    <div className="flex rounded-xl border bg-muted/30 p-1">
                        {filters.map((filter) => (
                            <Button
                                key={filter.label}
                                type="button"
                                size="sm"
                                variant={approved === filter.value ? "default" : "ghost"}
                                className="rounded-lg"
                                onClick={() => setApproved(filter.value)}
                            >
                                {filter.label}
                            </Button>
                        ))}
                    </div>
                }
            />

            <Card className="border-primary/20 bg-primary/5">
                <CardContent className="flex gap-3 p-5">
                    <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" />
                    <div>
                        <p className="font-semibold">Reviews require approval</p>
                        <p className="mt-1 text-sm leading-6 text-muted-foreground">
                            New and edited reviews stay private until approved. Verified purchase badges are calculated from completed customer orders.
                        </p>
                    </div>
                </CardContent>
            </Card>

            {reviews.isLoading && (
                <div className="grid gap-4 xl:grid-cols-2">
                    {Array.from({ length: 4 }).map((_, index) => (
                        <Skeleton key={index} className="h-64 rounded-2xl" />
                    ))}
                </div>
            )}

            {reviews.isError && (
                <Card className="border-destructive/30 bg-destructive/5">
                    <CardContent className="p-8 text-center text-sm text-destructive">
                        Reviews could not be loaded. Check the API and try again.
                    </CardContent>
                </Card>
            )}

            {!reviews.isLoading && !reviews.isError && !reviews.data?.length && (
                <Card>
                    <CardContent className="px-6 py-16 text-center">
                        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-muted text-muted-foreground">
                            <MessageSquareText className="size-6" />
                        </span>
                        <h2 className="mt-4 text-lg font-black">No reviews in this view</h2>
                        <p className="mt-2 text-sm text-muted-foreground">
                            Customer reviews will appear here when they are submitted.
                        </p>
                    </CardContent>
                </Card>
            )}

            <div className="grid gap-4 xl:grid-cols-2">
                {reviews.data?.map((review) => (
                    <ReviewCard
                        key={review.id}
                        review={review}
                        approvalPending={approval.isPending && approval.variables?.id === review.id}
                        deletePending={remove.isPending && remove.variables === review.id}
                        onApproval={(value) => approval.mutate({ id: review.id, value })}
                        onDelete={async () => {
                            await remove.mutateAsync(review.id);
                        }}
                    />
                ))}
            </div>
        </div>
    );
}

function ReviewCard({
    review,
    approvalPending,
    deletePending,
    onApproval,
    onDelete,
}: {
    review: AdminProductReview;
    approvalPending: boolean;
    deletePending: boolean;
    onApproval: (value: boolean) => void;
    onDelete: () => Promise<void>;
}) {
    return (
        <Card className="overflow-hidden">
            <CardContent className="space-y-5 p-5">
                <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <Badge variant={review.isApproved ? "default" : "secondary"}>
                                {review.isApproved ? "Approved" : "Pending"}
                            </Badge>
                            {review.isVerifiedPurchase && (
                                <Badge variant="outline" className="gap-1 text-emerald-600">
                                    <BadgeCheck className="size-3" /> Verified purchase
                                </Badge>
                            )}
                        </div>
                        <Link
                            to={`/products/${review.productId}`}
                            className="mt-3 inline-flex max-w-full items-center gap-1.5 truncate text-base font-black hover:text-primary"
                        >
                            {review.productName}
                            <ExternalLink className="size-3.5 shrink-0" />
                        </Link>
                        <p className="mt-1 text-xs text-muted-foreground">
                            {review.customerName} · {new Date(review.createdAt).toLocaleString()}
                        </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1 rounded-xl bg-amber-500/10 px-3 py-2 font-black text-amber-600">
                        <Star className="size-4 fill-current" /> {review.rating}/5
                    </div>
                </div>

                <div className="flex gap-1" aria-label={`${review.rating} out of 5 stars`}>
                    {Array.from({ length: 5 }).map((_, index) => (
                        <Star
                            key={index}
                            className={cn(
                                "size-4",
                                index < review.rating
                                    ? "fill-amber-400 text-amber-400"
                                    : "text-muted-foreground/25",
                            )}
                        />
                    ))}
                </div>

                <p className="min-h-16 whitespace-pre-line rounded-xl border bg-muted/20 p-4 text-sm leading-6 text-muted-foreground">
                    {review.comment || "No written comment was provided."}
                </p>

                <div className="flex flex-wrap gap-2 border-t pt-4">
                    {!review.isApproved ? (
                        <Button
                            onClick={() => onApproval(true)}
                            disabled={approvalPending}
                        >
                            {approvalPending ? <LoaderCircle className="animate-spin" /> : <Check />}
                            Approve
                        </Button>
                    ) : (
                        <Button
                            variant="outline"
                            onClick={() => onApproval(false)}
                            disabled={approvalPending}
                        >
                            {approvalPending ? <LoaderCircle className="animate-spin" /> : <X />}
                            Hide from storefront
                        </Button>
                    )}
                    <ConfirmActionDialog
                        trigger={
                            <Button variant="outline" className="ms-auto text-destructive">
                                <Trash2 /> Delete
                            </Button>
                        }
                        title="Delete this review?"
                        description="This permanently removes the customer review from moderation and the storefront."
                        confirmLabel="Delete review"
                        destructive
                        pending={deletePending}
                        onConfirm={onDelete}
                    />
                </div>
            </CardContent>
        </Card>
    );
}

function errorMessage(error: unknown) {
    if (typeof error === "object" && error && "message" in error)
        return String(error.message);
    return "The review operation failed.";
}
