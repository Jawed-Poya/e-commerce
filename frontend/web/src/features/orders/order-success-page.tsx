import {
    ArrowRight,
    Banknote,
    Building2,
    CheckCircle2,
    ClipboardCheck,
    PackageCheck,
    Truck,
} from "lucide-react";
import { Link, useLocation, useParams } from "react-router-dom";

import type { OrderConfirmation } from "../checkout/checkout-types";
import { Button } from "../../shared/components/ui/button";
import { formatMoney } from "../../shared/lib/money";

type ConfirmationState = {
    confirmation: OrderConfirmation;
    phone: string;
};

export function OrderSuccessPage() {
    const location = useLocation();
    const { orderNumber } = useParams();
    const stored = readStoredConfirmation();
    const state = (location.state as ConfirmationState | null) ?? stored;
    const confirmation = state?.confirmation;

    if (!confirmation || confirmation.orderNumber !== orderNumber) {
        return (
            <main className="mx-auto grid min-h-[65vh] max-w-2xl place-items-center px-4 py-16 text-center">
                <div>
                    <PackageCheck className="mx-auto size-14 text-primary" />
                    <h1 className="mt-5 text-3xl font-black">
                        Your order was submitted
                    </h1>
                    <p className="mt-3 text-muted-foreground">
                        Use the order number and phone number from checkout to
                        track its status.
                    </p>
                    <Button asChild className="mt-6">
                        <Link to="/track-order">Track an order</Link>
                    </Button>
                </div>
            </main>
        );
    }

    const isBank = confirmation.paymentMethod === "BankTransfer";

    return (
        <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 lg:py-16">
            <section className="overflow-hidden rounded-[32px] border bg-card shadow-[0_24px_70px_rgba(15,23,42,0.09)]">
                <div className="bg-gradient-to-br from-emerald-500/15 via-primary/10 to-transparent p-8 text-center sm:p-12">
                    <span className="mx-auto grid size-20 place-items-center rounded-full bg-emerald-500 text-white shadow-xl shadow-emerald-500/20">
                        <CheckCircle2 className="size-10" />
                    </span>
                    <p className="mt-6 text-xs font-black uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-400">
                        Order received
                    </p>
                    <h1 className="mt-3 text-3xl font-black tracking-[-0.04em] sm:text-5xl">
                        Thank you for your order.
                    </h1>
                    <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-muted-foreground sm:text-base">
                        Your products are reserved. The admin team will review
                        the order and move it to processing.
                    </p>
                </div>

                <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[1fr_0.9fr] lg:p-10">
                    <div className="space-y-5">
                        <div className="rounded-2xl border bg-muted/25 p-5">
                            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                Order number
                            </p>
                            <p className="mt-2 break-all text-2xl font-black text-primary">
                                {confirmation.orderNumber}
                            </p>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                            <InfoCard
                                icon={<ClipboardCheck />}
                                label="Order status"
                                value={confirmation.status}
                            />
                            <InfoCard
                                icon={
                                    isBank ? <Building2 /> : <Banknote />
                                }
                                label="Payment"
                                value={
                                    isBank
                                        ? "Bank transfer review"
                                        : "Cash on delivery"
                                }
                            />
                            <InfoCard
                                icon={<Truck />}
                                label="Delivery"
                                value={
                                    confirmation.shippingTotal
                                        ? formatMoney(
                                              confirmation.shippingTotal,
                                              confirmation.currency,
                                          )
                                        : "Free"
                                }
                            />
                            <InfoCard
                                icon={<PackageCheck />}
                                label="Order total"
                                value={formatMoney(
                                    confirmation.total,
                                    confirmation.currency,
                                )}
                            />
                        </div>

                        <div className="flex flex-col gap-3 sm:flex-row">
                            <Button asChild size="lg" className="rounded-xl">
                                <Link
                                    to={`/track-order?orderNumber=${encodeURIComponent(
                                        confirmation.orderNumber,
                                    )}&phone=${encodeURIComponent(state.phone)}`}
                                >
                                    Track this order <ArrowRight />
                                </Link>
                            </Button>
                            <Button
                                asChild
                                size="lg"
                                variant="outline"
                                className="rounded-xl"
                            >
                                <Link to="/products">Continue shopping</Link>
                            </Button>
                        </div>
                    </div>

                    <div className="rounded-3xl border bg-background p-6">
                        <h2 className="text-xl font-black">
                            {isBank
                                ? "Complete the bank transfer"
                                : "What happens next?"}
                        </h2>

                        {isBank && confirmation.bankDetails ? (
                            <div className="mt-5 space-y-4">
                                <BankDetail
                                    label="Bank"
                                    value={confirmation.bankDetails.bankName}
                                />
                                <BankDetail
                                    label="Account name"
                                    value={
                                        confirmation.bankDetails.accountName
                                    }
                                />
                                <BankDetail
                                    label="Account number"
                                    value={
                                        confirmation.bankDetails.accountNumber
                                    }
                                />
                                {confirmation.bankDetails.iban && (
                                    <BankDetail
                                        label="IBAN"
                                        value={confirmation.bankDetails.iban}
                                    />
                                )}
                                <p className="rounded-xl bg-primary/5 p-4 text-sm leading-6 text-muted-foreground">
                                    {confirmation.bankDetails.instructions}
                                </p>
                                <p className="text-xs leading-5 text-muted-foreground">
                                    The admin must verify the transfer before
                                    confirming the order.
                                </p>
                            </div>
                        ) : (
                            <ol className="mt-5 space-y-4 text-sm">
                                <Step number="1" text="The admin reviews your order and confirms availability." />
                                <Step number="2" text="The order moves to processing and delivery." />
                                <Step number="3" text="Pay cash when the order is delivered." />
                            </ol>
                        )}
                    </div>
                </div>
            </section>
        </main>
    );
}

function InfoCard({
    icon,
    label,
    value,
}: {
    icon: React.ReactNode;
    label: string;
    value: string;
}) {
    return (
        <div className="flex items-center gap-3 rounded-2xl border p-4">
            <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary [&_svg]:size-5">
                {icon}
            </span>
            <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    {label}
                </p>
                <p className="mt-1 truncate font-bold">{value}</p>
            </div>
        </div>
    );
}

function BankDetail({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-xl border p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                {label}
            </p>
            <p className="mt-1 break-all font-black">{value}</p>
        </div>
    );
}

function Step({ number, text }: { number: string; text: string }) {
    return (
        <li className="flex gap-3">
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                {number}
            </span>
            <span className="pt-1 text-muted-foreground">{text}</span>
        </li>
    );
}

function readStoredConfirmation(): ConfirmationState | null {
    try {
        return JSON.parse(
            localStorage.getItem("last-order-confirmation") ?? "null",
        ) as ConfirmationState | null;
    } catch {
        return null;
    }
}
