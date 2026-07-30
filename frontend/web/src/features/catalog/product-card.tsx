import {
    ArrowUpRight,
    Check,
    Heart,
    PackageCheck,
    ShoppingBag,
    Star,
} from "lucide-react";
import { Link } from "react-router-dom";

import { useI18n } from "../../i18n/i18n-provider";
import { imageUrl } from "../../shared/api/api-client";
import { Badge } from "../../shared/components/ui/badge";
import { Button } from "../../shared/components/ui/button";
import { formatMoney } from "../../shared/lib/money";
import { productPath } from "../../shared/lib/product-path";
import { cn } from "../../shared/lib/utils";
import type { Product } from "../../shared/types/product";
import { useCart } from "../cart/cart-context";

export function ProductCard({ product }: { product: Product }) {
    const cart = useCart();
    const { t } = useI18n();
    const liked = cart.wishlist.includes(product.id);
    const primary = imageUrl(product.primaryImageUrl) || "/placeholder-product.svg";
    const hasPrice = product.price != null;
    const hasDiscount =
        product.oldPrice != null &&
        product.price != null &&
        product.oldPrice > product.price;
    const discount = hasDiscount
        ? Math.round(((product.oldPrice! - product.price!) / product.oldPrice!) * 100)
        : 0;

    const addToCart = () => {
        if (product.price == null) return;

        cart.addItem({
            id: product.id,
            name: product.name,
            image: product.primaryImageUrl,
            price: product.price,
            stock: product.stock,
            unitId: product.unitId,
            unitName: product.unitName,
            conversionFactor: 1,
            slug: product.slug,
            minimumValue: product.minimumValue,
            maximumValue: product.maximumValue,
        });
    };

    return (
        <article className="group flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border border-border/75 bg-card transition duration-300 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-[0_18px_45px_-28px_rgba(15,23,42,.35)] dark:border-white/10">
            <div className="relative aspect-[4/3] overflow-hidden border-b border-border/70 bg-muted/25 dark:border-white/10">
                <Link
                    viewTransition
                    to={productPath(product)}
                    className="absolute inset-0 z-10"
                    aria-label={`View ${product.name}`}
                />

                <img
                    src={primary}
                    alt={product.name}
                    loading="lazy"
                    decoding="async"
                    className="size-full object-contain p-5 transition duration-500 ease-out group-hover:scale-[1.04] sm:p-7"
                />

                <div className="absolute start-3 top-3 z-20 flex flex-wrap gap-1.5">
                    {hasDiscount ? (
                        <Badge className="rounded-md border-0 bg-brand-orange px-2 py-1 text-[10px] font-black text-white shadow-sm">
                            -{discount}%
                        </Badge>
                    ) : null}
                    {product.isFeatured ? (
                        <Badge className="rounded-md border border-border/70 bg-background/90 px-2 py-1 text-[10px] font-bold text-foreground shadow-sm backdrop-blur">
                            {t("product.featured")}
                        </Badge>
                    ) : null}
                </div>

                <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => cart.toggleWishlist(product.id)}
                    className={cn(
                        "absolute end-3 top-3 z-30 size-9 rounded-full border-border/70 bg-background/90 text-muted-foreground shadow-sm backdrop-blur transition hover:border-brand-orange/30 hover:text-brand-orange",
                        liked &&
                            "border-brand-orange bg-brand-orange text-white hover:bg-brand-orange/90 hover:text-white",
                    )}
                    aria-label={liked ? t("wishlist.remove") : t("wishlist.add")}
                >
                    <Heart className={cn("size-4", liked && "fill-current")} />
                </Button>

                <Link
                    viewTransition
                    to={productPath(product)}
                    className="absolute inset-x-3 bottom-3 z-20 hidden translate-y-2 items-center justify-between rounded-lg border border-border/70 bg-background/95 px-3 py-2.5 text-xs font-bold opacity-0 shadow-md backdrop-blur transition duration-200 group-hover:translate-y-0 group-hover:opacity-100 sm:flex"
                >
                    {t("home.viewProduct")}
                    <ArrowUpRight className="size-4 text-primary" />
                </Link>
            </div>

            <div className="flex min-w-0 flex-1 flex-col p-3.5 sm:p-4">
                <div className="flex min-w-0 items-center justify-between gap-2">
                    <p className="min-w-0 truncate text-[10px] font-bold uppercase tracking-[0.12em] text-primary">
                        {product.categoryName}
                    </p>
                    <span className="inline-flex shrink-0 items-center gap-1 text-[10px] font-semibold text-muted-foreground">
                        <Star className="size-3.5 fill-amber-400 text-amber-400" />
                        {product.reviewCount > 0
                            ? product.averageRating.toFixed(1)
                            : "—"}
                    </span>
                </div>

                <Link
                    viewTransition
                    to={productPath(product)}
                    className="mt-2 line-clamp-2 min-h-10 text-sm font-bold leading-5 tracking-[-0.015em] transition hover:text-primary sm:min-h-12 sm:text-[15px] sm:leading-6"
                >
                    {product.name}
                </Link>

                <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] font-semibold">
                    <span
                        className={cn(
                            "inline-flex items-center gap-1.5 rounded-md px-2 py-1",
                            product.stock > 0
                                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                                : "bg-destructive/10 text-destructive",
                        )}
                    >
                        {product.stock > 0 ? <Check className="size-3" /> : null}
                        {product.stock > 0
                            ? t("product.inStock")
                            : t("product.unavailable")}
                    </span>

                    {product.unitName ? (
                        <span className="inline-flex items-center gap-1 rounded-md border border-border/70 bg-muted/30 px-2 py-1 text-muted-foreground">
                            <PackageCheck className="size-3" />
                            {product.unitName}
                        </span>
                    ) : null}
                </div>

                <div className="mt-auto pt-4">
                    <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
                        <span className="text-xl font-black tracking-[-0.04em] text-foreground sm:text-2xl">
                            {hasPrice
                                ? formatMoney(product.price!)
                                : t("product.noPrice")}
                        </span>
                        {hasDiscount ? (
                            <span className="text-xs font-semibold text-muted-foreground line-through decoration-destructive/70 decoration-2">
                                {formatMoney(product.oldPrice!)}
                            </span>
                        ) : null}
                    </div>

                    <p className="mt-1 min-h-4 text-[10px] font-medium text-muted-foreground">
                        {hasPrice && product.unitName
                            ? t("product.perUnit", { unit: product.unitName })
                            : product.stock > 0
                              ? t("product.availableCount", {
                                    count: product.stock,
                                })
                              : ""}
                    </p>

                    <div className="mt-3 flex gap-2">
                        <Button
                            type="button"
                            className="h-10 flex-1 rounded-lg px-3 text-xs font-bold shadow-none sm:h-11 sm:text-sm"
                            disabled={product.stock < 1 || !hasPrice}
                            onClick={addToCart}
                        >
                            <ShoppingBag className="size-4" />
                            {product.stock < 1
                                ? t("product.soldOut")
                                : hasPrice
                                  ? t("product.addToCart")
                                  : t("product.noPrice")}
                        </Button>
                        <Button
                            asChild
                            type="button"
                            variant="outline"
                            size="icon"
                            className="size-10 shrink-0 rounded-lg sm:size-11"
                        >
                            <Link
                                viewTransition
                                to={productPath(product)}
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
