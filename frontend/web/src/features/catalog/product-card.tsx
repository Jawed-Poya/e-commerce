import { ArrowUpRight, Check, Heart, ShoppingBag, Star } from "lucide-react";
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
    const alternate = product.images.find((image) => image.url !== product.primaryImageUrl);
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
        <article className="group relative grid h-full min-w-0 grid-cols-[118px_minmax(0,1fr)] gap-3 overflow-hidden rounded-[22px] border border-border/80 bg-card p-3 shadow-[0_12px_38px_-32px_rgba(15,23,42,.6)] transition duration-300 hover:border-primary/30 hover:shadow-[0_24px_64px_-42px_rgba(15,23,42,.72)] dark:border-white/11 dark:shadow-[0_16px_44px_-34px_rgba(0,0,0,.9)] sm:flex sm:flex-col sm:gap-0 sm:p-0 sm:hover:-translate-y-1">
            <div className="relative min-h-[160px] overflow-hidden rounded-[17px] border border-border/65 bg-gradient-to-br from-white via-slate-50 to-slate-100 dark:border-white/10 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900 sm:aspect-[4/3] sm:min-h-0 sm:rounded-none sm:border-x-0 sm:border-t-0">
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
                        "size-full object-contain p-3.5 drop-shadow-md transition duration-500 ease-out sm:p-7 sm:group-hover:scale-[1.045]",
                        alternate && "sm:group-hover:opacity-0",
                    )}
                />

                {alternate ? (
                    <img
                        src={imageUrl(alternate.url) ?? primary}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className="absolute inset-0 hidden size-full scale-[1.035] object-contain p-7 opacity-0 drop-shadow-md transition duration-500 ease-out sm:block sm:group-hover:scale-100 sm:group-hover:opacity-100"
                    />
                ) : null}

                <div className="absolute start-2.5 top-2.5 z-20 flex flex-wrap gap-1.5 sm:start-3 sm:top-3">
                    {hasDiscount ? (
                        <Badge className="rounded-lg border-0 bg-brand-orange px-2.5 py-1 text-[10px] font-black text-white shadow-md">
                            -{discount}%
                        </Badge>
                    ) : null}
                    {product.isFeatured ? (
                        <Badge className="hidden rounded-lg border border-primary/20 bg-background/90 px-2.5 py-1 text-[10px] font-black text-primary shadow-sm backdrop-blur sm:inline-flex">
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
                        "absolute end-2.5 top-2.5 z-30 size-8 rounded-full border-white/70 bg-background/92 text-muted-foreground shadow-md backdrop-blur transition hover:border-brand-orange/30 hover:text-brand-orange sm:end-3 sm:top-3 sm:size-9",
                        liked && "border-brand-orange bg-brand-orange text-white hover:bg-brand-orange/90 hover:text-white",
                    )}
                    aria-label={liked ? t("wishlist.remove") : t("wishlist.add")}
                >
                    <Heart className={cn("size-3.5", liked && "fill-current")} />
                </Button>

                <Link
                    viewTransition
                    to={productPath(product)}
                    className="absolute inset-x-3 bottom-3 z-30 hidden translate-y-2 items-center justify-between rounded-xl border border-white/75 bg-background/92 px-3 py-2.5 text-xs font-black opacity-0 shadow-lg backdrop-blur transition duration-300 sm:flex sm:group-hover:translate-y-0 sm:group-hover:opacity-100 dark:border-white/12"
                >
                    {t("home.viewProduct")}
                    <ArrowUpRight className="size-4 text-primary" />
                </Link>
            </div>

            <div className="flex min-w-0 flex-1 flex-col py-0.5 sm:p-4">
                <div className="flex items-center justify-between gap-2">
                    <p className="min-w-0 truncate text-[10px] font-black uppercase tracking-[0.14em] text-primary">
                        {product.categoryName}
                    </p>
                    <span className="inline-flex shrink-0 items-center gap-1 text-[10px] font-bold text-muted-foreground">
                        <Star className="size-3.5 fill-amber-400 text-amber-400" />
                        {product.reviewCount > 0 ? product.averageRating.toFixed(1) : "—"}
                    </span>
                </div>

                <Link
                    viewTransition
                    to={productPath(product)}
                    className="mt-1.5 line-clamp-2 text-sm font-black leading-5 tracking-[-0.02em] transition hover:text-primary sm:min-h-12 sm:text-[15px] sm:leading-6"
                >
                    {product.name}
                </Link>

                <div className="mt-2 flex items-center gap-1.5 text-[10px] font-bold">
                    <span
                        className={cn(
                            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1",
                            product.stock > 0
                                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                                : "bg-destructive/10 text-destructive",
                        )}
                    >
                        {product.stock > 0 ? <Check className="size-3" /> : null}
                        {product.stock > 0
                            ? `${t("product.availableCount", { count: product.stock })}${product.unitName ? ` ${product.unitName}` : ""}`
                            : t("product.unavailable")}
                    </span>
                </div>

                <div className="mt-auto pt-3">
                    <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
                        <span className="text-lg font-black tracking-[-0.04em] text-foreground sm:text-2xl">
                            {hasPrice ? formatMoney(product.price!) : t("product.noPrice")}
                        </span>
                        {hasPrice && product.unitName ? <span className="text-[10px] font-bold text-muted-foreground">/ {product.unitName}</span> : null}
                        {hasDiscount ? (
                            <>
                                <span className="text-xs font-semibold text-muted-foreground line-through decoration-destructive/70 decoration-2">
                                    {formatMoney(product.oldPrice!)}
                                </span>
                                <span className="rounded-full bg-brand-orange/10 px-2 py-0.5 text-[9px] font-black text-brand-orange">
                                    {t("common.save")} {discount}%
                                </span>
                            </>
                        ) : null}
                    </div>

                    <div className="mt-3 flex gap-2">
                        <Button
                            type="button"
                            className="h-10 flex-1 rounded-xl px-3 text-xs font-bold shadow-sm transition active:scale-[0.98] sm:h-11 sm:text-sm"
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
                        <Button asChild type="button" variant="outline" size="icon" className="size-10 shrink-0 rounded-xl sm:hidden">
                            <Link viewTransition to={productPath(product)} aria-label={`View ${product.name}`}>
                                <ArrowUpRight className="size-4" />
                            </Link>
                        </Button>
                    </div>
                </div>
            </div>
        </article>
    );
}
