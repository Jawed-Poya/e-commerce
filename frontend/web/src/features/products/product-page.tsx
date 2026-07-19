import {
    ChevronLeft,
    ChevronRight,
    Heart,
    PackageCheck,
    ShoppingBag,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";

import { apiGet, imageUrl } from "../../shared/api/api-client";
import { Badge } from "../../shared/components/ui/badge";
import { Button } from "../../shared/components/ui/button";
import { Skeleton } from "../../shared/components/ui/skeleton";
import { cn } from "../../shared/lib/utils";
import type { ProductDetails } from "../../shared/types/product";
import { useCart } from "../cart/cart-context";

export function ProductPage() {
    const { id } = useParams();

    const q = useQuery({
        queryKey: ["product", id],
        queryFn: () => apiGet<ProductDetails>(`/products/${id}`),
        enabled: Boolean(id),
    });

    const [selected, setSelected] = useState<number | null>(null);
    const cart = useCart();

    if (q.isLoading) {
        return (
            <div className="mx-auto w-full max-w-[1500px] px-4 py-6 sm:px-6 sm:py-10 lg:px-8">
                <div className="grid gap-7 lg:grid-cols-2 lg:gap-14">
                    <div>
                        <Skeleton className="aspect-square rounded-3xl" />

                        <div className="mt-3 flex gap-3 overflow-hidden">
                            {Array.from({ length: 4 }).map((_, index) => (
                                <Skeleton
                                    key={index}
                                    className="size-20 shrink-0 rounded-xl sm:size-24"
                                />
                            ))}
                        </div>
                    </div>

                    <div className="space-y-5 py-2">
                        <Skeleton className="h-6 w-32 rounded-full" />
                        <Skeleton className="h-14 w-4/5 rounded-xl" />
                        <Skeleton className="h-20 w-full rounded-xl" />
                        <Skeleton className="h-12 w-40 rounded-xl" />
                        <Skeleton className="h-20 w-full rounded-2xl" />
                        <Skeleton className="h-12 w-full rounded-xl" />
                    </div>
                </div>
            </div>
        );
    }

    if (!q.data) {
        return (
            <div className="mx-auto grid min-h-[65vh] max-w-xl place-items-center px-4 py-20 text-center">
                <div>
                    <span className="mx-auto grid size-16 place-items-center rounded-3xl border bg-muted text-muted-foreground">
                        <ShoppingBag className="size-7" />
                    </span>

                    <h1 className="mt-6 text-3xl font-black tracking-tight">
                        Product not found
                    </h1>

                    <p className="mt-3 text-sm leading-6 text-muted-foreground">
                        This product may have been removed or is no longer
                        available.
                    </p>

                    <Button asChild className="mt-7 rounded-xl">
                        <Link to="/products">
                            <ChevronLeft className="size-4" />
                            Back to shop
                        </Link>
                    </Button>
                </div>
            </div>
        );
    }

    const p = q.data;

    const price =
        p.prices.find((x) => x.salePrice)?.salePrice ??
        p.prices[0]?.regularPrice ??
        0;

    const stock = p.inventory?.availableQuantity ?? 0;

    const active =
        p.images.find((x) => x.id === selected) ??
        p.images.find((x) => x.isPrimary) ??
        p.images[0];

    const liked = cart.wishlist.includes(p.id);

    const addToCart = () =>
        cart.addItem({
            id: p.id,
            name: p.name,
            image: active?.url,
            price,
            stock,
        });

    return (
        <>
            <div className="mx-auto w-full max-w-[1500px] px-4 pb-28 pt-5 sm:px-6 sm:pb-14 sm:pt-8 lg:px-8 lg:pt-10">
                <nav className="mb-5 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground sm:mb-8">
                    <Link
                        to="/products"
                        className="mr-1 grid size-8 shrink-0 place-items-center rounded-full border bg-background transition-colors hover:border-primary/30 hover:text-primary sm:hidden"
                        aria-label="Back to products"
                    >
                        <ChevronLeft className="size-4" />
                    </Link>

                    <Link
                        to="/"
                        className="hidden transition-colors hover:text-primary sm:inline"
                    >
                        Home
                    </Link>

                    <ChevronRight className="hidden size-3.5 opacity-50 sm:block" />

                    <Link
                        to="/products"
                        className="transition-colors hover:text-primary"
                    >
                        Products
                    </Link>

                    <ChevronRight className="size-3.5 shrink-0 opacity-50" />

                    <span className="truncate font-medium text-foreground">
                        {p.name}
                    </span>
                </nav>

                <div className="grid items-start gap-7 lg:grid-cols-[1.05fr_.95fr] lg:gap-14 xl:gap-20">
                    {/* Product gallery */}
                    <section className="min-w-0 lg:sticky lg:top-32">
                        <div className="relative aspect-square overflow-hidden rounded-3xl border bg-gradient-to-b from-muted/40 to-muted shadow-[0_20px_60px_-35px_rgba(15,23,42,0.35)]">
                            <img
                                className="size-full object-contain p-3 transition-all duration-500 sm:p-6 lg:p-8"
                                src={
                                    imageUrl(active?.url) ||
                                    "/placeholder-product.svg"
                                }
                                alt={p.name}
                            />

                            <div className="absolute left-3 top-3 flex flex-wrap gap-2 sm:left-5 sm:top-5">
                                {p.isFeatured && (
                                    <Badge className="rounded-full border border-white/20 bg-primary/95 px-3 py-1 text-[10px] font-bold text-primary-foreground shadow-md backdrop-blur">
                                        Featured
                                    </Badge>
                                )}

                                <Badge
                                    className={cn(
                                        "rounded-full border px-3 py-1 text-[10px] font-bold shadow-md backdrop-blur",
                                        stock > 0
                                            ? "border-emerald-500/20 bg-emerald-500/90 text-white"
                                            : "border-white/20 bg-slate-950/80 text-white",
                                    )}
                                >
                                    {stock > 0 ? "In stock" : "Unavailable"}
                                </Badge>
                            </div>

                            <Button
                                size="icon"
                                variant="outline"
                                onClick={() => cart.toggleWishlist(p.id)}
                                className={cn(
                                    "absolute right-3 top-3 size-10 rounded-full border-white/60 bg-background/90 text-muted-foreground shadow-lg backdrop-blur transition-all hover:scale-105 hover:text-brand-orange sm:right-5 sm:top-5 sm:size-11",
                                    liked &&
                                        "border-brand-orange bg-brand-orange text-white hover:bg-brand-orange/90 hover:text-white",
                                )}
                                aria-label={
                                    liked
                                        ? "Remove from wishlist"
                                        : "Add to wishlist"
                                }
                            >
                                <Heart
                                    className={cn(
                                        "size-4.5",
                                        liked && "fill-current",
                                    )}
                                />
                            </Button>
                        </div>

                        {p.images.length > 1 && (
                            <div className="mt-3 flex snap-x gap-2.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mt-4 sm:gap-3">
                                {p.images.map((image) => (
                                    <button
                                        key={image.id}
                                        type="button"
                                        onClick={() => setSelected(image.id)}
                                        className={cn(
                                            "relative aspect-square size-[72px] shrink-0 snap-start overflow-hidden rounded-xl border-2 bg-muted transition-all sm:size-24 sm:rounded-2xl",
                                            active?.id === image.id
                                                ? "border-primary shadow-md shadow-primary/15"
                                                : "border-transparent opacity-70 hover:border-border hover:opacity-100",
                                        )}
                                    >
                                        <img
                                            className="size-full object-cover"
                                            src={imageUrl(image.url) ?? ""}
                                            alt=""
                                        />

                                        {active?.id === image.id && (
                                            <span className="absolute inset-x-3 bottom-1.5 h-0.5 rounded-full bg-primary" />
                                        )}
                                    </button>
                                ))}
                            </div>
                        )}
                    </section>

                    {/* Product details */}
                    <section className="min-w-0 py-1">
                        <div className="flex flex-wrap items-center gap-2">
                            <Badge
                                className="rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em]"
                            >
                                {p.categoryName}
                            </Badge>

                            {p.isFeatured && (
                                <Badge className="rounded-full bg-brand-orange px-3 py-1 text-[10px] font-bold text-white">
                                    Featured product
                                </Badge>
                            )}
                        </div>

                        <h1 className="mt-4 text-3xl font-black leading-tight tracking-[-0.04em] sm:mt-5 sm:text-4xl lg:text-5xl">
                            {p.name}
                        </h1>

                        <p className="mt-4 text-sm leading-7 text-muted-foreground sm:mt-5 sm:text-base sm:leading-8">
                            {p.shortDescription ||
                                "A carefully selected product with transparent pricing and live availability."}
                        </p>

                        <div className="mt-6 flex items-end justify-between gap-4 border-y py-5">
                            <div>
                                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                                    Current price
                                </p>

                                <p className="mt-1 text-3xl font-black tracking-[-0.04em] text-primary sm:text-4xl">
                                    ${price.toFixed(2)}
                                </p>
                            </div>

                            <div className="text-right">
                                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                                    Availability
                                </p>

                                <p
                                    className={cn(
                                        "mt-1 text-sm font-bold",
                                        stock > 0
                                            ? "text-emerald-600 dark:text-emerald-400"
                                            : "text-destructive",
                                    )}
                                >
                                    {stock > 0
                                        ? `${stock} available`
                                        : "Sold out"}
                                </p>
                            </div>
                        </div>

                        <div
                            className={cn(
                                "mt-5 flex items-start gap-3 rounded-2xl border p-4 sm:p-5",
                                stock > 0
                                    ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300"
                                    : "border-destructive/20 bg-destructive/5 text-destructive",
                            )}
                        >
                            <span
                                className={cn(
                                    "grid size-10 shrink-0 place-items-center rounded-xl",
                                    stock > 0
                                        ? "bg-emerald-500/10"
                                        : "bg-destructive/10",
                                )}
                            >
                                <PackageCheck className="size-5" />
                            </span>

                            <div>
                                <b className="block text-sm">
                                    {stock > 0
                                        ? "In stock and ready to order"
                                        : "Currently unavailable"}
                                </b>

                                <small className="mt-1 block leading-5 opacity-80">
                                    {stock > 0
                                        ? `${stock} items are currently available for purchase.`
                                        : "This product cannot be ordered right now. Check back soon."}
                                </small>
                            </div>
                        </div>

                        <div className="mt-6 hidden gap-3 sm:flex">
                            <Button
                                size="lg"
                                className="h-12 flex-1 rounded-xl font-bold shadow-md shadow-primary/15"
                                disabled={stock < 1}
                                onClick={addToCart}
                            >
                                <ShoppingBag className="size-4.5" />
                                Add to cart
                            </Button>

                            <Button
                                size="lg"
                                variant="outline"
                                className={cn(
                                    "h-12 rounded-xl px-5",
                                    liked &&
                                        "border-brand-orange bg-brand-orange/5 text-brand-orange",
                                )}
                                onClick={() => cart.toggleWishlist(p.id)}
                            >
                                <Heart
                                    className={cn(
                                        "size-4.5",
                                        liked && "fill-current",
                                    )}
                                />

                                <span className="hidden md:inline">
                                    {liked ? "Saved" : "Wishlist"}
                                </span>
                            </Button>
                        </div>

                        <div className="mt-8 border-t pt-7">
                            <div>
                                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">
                                    Details
                                </p>

                                <h2 className="mt-2 text-xl font-black">
                                    Product information
                                </h2>
                            </div>

                            {p.description && (
                                <p className="mt-4 whitespace-pre-line text-sm leading-7 text-muted-foreground">
                                    {p.description}
                                </p>
                            )}

                            <dl className="mt-6 overflow-hidden rounded-2xl border bg-card">
                                {[
                                    ["Category", p.categoryName],
                                    ["Brand", p.brandName],
                                    ["Unit", p.unitName],
                                    ["Barcode", p.barcode],
                                ]
                                    .filter((item) => item[1])
                                    .map((item, index, values) => (
                                        <div
                                            key={item[0]}
                                            className={cn(
                                                "flex items-center justify-between gap-6 px-4 py-3.5 text-sm sm:px-5",
                                                index !== values.length - 1 &&
                                                    "border-b",
                                            )}
                                        >
                                            <dt className="text-muted-foreground">
                                                {item[0]}
                                            </dt>

                                            <dd className="max-w-[60%] text-right font-semibold">
                                                {item[1]}
                                            </dd>
                                        </div>
                                    ))}
                            </dl>
                        </div>
                    </section>
                </div>
            </div>

            {/* Mobile app purchase bar */}
            <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 px-4 py-3 shadow-[0_-10px_35px_rgba(15,23,42,0.08)] backdrop-blur-xl sm:hidden">
                <div className="mx-auto flex max-w-lg items-center gap-3">
                    <div className="min-w-0">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                            Total price
                        </p>

                        <p className="text-xl font-black tracking-tight text-primary">
                            ${price.toFixed(2)}
                        </p>
                    </div>

                    <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => cart.toggleWishlist(p.id)}
                        className={cn(
                            "ml-auto size-11 shrink-0 rounded-xl",
                            liked &&
                                "border-brand-orange bg-brand-orange/5 text-brand-orange",
                        )}
                        aria-label={
                            liked ? "Remove from wishlist" : "Add to wishlist"
                        }
                    >
                        <Heart
                            className={cn("size-4.5", liked && "fill-current")}
                        />
                    </Button>

                    <Button
                        type="button"
                        className="h-11 min-w-36 rounded-xl px-5 font-bold shadow-md shadow-primary/15"
                        disabled={stock < 1}
                        onClick={addToCart}
                    >
                        <ShoppingBag className="size-4" />
                        Add to cart
                    </Button>
                </div>
            </div>
        </>
    );
}
