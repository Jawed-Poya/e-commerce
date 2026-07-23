import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, LoaderCircle, MessageSquare, Star, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { useI18n } from "../../i18n/i18n-provider";
import { Button } from "../../shared/components/ui/button";
import { cn } from "../../shared/lib/utils";
import { useAuth } from "../auth/auth-context";
import { reviewApi } from "./review-api";

export function ProductReviews({ productId }: { productId: number }) {
    const { language, t } = useI18n();
    const auth = useAuth();
    const queryClient = useQueryClient();
    const [rating, setRating] = useState(5);
    const [comment, setComment] = useState("");
    const [message, setMessage] = useState<string | null>(null);

    const reviews = useQuery({
        queryKey: ["product-reviews", productId, auth.user?.userId],
        queryFn: () => reviewApi.get(productId),
    });

    useEffect(() => {
        if (!reviews.data?.myReview) return;
        setRating(reviews.data.myReview.rating);
        setComment(reviews.data.myReview.comment ?? "");
    }, [reviews.data?.myReview]);

    const save = useMutation({
        mutationFn: () => reviewApi.save(productId, rating, comment),
        onSuccess: async () => {
            setMessage(t("reviews.pending"));
            await queryClient.invalidateQueries({ queryKey: ["product-reviews", productId] });
        },
        onError: (error) => setMessage(error instanceof Error ? error.message : "Review could not be saved."),
    });

    const remove = useMutation({
        mutationFn: () => reviewApi.removeMine(productId),
        onSuccess: async () => {
            setRating(5);
            setComment("");
            setMessage(null);
            await queryClient.invalidateQueries({ queryKey: ["product-reviews", productId] });
        },
    });

    const data = reviews.data;
    const locale = language === "en" ? "en-US" : "fa-AF";

    return (
        <section className="mx-auto w-full max-w-[1500px] px-4 pb-20 sm:px-6 lg:px-8">
            <div className="rounded-[26px] border bg-card p-5 shadow-sm sm:p-8 lg:p-10">
                <div className="grid gap-8 lg:grid-cols-[0.38fr_0.62fr]">
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-primary">{t("reviews.title")}</p>
                        <div className="mt-4 flex items-end gap-3">
                            <strong className="text-5xl font-black tracking-tight">{data?.averageRating.toFixed(1) ?? "0.0"}</strong>
                            <div className="pb-1">
                                <Stars value={Math.round(data?.averageRating ?? 0)} />
                                <p className="mt-1 text-xs text-muted-foreground">{t("reviews.summary", { count: data?.reviewCount ?? 0 })}</p>
                            </div>
                        </div>
                        <div className="mt-6 space-y-2">
                            {[5, 4, 3, 2, 1].map((value) => {
                                const count = data?.distribution[String(value)] ?? 0;
                                const percentage = data?.reviewCount ? (count / data.reviewCount) * 100 : 0;
                                return (
                                    <div key={value} className="grid grid-cols-[2rem_1fr_2rem] items-center gap-2 text-xs">
                                        <span>{value}★</span>
                                        <span className="h-2 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full bg-amber-400" style={{ width: `${percentage}%` }} /></span>
                                        <span className="text-end text-muted-foreground">{count}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="rounded-2xl border bg-muted/20 p-4 sm:p-6">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <h3 className="font-black">{data?.myReview ? t("reviews.edit") : t("reviews.write")}</h3>
                                {data?.myReview && !data.myReview.isApproved && <p className="mt-1 text-xs text-amber-600">{t("reviews.pending")}</p>}
                            </div>
                            {data?.myReview && (
                                <Button variant="ghost" size="icon" className="text-destructive" disabled={remove.isPending} onClick={() => remove.mutate()} aria-label={t("reviews.delete")}>
                                    {remove.isPending ? <LoaderCircle className="animate-spin" /> : <Trash2 />}
                                </Button>
                            )}
                        </div>

                        {!auth.isAuthenticated ? (
                            <div className="mt-5 rounded-xl border border-dashed bg-background p-5 text-sm text-muted-foreground">
                                {t("reviews.login")} <Link to="/account/login" className="font-bold text-primary underline">{t("common.login")}</Link>
                            </div>
                        ) : (
                            <div className="mt-5 space-y-4">
                                <div>
                                    <label className="text-sm font-bold">{t("reviews.rating")}</label>
                                    <div className="mt-2 flex gap-1" role="radiogroup" aria-label={t("reviews.rating")}>
                                        {[1, 2, 3, 4, 5].map((value) => (
                                            <button key={value} type="button" role="radio" aria-checked={rating === value} onClick={() => setRating(value)} className="rounded-lg p-1.5 transition hover:bg-amber-500/10 focus-visible:ring-2 focus-visible:ring-ring">
                                                <Star className={cn("size-7 text-amber-400", value <= rating && "fill-amber-400")} />
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <label className="text-sm font-bold" htmlFor="review-comment">{t("reviews.comment")}</label>
                                    <textarea id="review-comment" rows={5} maxLength={2000} value={comment} onChange={(event) => setComment(event.target.value)} placeholder={t("reviews.commentPlaceholder")} className="mt-2 w-full rounded-xl border bg-background p-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10" />
                                </div>
                                {message && <p className="text-xs text-muted-foreground">{message}</p>}
                                <Button onClick={() => save.mutate()} disabled={save.isPending} className="rounded-xl">
                                    {save.isPending && <LoaderCircle className="animate-spin" />}
                                    {data?.myReview ? t("reviews.update") : t("reviews.submit")}
                                </Button>
                            </div>
                        )}
                    </div>
                </div>

                <div className="mt-10 border-t pt-8">
                    {!data?.items.length ? (
                        <div className="py-8 text-center text-sm text-muted-foreground">
                            <MessageSquare className="mx-auto mb-3 size-8" />
                            {t("reviews.empty")}
                        </div>
                    ) : (
                        <div className="grid gap-4 lg:grid-cols-2">
                            {data.items.map((review) => (
                                <article key={review.id} className="rounded-2xl border p-5">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <p className="font-bold">{review.customerName}</p>
                                            <div className="mt-1 flex flex-wrap items-center gap-2">
                                                <Stars value={review.rating} small />
                                                {review.isVerifiedPurchase && (
                                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600"><BadgeCheck className="size-3.5" />{t("reviews.verified")}</span>
                                                )}
                                            </div>
                                        </div>
                                        <time className="text-[10px] text-muted-foreground">{new Date(review.createdAt).toLocaleDateString(locale)}</time>
                                    </div>
                                    {review.comment && <p className="mt-4 whitespace-pre-line text-sm leading-7 text-muted-foreground">{review.comment}</p>}
                                </article>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </section>
    );
}

function Stars({ value, small = false }: { value: number; small?: boolean }) {
    return <div className="flex gap-0.5" aria-label={`${value} out of 5 stars`}>{[1, 2, 3, 4, 5].map((star) => <Star key={star} className={cn(small ? "size-3.5" : "size-4", "text-amber-400", star <= value && "fill-amber-400")} />)}</div>;
}
