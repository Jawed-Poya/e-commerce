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
    const primary =
        imageUrl(product.primaryImageUrl) || "/placeholder-product.svg";
    const hasPrice = product.price != null;
    const hasDiscount =
        product.oldPrice != null &&
        product.price != null &&
        product.oldPrice > product.price;
    const discount = hasDiscount
        ? Math.round(
              ((product.oldPrice! - product.price!) / product.oldPrice!) * 100,
          )
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

    const stockLabel =
        product.stock > 0 ? t("product.inStock") : t("product.unavailable");
    const displayPrice = hasPrice
        ? formatMoney(product.price!)
        : t("product.noPrice");

    return (
        <>
            <article className="group grid min-h-[196px] min-w-0 grid-cols-[38%_minmax(0,1fr)] overflow-hidden rounded-2xl bg-card shadow-[0_14px_35px_-30px_rgba(15,23,42,.55)] ring-1 ring-black/[0.06] transition hover:-translate-y-0.5 hover:shadow-[0_20px_45px_-30px_rgba(15,23,42,.48)] dark:bg-white/[0.035] dark:ring-white/[0.055] sm:hidden">
                <div className="relative min-h-full overflow-hidden bg-muted/25">
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
                        className="size-full min-h-[196px] object-cover object-center grayscale transition duration-500 ease-out group-hover:scale-[1.035] group-hover:grayscale-0 group-focus-within:grayscale-0 group-active:grayscale-0"
                    />
                    {hasDiscount ? (
                        <Badge className="absolute start-2 top-2 z-20 rounded-md border-0 bg-brand-orange px-2 py-1 text-[9px] font-black text-white shadow-sm">
                            -{discount}%
                        </Badge>
                    ) : null}
                    <button
                        type="button"
                        onClick={() => cart.toggleWishlist(product.id)}
                        className={cn(
                            "absolute end-2 top-2 z-30 grid size-8 place-items-center rounded-full bg-background/[0.92] text-muted-foreground shadow-sm ring-1 ring-black/[0.06] backdrop-blur transition hover:text-brand-orange dark:ring-white/[0.08]",
                            liked && "bg-brand-orange text-white hover:text-white",
                        )}
                        aria-label={
                            liked ? t("wishlist.remove") : t("wishlist.add")
                        }
                    >
                        <Heart
                            className={cn("size-3.5", liked && "fill-current")}
                        />
                    </button>
                </div>

                <div className="flex min-w-0 flex-col px-3.5 py-3">
                    <div className="flex min-w-0 items-center justify-between gap-2">
                        <p className="min-w-0 truncate text-[9px] font-black uppercase tracking-[0.12em] text-primary">
                            {product.categoryName}
                        </p>
                        <span className="inline-flex shrink-0 items-center gap-1 text-[10px] font-semibold text-muted-foreground">
                            <Star className="size-3 fill-amber-400 text-amber-400" />
                            {product.reviewCount > 0
                                ? product.averageRating.toFixed(1)
                                : "—"}
                        </span>
                    </div>

                    <Link
                        viewTransition
                        to={productPath(product)}
                        className="mt-1.5 line-clamp-2 text-[15px] font-black leading-5 tracking-[-0.02em] transition hover:text-primary"
                    >
                        {product.name}
                    </Link>

                    {product.strength ? (
                        <p className="mt-1 text-[10px] font-bold text-primary/80">{product.strength}</p>
                    ) : null}

                    <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[9px] font-bold">
                        <span
                            className={cn(
                                "inline-flex items-center gap-1 rounded-md px-1.5 py-1",
                                product.stock > 0
                                    ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                                    : "bg-destructive/10 text-destructive",
                            )}
                        >
                            {product.stock > 0 ? (
                                <Check className="size-2.5" />
                            ) : null}
                            {stockLabel}
                        </span>
                        {product.unitName ? (
                            <span className="inline-flex items-center gap-1 rounded-md bg-muted/[0.60] px-1.5 py-1 text-muted-foreground">
                                <PackageCheck className="size-2.5" />
                                {product.unitName}
                            </span>
                        ) : null}
                    </div>

                    <div className="mt-auto flex items-end justify-between gap-2 pt-3">
                        <div className="min-w-0">
                            <div className="flex min-w-0 flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                                <span className="text-lg font-black tracking-[-0.045em] text-foreground">
                                    {displayPrice}
                                </span>
                                {hasDiscount ? (
                                    <span className="text-[10px] font-semibold text-muted-foreground line-through decoration-destructive/70 decoration-2">
                                        {formatMoney(product.oldPrice!)}
                                    </span>
                                ) : null}
                            </div>
                            <p className="mt-0.5 truncate text-[9px] font-medium text-muted-foreground">
                                {hasPrice && product.unitName
                                    ? t("product.perUnit", {
                                          unit: product.unitName,
                                      })
                                    : t("product.availableCount", {
                                          count: product.stock,
                                      })}
                            </p>
                        </div>

                        <Button
                            type="button"
                            size="icon"
                            className="size-10 shrink-0 rounded-xl shadow-none"
                            disabled={product.stock < 1 || !hasPrice}
                            onClick={addToCart}
                            aria-label={t("product.addToCart")}
                        >
                            <ShoppingBag className="size-4" />
                        </Button>
                    </div>
                </div>
            </article>

            <article className="group hidden h-full min-w-0 flex-col overflow-hidden rounded-2xl bg-card shadow-[0_14px_38px_-32px_rgba(15,23,42,.5)] ring-1 ring-black/[0.055] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_22px_48px_-30px_rgba(15,23,42,.42)] dark:bg-white/[0.035] dark:ring-white/[0.055] sm:flex">
                <div className="relative aspect-[4/3] overflow-hidden bg-muted/25">
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
                        className="size-full object-cover object-center grayscale transition duration-500 ease-out group-hover:scale-[1.04] group-hover:grayscale-0 group-focus-within:grayscale-0 group-active:grayscale-0"
                    />

                    <div className="absolute start-3 top-3 z-20 flex flex-wrap gap-1.5">
                        {hasDiscount ? (
                            <Badge className="rounded-md border-0 bg-brand-orange px-2 py-1 text-[10px] font-black text-white shadow-sm">
                                -{discount}%
                            </Badge>
                        ) : null}
                        {product.isFeatured ? (
                            <Badge className="rounded-md bg-background/[0.92] px-2 py-1 text-[10px] font-bold text-foreground shadow-sm ring-1 ring-black/[0.06] backdrop-blur dark:ring-white/[0.08]">
                                {t("product.featured")}
                            </Badge>
                        ) : null}
                    </div>

                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => cart.toggleWishlist(product.id)}
                        className={cn(
                            "absolute end-3 top-3 z-30 size-9 rounded-full bg-background/[0.92] text-muted-foreground shadow-sm ring-1 ring-black/[0.06] backdrop-blur transition hover:bg-background hover:text-brand-orange dark:ring-white/[0.08]",
                            liked &&
                                "bg-brand-orange text-white hover:bg-brand-orange/90 hover:text-white",
                        )}
                        aria-label={
                            liked ? t("wishlist.remove") : t("wishlist.add")
                        }
                    >
                        <Heart
                            className={cn("size-4", liked && "fill-current")}
                        />
                    </Button>

                    <Link
                        viewTransition
                        to={productPath(product)}
                        className="absolute inset-x-3 bottom-3 z-20 hidden translate-y-2 items-center justify-between rounded-lg bg-background/[0.95] px-3 py-2.5 text-xs font-bold opacity-0 shadow-md ring-1 ring-black/[0.06] backdrop-blur transition duration-200 group-hover:translate-y-0 group-hover:opacity-100 lg:flex dark:ring-white/[0.08]"
                    >
                        {t("home.viewProduct")}
                        <ArrowUpRight className="size-4 text-primary" />
                    </Link>
                </div>

                <div className="flex min-w-0 flex-1 flex-col p-4">
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
                        className="mt-2 line-clamp-2 min-h-12 text-[15px] font-bold leading-6 tracking-[-0.015em] transition hover:text-primary"
                    >
                        {product.name}
                    </Link>

                    {product.strength ? (
                        <p className="mt-1 text-xs font-bold text-primary/80">{product.strength}</p>
                    ) : null}

                    <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] font-semibold">
                        <span
                            className={cn(
                                "inline-flex items-center gap-1.5 rounded-md px-2 py-1",
                                product.stock > 0
                                    ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                                    : "bg-destructive/10 text-destructive",
                            )}
                        >
                            {product.stock > 0 ? (
                                <Check className="size-3" />
                            ) : null}
                            {stockLabel}
                        </span>

                        {product.unitName ? (
                            <span className="inline-flex items-center gap-1 rounded-md bg-muted/[0.55] px-2 py-1 text-muted-foreground">
                                <PackageCheck className="size-3" />
                                {product.unitName}
                            </span>
                        ) : null}
                    </div>

                    <div className="mt-auto pt-4">
                        <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
                            <span className="text-2xl font-black tracking-[-0.04em] text-foreground">
                                {displayPrice}
                            </span>
                            {hasDiscount ? (
                                <span className="text-xs font-semibold text-muted-foreground line-through decoration-destructive/70 decoration-2">
                                    {formatMoney(product.oldPrice!)}
                                </span>
                            ) : null}
                        </div>

                        <p className="mt-1 min-h-4 text-[10px] font-medium text-muted-foreground">
                            {hasPrice && product.unitName
                                ? t("product.perUnit", {
                                      unit: product.unitName,
                                  })
                                : product.stock > 0
                                  ? t("product.availableCount", {
                                        count: product.stock,
                                    })
                                  : ""}
                        </p>

                        <div className="mt-3 flex gap-2">
                            <Button
                                type="button"
                                className="h-11 flex-1 rounded-lg px-3 text-sm font-bold shadow-none"
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
                                className="size-11 shrink-0 rounded-lg border-black/[0.08] bg-transparent dark:border-white/[0.08]"
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
        </>
    );
}
