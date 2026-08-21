import {
    AlertTriangle,
    ArrowRight,
    CircleCheck,
    CloudOff,
    LoaderCircle,
    LogIn,
    ShoppingBag,
    Trash2,
    Truck,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { imageUrl } from "../../shared/api/api-client";
import { Button } from "../../shared/components/ui/button";
import { formatMoney } from "../../shared/lib/money";
import { productPath } from "../../shared/lib/product-path";
import { getCheckoutConfiguration } from "../checkout/checkout-api";
import { getProducts } from "../catalog/catalog-api";
import {
    maximumCartQuantity,
    minimumCartQuantity,
    useCart,
    type CartItem,
} from "./cart-context";
import { useI18n } from "../../i18n/i18n-provider";
import { useCompany } from "../company/company-context";
import { useAuth } from "../auth/auth-context";
import { CartQuantityControl } from "./cart-quantity-control";

export function CartPage() {
    const cart = useCart();
    const { company } = useCompany();
    const { t, formatNumber } = useI18n();
    const configuration = useQuery({
        queryKey: ["checkout-configuration"],
        queryFn: getCheckoutConfiguration,
        staleTime: 5 * 60_000,
    });
    const productIds = Array.from(new Set(cart.items.map((item) => item.id))).sort((a, b) => a - b);
    const availability = useQuery({
        queryKey: ["cart-product-availability", productIds],
        queryFn: async () => {
            const chunks: number[][] = [];
            for (let index = 0; index < productIds.length; index += 100) {
                chunks.push(productIds.slice(index, index + 100));
            }
            const pages = await Promise.all(
                chunks.map((ids) => getProducts({ ids, page: 1, pageSize: 100, isActive: true })),
            );
            return pages.flatMap((page) => page.items);
        },
        enabled: productIds.length > 0,
        staleTime: 15_000,
        refetchOnWindowFocus: true,
    });
    const productsById = new Map((availability.data ?? []).map((product) => [product.id, product]));
    const availabilityReady = availability.isSuccess;
    const currentCartItem = (item: CartItem): CartItem => {
        if (!availabilityReady) return item;
        const product = productsById.get(item.id);
        if (!product) return { ...item, stock: 0 };
        const factor = item.conversionFactor && item.conversionFactor > 0 ? item.conversionFactor : 1;
        const quickOrderQuantities = product.quickOrderQuantities?.length
            ? product.quickOrderQuantities
            : company?.settings.defaultQuickOrderQuantities ?? [];
        return {
            ...item,
            stock: Math.max(0, product.stock / factor),
            quantityStep: product.orderQuantityStep > 0 ? product.orderQuantityStep : 1,
            quickOrderQuantities,
        };
    };
    const availabilityIssue = (item: CartItem) => {
        if (!availabilityReady) return null;
        const live = currentCartItem(item);
        const minimum = minimumCartQuantity(live);
        const maximum = maximumCartQuantity(live);
        if (maximum < minimum) return "unavailable" as const;
        if (item.quantity > maximum + Number.EPSILON) return "quantity" as const;
        return null;
    };
    const hasAvailabilityIssue = cart.items.some((item) => availabilityIssue(item) !== null);

    const subtotal = cart.items.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0,
    );

    const rules = configuration.data;
    const threshold = rules?.freeShippingThreshold ?? 0;
    const qualifiesForFreeShipping = threshold > 0 && subtotal >= threshold;
    const shipping =
        !subtotal || !rules?.shippingEnabled || qualifiesForFreeShipping
            ? 0
            : rules.flatShippingFee;
    const total = subtotal + shipping;

    if (!cart.items.length) {
        return (
            <main className="relative grid min-h-[62vh] place-items-center overflow-hidden px-4 py-14">
                <div className="pointer-events-none absolute left-1/2 top-1/2 size-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-3xl" />

                <div className="relative mx-auto max-w-xl text-center">
                    <span className="mx-auto grid size-16 place-items-center rounded-2xl border bg-background text-primary shadow-xl shadow-primary/10 sm:size-20">
                        <ShoppingBag className="size-8 sm:size-10" />
                    </span>

                    <p className="mt-5 text-xs font-bold uppercase tracking-[0.2em] text-primary">
                        {t("cart.title")}
                    </p>

                    <h1 className="mt-1.5 text-2xl font-black tracking-[-0.035em] sm:text-4xl">
                        {t("cart.emptyTitle")}
                    </h1>

                    <p className="mx-auto mt-4 max-w-md text-sm leading-7 text-muted-foreground sm:text-base">
                        {t("cart.emptyDescription")}
                    </p>

                    <CartSyncStatus status={cart.syncStatus} className="mx-auto mt-4" />

                    <Button
                        asChild
                        size="lg"
                        className="mt-6 h-11 rounded-lg px-6 font-bold"
                    >
                        <Link viewTransition to="/products">
                            {t("wishlist.explore")}
                            <ArrowRight className="size-4 rtl:rotate-180" />
                        </Link>
                    </Button>
                </div>
            </main>
        );
    }

    return (
        <>
            <main className="mx-auto w-full max-w-[1380px] px-4 pb-40 pt-6 sm:px-6 md:pb-28 lg:px-8 lg:py-9">
                <div className="flex flex-col justify-between gap-4 border-b pb-5 sm:flex-row sm:items-end">
                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary sm:text-xs">
                            {t("checkout.orderSummary")}
                        </p>

                        <h1 className="mt-1.5 text-3xl font-black tracking-[-0.035em] sm:text-4xl">
                            {t("cart.title")}
                        </h1>

                        <p className="mt-2 text-sm text-muted-foreground">
                            {t("cart.itemsInCart", { count: cart.items.length })}
                        </p>
                        <CartSyncStatus status={cart.syncStatus} className="mt-3" />
                    </div>

                    <Button
                        asChild
                        variant="outline"
                        className="hidden rounded-lg sm:flex"
                    >
                        <Link viewTransition to="/products">
                            {t("common.continueShopping")}
                            <ArrowRight className="size-4 rtl:rotate-180" />
                        </Link>
                    </Button>
                </div>

                <div className="mt-5 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-6">
                    <section className="min-w-0">
                        <div className="grid gap-3">
                            {cart.items.map((item) => (
                                <article
                                    key={item.lineKey}
                                    className="grid min-w-0 grid-cols-[92px_minmax(0,1fr)] gap-3 rounded-2xl border border-border/80 bg-card p-2.5 shadow-none transition-colors hover:border-primary/25 sm:grid-cols-[112px_minmax(0,1fr)_auto] sm:gap-4 sm:p-3.5 dark:border-white/[0.09]"
                                >
                                    <Link viewTransition
                                        to={productPath(item)}
                                        className="relative block overflow-hidden rounded-lg bg-muted"
                                    >
                                        <img
                                            className="aspect-square size-full object-cover transition-transform duration-500 hover:scale-105"
                                            src={
                                                imageUrl(item.image) ||
                                                "/placeholder-product.svg"
                                            }
                                            alt={item.name}
                                        />

                                        {item.quantity > 1 && (
                                            <span className="absolute bottom-2 right-2 grid min-w-6 place-items-center rounded-full bg-background/90 px-1.5 text-[10px] font-bold leading-6 shadow-sm backdrop-blur sm:hidden">
                                                ×{formatNumber(item.quantity)}
                                            </span>
                                        )}
                                    </Link>

                                    <div className="flex min-w-0 flex-col py-1">
                                        <Link viewTransition
                                            to={productPath(item)}
                                            className="line-clamp-2 text-sm font-bold leading-5 transition-colors hover:text-primary sm:text-base sm:leading-6"
                                        >
                                            {item.name}
                                        </Link>
                                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                            {item.unitName ? <span className="inline-flex w-fit rounded-full border border-primary/15 bg-primary/5 px-2 py-0.5 text-[10px] font-bold text-primary">{formatNumber(item.quantity)} {item.unitName}</span> : null}
                                        </div>

                                        <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
                                            {formatMoney(item.price)} {item.unitName ? `/ ${item.unitName}` : t("cart.each")}
                                        </p>

                                        {availabilityIssue(item) ? (
                                            <p className="mt-1.5 flex items-start gap-1.5 text-[11px] font-semibold leading-4 text-destructive sm:text-xs">
                                                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                                                <span>
                                                    {availabilityIssue(item) === "unavailable"
                                                        ? t("cart.itemUnavailable")
                                                        : t("cart.quantityUnavailable", {
                                                              count: maximumCartQuantity(currentCartItem(item)),
                                                          })}
                                                </span>
                                            </p>
                                        ) : null}

                                        <p className="mt-1.5 text-base font-black tracking-tight sm:hidden">
                                            {formatMoney(item.price * item.quantity)}
                                        </p>

                                        <div className="mt-auto flex items-end justify-between gap-3 pt-2.5">
                                            <CartQuantityControl
                                                item={currentCartItem(item)}
                                                compact
                                                showQuickQuantities
                                                className="max-w-[13rem]"
                                            />

                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                className="size-8 shrink-0 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive sm:hidden"
                                                onClick={() =>
                                                    cart.removeItem(item.lineKey)
                                                }
                                                aria-label={`Remove ${item.name}`}
                                            >
                                                <Trash2 className="size-4" />
                                            </Button>
                                        </div>
                                    </div>

                                    <div className="hidden min-w-28 flex-col items-end justify-between py-1 sm:flex">
                                        <div className="text-end">
                                            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                                {t("cart.itemTotal")}
                                            </p>

                                            <p className="mt-1 text-lg font-black tracking-tight">
                                                {formatMoney(item.price * item.quantity)}
                                            </p>
                                        </div>

                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            className="rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                            onClick={() =>
                                                cart.removeItem(item.lineKey)
                                            }
                                        >
                                            <Trash2 className="size-4" />
                                            {t("common.remove")}
                                        </Button>
                                    </div>
                                </article>
                            ))}
                        </div>

                        {rules?.shippingEnabled && threshold > 0 && subtotal < threshold && (
                            <div className="mt-4 rounded-xl border border-primary/15 bg-primary/5 p-3.5">
                                <div className="flex items-start gap-3">
                                    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                                        <Truck className="size-5" />
                                    </span>

                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center justify-between gap-3">
                                            <p className="text-sm font-bold">
                                                {t("cart.closeToFreeDelivery")}
                                            </p>

                                            <span className="text-xs font-bold text-primary">
                                                {t("cart.amountLeft", {
                                                    amount: formatMoney(threshold - subtotal),
                                                })}
                                            </span>
                                        </div>

                                        <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-primary/10">
                                            <div
                                                className="h-full rounded-full bg-primary transition-all"
                                                style={{
                                                    width: `${Math.min(
                                                        100,
                                                        (subtotal / threshold) * 100,
                                                    )}%`,
                                                }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </section>

                    <aside className="sticky top-28 hidden h-max overflow-hidden rounded-xl border bg-card shadow-[0_18px_45px_rgba(15,23,42,0.08)] lg:block">
                        <div className="border-b bg-muted/25 p-4">
                            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
                                {t("checkout.orderSummary")}
                            </p>

                            <h2 className="mt-1.5 text-2xl font-black tracking-[-0.04em]">
                                {formatMoney(total)}
                            </h2>
                        </div>

                        <div className="p-4">
                            <div className="grid gap-3 text-sm">
                                <div className="flex items-center justify-between text-muted-foreground">
                                    <span>{t("common.subtotal")}</span>

                                    <span className="font-bold text-foreground">
                                        {formatMoney(subtotal)}
                                    </span>
                                </div>

                                <div className="flex items-center justify-between text-muted-foreground">
                                    <span>{t("common.delivery")}</span>

                                    <span className="font-bold text-foreground">
                                        {shipping
                                            ? formatMoney(shipping)
                                            : t("common.free")}
                                    </span>
                                </div>

                                <div className="flex items-center justify-between border-t pt-3 text-base font-bold">
                                    <span>{t("common.total")}</span>
                                    <span className="text-xl">
                                        {formatMoney(total)}
                                    </span>
                                </div>
                            </div>

                            {hasAvailabilityIssue ? (
                                <Button
                                    className="mt-4 h-11 w-full rounded-lg font-bold"
                                    size="lg"
                                    disabled
                                >
                                    <AlertTriangle className="size-4" />
                                    {t("cart.resolveAvailability")}
                                </Button>
                            ) : (
                                <Button
                                    asChild
                                    className="mt-4 h-11 w-full rounded-xl font-bold shadow-none"
                                    size="lg"
                                >
                                    <Link viewTransition to="/checkout">
                                        {t("cart.checkout")}
                                        <ArrowRight className="size-4 rtl:rotate-180" />
                                    </Link>
                                </Button>
                            )}

                            <p className={hasAvailabilityIssue ? "mt-3 text-center text-xs leading-5 text-destructive" : "mt-3 text-center text-xs leading-5 text-muted-foreground"}>
                                {hasAvailabilityIssue ? t("cart.stockChanged") : t("cart.checkoutDisclaimer")}
                            </p>
                        </div>
                    </aside>
                </div>
            </main>

            <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 border-t bg-background/95 px-4 py-2.5 shadow-[0_-12px_35px_rgba(15,23,42,0.1)] backdrop-blur-xl md:bottom-0 lg:hidden">
                <div className="mx-auto flex max-w-xl items-center gap-4">
                    <div className="min-w-0">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                            {t("common.total")}
                        </p>

                        <p className="truncate text-lg font-black tracking-tight">
                            {formatMoney(total)}
                        </p>

                        <p className="text-[10px] text-muted-foreground">
                            {shipping
                                ? t("cart.includesDelivery", { amount: formatMoney(shipping) })
                                : t("cart.freeDelivery")}
                        </p>
                    </div>

                    {hasAvailabilityIssue ? (
                        <Button disabled className="ms-auto h-11 min-w-40 rounded-lg px-4 font-bold">
                            <AlertTriangle className="size-4" />
                            {t("cart.resolveAvailability")}
                        </Button>
                    ) : (
                        <Button asChild className="ms-auto h-11 min-w-40 rounded-xl px-4 font-bold shadow-none">
                            <Link viewTransition to="/checkout">
                                {t("checkout.title")}
                                <ArrowRight className="size-4 rtl:rotate-180" />
                            </Link>
                        </Button>
                    )}
                </div>
            </div>
        </>
    );
}

function CartSyncStatus({ status, className = "" }: { status: "local" | "syncing" | "synced" | "offline"; className?: string }) {
    const auth = useAuth();
    const { t } = useI18n();

    if (!auth.isAuthenticated) {
        return (
            <Link
                viewTransition
                to="/account/login"
                className={`inline-flex w-fit items-center gap-1.5 rounded-full border border-primary/15 bg-primary/5 px-3 py-1.5 text-[11px] font-bold text-primary transition-colors hover:bg-primary/10 ${className}`}
            >
                <LogIn className="size-3.5" />
                {t("cart.syncAccountRequired")}
            </Link>
        );
    }

    const content = status === "synced"
        ? { icon: <CircleCheck className="size-3.5" />, label: t("cart.synced"), tone: "text-emerald-700 dark:text-emerald-400" }
        : status === "offline"
          ? { icon: <CloudOff className="size-3.5" />, label: t("cart.syncOffline"), tone: "text-amber-700 dark:text-amber-400" }
          : { icon: <LoaderCircle className="size-3.5 animate-spin" />, label: t("cart.syncing"), tone: "text-muted-foreground" };

    return (
        <span
            aria-live="polite"
            className={`inline-flex w-fit items-center gap-1.5 text-[11px] font-bold ${content.tone} ${className}`}
        >
            {content.icon}
            {content.label}
        </span>
    );
}
