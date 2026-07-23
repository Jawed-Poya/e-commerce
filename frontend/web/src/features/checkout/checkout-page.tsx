import { useQuery } from "@tanstack/react-query";
import {
    ArrowLeft,
    BadgeCheck,
    Banknote,
    Building2,
    CreditCard,
    LoaderCircle,
    LockKeyhole,
    MapPin,
    PackageCheck,
    Phone,
    ShoppingBag,
    Truck,
} from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";

import { useAuth } from "../auth/auth-context";
import { useCart } from "../cart/cart-context";
import { saveRecentOrder } from "../orders/recent-orders";
import { imageUrl, ApiError } from "../../shared/api/api-client";
import { Button } from "../../shared/components/ui/button";
import { formatMoney } from "../../shared/lib/money";
import { createOrder, getCheckoutConfiguration } from "./checkout-api";
import { useI18n } from "../../i18n/i18n-provider";
import type {
    CreateOrderRequest,
    OrderConfirmation,
    PaymentMethod,
} from "./checkout-types";

interface CheckoutForm {
    firstName: string;
    lastName: string;
    phone: string;
    email: string;
    recipientName: string;
    addressLine1: string;
    addressLine2: string;
    city: string;
    state: string;
    country: string;
    postalCode: string;
    notes: string;
    paymentMethod: PaymentMethod;
    bankTransferReference: string;
}

const initialForm: CheckoutForm = {
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    recipientName: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    country: "Afghanistan",
    postalCode: "",
    notes: "",
    paymentMethod: "CashOnDelivery",
    bankTransferReference: "",
};

