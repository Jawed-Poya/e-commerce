import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
    ArrowRight,
    BadgeCheck,
    CalendarDays,
    LogOut,
    LoaderCircle,
    Mail,
    PackageSearch,
    Phone,
    ShieldCheck,
    ReceiptText,
    UserRound,
} from "lucide-react";
import { Link, Navigate } from "react-router-dom";

import { Button } from "../../shared/components/ui/button";
import { formatMoney } from "../../shared/lib/money";
import { useAuth } from "../auth/auth-context";
import { confirmVerificationCode, sendVerificationCode } from "../auth/auth-api";
import type { VerificationChannel } from "../auth/auth-types";
import { ApiError } from "../../shared/api/api-client";
import { getAccountOrders } from "./account-api";
import { useI18n } from "../../i18n/i18n-provider";

export function AccountPage() {
    const auth = useAuth();
    const { t, language } = useI18n();
    const [verificationChannel, setVerificationChannel] = useState<VerificationChannel | null>(null);
    const [verificationCode, setVerificationCode] = useState("");
    const [verificationBusy, setVerificationBusy] = useState(false);
    const [verificationMessage, setVerificationMessage] = useState<string | null>(null);
    const [verificationError, setVerificationError] = useState<string | null>(null);

    const orders = useQuery({
        queryKey: ["account-orders", auth.user?.customerId],
        queryFn: getAccountOrders,
        enabled: auth.isAuthenticated && Boolean(auth.user?.customerId),
    });

    if (!auth.loading && !auth.isAuthenticated) {
        return <Navigate to="/account/login" replace state={{ from: "/account" }} />;
    }

    const user = auth.user;
    if (!user) return null;

    const requestVerification = async (channel: VerificationChannel) => {
        setVerificationBusy(true);
        setVerificationError(null);
        setVerificationMessage(null);
        setVerificationCode("");
        try {
            const result = await sendVerificationCode(channel);
            setVerificationChannel(result.alreadyVerified ? null : channel);
            setVerificationCode(result.alreadyVerified ? "" : result.developmentCode ?? "");
            setVerificationMessage(result.alreadyVerified
                ? t("account.alreadyVerified")
                : result.developmentCode
                    ? t("account.developmentCode", { code: result.developmentCode })
                    : t("account.codeSent", { destination: result.destination }));
        } catch (error) {
            setVerificationError(error instanceof ApiError ? error.message : t("account.verificationError"));
        } finally {
            setVerificationBusy(false);
        }
    };

    const confirmVerification = async () => {
        if (!verificationChannel || verificationCode.trim().length !== 6) return;
        setVerificationBusy(true);
        setVerificationError(null);
        try {
            await confirmVerificationCode(verificationChannel, verificationCode.trim());
            await auth.refresh();
            setVerificationCode("");
            setVerificationChannel(null);
            setVerificationMessage(t("account.verificationComplete"));
        } catch (error) {
            setVerificationError(error instanceof ApiError ? error.message : t("account.verificationError"));
        } finally {
            setVerificationBusy(false);
        }
    };

    return (
        <main className="mx-auto w-full max-w-[1300px] px-4 py-8 sm:px-6 lg:px-8 lg:py-14">
            <section className="overflow-hidden rounded-[32px] border bg-card shadow-[0_22px_70px_rgba(15,23,42,0.07)]">
                <div className="relative overflow-hidden border-b bg-gradient-to-br from-primary/15 via-primary/5 to-transparent p-7 sm:p-10">
                    <div className="absolute -right-16 -top-20 size-72 rounded-full bg-blue-500/10 blur-3xl" />
                    <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-4">
                            <span className="grid size-16 place-items-center rounded-2xl bg-primary text-xl font-black text-primary-foreground shadow-lg shadow-primary/20">
                                {user.fullName.slice(0, 2).toUpperCase()}
                            </span>
                            <div>
                                <p className="text-xs font-black uppercase tracking-[0.18em] text-primary">{t("account.customerAccount")}</p>
                                <h1 className="mt-1 text-3xl font-black tracking-[-0.04em]">{user.fullName}</h1>
                                <p className="mt-1 text-sm text-muted-foreground">{user.email ?? user.phone}</p>
                            </div>
                        </div>
                        <Button variant="outline" onClick={auth.logout} className="rounded-xl"><LogOut /> {t("common.logout")}</Button>
                    </div>
                </div>

                <div className="grid gap-4 p-6 sm:grid-cols-3 sm:p-8">
                    <ProfileCard icon={<BadgeCheck />} label={t("account.customerType")} value={user.customerTypeName ?? t("common.general")} description={t("account.typeDescription")} />
                    <ProfileCard icon={<UserRound />} label={t("common.phone")} value={user.phone ?? t("common.notSet")} description={t("account.phoneDescription")} />
                    <ProfileCard icon={<ReceiptText />} label={t("account.orders")} value={String(orders.data?.length ?? 0)} description={t("account.ordersDescription")} />
                </div>
            </section>

            <section className="mt-8 overflow-hidden rounded-[28px] border bg-card">
                <div className="flex flex-col gap-3 border-b bg-muted/30 p-6 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <p className="flex items-center gap-2 text-sm font-black"><ShieldCheck className="size-5 text-primary" /> {t("account.verifyContact")}</p>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">{t("account.verifyDescription")}</p>
                    </div>
                    <span className={`w-fit rounded-full px-3 py-1.5 text-xs font-bold ${user.canPlaceOrders ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-amber-500/10 text-amber-700 dark:text-amber-300"}`}>
                        {user.canPlaceOrders ? t("account.checkoutReady") : t("account.verificationRequired")}
                    </span>
                </div>
                <div className="grid gap-4 p-6 lg:grid-cols-2">
                    <VerificationContact
                        icon={<Mail />}
                        label={t("common.email")}
                        value={user.email}
                        verified={user.emailVerified}
                        disabled={verificationBusy}
                        onVerify={() => void requestVerification("Email")}
                        verifyLabel={t("account.verifyEmail")}
                        verifiedLabel={t("account.verified")}
                        missingLabel={t("common.notSet")}
                    />
                    <VerificationContact
                        icon={<Phone />}
                        label={t("common.phone")}
                        value={user.phone}
                        verified={user.phoneVerified}
                        disabled={verificationBusy}
                        onVerify={() => void requestVerification("Phone")}
                        verifyLabel={t("account.verifyPhone")}
                        verifiedLabel={t("account.verified")}
                        missingLabel={t("common.notSet")}
                    />
                </div>
                {verificationChannel ? (
                    <div className="border-t p-6">
                        <label className="block max-w-md">
                            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t("account.verificationCode")}</span>
                            <div className="mt-2 flex gap-2">
                                <input
                                    inputMode="numeric"
                                    autoComplete="one-time-code"
                                    maxLength={6}
                                    value={verificationCode}
                                    onChange={(event) => setVerificationCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                                    className="h-11 min-w-0 flex-1 rounded-xl border bg-background px-4 font-mono tracking-[0.3em] outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"
                                    placeholder="000000"
                                />
                                <Button type="button" disabled={verificationBusy || verificationCode.length !== 6} onClick={() => void confirmVerification()}>
                                    {verificationBusy ? <LoaderCircle className="animate-spin" /> : <BadgeCheck />} {t("account.confirmCode")}
                                </Button>
                            </div>
                        </label>
                    </div>
                ) : null}
                {(verificationMessage || verificationError) ? (
                    <p className={`border-t px-6 py-4 text-sm ${verificationError ? "text-destructive" : "text-emerald-700 dark:text-emerald-300"}`}>
                        {verificationError ?? verificationMessage}
                    </p>
                ) : null}
            </section>

            <section className="mt-8">
                <div className="flex items-end justify-between gap-4">
                    <div>
                        <p className="text-xs font-black uppercase tracking-[0.18em] text-primary">{t("account.orderHistory")}</p>
                        <h2 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">{t("account.orderNumbers")}</h2>
                        <p className="mt-2 text-sm text-muted-foreground">{t("account.orderNumbersDescription")}</p>
                    </div>
                    <Button asChild variant="outline" className="hidden rounded-xl sm:flex"><Link viewTransition to="/track-order"><PackageSearch /> {t("account.guestTracking")}</Link></Button>
                </div>

                <div className="mt-6 grid gap-4">
                    {orders.isLoading && <div className="rounded-2xl border bg-card p-8 text-center text-muted-foreground">{t("account.loadingOrders")}</div>}
                    {orders.isError && <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-6 text-center text-destructive">{t("account.ordersError")}</div>}
                    {orders.data?.map((order) => (
                        <article key={order.id} className="grid gap-5 rounded-2xl border bg-card p-5 transition hover:border-primary/30 hover:shadow-md sm:grid-cols-[1fr_auto] sm:items-center">
                            <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                    <h3 className="break-all text-lg font-black text-primary">{order.orderNumber}</h3>
                                    <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-bold text-primary">{order.status}</span>
                                    <span className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-bold text-muted-foreground">{order.paymentStatus}</span>
                                </div>
                                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
                                    <span className="flex items-center gap-1.5"><CalendarDays className="size-3.5" />{new Date(order.createdAt).toLocaleString(language === "en" ? "en-US" : "fa-AF")}</span>
                                    <span>{t("common.itemCount", { count: order.itemCount })}</span>
                                    <span>{order.paymentMethod}</span>
                                </div>
                            </div>
                            <div className="flex items-center justify-between gap-4 sm:justify-end">
                                <p className="text-xl font-black">{formatMoney(order.total, order.currency)}</p>
                                <Button asChild variant="outline" size="icon" className="rounded-xl"><Link viewTransition to={`/track-order?orderNumber=${encodeURIComponent(order.orderNumber)}&phone=${encodeURIComponent(order.customerPhone)}`} aria-label={`Track ${order.orderNumber}`}><ArrowRight className="rtl:rotate-180" /></Link></Button>
                            </div>
                        </article>
                    ))}
                    {!orders.isLoading && (!user.customerId || orders.data?.length === 0) && (
                        <div className="rounded-3xl border border-dashed bg-card p-10 text-center">
                            <PackageSearch className="mx-auto size-10 text-muted-foreground" />
                            <h3 className="mt-4 text-xl font-black">{t("account.noOrders")}</h3>
                            <p className="mt-2 text-sm text-muted-foreground">{t("account.noOrdersDescription")}</p>
                            <Button asChild className="mt-5 rounded-xl"><Link viewTransition to="/products">{t("account.startShopping")}</Link></Button>
                        </div>
                    )}
                </div>
            </section>
        </main>
    );
}

function ProfileCard({ icon, label, value, description }: { icon: React.ReactNode; label: string; value: string; description: string }) {
    return <div className="rounded-2xl border bg-background p-5"><span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary [&_svg]:size-5">{icon}</span><p className="mt-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</p><p className="mt-1 text-xl font-black">{value}</p><p className="mt-2 text-xs leading-5 text-muted-foreground">{description}</p></div>;
}


function VerificationContact({
    icon,
    label,
    value,
    verified,
    disabled,
    onVerify,
    verifyLabel,
    verifiedLabel,
    missingLabel,
}: {
    icon: React.ReactNode;
    label: string;
    value: string | null;
    verified: boolean;
    disabled: boolean;
    onVerify: () => void;
    verifyLabel: string;
    verifiedLabel: string;
    missingLabel: string;
}) {
    return (
        <div className="flex items-center gap-4 rounded-2xl border bg-background p-4">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary [&_svg]:size-5">{icon}</span>
            <div className="min-w-0 flex-1">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
                <p className="mt-1 truncate text-sm font-bold">{value ?? missingLabel}</p>
            </div>
            {verified ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-300"><BadgeCheck className="size-3.5" /> {verifiedLabel}</span>
            ) : value ? (
                <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={onVerify}>{verifyLabel}</Button>
            ) : null}
        </div>
    );
}
