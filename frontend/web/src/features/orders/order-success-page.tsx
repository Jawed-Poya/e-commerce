import {
    ArrowRight,
    Banknote,
    Building2,
    CheckCircle2,
    Clipboard,
    ClipboardCheck,
    PackageCheck,
    Truck,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link, useLocation, useParams } from "react-router-dom";

import type { OrderConfirmation } from "../checkout/checkout-types";
import { Button } from "../../shared/components/ui/button";
import { formatMoney } from "../../shared/lib/money";
import { useAuth } from "../auth/auth-context";
import { useI18n } from "../../i18n/i18n-provider";

type ConfirmationState = { confirmation: OrderConfirmation; phone: string };

export function OrderSuccessPage() {
    const location = useLocation();
    const auth = useAuth();
    const { t, direction } = useI18n();
    const [copied, setCopied] = useState(false);
    const { orderNumber } = useParams();
    const stored = readStoredConfirmation();
    const state = (location.state as ConfirmationState | null) ?? stored;
    const confirmation = state?.confirmation;

    if (!confirmation || confirmation.orderNumber !== orderNumber) {
        return (
            <main className="mx-auto grid min-h-[65vh] max-w-2xl place-items-center px-4 py-16 text-center">
                <div>
                    <PackageCheck className="mx-auto size-14 text-primary" />
                    <h1 className="mt-5 text-3xl font-black">{t("orders.submittedTitle")}</h1>
                    <p className="mt-3 text-muted-foreground">{t("orders.submittedDescription")}</p>
                    <Button asChild className="mt-6"><Link to="/track-order">{t("orders.track")}</Link></Button>
                </div>
            </main>
        );
    }

    const isBank = confirmation.paymentMethod === "BankTransfer";
    const arrowClass = direction === "rtl" ? "rotate-180" : "";

    return (
        <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 lg:py-16">
            <section className="overflow-hidden rounded-[32px] border bg-card shadow-[0_24px_70px_rgba(15,23,42,0.09)]">
                <div className="bg-gradient-to-br from-emerald-500/15 via-primary/10 to-transparent p-8 text-center sm:p-12">
                    <span className="mx-auto grid size-20 place-items-center rounded-full bg-emerald-500 text-white shadow-xl shadow-emerald-500/20"><CheckCircle2 className="size-10" /></span>
                    <p className="mt-6 text-xs font-black uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-400">{t("orders.received")}</p>
                    <h1 className="mt-3 text-3xl font-black tracking-[-0.04em] sm:text-5xl">{t("orders.thankYou")}</h1>
                    <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-muted-foreground sm:text-base">{t("orders.reservedDescription")}</p>
                </div>

                <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[1fr_0.9fr] lg:p-10">
                    <div className="space-y-5">
                        <div className="rounded-2xl border bg-muted/25 p-5">
                            <div className="flex items-start justify-between gap-4">
                                <div className="min-w-0">
                                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t("orders.yourNumber")}</p>
                                    <p className="mt-2 break-all text-2xl font-black text-primary">{confirmation.orderNumber}</p>
                                    <p className="mt-2 text-xs leading-5 text-muted-foreground">{auth.isAuthenticated ? t("orders.savedAccount") : t("orders.savedBrowser")}</p>
                                </div>
                                <Button type="button" variant="outline" size="sm" className="shrink-0 rounded-xl" onClick={async () => {
                                    await navigator.clipboard.writeText(confirmation.orderNumber);
                                    setCopied(true);
                                    window.setTimeout(() => setCopied(false), 1800);
                                }}>
                                    <Clipboard /> {copied ? t("orders.copied") : t("orders.copy")}
                                </Button>
                            </div>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                            <InfoCard icon={<ClipboardCheck />} label={t("orders.orderStatus")} value={confirmation.status} />
                            <InfoCard icon={isBank ? <Building2 /> : <Banknote />} label={t("common.payment")} value={isBank ? t("orders.bankReview") : t("orders.cashDelivery")} />
                            <InfoCard icon={<Truck />} label={t("common.delivery")} value={confirmation.shippingTotal ? formatMoney(confirmation.shippingTotal, confirmation.currency) : t("common.free")} />
                            <InfoCard icon={<PackageCheck />} label={t("orders.orderTotal")} value={formatMoney(confirmation.total, confirmation.currency)} />
                        </div>

                        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                            <Button asChild size="lg" className="rounded-xl">
                                <Link to={`/track-order?orderNumber=${encodeURIComponent(confirmation.orderNumber)}&phone=${encodeURIComponent(state.phone)}`}>
                                    {t("orders.trackThis")} <ArrowRight className={arrowClass} />
                                </Link>
                            </Button>
                            <Button asChild size="lg" variant="outline" className="rounded-xl"><Link to="/products">{t("orders.continueShopping")}</Link></Button>
                            {auth.isAuthenticated && <Button asChild size="lg" variant="outline" className="rounded-xl"><Link to="/account">{t("orders.viewMine")}</Link></Button>}
                        </div>
                    </div>

                    <div className="rounded-3xl border bg-background p-6">
                        <h2 className="text-xl font-black">{isBank ? t("orders.completeBank") : t("orders.next")}</h2>
                        {isBank && confirmation.bankDetails ? (
                            <div className="mt-5 space-y-4">
                                <BankDetail label={t("orders.bank")} value={confirmation.bankDetails.bankName} />
                                <BankDetail label={t("orders.accountName")} value={confirmation.bankDetails.accountName} />
                                <BankDetail label={t("orders.accountNumber")} value={confirmation.bankDetails.accountNumber} />
                                {confirmation.bankDetails.iban && <BankDetail label="IBAN" value={confirmation.bankDetails.iban} />}
                                <p className="rounded-xl bg-primary/5 p-4 text-sm leading-6 text-muted-foreground">{confirmation.bankDetails.instructions}</p>
                                <p className="text-xs leading-5 text-muted-foreground">{t("orders.bankVerify")}</p>
                            </div>
                        ) : (
                            <ol className="mt-5 space-y-4 text-sm">
                                <Step number="1" text={t("orders.stepReview")} />
                                <Step number="2" text={t("orders.stepProcess")} />
                                <Step number="3" text={t("orders.stepCash")} />
                            </ol>
                        )}
                    </div>
                </div>
            </section>
        </main>
    );
}

function InfoCard({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
    return <div className="flex items-center gap-3 rounded-2xl border p-4"><span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary [&_svg]:size-5">{icon}</span><div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p><p className="mt-1 truncate font-bold">{value}</p></div></div>;
}

function BankDetail({ label, value }: { label: string; value: string }) {
    return <div className="rounded-xl border p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p><p className="mt-1 break-all font-black">{value}</p></div>;
}

function Step({ number, text }: { number: string; text: string }) {
    return <li className="flex gap-3"><span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{number}</span><span className="pt-1 text-muted-foreground">{text}</span></li>;
}

function readStoredConfirmation(): ConfirmationState | null {
    try { return JSON.parse(localStorage.getItem("last-order-confirmation") ?? "null") as ConfirmationState | null; }
    catch { return null; }
}
