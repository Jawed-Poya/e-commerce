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
import { CartQuantityControl } from "../cart/cart-quantity-control";
import { cartLineKey, useCart } from "../cart/cart-context";

type ProductCardProps = {
    product: Product;
    density?: "default" | "compact";
};

export function ProductCard({
    product,
    density = "default",
}: ProductCardProps) {
    const cart = useCart();
    const { t } = useI18n();
    const compact = density === "compact";
    const liked = cart.wishlist.includes(product.id);
    const productLineKey = cartLineKey(product.id, product.unitId);
    const cartItem = cart.items.find((item) => item.lineKey === productLineKey);
    const primary =
        imageUrl(product.primaryImageUrl) || "/placeholder-product.svg";
    const hasPrice = product.price != null;
    const quantityStep = product.orderQuantityStep > 0 ? product.orderQuantityStep : 1;
    const hasOrderableStock = product.stock >= quantityStep;
    const canAddToCart = hasPrice && hasOrderableStock;
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
            quantityStep,
            slug: product.slug,
            minimumValue: product.minimumValue,
            maximumValue: product.maximumValue,
        });
    };

    const stockLabel = hasOrderableStock
        ? t("product.inStock")
        : t("product.unavailable");
    const displayPrice = hasPrice
        ? formatMoney(product.price!)
        : t("product.noPrice");

    return (
        <>
            <article
                className={cn(
                    "group grid min-w-0 grid-cols-[40%_minmax(0,1fr)] overflow-hidden rounded-xl border border-border/75 bg-card shadow-[0_12px_32px_-28px_rgba(15,23,42,.55)] transition hover:border-primary/20 hover:shadow-[0_18px_40px_-28px_rgba(15,23,42,.45)] dark:border-white/[0.07] sm:hidden",
                    compact ? "min-h-[156px]" : "min-h-[178px]",
                )}
            >
                <div className="relative m-1.5 overflow-hidden rounded-lg bg-muted/30">
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
                        className={cn(
                            "size-full object-contain object-center p-2.5 transition duration-500 ease-out group-hover:scale-[1.025]",
                            !hasOrderableStock && "grayscale opacity-60",
                        )}
                    />
                    {!hasOrderableStock ? (
                        <Badge className="absolute end-1.5 top-1.5 z-20 rounded-md border-0 bg-slate-950/85 px-1.5 py-0.5 text-[8px] font-black text-white shadow-sm backdrop-blur">
                            {t("product.unavailable")}
                        </Badge>
                    ) : null}
                    {hasDiscount ? (
                        <Badge className="absolute start-1.5 top-1.5 z-20 rounded-md border-0 bg-brand-orange px-1.5 py-0.5 text-[9px] font-black text-white shadow-sm">
                            -{discount}%
                        </Badge>
                    ) : null}
                    {product.isFeatured ? (
                        <Badge className="absolute bottom-1.5 start-1.5 z-20 rounded-md bg-card/95 px-1.5 py-0.5 text-[8px] font-bold text-foreground shadow-sm ring-1 ring-black/[0.05] backdrop-blur dark:ring-white/[0.08]">
                            {t("product.featured")}
                        </Badge>
                    ) : null}
                </div>

                <div
                    className={cn(
                        "flex min-w-0 flex-col px-2.5",
                        compact ? "py-2" : "py-2.5",
                    )}
                >
                    <div className="flex min-w-0 items-center justify-between gap-2">
                        <p className="min-w-0 truncate text-[8px] font-black uppercase tracking-[0.12em] text-primary">
                            {product.categoryName}
                        </p>
                        <span className="inline-flex shrink-0 items-center gap-1 text-[9px] font-semibold text-muted-foreground">
                            <Star className="size-2.5 fill-amber-400 text-amber-400" />
                            {product.reviewCount > 0
                                ? product.averageRating.toFixed(1)
                                : "—"}
                        </span>
                    </div>

                    <Link
                        viewTransition
                        to={productPath(product)}
                        className="mt-1 line-clamp-2 text-[13px] font-black leading-[1.15rem] tracking-[-0.02em] transition hover:text-primary"
                    >
                        {product.name}
                    </Link>

                    {product.strength ? (
                        <p className="mt-0.5 truncate text-[9px] font-bold text-muted-foreground">
                            {product.strength}
                        </p>
                    ) : null}

                    <div className="mt-1.5 flex flex-wrap items-center gap-1 text-[8px] font-bold">
                        <span
                            className={cn(
                                "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5",
                                hasOrderableStock
                                    ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                                    : "bg-destructive/10 text-destructive",
                            )}
                        >
                            {hasOrderableStock ? (
                                <Check className="size-2.5" />
                            ) : null}
                            {stockLabel}
                        </span>
                        {product.unitName ? (
                            <span className="inline-flex min-w-0 items-center gap-1 rounded-md bg-muted/70 px-1.5 py-0.5 text-muted-foreground">
                                <PackageCheck className="size-2.5" />
                                <span className="max-w-14 truncate">
                                    {product.unitName}
                                </span>
                            </span>
                        ) : null}
                        {product.orderQuantityStep > 1 ? (
                            <span className="inline-flex shrink-0 rounded-md bg-primary/[0.08] px-1.5 py-0.5 text-primary">
                                {t("cart.quantityStep", { count: product.orderQuantityStep })}
                            </span>
                        ) : null}
                    </div>

                    <div className="mt-auto flex items-end justify-between gap-2 pt-2">
                        <div className="min-w-0">
                            <div className="flex min-w-0 flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                                <span className="text-sm font-black tracking-[-0.035em] text-primary">
                                    {displayPrice}
                                </span>
                                {hasDiscount ? (
                                    <span className="text-[8px] font-semibold text-muted-foreground line-through decoration-brand-orange decoration-2">
                                        {formatMoney(product.oldPrice!)}
                                    </span>
                                ) : null}
                            </div>
                            <p className="mt-0.5 truncate text-[8px] font-medium text-muted-foreground">
                                {hasPrice && product.unitName
                                    ? t("product.perUnit", {
                                          unit: product.unitName,
                                      })
                                    : t("product.availableCount", {
                                          count: product.stock,
                                      })}
                            </p>
                        </div>

                        <div className="flex shrink-0 items-center gap-1">
                            <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                onClick={() => cart.toggleWishlist(product.id)}
                                className={cn(
                                    "size-8 rounded-lg shadow-none",
                                    liked &&
                                        "border-brand-orange/30 bg-brand-orange text-white hover:bg-brand-orange/90 hover:text-white",
                                )}
                                aria-label={
                                    liked
                                        ? t("wishlist.remove")
                                        : t("wishlist.add")
                                }
                            >
                                <Heart
                                    className={cn(
                                        "size-3.5",
                                        liked && "fill-current",
                                    )}
                                />
                            </Button>
                            {cartItem && canAddToCart ? (
                                <CartQuantityControl
                                    item={cartItem}
                                    compact
                                    showStepBadge={false}
                                />
                            ) : (
                                <Button
                                    type="button"
                                    size="icon"
                                    className="size-8 rounded-lg shadow-none"
                                    disabled={!canAddToCart}
                                    onClick={addToCart}
                                    aria-label={t("product.addToCart")}
                                >
                                    <ShoppingBag className="size-3.5" />
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            </article>

            <article
                className={cn(
                    "group relative hidden min-w-0 overflow-hidden rounded-xl border border-border/75 bg-card shadow-[0_14px_38px_-32px_rgba(15,23,42,.5)] transition duration-300 hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-[0_24px_52px_-30px_rgba(15,23,42,.46)] focus-within:border-primary/25 dark:border-white/[0.07] sm:block",
                    compact
                        ? "h-[clamp(235px,32vh,310px)]"
                        : "h-[clamp(275px,38vh,350px)]",
                )}
            >
                <Link
                    viewTransition
                    to={productPath(product)}
                    className="absolute inset-0 z-10 focus-visible:outline-none"
                    aria-label={`View ${product.name}`}
                />

                <div className="absolute inset-0 bg-muted/20" />
                <div
                    className={cn(
                        "absolute inset-x-0 top-0 z-[1]",
                        compact ? "bottom-[4.9rem]" : "bottom-[5.2rem]",
                    )}
                >
                    <img
                        src={primary}
                        alt={product.name}
                        loading="lazy"
                        decoding="async"
                        className={cn(
                            "block size-full max-w-none object-cover object-center transition duration-500 ease-out group-hover:scale-[1.02]",
                            !hasOrderableStock && "grayscale opacity-60",
                        )}
                    />
                </div>

                {!hasOrderableStock ? (
                    <Badge className="absolute end-2.5 top-2.5 z-20 rounded-md border-0 bg-slate-950/85 px-2 py-1 text-[10px] font-black text-white shadow-sm backdrop-blur">
                        {t("product.unavailable")}
                    </Badge>
                ) : null}

                <div className="absolute start-2.5 top-2.5 z-20 flex max-w-[72%] flex-wrap gap-1.5">
                    {hasDiscount ? (
                        <Badge className="rounded-md border-0 bg-brand-orange px-2 py-1 text-[10px] font-black text-white shadow-sm">
                            -{discount}%
                        </Badge>
                    ) : null}
                    {product.isFeatured ? (
                        <Badge className="rounded-md bg-card/95 px-2 py-1 text-[10px] font-bold text-foreground shadow-sm ring-1 ring-black/[0.06] backdrop-blur dark:ring-white/[0.08]">
                            {t("product.featured")}
                        </Badge>
                    ) : null}
                </div>

                <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-28 bg-gradient-to-t from-background/55 via-background/15 to-transparent transition duration-300 group-hover:h-48 group-focus-within:h-48" />

                <div className="absolute inset-x-0 bottom-0 z-30 border-t border-border/80 bg-card/95 px-3 py-2.5 shadow-[0_-10px_30px_-24px_rgba(15,23,42,.42)] backdrop-blur-xl supports-[backdrop-filter]:bg-card/90 dark:border-white/[0.08]">
                    <div className="flex min-w-0 items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                            <p className="truncate text-[9px] font-black uppercase tracking-[0.12em] text-primary/80">
                                {product.categoryName}
                            </p>
                            <Link
                                viewTransition
                                to={productPath(product)}
                                className={cn(
                                    "mt-0.5 block truncate font-black tracking-[-0.02em] text-foreground transition hover:text-primary",
                                    compact ? "text-sm" : "text-[15px]",
                                )}
                            >
                                {product.name}
                            </Link>
                        </div>

                        <div className="shrink-0 text-end">
                            <div className="flex items-baseline justify-end gap-1.5">
                                <span
                                    className={cn(
                                        "font-black tracking-[-0.035em] text-primary",
                                        compact ? "text-base" : "text-lg",
                                    )}
                                >
                                    {displayPrice}
                                </span>
                                {hasDiscount ? (
                                    <span className="text-[9px] font-semibold text-muted-foreground line-through decoration-brand-orange decoration-2">
                                        {formatMoney(product.oldPrice!)}
                                    </span>
                                ) : null}
                            </div>
                            <p className="mt-0.5 max-w-24 truncate text-[8px] font-medium text-muted-foreground">
                                {hasPrice && product.unitName
                                    ? t("product.perUnit", {
                                          unit: product.unitName,
                                      })
                                    : hasOrderableStock
                                      ? t("product.availableCount", {
                                            count: product.stock,
                                        })
                                      : ""}
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-rows-[0fr] opacity-0 transition-[grid-template-rows,opacity,margin] duration-300 ease-out group-hover:mt-2 group-hover:grid-rows-[1fr] group-hover:opacity-100 group-focus-within:mt-2 group-focus-within:grid-rows-[1fr] group-focus-within:opacity-100">
                        <div className="overflow-hidden">
                            <div className="border-t border-border/70 pt-2 dark:border-white/[0.07]">
                                <div className="flex min-w-0 items-center justify-between gap-2">
                                    <div className="flex min-w-0 flex-wrap items-center gap-1.5 text-[9px] font-bold">
                                        <span className="inline-flex shrink-0 items-center gap-1 text-muted-foreground">
                                            <Star className="size-3 fill-amber-400 text-amber-400" />
                                            {product.reviewCount > 0
                                                ? product.averageRating.toFixed(
                                                      1,
                                                  )
                                                : "—"}
                                        </span>
                                        <span
                                            className={cn(
                                                "inline-flex items-center gap-1 rounded-md px-1.5 py-1",
                                                hasOrderableStock
                                                    ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                                                    : "bg-destructive/10 text-destructive",
                                            )}
                                        >
                                            {hasOrderableStock ? (
                                                <Check className="size-2.5" />
                                            ) : null}
                                            {stockLabel}
                                        </span>
                                        {product.unitName ? (
                                            <span className="inline-flex min-w-0 items-center gap-1 rounded-md bg-muted/75 px-1.5 py-1 text-muted-foreground">
                                                <PackageCheck className="size-2.5" />
                                                <span className="max-w-20 truncate">
                                                    {product.unitName}
                                                </span>
                                            </span>
                                        ) : null}
                                        {product.orderQuantityStep > 1 ? (
                                            <span className="inline-flex shrink-0 rounded-md bg-primary/[0.08] px-1.5 py-1 text-primary">
                                                {t("cart.quantityStep", { count: product.orderQuantityStep })}
                                            </span>
                                        ) : null}
                                    </div>

                                    {product.strength ? (
                                        <p className="max-w-24 shrink-0 truncate text-[9px] font-bold text-muted-foreground">
                                            {product.strength}
                                        </p>
                                    ) : null}
                                </div>

                                <div className="mt-2 flex items-center gap-1.5">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="icon"
                                        onClick={() =>
                                            cart.toggleWishlist(product.id)
                                        }
                                        className={cn(
                                            "size-8 rounded-lg bg-background/70 shadow-none",
                                            liked &&
                                                "border-brand-orange/30 bg-brand-orange text-white hover:bg-brand-orange/90 hover:text-white",
                                        )}
                                        aria-label={
                                            liked
                                                ? t("wishlist.remove")
                                                : t("wishlist.add")
                                        }
                                    >
                                        <Heart
                                            className={cn(
                                                "size-3.5",
                                                liked && "fill-current",
                                            )}
                                        />
                                    </Button>

                                    {cartItem && canAddToCart ? (
                                        <CartQuantityControl
                                            item={cartItem}
                                            compact
                                            className="min-w-0 flex-1 justify-center"
                                            showStepBadge={false}
                                        />
                                    ) : (
                                        <Button
                                            type="button"
                                            size="sm"
                                            className="h-8 min-w-0 flex-1 rounded-lg px-2.5 text-[10px] font-black shadow-none"
                                            disabled={!canAddToCart}
                                            onClick={addToCart}
                                            aria-label={t("product.addToCart")}
                                        >
                                            <ShoppingBag className="size-3.5" />
                                            <span className="truncate">
                                                {!hasOrderableStock
                                                    ? t("product.soldOut")
                                                    : hasPrice
                                                      ? t("product.addToCart")
                                                      : t("product.noPrice")}
                                            </span>
                                        </Button>
                                    )}

                                    <Button
                                        asChild
                                        type="button"
                                        variant="outline"
                                        size="icon"
                                        className="size-8 rounded-lg bg-background/70 shadow-none"
                                    >
                                        <Link
                                            viewTransition
                                            to={productPath(product)}
                                            aria-label={`View ${product.name}`}
                                        >
                                            <ArrowUpRight className="size-3.5" />
                                        </Link>
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </article>
        </>
    );
}
