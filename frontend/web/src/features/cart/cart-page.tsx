import {
    ArrowRight,
    Minus,
    Plus,
    ShoppingBag,
    Trash2,
    Truck,
} from "lucide-react";
import { Link } from "react-router-dom";

import { imageUrl } from "../../shared/api/api-client";
import { Button } from "../../shared/components/ui/button";
import { useCart } from "./cart-context";
import { useI18n } from "../../i18n/i18n-provider";

export function CartPage() {
    const cart = useCart();
    const { t } = useI18n();

    const subtotal = cart.items.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0,
    );

    const shipping = subtotal >= 75 || !subtotal ? 0 : 7.5;
    const total = subtotal + shipping;

    if (!cart.items.length) {
        return (
            <main className="relative grid min-h-[70vh] place-items-center overflow-hidden px-4 py-20">
                <div className="pointer-events-none absolute left-1/2 top-1/2 size-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-3xl" />

                <div className="relative mx-auto max-w-xl text-center">
                    <span className="mx-auto grid size-20 place-items-center rounded-[28px] border bg-background text-primary shadow-xl shadow-primary/10 sm:size-24">
                        <ShoppingBag className="size-8 sm:size-10" />
                    </span>

                    <p className="mt-7 text-xs font-bold uppercase tracking-[0.2em] text-primary">
                        {t("cart.title")}
                    </p>

                    <h1 className="mt-3 text-3xl font-black tracking-[-0.04em] sm:text-5xl">
                        {t("cart.emptyTitle")}
                    </h1>

                    <p className="mx-auto mt-4 max-w-md text-sm leading-7 text-muted-foreground sm:text-base">
                        {t("cart.emptyDescription")}
                    </p>

                    <Button
                        asChild
                        size="lg"
                        className="mt-7 h-12 rounded-xl px-7 font-bold"
                    >
                        <Link to="/products">
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
            <main className="mx-auto w-full max-w-[1500px] px-4 pb-32 pt-7 sm:px-6 sm:pb-14 lg:px-8 lg:py-12">
                <div className="flex flex-col justify-between gap-4 border-b pb-6 sm:flex-row sm:items-end">
                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary sm:text-xs">
                            {t("checkout.orderSummary")}
                        </p>

                        <h1 className="mt-2 text-3xl font-black tracking-[-0.04em] sm:text-5xl">
                            {t("cart.title")}
                        </h1>

                        <p className="mt-2 text-sm text-muted-foreground">
                            {cart.items.length}{" "}
                            {cart.items.length === 1 ? "product" : "products"}{" "}
                            in your cart
                        </p>
                    </div>

                    <Button
                        asChild
                        variant="outline"
                        className="hidden rounded-xl sm:flex"
                    >
                        <Link to="/products">
                            {t("common.continueShopping")}
                            <ArrowRight className="size-4 rtl:rotate-180" />
                        </Link>
                    </Button>
                </div>

                <div className="mt-7 grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-10">
                    <section className="min-w-0">
                        <div className="grid gap-3 sm:gap-4">
                            {cart.items.map((item) => (
                                <article
                                    key={item.id}
                                    className="grid min-w-0 grid-cols-[105px_minmax(0,1fr)] gap-3 rounded-2xl border bg-card p-2.5 shadow-[0_6px_22px_rgba(15,23,42,0.05)] transition-shadow hover:shadow-md sm:grid-cols-[130px_minmax(0,1fr)_auto] sm:gap-5 sm:p-4"
                                >
                                    <Link
                                        to={`/products/${item.id}`}
                                        className="relative block overflow-hidden rounded-xl bg-muted"
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
                                                ×{item.quantity}
                                            </span>
                                        )}
                                    </Link>

                                    <div className="flex min-w-0 flex-col py-1">
                                        <Link
                                            to={`/products/${item.id}`}
                                            className="line-clamp-2 text-sm font-bold leading-5 transition-colors hover:text-primary sm:text-base sm:leading-6"
                                        >
                                            {item.name}
                                        </Link>

                                        <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
                                            ${item.price.toFixed(2)} each
                                        </p>

                                        <p className="mt-2 text-lg font-black tracking-tight sm:hidden">
                                            $
                                            {(
                                                item.price * item.quantity
                                            ).toFixed(2)}
                                        </p>

                                        <div className="mt-auto flex items-end justify-between gap-3 pt-3">
                                            <div className="inline-flex h-9 items-center overflow-hidden rounded-xl border bg-background shadow-sm">
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    className="size-9 rounded-none"
                                                    disabled={
                                                        item.quantity <= 1
                                                    }
                                                    onClick={() =>
                                                        cart.updateQuantity(
                                                            item.id,
                                                            item.quantity - 1,
                                                        )
                                                    }
                                                    aria-label={`Decrease ${item.name} quantity`}
                                                >
                                                    <Minus className="size-3.5" />
                                                </Button>

                                                <span className="grid h-9 min-w-9 place-items-center border-x px-2 text-xs font-bold">
                                                    {item.quantity}
                                                </span>

                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    className="size-9 rounded-none"
                                                    disabled={
                                                        item.quantity >=
                                                        item.stock
                                                    }
                                                    onClick={() =>
                                                        cart.updateQuantity(
                                                            item.id,
                                                            item.quantity + 1,
                                                        )
                                                    }
                                                    aria-label={`Increase ${item.name} quantity`}
                                                >
                                                    <Plus className="size-3.5" />
                                                </Button>
                                            </div>

                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                className="size-9 shrink-0 rounded-xl text-muted-foreground hover:bg-destructive/10 hover:text-destructive sm:hidden"
                                                onClick={() =>
                                                    cart.removeItem(item.id)
                                                }
                                                aria-label={`Remove ${item.name}`}
                                            >
                                                <Trash2 className="size-4" />
                                            </Button>
                                        </div>
                                    </div>

                                    <div className="hidden min-w-32 flex-col items-end justify-between py-1 sm:flex">
                                        <div className="text-end">
                                            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                                Item total
                                            </p>

                                            <p className="mt-1 text-xl font-black tracking-tight">
                                                $
                                                {(
                                                    item.price * item.quantity
                                                ).toFixed(2)}
                                            </p>
                                        </div>

                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            className="rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                            onClick={() =>
                                                cart.removeItem(item.id)
                                            }
                                        >
                                            <Trash2 className="size-4" />
                                            {t("common.remove")}
                                        </Button>
                                    </div>
                                </article>
                            ))}
                        </div>

                        {subtotal < 75 && (
                            <div className="mt-5 rounded-2xl border border-primary/15 bg-primary/5 p-4">
                                <div className="flex items-start gap-3">
                                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                                        <Truck className="size-5" />
                                    </span>

                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center justify-between gap-3">
                                            <p className="text-sm font-bold">
                                                You are close to free delivery
                                            </p>

                                            <span className="text-xs font-bold text-primary">
                                                ${(75 - subtotal).toFixed(2)}{" "}
                                                left
                                            </span>
                                        </div>

                                        <div className="mt-3 h-2 overflow-hidden rounded-full bg-primary/10">
                                            <div
                                                className="h-full rounded-full bg-primary transition-all"
                                                style={{
                                                    width: `${Math.min(
                                                        100,
                                                        (subtotal / 75) * 100,
                                                    )}%`,
                                                }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </section>

                    <aside className="sticky top-32 hidden h-max overflow-hidden rounded-2xl border bg-card shadow-[0_18px_45px_rgba(15,23,42,0.08)] lg:block">
                        <div className="border-b bg-muted/25 p-6">
                            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
                                {t("checkout.orderSummary")}
                            </p>

                            <h2 className="mt-2 text-3xl font-black tracking-[-0.04em]">
                                ${total.toFixed(2)}
                            </h2>
                        </div>

                        <div className="p-6">
                            <div className="grid gap-4 text-sm">
                                <div className="flex items-center justify-between text-muted-foreground">
                                    <span>{t("common.subtotal")}</span>

                                    <span className="font-bold text-foreground">
                                        ${subtotal.toFixed(2)}
                                    </span>
                                </div>

                                <div className="flex items-center justify-between text-muted-foreground">
                                    <span>{t("common.delivery")}</span>

                                    <span className="font-bold text-foreground">
                                        {shipping
                                            ? `$${shipping.toFixed(2)}`
                                            : t("common.free")}
                                    </span>
                                </div>

                                <div className="flex items-center justify-between border-t pt-4 text-base font-bold">
                                    <span>{t("common.total")}</span>
                                    <span className="text-xl">
                                        ${total.toFixed(2)}
                                    </span>
                                </div>
                            </div>

                            <Button
                                asChild
                                className="mt-6 h-12 w-full rounded-xl font-bold shadow-md shadow-primary/15"
                                size="lg"
                            >
                                <Link to="/checkout">
                                    {t("cart.checkout")}
                                    <ArrowRight className="size-4 rtl:rotate-180" />
                                </Link>
                            </Button>

                            <p className="mt-4 text-center text-xs leading-5 text-muted-foreground">
                                Taxes and delivery details are confirmed at
                                checkout.
                            </p>
                        </div>
                    </aside>
                </div>
            </main>

            <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 px-4 py-3 shadow-[0_-12px_35px_rgba(15,23,42,0.1)] backdrop-blur-xl lg:hidden">
                <div className="mx-auto flex max-w-xl items-center gap-4">
                    <div className="min-w-0">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                            {t("common.total")}
                        </p>

                        <p className="truncate text-xl font-black tracking-tight">
                            ${total.toFixed(2)}
                        </p>

                        <p className="text-[10px] text-muted-foreground">
                            {shipping
                                ? `Includes $${shipping.toFixed(2)} delivery`
                                : t("cart.freeDelivery")}
                        </p>
                    </div>

                    <Button asChild className="ms-auto h-12 min-w-44 rounded-xl px-5 font-bold shadow-md shadow-primary/15">
                        <Link to="/checkout">
                            {t("checkout.title")}
                            <ArrowRight className="size-4 rtl:rotate-180" />
                        </Link>
                    </Button>
                </div>
            </div>
        </>
    );
}