export function CheckoutPage() {
    const cart = useCart();
    const { t } = useI18n();
    const auth = useAuth();
    const navigate = useNavigate();
    const [form, setForm] = useState(initialForm);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!auth.user) return;
        const names = auth.user.fullName.trim().split(/\s+/);
        setForm((current) => ({
            ...current,
            firstName: current.firstName || names[0] || "",
            lastName: current.lastName || names.slice(1).join(" "),
            recipientName: current.recipientName || auth.user!.fullName,
            phone: current.phone || auth.user!.phone || "",
            email: current.email || auth.user!.email || "",
        }));
    }, [auth.user]);

    const configQuery = useQuery({
        queryKey: ["checkout-configuration"],
        queryFn: getCheckoutConfiguration,
    });

    const subtotal = useMemo(
        () =>
            cart.items.reduce(
                (sum, item) => sum + item.price * item.quantity,
                0,
            ),
        [cart.items],
    );

    const config = configQuery.data;
    const qualifiesForFreeShipping =
        Boolean(config) &&
        config!.freeShippingThreshold > 0 &&
        subtotal >= config!.freeShippingThreshold;
    const shipping =
        config?.shippingEnabled && !qualifiesForFreeShipping
            ? config.flatShippingFee
            : 0;
    const estimatedTotal = subtotal + shipping;
    const bankOption = config?.paymentMethods.find(
        (option) => option.method === "BankTransfer",
    );

    if (!cart.items.length) return <Navigate to="/cart" replace />;

    const update = (field: keyof CheckoutForm, value: string) => {
        setForm((current) => ({ ...current, [field]: value }));
        setError(null);
    };

    const submit = async (event: FormEvent) => {
        event.preventDefault();

        if (
            !form.firstName.trim() ||
            !form.phone.trim() ||
            !form.recipientName.trim() ||
            !form.addressLine1.trim() ||
            !form.city.trim() ||
            !form.country.trim()
        ) {
            setError(t("checkout.completeRequired"));
            return;
        }

        if (
            form.paymentMethod === "BankTransfer" &&
            !form.bankTransferReference.trim()
        ) {
            setError(t("checkout.enterReference"));
            return;
        }

        const request: CreateOrderRequest = {
            customer: {
                firstName: form.firstName.trim(),
                lastName: nullable(form.lastName),
                phone: form.phone.trim(),
                email: nullable(form.email),
            },
            shippingAddress: {
                label: "Home",
                recipientName: form.recipientName.trim(),
                phone: form.phone.trim(),
                addressLine1: form.addressLine1.trim(),
                addressLine2: nullable(form.addressLine2),
                city: form.city.trim(),
                state: nullable(form.state),
                country: form.country.trim(),
                postalCode: nullable(form.postalCode),
            },
            paymentMethod: form.paymentMethod,
            bankTransferReference:
                form.paymentMethod === "BankTransfer"
                    ? form.bankTransferReference.trim()
                    : null,
            notes: nullable(form.notes),
            items: cart.items.map((item) => ({
                productId: item.id,
                quantity: item.quantity,
            })),
        };

        setSubmitting(true);
        setError(null);

        try {
            const confirmation = await createOrder(request);
            saveConfirmation(confirmation, form.phone);
            saveRecentOrder(confirmation, form.phone);
            cart.clear();
            navigate(`/orders/${confirmation.orderNumber}/success`, {
                replace: true,
                state: { confirmation, phone: form.phone },
            });
        } catch (requestError) {
            setError(
                requestError instanceof ApiError
                    ? requestError.message
                    : "The order could not be created. Please try again.",
            );
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <main className="mx-auto w-full max-w-[1450px] px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
            <div className="mb-8 flex items-center justify-between gap-4">
                <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
                        {t("checkout.secure")}
                    </p>
                    <h1 className="mt-2 text-3xl font-black tracking-[-0.04em] sm:text-5xl">
                        {t("checkout.completeOrder")}
                    </h1>
                    <p className="mt-2 text-sm text-muted-foreground">
                        {t("checkout.serverCheck")}
                    </p>
                    {auth.user && (
                        <p className="mt-3 inline-flex rounded-full bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary">
                            {t("checkout.signedIn", {
                                name: auth.user.fullName,
                                type: auth.user.customerTypeName ?? t("common.general"),
                            })}
                        </p>
                    )}
                </div>

                <Button asChild variant="outline" className="hidden sm:flex">
                    <Link to="/cart">
                        <ArrowLeft className="rtl:rotate-180" /> {t("checkout.backToCart")}
                    </Link>
                </Button>
            </div>

            <form
                onSubmit={submit}
                className="grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_410px]"
            >
                <div className="grid gap-6">
                    <CheckoutSection
                        icon={<Phone />}
                        title={t("checkout.contact")}
                        description={t("checkout.contactDescription")}
                    >
                        <div className="grid gap-4 sm:grid-cols-2">
                            <Field
                                label={t("common.firstName")}
                                required
                                value={form.firstName}
                                onChange={(value) => update("firstName", value)}
                            />
                            <Field
                                label={t("common.lastName")}
                                value={form.lastName}
                                onChange={(value) => update("lastName", value)}
                            />
                            <Field
                                label={t("auth.phone")}
                                required
                                value={form.phone}
                                onChange={(value) => {
                                    update("phone", value);
                                    if (!form.recipientName)
                                        setForm((current) => ({
                                            ...current,
                                            phone: value,
                                        }));
                                }}
                                placeholder="+93 ..."
                            />
                            <Field
                                label={t("common.email")}
                                type="email"
                                value={form.email}
                                onChange={(value) => update("email", value)}
                                placeholder="Optional"
                            />
                        </div>
                    </CheckoutSection>

                    <CheckoutSection
                        icon={<MapPin />}
                        title={t("checkout.address")}
                        description={t("checkout.addressDescription")}
                    >
                        <div className="grid gap-4 sm:grid-cols-2">
                            <Field
                                label={t("checkout.recipient")}
                                required
                                value={form.recipientName}
                                onChange={(value) =>
                                    update("recipientName", value)
                                }
                                className="sm:col-span-2"
                            />
                            <Field
                                label="Address line 1"
                                required
                                value={form.addressLine1}
                                onChange={(value) =>
                                    update("addressLine1", value)
                                }
                                className="sm:col-span-2"
                                placeholder={t("checkout.addressLine1")}
                            />
                            <Field
                                label="Address line 2"
                                value={form.addressLine2}
                                onChange={(value) =>
                                    update("addressLine2", value)
                                }
                                className="sm:col-span-2"
                                placeholder={t("checkout.addressLine2")}
                            />
                            <Field
                                label={t("checkout.city")}
                                required
                                value={form.city}
                                onChange={(value) => update("city", value)}
                            />
                            <Field
                                label={t("checkout.state")}
                                value={form.state}
                                onChange={(value) => update("state", value)}
                            />
                            <Field
                                label={t("checkout.country")}
                                required
                                value={form.country}
                                onChange={(value) => update("country", value)}
                            />
                            <Field
                                label={t("checkout.postalCode")}
                                value={form.postalCode}
                                onChange={(value) =>
                                    update("postalCode", value)
                                }
                            />
                        </div>
                    </CheckoutSection>

                    <CheckoutSection
                        icon={<CreditCard />}
                        title={t("checkout.paymentMethod")}
                        description={t("checkout.paymentDescription")}
                    >
                        <div className="grid gap-3 sm:grid-cols-2">
                            <PaymentCard
                                active={
                                    form.paymentMethod === "CashOnDelivery"
                                }
                                icon={<Banknote />}
                                title={t("checkout.cash")}
                                description={t("checkout.cashDescription")}
                                onClick={() =>
                                    update(
                                        "paymentMethod",
                                        "CashOnDelivery",
                                    )
                                }
                            />
                            <PaymentCard
                                active={form.paymentMethod === "BankTransfer"}
                                icon={<Building2 />}
                                title={t("checkout.bank")}
                                description={t("checkout.bankDescription")}
                                onClick={() =>
                                    update("paymentMethod", "BankTransfer")
                                }
                            />
                        </div>

                        {form.paymentMethod === "BankTransfer" && (
                            <div className="mt-5 rounded-2xl border border-primary/20 bg-primary/5 p-5">
                                {configQuery.isLoading ? (
                                    <p className="text-sm text-muted-foreground">
                                        {t("checkout.loadingBank")}
                                    </p>
                                ) : bankOption?.bankDetails ? (
                                    <div className="space-y-4">
                                        <div className="grid gap-3 text-sm sm:grid-cols-2">
                                            <BankLine
                                                label="Bank"
                                                value={
                                                    bankOption.bankDetails
                                                        .bankName
                                                }
                                            />
                                            <BankLine
                                                label="Account name"
                                                value={
                                                    bankOption.bankDetails
                                                        .accountName
                                                }
                                            />
                                            <BankLine
                                                label="Account number"
                                                value={
                                                    bankOption.bankDetails
                                                        .accountNumber
                                                }
                                            />
                                            {bankOption.bankDetails.iban && (
                                                <BankLine
                                                    label="IBAN"
                                                    value={
                                                        bankOption.bankDetails
                                                            .iban
                                                    }
                                                />
                                            )}
                                        </div>

                                        <p className="text-xs leading-6 text-muted-foreground">
                                            {
                                                bankOption.bankDetails
                                                    .instructions
                                            }
                                        </p>

                                        <Field
                                            label={t("checkout.bankReference")}
                                            required
                                            value={form.bankTransferReference}
                                            onChange={(value) =>
                                                update(
                                                    "bankTransferReference",
                                                    value,
                                                )
                                            }
                                            placeholder="Example: TRX-984725"
                                        />
                                    </div>
                                ) : (
                                    <p className="text-sm text-destructive">
                                        {t("checkout.bankMissing")}
                                    </p>
                                )}
                            </div>
                        )}
                    </CheckoutSection>

                    <CheckoutSection
                        icon={<PackageCheck />}
                        title={t("checkout.notes")}
                        description={t("checkout.notesDescription")}
                    >
                        <textarea
                            value={form.notes}
                            onChange={(event) =>
                                update("notes", event.target.value)
                            }
                            rows={4}
                            className="w-full rounded-xl border bg-background px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
                            placeholder="Call before delivery, preferred delivery time, landmark..."
                        />
                    </CheckoutSection>
                </div>

                <aside className="sticky top-32 overflow-hidden rounded-3xl border bg-card shadow-[0_18px_55px_rgba(15,23,42,0.08)]">
                    <div className="border-b bg-muted/30 p-6">
                        <div className="flex items-center gap-3">
                            <span className="grid size-11 place-items-center rounded-2xl bg-primary/10 text-primary">
                                <ShoppingBag />
                            </span>
                            <div>
                                <p className="font-bold">{t("checkout.orderSummary")}</p>
                                <p className="text-xs text-muted-foreground">
                                    {t("checkout.itemsCount", { count: cart.count })}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="max-h-72 space-y-4 overflow-auto p-6">
                        {cart.items.map((item) => (
                            <div key={item.id} className="flex gap-3">
                                <img
                                    src={
                                        imageUrl(item.image) ??
                                        "/placeholder-product.svg"
                                    }
                                    alt={item.name}
                                    className="size-16 rounded-xl border bg-muted object-cover"
                                />
                                <div className="min-w-0 flex-1">
                                    <p className="line-clamp-2 text-sm font-bold">
                                        {item.name}
                                    </p>
                                    <p className="mt-1 text-xs text-muted-foreground">
                                        {item.quantity} × {formatMoney(item.price, config?.currency)}
                                    </p>
                                </div>
                                <p className="text-sm font-bold">
                                    {formatMoney(
                                        item.price * item.quantity,
                                        config?.currency,
                                    )}
                                </p>
                            </div>
                        ))}
                    </div>

                    <div className="border-t p-6">
                        <div className="grid gap-3 text-sm">
                            <SummaryLine
                                label={t("common.subtotal")}
                                value={formatMoney(
                                    subtotal,
                                    config?.currency,
                                )}
                            />
                            <SummaryLine
                                label={t("common.delivery")}
                                value={
                                    shipping
                                        ? formatMoney(
                                              shipping,
                                              config?.currency,
                                          )
                                        : t("common.free")
                                }
                            />
                            <div className="flex items-center justify-between border-t pt-4 text-lg font-black">
                                <span>{t("checkout.estimatedTotal")}</span>
                                <span>
                                    {formatMoney(
                                        estimatedTotal,
                                        config?.currency,
                                    )}
                                </span>
                            </div>
                        </div>

                        {error && (
                            <div className="mt-5 rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
                                {error}
                            </div>
                        )}

                        <Button
                            type="submit"
                            size="lg"
                            className="mt-5 h-13 w-full rounded-xl font-bold"
                            disabled={submitting || configQuery.isError}
                        >
                            {submitting ? (
                                <LoaderCircle className="animate-spin" />
                            ) : (
                                <LockKeyhole />
                            )}
                            {submitting ? t("checkout.creating") : t("checkout.placeOrder")}
                        </Button>

                        <div className="mt-4 flex items-start gap-2 text-xs leading-5 text-muted-foreground">
                            <BadgeCheck className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                            {t("checkout.inventoryVerified")}
                        </div>
                        <div className="mt-2 flex items-start gap-2 text-xs leading-5 text-muted-foreground">
                            <Truck className="mt-0.5 size-4 shrink-0 text-primary" />
                            {t("checkout.adminApproval")}
                        </div>
                    </div>
                </aside>
            </form>
        </main>
    );
}

