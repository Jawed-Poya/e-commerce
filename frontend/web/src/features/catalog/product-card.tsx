import { ArrowUpRight, Check, Heart, ShoppingBag } from "lucide-react";
import { Link } from "react-router-dom";

import { imageUrl } from "../../shared/api/api-client";
import { Badge } from "../../shared/components/ui/badge";
import { Button } from "../../shared/components/ui/button";
import { cn } from "../../shared/lib/utils";
import type { Product } from "../../shared/types/product";
import { useCart } from "../cart/cart-context";

export function ProductCard({ product }: { product: Product }) {
    const cart = useCart();

    const liked = cart.wishlist.includes(product.id);

    const primary =
        imageUrl(product.primaryImageUrl) || "/placeholder-product.svg";

    const alternate = product.images.find(
        (image) => image.url !== product.primaryImageUrl,
    );

    const hasDiscount =
        product.oldPrice != null &&
        product.price != null &&
        product.oldPrice > product.price;

    const discount = hasDiscount
        ? Math.round(
              ((product.oldPrice! - product.price!) / product.oldPrice!) * 100,
          )
        : 0;

    const hasPrice = product.price != null;

    const addToCart = () => {
        if (product.price == null) return;
        cart.addItem({
            id: product.id,
            name: product.name,
            image: product.primaryImageUrl,
            price: product.price,
            stock: product.stock,
        });
    };

    return (
        <article className="group relative grid h-full min-w-0 grid-cols-[116px_minmax(0,1fr)] overflow-hidden rounded-[20px] border border-border/70 bg-card p-2 shadow-[0_5px_20px_rgba(15,23,42,0.05)] transition-all duration-300 active:scale-[0.99] dark:shadow-[0_8px_28px_rgba(0,0,0,0.22)] sm:flex sm:flex-col sm:p-0 sm:hover:-translate-y-1.5 sm:hover:border-primary/25 sm:hover:shadow-[0_24px_60px_rgba(15,23,42,0.12)] dark:sm:hover:shadow-[0_24px_60px_rgba(0,0,0,0.38)]">
            {/* Product image */}
            <div className="relative min-h-[152px] overflow-hidden rounded-2xl border border-border/40 bg-muted/40 sm:aspect-[1/1.04] sm:min-h-0 sm:rounded-none sm:border-0">
                <Link
                    to={`/products/${product.id}`}
                    className="absolute inset-0 z-10"
                    aria-label={`View ${product.name}`}
                />

                <img
                    src={primary}
                    alt={product.name}
                    className={cn(
                        "size-full object-cover transition-all duration-700 ease-out sm:group-hover:scale-[1.06]",
                        alternate && "sm:group-hover:opacity-0",
                    )}
                />

                {alternate && (
                    <img
                        src={imageUrl(alternate.url) ?? primary}
                        alt=""
                        className="absolute inset-0 hidden size-full scale-[1.04] object-cover opacity-0 transition-all duration-700 ease-out sm:block sm:group-hover:scale-100 sm:group-hover:opacity-100"
                    />
                )}

                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/45 via-transparent to-transparent opacity-0 transition-opacity duration-300 sm:group-hover:opacity-100" />

                {/* Badges */}
                <div className="absolute left-2 top-2 z-20 flex max-w-[72%] flex-wrap gap-1.5 sm:left-3 sm:top-3 sm:gap-2">
                    {hasDiscount && (
                        <Badge className="h-6 rounded-lg border-0 bg-brand-orange px-2 text-[9px] font-black text-white shadow-md sm:h-auto sm:px-2.5 sm:py-1 sm:text-[10px]">
                            -{discount}%
                        </Badge>
                    )}

                    {product.isFeatured && (
                        <Badge className="hidden rounded-lg border border-white/20 bg-primary/95 px-2.5 py-1 text-[10px] font-bold text-primary-foreground shadow-md backdrop-blur sm:inline-flex">
                            Featured
                        </Badge>
                    )}

                    {product.stock < 1 && (
                        <Badge className="rounded-lg border border-white/15 bg-slate-950/80 px-2 py-1 text-[9px] font-bold text-white shadow-md backdrop-blur sm:px-2.5 sm:text-[10px]">
                            Sold out
                        </Badge>
                    )}
                </div>

                {/* Wishlist */}
                <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => cart.toggleWishlist(product.id)}
                    className={cn(
                        "absolute right-2 top-2 z-30 size-8 rounded-full border-white/60 bg-background/90 text-muted-foreground shadow-md backdrop-blur transition-all hover:bg-background hover:text-brand-orange sm:right-3 sm:top-3 sm:size-10 sm:hover:scale-110",
                        liked &&
                            "border-brand-orange bg-brand-orange text-white hover:border-brand-orange hover:bg-brand-orange/90 hover:text-white",
                    )}
                    aria-label={liked ? "Remove from wishlist" : "Save product"}
                >
                    <Heart
                        className={cn(
                            "size-3.5 sm:size-4",
                            liked && "fill-current",
                        )}
                    />
                </Button>

                {/* Desktop quick view */}
                <Link
                    to={`/products/${product.id}`}
                    className="absolute inset-x-3 bottom-3 z-30 hidden translate-y-4 items-center justify-between rounded-xl border border-white/50 bg-background/95 px-4 py-3 text-xs font-bold opacity-0 shadow-xl backdrop-blur-md transition-all duration-300 sm:flex sm:group-hover:translate-y-0 sm:group-hover:opacity-100"
                >
                    View product
                    <span className="grid size-7 place-items-center rounded-lg bg-primary/10 text-primary">
                        <ArrowUpRight className="size-4" />
                    </span>
                </Link>
            </div>

            {/* Product content */}
            <div className="flex min-w-0 flex-1 flex-col px-3 py-1.5 sm:p-5">
                <div className="flex items-start justify-between gap-2">
                    <p className="min-w-0 truncate text-[9px] font-bold uppercase tracking-[0.14em] text-primary sm:text-[10px] sm:tracking-[0.16em]">
                        {product.categoryName}
                    </p>

                    <span
                        className={cn(
                            "flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-semibold sm:hidden",
                            product.stock > 0
                                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                : "bg-destructive/10 text-destructive",
                        )}
                    >
                        {product.stock > 0 && <Check className="size-3" />}

                        {product.stock > 0 ? "In stock" : "Unavailable"}
                    </span>
                </div>

                <Link
                    to={`/products/${product.id}`}
                    className="mt-1.5 line-clamp-2 text-sm font-bold leading-5 tracking-[-0.015em] transition-colors hover:text-primary sm:mt-3 sm:min-h-12 sm:text-[15px] sm:leading-6"
                >
                    {product.name}
                </Link>

                <div className="mt-2 hidden items-center justify-between sm:flex">
                    <span
                        className={cn(
                            "flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold",
                            product.stock > 0
                                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                : "bg-destructive/10 text-destructive",
                        )}
                    >
                        {product.stock > 0 && <Check className="size-3" />}

                        {product.stock > 0
                            ? `${product.stock} in stock`
                            : "Unavailable"}
                    </span>
                </div>

                <div className="mt-auto pt-3 sm:pt-5">
                    <div className="mb-3 flex items-end justify-between gap-2 sm:mb-4">
                        <div className="min-w-0">
                            <p className="text-lg font-black tracking-[-0.035em] text-foreground sm:text-2xl">
                                {hasPrice
                                    ? `$${product.price!.toFixed(2)}`
                                    : "Price unavailable"}
                            </p>
                            {hasPrice && (
                                <p className="mt-1 truncate text-[9px] font-semibold text-muted-foreground sm:text-[10px]">
                                    {product.isDefaultPrice
                                        ? `${product.priceCustomerTypeName ?? "General"} default price`
                                        : `${product.priceCustomerTypeName ?? "Customer"} price`}
                                </p>
                            )}

                            {hasDiscount && (
                                <div className="mt-0.5 flex items-center gap-1.5">
                                    <p className="text-[10px] font-medium text-muted-foreground line-through decoration-destructive/70 sm:text-xs">
                                        ${product.oldPrice!.toFixed(2)}
                                    </p>

                                    <span className="hidden rounded-full bg-brand-orange/10 px-2 py-0.5 text-[10px] font-bold text-brand-orange sm:inline">
                                        Save {discount}%
                                    </span>
                                </div>
                            )}
                        </div>

                        {product.stock > 0 && (
                            <div className="hidden text-right sm:block">
                                <span className="block text-xs font-black text-foreground">
                                    {product.stock}
                                </span>

                                <span className="text-[10px] text-muted-foreground">
                                    available
                                </span>
                            </div>
                        )}
                    </div>

                    <div className="flex gap-2">
                        <Button
                            type="button"
                            className="h-9 flex-1 rounded-xl px-3 text-xs font-bold shadow-sm transition-all hover:shadow-md active:scale-[0.97] sm:h-11 sm:text-sm"
                            disabled={product.stock < 1 || !hasPrice}
                            onClick={addToCart}
                        >
                            <ShoppingBag className="size-3.5 sm:size-4" />

                            <span className="sm:hidden">
                                {product.stock < 1
                                    ? "Sold out"
                                    : hasPrice
                                      ? "Add"
                                      : "No price"}
                            </span>

                            <span className="hidden sm:inline">
                                {product.stock < 1
                                    ? "Out of stock"
                                    : hasPrice
                                      ? "Add to cart"
                                      : "Price unavailable"}
                            </span>
                        </Button>

                        <Button
                            asChild
                            type="button"
                            variant="outline"
                            size="icon"
                            className="size-9 shrink-0 rounded-xl bg-background shadow-sm sm:hidden"
                        >
                            <Link
                                to={`/products/${product.id}`}
                                aria-label={`View ${product.name}`}
                            >
                                <ArrowUpRight className="size-4" />
                            </Link>
                        </Button>
                    </div>
                </div>
            </div>
        </article>
    );
}
