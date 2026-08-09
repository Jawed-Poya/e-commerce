import {
  BellRing,
  ChevronLeft,
  ChevronRight,
  Eye,
  Heart,
  PackageCheck,
  ShoppingBag,
  Star,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { apiGet, apiPost, imageUrl } from "../../shared/api/api-client";
import { Badge } from "../../shared/components/ui/badge";
import { Button } from "../../shared/components/ui/button";
import { Skeleton } from "../../shared/components/ui/skeleton";
import { formatMoney } from "../../shared/lib/money";
import { cn } from "../../shared/lib/utils";
import type { ProductDetails } from "../../shared/types/product";
import {
  cartLineKey,
  maximumCartQuantity,
  minimumCartQuantity,
  useCart,
} from "../cart/cart-context";
import { useStoreNotifications } from "../notifications/notification-context";
import { ProductReviews } from "../reviews/product-reviews";
import { CartQuantityControl } from "../cart/cart-quantity-control";
import { useI18n } from "../../i18n/i18n-provider";
import { useCompany } from "../company/company-context";

export function ProductPage() {
  const { id: identifier } = useParams();
  const numericIdentifier = Number(identifier);
  const isNumericIdentifier = Number.isInteger(numericIdentifier) && numericIdentifier > 0;

  const q = useQuery({
    queryKey: ["product", identifier],
    queryFn: () =>
      apiGet<ProductDetails>(
        isNumericIdentifier
          ? `/products/${numericIdentifier}`
          : `/products/by-slug/${encodeURIComponent(identifier ?? "")}`,
      ),
    enabled: Boolean(identifier),
  });

  const [selected, setSelected] = useState<number | null>(null);
  const [selectedUnitId, setSelectedUnitId] = useState<number | null>(null);
  const cart = useCart();
  const { company } = useCompany();
  const {
    trackProduct,
    permission: notificationPermission,
    enableBrowserNotifications,
  } = useStoreNotifications();
  const { t } = useI18n();
  const productId = q.data?.isActive ? q.data.id : undefined;

  useEffect(() => {
    if (!productId) return;

    trackProduct(productId);
    const viewKey = `easycart-product-view-${productId}`;
    if (sessionStorage.getItem(viewKey)) return;

    sessionStorage.setItem(viewKey, "1");
    void apiPost<void>(`/products/${productId}/views`).catch(() => {
      sessionStorage.removeItem(viewKey);
    });
  }, [productId, trackProduct]);

  useEffect(() => {
    if (!q.data) return;
    const activeUnits = q.data.unitConversions.filter((unit) => unit.isActive);
    const isOrderable = (unit: (typeof activeUnits)[number]) => {
      const step = unit.orderQuantityStep > 0 ? unit.orderQuantityStep : 1;
      return unit.price != null && unit.availableQuantity >= step;
    };
    const preferred = activeUnits.find((unit) => unit.isDefault && isOrderable(unit))
      ?? activeUnits.find(isOrderable)
      ?? activeUnits.find((unit) => unit.isDefault)
      ?? activeUnits.find((unit) => unit.isBaseUnit)
      ?? activeUnits[0];
    setSelectedUnitId(preferred?.unitId ?? q.data.unitId ?? null);
  }, [q.data]);

  if (q.isLoading) {
    return (
      <div className="mx-auto w-full max-w-[1500px] px-4 py-6 sm:px-6 sm:py-10 lg:px-8">
        <div className="grid gap-7 lg:grid-cols-2 lg:gap-14">
          <div>
            <Skeleton className="aspect-square rounded-2xl" />

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
            <Skeleton className="h-11 w-4/5 rounded-xl" />
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-12 w-40 rounded-xl" />
            <Skeleton className="h-20 w-full rounded-2xl" />
            <Skeleton className="h-12 w-full rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (!q.data || !q.data.isActive) {
    return (
      <div className="mx-auto grid min-h-[65vh] max-w-xl place-items-center px-4 py-20 text-center">
        <div>
          <span className="mx-auto grid size-12 place-items-center rounded-2xl border bg-muted text-muted-foreground">
            <ShoppingBag className="size-7" />
          </span>

          <h1 className="mt-6 text-3xl font-black tracking-tight">
            {t("product.notFound")}
          </h1>

          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            {t("product.notFoundDescription")}
          </p>

          <Button asChild className="mt-7 rounded-xl">
            <Link viewTransition to="/products">
              <ChevronLeft className="size-4" />
              {t("common.backToShop")}
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  const p = q.data;

  const unitOptions = p.unitConversions.length
    ? p.unitConversions.filter(unit => unit.isActive)
    : [{
        id: null,
        unitId: p.unitId ?? 0,
        unitName: p.unitName ?? t("product.unit"),
        conversionFactor: 1,
        barcode: p.barcode,
        priceOverride: null,
        oldPriceOverride: null,
        orderQuantityStep: p.orderQuantityStep || 1,
        isBaseUnit: true,
        isDefault: true,
        isActive: true,
        sortOrder: 0,
        availableQuantity: p.stock,
        price: p.price,
        oldPrice: p.oldPrice,
      }];
  const selectedUnit = unitOptions.find(unit => unit.unitId === selectedUnitId)
    ?? unitOptions.find(unit => unit.isDefault)
    ?? unitOptions[0];
  const factor = selectedUnit?.conversionFactor && selectedUnit.conversionFactor > 0
    ? selectedUnit.conversionFactor
    : 1;
  const price = selectedUnit?.price ?? p.price;
  const oldPrice = selectedUnit?.oldPrice ?? p.oldPrice;
  const hasPrice = price != null;
  const stock = selectedUnit?.availableQuantity ?? p.stock;

  const active =
    p.images.find((x) => x.id === selected) ??
    p.images.find((x) => x.isPrimary) ??
    p.images[0];

  const liked = cart.wishlist.includes(p.id);
  const selectedCartLineKey = cartLineKey(
    p.id,
    selectedUnit?.unitId ?? p.unitId,
  );
  const cartItem = cart.items.find(
    (item) => item.lineKey === selectedCartLineKey,
  );
  const quantityStep = selectedUnit?.orderQuantityStep || p.orderQuantityStep || 1;
  const minimumQuantity = minimumCartQuantity({ stock, quantityStep });
  const maximumQuantity = maximumCartQuantity({ stock, quantityStep });
  const hasOrderableStock = maximumQuantity >= minimumQuantity;
  const canAddToCart = hasPrice && hasOrderableStock;
  const notificationLabel =
    notificationPermission === "granted"
      ? t("product.alertsEnabled")
      : notificationPermission === "denied"
        ? t("product.alertsBlocked")
        : notificationPermission === "unsupported"
          ? t("product.alertsUnavailable")
          : t("product.enableAlerts");

  const addToCart = () =>
    cart.addItem({
      id: p.id,
      name: p.name,
      image: active?.url,
      price: price!,
      stock,
      unitId: selectedUnit?.unitId ?? p.unitId,
      unitName: selectedUnit?.unitName ?? p.unitName,
      conversionFactor: factor,
      quantityStep,
      slug: p.slug,
      minimumValue: null,
      maximumValue: null,
    });

  return (
    <>
      <div className="mx-auto w-full max-w-[1500px] px-4 pb-28 pt-5 sm:px-6 sm:pb-14 sm:pt-8 lg:px-8 lg:pt-10">
        <nav className="mb-5 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground sm:mb-8">
          <Link viewTransition
            to="/products"
            className="mr-1 grid size-8 shrink-0 place-items-center rounded-full border bg-background transition-colors hover:border-primary/30 hover:text-primary sm:hidden"
            aria-label={t("common.backToShop")}
          >
            <ChevronLeft className="size-4" />
          </Link>

          <Link viewTransition
            to="/"
            className="hidden transition-colors hover:text-primary sm:inline"
          >
            {t("common.home")}
          </Link>

          <ChevronRight className="hidden size-3.5 opacity-50 sm:block" />

          <Link viewTransition to="/products" className="transition-colors hover:text-primary">
            {t("common.products")}
          </Link>

          <ChevronRight className="size-3.5 shrink-0 opacity-50" />

          <span className="truncate font-medium text-foreground">{p.name}</span>
        </nav>

        <div className="grid items-start gap-7 lg:grid-cols-[1.05fr_.95fr] lg:gap-14 xl:gap-20">
          {/* Product gallery */}
          <section className="min-w-0 lg:sticky lg:top-32">
            <div className="relative aspect-square overflow-hidden rounded-2xl border bg-gradient-to-b from-muted/40 to-muted shadow-[0_20px_60px_-35px_rgba(15,23,42,0.35)]">
              <img
                className="size-full object-contain p-3 transition-all duration-500 sm:p-5 lg:p-6"
                src={imageUrl(active?.url) || "/placeholder-product.svg"}
                alt={p.name}
              />

              <div className="absolute left-3 top-3 flex flex-wrap gap-2 sm:left-5 sm:top-5">
                {p.isFeatured && (
                  <Badge className="rounded-full border border-white/20 bg-primary/95 px-3 py-1 text-[10px] font-bold text-primary-foreground shadow-md backdrop-blur">
                    {t("product.featured")}
                  </Badge>
                )}

                <Badge
                  className={cn(
                    "rounded-full border px-3 py-1 text-[10px] font-bold shadow-md backdrop-blur",
                    hasOrderableStock
                      ? "border-emerald-500/20 bg-emerald-500/90 text-white"
                      : "border-white/20 bg-slate-950/80 text-white",
                  )}
                >
                  {hasOrderableStock ? t("product.inStock") : t("product.unavailable")}
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
                aria-label={liked ? t("wishlist.remove") : t("wishlist.add")}
              >
                <Heart className={cn("size-4.5", liked && "fill-current")} />
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
              <Badge className="rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em]">
                {p.categoryName}
              </Badge>

              {p.isFeatured && (
                <Badge className="rounded-full bg-brand-orange px-3 py-1 text-[10px] font-bold text-white">
                  {t("product.featured")}
                </Badge>
              )}
            </div>

            <h1 className="mt-3 text-2xl font-black leading-tight tracking-[-0.035em] sm:mt-4 sm:text-3xl lg:text-4xl">
              {p.name}
            </h1>

            {p.strength ? (
              <div className="mt-3 inline-flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2">
                <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                  {t("product.strength")}
                </span>
                <strong className="text-sm font-black text-primary sm:text-base">
                  {p.strength}
                </strong>
              </div>
            ) : null}

            <p className="mt-4 text-sm leading-7 text-muted-foreground sm:mt-5 sm:text-base sm:leading-8">
              {p.shortDescription || t("product.defaultDescription")}
            </p>

            <div className="mt-6 flex items-end justify-between gap-4 border-y py-5">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                  {t("product.currentPrice")}
                </p>

                <p className="mt-1 text-2xl font-black tracking-[-0.035em] text-primary sm:text-3xl">
                  {hasPrice ? formatMoney(price) : t("product.noPrice")}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {hasPrice && selectedUnit?.unitName ? <span className="rounded-full border border-primary/15 bg-primary/5 px-2.5 py-1 text-xs font-bold text-primary">{t("product.perUnit", { unit: selectedUnit.unitName })}</span> : null}
                  {oldPrice != null && price != null && oldPrice > price ? <span className="text-sm font-semibold text-muted-foreground line-through decoration-destructive/70 decoration-2">{formatMoney(oldPrice)}</span> : null}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="rounded-full bg-primary/10 px-2.5 py-1 font-bold text-primary">
                    {p.isDefaultPrice
                      ? t("product.defaultTierPrice", {
                          type: p.priceCustomerTypeName ?? t("product.general"),
                        })
                      : t("product.tierPrice", {
                          type:
                            p.priceCustomerTypeName ?? t("product.customer"),
                        })}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Eye className="size-3.5" />{" "}
                    {t("product.views", { count: p.viewCount })}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Star className="size-3.5 fill-amber-400 text-amber-400" />
                    {p.reviewCount > 0 ? p.averageRating.toFixed(1) : "—"} ({p.reviewCount})
                  </span>
                </div>
              </div>

              <div className="text-end">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                  {t("product.availability")}
                </p>

                <p
                  className={cn(
                    "mt-1 text-sm font-bold",
                    hasOrderableStock
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-destructive",
                  )}
                >
                  {hasOrderableStock
                    ? `${t("product.availableCount", { count: stock })}${selectedUnit?.unitName ? ` ${selectedUnit.unitName}` : ""}`
                    : t("product.soldOut")}
                </p>
              </div>
            </div>

            {unitOptions.length > 1 ? (
              <div className="mt-5 rounded-2xl border border-border/80 bg-card p-4 dark:border-white/12 sm:p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-black">{t("product.chooseSellingUnit")}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{t("product.unitConversionHelp")}</p>
                  </div>
                  <span className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-bold text-muted-foreground">{t("product.baseUnit", { unit: p.unitName ?? "—" })}</span>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {unitOptions.map(unit => (
                    <button
                      key={`${unit.unitId}-${unit.isBaseUnit ? "base" : unit.id}`}
                      type="button"
                      onClick={() => setSelectedUnitId(unit.unitId)}
                      className={cn(
                        "rounded-xl border px-3 py-3 text-start transition",
                        selectedUnit?.unitId === unit.unitId
                          ? "border-primary bg-primary/8 shadow-sm"
                          : "border-border/70 bg-background hover:border-primary/30 dark:border-white/10",
                      )}
                    >
                      <span className="block text-sm font-black">{unit.unitName}</span>
                      <span className="mt-1 block text-[10px] text-muted-foreground">{unit.isBaseUnit ? t("product.baseInventoryUnit") : t("product.unitEquation", { unit: unit.unitName, factor: unit.conversionFactor, baseUnit: p.unitName ?? t("product.unit") })}</span>
                      <span className="mt-2 block text-xs font-bold text-primary">{unit.price != null ? formatMoney(unit.price) : t("product.noPrice")}</span>
                      <span className={cn(
                        "mt-2 inline-flex rounded-full px-2 py-0.5 text-[9px] font-black",
                        unit.price != null && unit.availableQuantity >= (unit.orderQuantityStep > 0 ? unit.orderQuantityStep : 1)
                          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                          : "bg-destructive/10 text-destructive",
                      )}>
                        {unit.price != null && unit.availableQuantity >= (unit.orderQuantityStep > 0 ? unit.orderQuantityStep : 1)
                          ? t("product.inStock")
                          : t("product.unavailable")}
                      </span>
                      {unit.orderQuantityStep > 1 ? (
                        <Badge variant="secondary" className="mt-2 h-5 border border-primary/15 bg-primary/[0.06] px-1.5 text-[9px] font-black text-primary">
                          {t("cart.quantityStep", { count: unit.orderQuantityStep })}
                        </Badge>
                      ) : null}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div
              className={cn(
                "mt-5 flex items-start gap-3 rounded-2xl border p-4 sm:p-5",
                hasOrderableStock
                  ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300"
                  : "border-destructive/20 bg-destructive/5 text-destructive",
              )}
            >
              <span
                className={cn(
                  "grid size-10 shrink-0 place-items-center rounded-xl",
                  hasOrderableStock ? "bg-emerald-500/10" : "bg-destructive/10",
                )}
              >
                <PackageCheck className="size-5" />
              </span>

              <div>
                <b className="block text-sm">
                  {hasOrderableStock
                    ? t("product.readyToOrder")
                    : t("product.unavailable")}
                </b>

                <small className="mt-1 block leading-5 opacity-80">
                  {hasOrderableStock
                    ? `${t("product.stockDescription", { count: stock })}${selectedUnit?.unitName ? ` ${selectedUnit.unitName}` : ""}`
                    : t("product.unavailableDescription")}
                </small>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>{t("product.alertTrackingDescription", { company: company?.name ?? "" })}</span>
            </div>

            <div className="mt-6 hidden gap-3 sm:flex">
              {cartItem && canAddToCart ? (
                <CartQuantityControl
                  item={cartItem}
                  className="min-w-0 flex-1"
                />
              ) : (
                <Button
                  size="lg"
                  className="h-11 flex-1 rounded-lg font-bold shadow-md shadow-primary/15"
                  disabled={!canAddToCart}
                  onClick={addToCart}
                >
                  <ShoppingBag className="size-4.5" />
                  {!hasOrderableStock
                    ? t("product.soldOut")
                    : hasPrice
                      ? t("product.addToCart")
                      : t("product.noPrice")}
                </Button>
              )}

              <Button
                size="lg"
                variant="outline"
                disabled={notificationPermission === "denied" || notificationPermission === "unsupported"}
                onClick={() => void enableBrowserNotifications()}
                className={cn(
                  "h-11 rounded-lg px-4",
                  notificationPermission === "granted" &&
                    "border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300",
                )}
              >
                <BellRing className="size-4.5" />
                <span className="hidden md:inline">{notificationLabel}</span>
              </Button>

              <Button
                size="lg"
                variant="outline"
                className={cn(
                  "h-11 rounded-lg px-4",
                  liked &&
                    "border-brand-orange bg-brand-orange/5 text-brand-orange",
                )}
                onClick={() => cart.toggleWishlist(p.id)}
              >
                <Heart className={cn("size-4.5", liked && "fill-current")} />

                <span className="hidden md:inline">
                  {liked ? t("product.saved") : t("common.wishlist")}
                </span>
              </Button>
            </div>

            <div className="mt-8 border-t pt-7">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary">
                  {t("product.details")}
                </p>

                <h2 className="mt-2 text-xl font-black">
                  {t("product.information")}
                </h2>
              </div>

              {p.description && (
                <p className="mt-4 whitespace-pre-line text-sm leading-7 text-muted-foreground">
                  {p.description}
                </p>
              )}

              <dl className="mt-6 overflow-hidden rounded-2xl border bg-card">
                {[
                  [t("product.category"), p.categoryName],
                  [t("product.brand"), p.brandName],
                  [t("product.strength"), p.strength],
                  [t("product.unit"), p.unitName],
                  [t("product.barcode"), p.barcode],
                ]
                  .filter((item) => item[1])
                  .map((item, index, values) => (
                    <div
                      key={item[0]}
                      className={cn(
                        "flex items-center justify-between gap-6 px-4 py-3.5 text-sm sm:px-5",
                        index !== values.length - 1 && "border-b",
                      )}
                    >
                      <dt className="text-muted-foreground">{item[0]}</dt>

                      <dd className="max-w-[60%] text-end font-semibold">
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
      <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 px-4 py-2.5 shadow-[0_-10px_35px_rgba(15,23,42,0.08)] backdrop-blur-xl sm:hidden">
        <div className="mx-auto flex max-w-lg items-center gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {t("product.totalPrice")}
            </p>

            <p className="text-xl font-black tracking-tight text-primary">
              {hasPrice ? formatMoney(price) : t("product.noPrice")}
            </p>
            {selectedUnit?.unitName ? <p className="text-[10px] font-bold text-muted-foreground">per {selectedUnit.unitName}</p> : null}
          </div>

          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => cart.toggleWishlist(p.id)}
            className={cn(
              "ms-auto size-11 shrink-0 rounded-xl",
              liked &&
                "border-brand-orange bg-brand-orange/5 text-brand-orange",
            )}
            aria-label={liked ? t("wishlist.remove") : t("wishlist.add")}
          >
            <Heart className={cn("size-4.5", liked && "fill-current")} />
          </Button>

          {cartItem && canAddToCart ? (
            <CartQuantityControl
              item={cartItem}
              className="ms-auto"
            />
          ) : (
            <Button
              type="button"
              className="h-11 min-w-36 rounded-xl px-5 font-bold shadow-md shadow-primary/15"
              disabled={!canAddToCart}
              onClick={addToCart}
            >
              <ShoppingBag className="size-4" />
              {!hasOrderableStock
                ? t("product.soldOut")
                : hasPrice
                  ? t("product.addToCart")
                  : t("product.noPrice")}
            </Button>
          )}
        </div>
      </div>
      <ProductReviews productId={p.id} />
    </>
  );
}