function CheckoutSection({
    icon,
    title,
    description,
    children,
}: {
    icon: React.ReactNode;
    title: string;
    description: string;
    children: React.ReactNode;
}) {
    return (
        <section className="rounded-3xl border bg-card p-5 shadow-[0_8px_35px_rgba(15,23,42,0.04)] sm:p-7">
            <div className="mb-6 flex items-start gap-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary [&_svg]:size-5">
                    {icon}
                </span>
                <div>
                    <h2 className="text-lg font-black">{title}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {description}
                    </p>
                </div>
            </div>
            {children}
        </section>
    );
}

function Field({
    label,
    value,
    onChange,
    required,
    type = "text",
    placeholder,
    className,
}: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    required?: boolean;
    type?: string;
    placeholder?: string;
    className?: string;
}) {
    return (
        <label className={`grid gap-2 ${className ?? ""}`}>
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {label} {required && <span className="text-destructive">*</span>}
            </span>
            <input
                value={value}
                onChange={(event) => onChange(event.target.value)}
                type={type}
                placeholder={placeholder}
                className="h-12 rounded-xl border bg-background px-4 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
            />
        </label>
    );
}

function PaymentCard({
    active,
    icon,
    title,
    description,
    onClick,
}: {
    active: boolean;
    icon: React.ReactNode;
    title: string;
    description: string;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`flex min-h-32 items-start gap-4 rounded-2xl border p-5 text-left transition ${
                active
                    ? "border-primary bg-primary/5 ring-4 ring-primary/10"
                    : "hover:border-primary/40 hover:bg-muted/30"
            }`}
        >
            <span
                className={`grid size-11 shrink-0 place-items-center rounded-xl [&_svg]:size-5 ${
                    active
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                }`}
            >
                {icon}
            </span>
            <span>
                <span className="block font-bold">{title}</span>
                <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                    {description}
                </span>
            </span>
        </button>
    );
}

function BankLine({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-xl border bg-background p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                {label}
            </p>
            <p className="mt-1 break-all font-bold">{value}</p>
        </div>
    );
}

function SummaryLine({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-center justify-between text-muted-foreground">
            <span>{label}</span>
            <span className="font-bold text-foreground">{value}</span>
        </div>
    );
}

function nullable(value: string) {
    const clean = value.trim();
    return clean.length ? clean : null;
}

function saveConfirmation(confirmation: OrderConfirmation, phone: string) {
    localStorage.setItem(
        "last-order-confirmation",
        JSON.stringify({ confirmation, phone }),
    );
}
