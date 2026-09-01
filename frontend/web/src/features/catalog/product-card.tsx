import {
    ArrowUpRight,
    Check,
    Heart,
    PackageCheck,
    Pin,
    ShoppingBag,
    Star,
} from "lucide-react";
import { Link } from "react-router-dom";

import { useI18n } from "../../i18n/i18n-provider";
import { imageUrl } from "../../shared/api/api-client";
import { Badge } from "../../shared/components/ui/badge";
import { Button } from "../../shared/components/ui/button";
import { formatDecimal, formatMoney } from "../../shared/lib/money";
import { productPath } from "../../shared/lib/product-path";
import { cn } from "../../shared/lib/utils";
import type { Product } from "../../shared/types/product";
import { CartQuantityControl } from "../cart/cart-quantity-control";
import {
    cartLineKey,
    maximumCartQuantity,
    minimumCartQuantity,
    useCart,
} from "../cart/cart-context";
import { useCompany } from "../company/company-context";
import { useProductPins } from "./product-pins-context";

type ProductCardProps = {
    product: Product;
    density?: "default" | "compact";
};

export function ProductCard({
    product,
    density = "default",
}: ProductCardProps) {
    const cart = useCart();
    const pins = useProductPins();
    const { company } = useCompany();
    const { t } = useI18n();
    const compact = density === "compact";
    const liked = cart.wishlist.includes(product.id);
    const pinned = pins.isPinned(product.id);
    const productLineKey = cartLineKey(product.id, product.unitId);
    const cartItem = cart.items.find((item) => item.lineKey === productLineKey);
    const primary =
        imageUrl(product.primaryImageUrl) || "/placeholder-product.svg";
    const hasPrice = product.price != null;
    const quantityStep =
        product.orderQuantityStep > 0 ? product.orderQuantityStep : 1;
    const quantityLimits = {
        stock: product.stock,
        quantityStep,
        minimumValue: product.minimumValue,
        maximumValue: product.maximumValue,
    };
    const minimumQuantity = minimumCartQuantity(quantityLimits);
    const maximumQuantity = maximumCartQuantity(quantityLimits);
    const configuredQuickQuantities = product.quickOrderQuantities?.length
        ? product.quickOrderQuantities
        : company?.settings.defaultQuickOrderQuantities ?? [];
    const quickOrderQuantities = configuredQuickQuantities.filter(
        (quantity) =>
            quantity >= minimumQuantity - Number.EPSILON &&
            quantity <= maximumQuantity + Number.EPSILON &&
            Math.abs(
                quantity / quantityStep - Math.round(quantity / quantityStep),
            ) < 1e-9,
    );
    const hasOrderableStock = maximumQuantity >= minimumQuantity;
    const canAddToCart = hasPrice && hasOrderableStock;
    const liveCartItem = cartItem
        ? {
              ...cartItem,
              stock: product.stock,
              quantityStep,
              quickOrderQuantities,
              minimumValue: product.minimumValue,
              maximumValue: product.maximumValue,
          }
        : null;
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
            quickOrderQuantities,
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
    const description = product.strength || product.shortDescription;

    return (
        <article className="group flex min-w-0 self-start flex-col overflow-hidden rounded-2xl border border-border/80 bg-card shadow-none transition-[border-color,background-color] duration-200 hover:border-primary/30 focus-within:border-primary/35 dark:border-white/[0.09]">
            <div
                className={cn(
                    "relative aspect-[5/4] overflow-hidden border-b border-border/65 bg-muted/25 sm:aspect-[4/3] dark:border-white/[0.06]",
                    compact && "sm:aspect-[16/11]",
                )}
            >
                <Link
                    viewTransition
                    to={productPath(product)}
                    className="absolute inset-0 z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
                    aria-label={`${t("product.details")}: ${product.name}`}
                />
                <img
                    src={primary}
                    alt={product.name}
                    loading="lazy"
                    decoding="async"
                    className={cn(
                        "size-full object-contain object-center p-3 transition duration-500 ease-out group-hover:scale-[1.025] sm:p-4",
                        !hasOrderableStock && "grayscale opacity-60",
                    )}
                />

                <div className="absolute start-2.5 top-2.5 z-20 flex max-w-[70%] flex-wrap gap-1.5">
                    {hasDiscount ? (
                        <Badge className="rounded-lg border-0 bg-brand-orange px-2 py-1 text-[10px] font-black text-white shadow-none">
                            -{discount}%
                        </Badge>
                    ) : null}
                    {product.isFeatured ? (
                        <Badge className="rounded-lg border border-border/80 bg-card/95 px-2 py-1 text-[10px] font-bold text-foreground shadow-none backdrop-blur dark:border-white/[0.10]">
                            {t("product.featured")}
                        </Badge>
                    ) : null}
                </div>

                {!hasOrderableStock ? (
                    <Badge className="absolute end-2.5 top-2.5 z-20 rounded-lg border-0 bg-slate-950/85 px-2 py-1 text-[10px] font-black text-white shadow-none backdrop-blur">
                        {t("product.unavailable")}
                    </Badge>
                ) : null}

                <div className="absolute bottom-2 end-2 z-20 flex gap-1.5 sm:hidden">
                    <button
                        type="button"
                        onClick={() => cart.toggleWishlist(product.id)}
                        className={cn(
                            "grid size-8 place-items-center rounded-full border border-border/80 bg-card/95 text-foreground shadow-none backdrop-blur",
                            liked && "bg-brand-orange text-white",
                        )}
                        aria-label={liked ? t("wishlist.remove") : t("wishlist.add")}
                    >
                        <Heart className={cn("size-3.5", liked && "fill-current")} />
                    </button>
                    <button
                        type="button"
                        onClick={() => pins.togglePinned(product.id)}
                        className={cn(
                            "grid size-8 place-items-center rounded-full border border-border/80 bg-card/95 text-foreground shadow-none backdrop-blur",
                            pinned && "bg-primary text-primary-foreground",
                        )}
                        aria-label={pinned ? t("product.unpin") : t("product.pin")}
                    >
                        <Pin className={cn("size-3.5", pinned && "fill-current")} />
                    </button>
                </div>
            </div>

            <div className={cn("flex flex-1 flex-col", compact ? "p-3" : "p-2.5 sm:p-4")}>
                <div className="flex min-w-0 items-center justify-between gap-3">
                    <p className="min-w-0 truncate text-[10px] font-black uppercase tracking-[0.13em] text-primary">
                        {product.categoryName}
                    </p>
                    <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-bold text-muted-foreground">
                        <Star className="size-3 fill-amber-400 text-amber-400" />
                        {product.reviewCount > 0
                            ? formatDecimal(product.averageRating)
                            : "—"}
                    </span>
                </div>

                <Link
                    viewTransition
                    to={productPath(product)}
                    className={cn(
                        "mt-1.5 line-clamp-2 font-black leading-snug tracking-[-0.025em] text-foreground transition hover:text-primary",
                        compact ? "text-[15px]" : "text-sm sm:text-lg",
                    )}
                >
                    {product.name}
                </Link>

                <p className="mt-1.5 line-clamp-2 min-h-5 text-[11px] leading-4 text-muted-foreground sm:text-xs sm:leading-5">
                    {description || t("product.defaultDescription")}
                </p>

                <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[10px] font-bold">
                    <span
                        className={cn(
                            "inline-flex items-center gap-1 rounded-lg px-2 py-1",
                            hasOrderableStock
                                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                                : "bg-destructive/10 text-destructive",
                        )}
                    >
                        {hasOrderableStock ? <Check className="size-3" /> : null}
                        {stockLabel}
                    </span>
                    {product.unitName ? (
                        <span className="inline-flex min-w-0 items-center gap-1 rounded-lg bg-muted/75 px-2 py-1 text-muted-foreground">
                            <PackageCheck className="size-3" />
                            <span className="max-w-24 truncate">
                                {product.unitName}
                            </span>
                        </span>
                    ) : null}
                </div>

                <div className="mt-auto pt-3">
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                            <span className="text-xl font-black tracking-[-0.04em] text-primary">
                                {displayPrice}
                            </span>
                            {hasDiscount ? (
                                <span className="text-[10px] font-semibold text-muted-foreground line-through decoration-brand-orange decoration-2">
                                    {formatMoney(product.oldPrice!)}
                                </span>
                            ) : null}
                        </div>
                        <p className="mt-0.5 text-[10px] font-medium text-muted-foreground">
                            {hasPrice && product.unitName
                                ? t("product.perUnit", {
                                      unit: product.unitName,
                                  })
                                : t("product.availableCount", {
                                      count: product.stock,
                                  })}
                        </p>
                    </div>

                    {cartItem && canAddToCart ? (
                        <div className="mt-2 rounded-xl border border-primary/12 bg-primary/[0.035] p-2">
                            <CartQuantityControl
                                item={liveCartItem!}
                                compact
                                className="w-full"
                                variant="productCard"
                                showStepBadge
                                showQuickQuantities
                                quickQuantityLimit={4}
                            />
                        </div>
                    ) : null}

                    <div className="mt-2 flex items-center gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => cart.toggleWishlist(product.id)}
                            className={cn(
                                "hidden size-11 shrink-0 rounded-xl shadow-none sm:inline-flex",
                                liked &&
                                    "border-brand-orange/30 bg-brand-orange text-white hover:bg-brand-orange/90 hover:text-white",
                            )}
                            aria-label={
                                liked ? t("wishlist.remove") : t("wishlist.add")
                            }
                            title={liked ? t("wishlist.remove") : t("wishlist.add")}
                        >
                            <Heart
                                className={cn("size-4.5", liked && "fill-current")}
                            />
                        </Button>

                        <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => pins.togglePinned(product.id)}
                            className={cn(
                                "hidden size-11 shrink-0 rounded-xl shadow-none sm:inline-flex",
                                pinned &&
                                    "border-primary/30 bg-primary text-primary-foreground hover:bg-primary/90",
                            )}
                            aria-label={
                                pinned ? t("product.unpin") : t("product.pin")
                            }
                            title={pinned ? t("product.unpin") : t("product.pin")}
                        >
                            <Pin className={cn("size-4.5", pinned && "fill-current")} />
                        </Button>

                        {cartItem && canAddToCart ? (
                            <Button
                                asChild
                                variant="outline"
                                className="h-10 min-w-0 flex-1 rounded-xl px-2 text-xs font-bold sm:px-4 sm:text-sm"
                            >
                                <Link viewTransition to={productPath(product)}>
                                    {t("product.details")}
                                    <ArrowUpRight className="size-4" />
                                </Link>
                            </Button>
                        ) : (
                            <Button
                                type="button"
                                className="h-12 min-w-0 flex-1 rounded-xl px-2 text-xs font-black shadow-none sm:h-12 sm:px-4 sm:text-sm"
                                disabled={!canAddToCart}
                                onClick={addToCart}
                            >
                                <ShoppingBag className="size-4.5" />
                                <span className="truncate">
                                    {!hasOrderableStock
                                        ? t("product.soldOut")
                                        : hasPrice
                                          ? t("product.addToCart")
                                          : t("product.noPrice")}
                                </span>
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        </article>
    );
}
