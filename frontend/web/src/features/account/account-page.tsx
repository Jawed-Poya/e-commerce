import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
    ArrowRight,
    BadgeCheck,
    CalendarDays,
    Eye,
    EyeOff,
    KeyRound,
    LogOut,
    LoaderCircle,
    Mail,
    Pencil,
    Phone,
    Save,
    PackageSearch,
    ShieldCheck,
    ReceiptText,
    UserRound,
    X,
} from "lucide-react";
import { Link, Navigate } from "react-router-dom";

import { ListPagination } from "../../shared/components/list-pagination";
import { Button } from "../../shared/components/ui/button";
import { formatMoney } from "../../shared/lib/money";
import { useAuth } from "../auth/auth-context";
import { changeCustomerPassword, confirmVerificationCode, sendVerificationCode, setCustomerPassword, updateCustomerProfile } from "../auth/auth-api";
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
    const [orderPage, setOrderPage] = useState(1);
    const orderPageSize = 10;
    const [profileEditing, setProfileEditing] = useState(false);
    const [profileBusy, setProfileBusy] = useState(false);
    const [profileMessage, setProfileMessage] = useState<string | null>(null);
    const [profileError, setProfileError] = useState<string | null>(null);
    const [profileForm, setProfileForm] = useState({
        fullName: auth.user?.fullName ?? "",
        email: auth.user?.email ?? "",
        phone: auth.user?.phone ?? "",
    });
    const [securityBusy, setSecurityBusy] = useState(false);
    const [securityMessage, setSecurityMessage] = useState<string | null>(null);
    const [securityError, setSecurityError] = useState<string | null>(null);
    const [showSecurityPassword, setShowSecurityPassword] = useState(false);
    const [securityForm, setSecurityForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });

    useEffect(() => {
        if (!auth.user || profileEditing) return;
        setProfileForm({
            fullName: auth.user.fullName,
            email: auth.user.email ?? "",
            phone: auth.user.phone ?? "",
        });
    }, [auth.user, profileEditing]);

    const orders = useQuery({
        queryKey: ["account-orders", auth.user?.customerId, orderPage, orderPageSize],
        queryFn: () => getAccountOrders(orderPage, orderPageSize),
        enabled: auth.isAuthenticated && Boolean(auth.user?.customerId),
    });

    if (!auth.loading && !auth.isAuthenticated) {
        return <Navigate to="/account/login" replace state={{ from: "/account" }} />;
    }

    const user = auth.user;
    if (!user) return null;

    const saveProfile = async () => {
        if (!profileForm.fullName.trim()) {
            setProfileError(t("account.fullNameRequired"));
            return;
        }
        setProfileBusy(true);
        setProfileError(null);
        setProfileMessage(null);
        try {
            await updateCustomerProfile({
                fullName: profileForm.fullName.trim(),
                email: profileForm.email.trim() || null,
                phone: profileForm.phone.trim() || null,
            });
            await auth.refresh();
            setProfileEditing(false);
            setProfileMessage(t("account.profileUpdated"));
        } catch (error) {
            setProfileError(error instanceof ApiError ? error.message : t("account.profileUpdateError"));
        } finally {
            setProfileBusy(false);
        }
    };

    const savePassword = async () => {
        setSecurityError(null);
        setSecurityMessage(null);
        if (securityForm.newPassword !== securityForm.confirmPassword) {
            setSecurityError(t("account.passwordsDoNotMatch"));
            return;
        }
        if (securityForm.newPassword.length < 6) {
            setSecurityError(t("account.passwordMinimum"));
            return;
        }

        setSecurityBusy(true);
        try {
            if (user.hasPassword) {
                await changeCustomerPassword(securityForm.currentPassword, securityForm.newPassword);
            } else {
                await setCustomerPassword(securityForm.newPassword);
            }
            await auth.refresh();
            setSecurityForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
            setSecurityMessage(user.hasPassword ? t("account.passwordChanged") : t("account.passwordCreated"));
        } catch (error) {
            setSecurityError(error instanceof ApiError ? error.message : t("account.passwordUpdateError"));
        } finally {
            setSecurityBusy(false);
        }
    };

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
        <main className="mx-auto w-full max-w-[1240px] px-4 py-6 sm:px-6 lg:px-8 lg:py-9">
            <section className="overflow-hidden rounded-2xl border bg-card shadow-[0_22px_70px_rgba(15,23,42,0.07)]">
                <div className="relative overflow-hidden border-b bg-gradient-to-br from-primary/15 via-primary/5 to-transparent p-5 sm:p-7">
                    <div className="absolute -right-16 -top-20 size-72 rounded-full bg-blue-500/10 blur-3xl" />
                    <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-3">
                            <span className="grid size-12 place-items-center rounded-xl bg-primary text-lg font-black text-primary-foreground shadow-lg shadow-primary/20">
                                {user.fullName.slice(0, 2).toUpperCase()}
                            </span>
                            <div>
                                <p className="text-xs font-black uppercase tracking-[0.18em] text-primary">{t("account.customerAccount")}</p>
                                <h1 className="mt-1 text-2xl font-black tracking-[-0.035em]">{user.fullName}</h1>
                                <p className="mt-1 text-sm text-muted-foreground">{user.email ?? user.phone}</p>
                            </div>
                        </div>
                        <Button variant="outline" onClick={auth.logout} className="rounded-lg"><LogOut /> {t("common.logout")}</Button>
                    </div>
                </div>

                <div className="grid gap-3 p-6 sm:grid-cols-3 sm:p-8">
                    <ProfileCard icon={<BadgeCheck />} label={t("account.customerType")} value={user.customerTypeName ?? t("common.general")} description={t("account.typeDescription")} />
                    <ProfileCard icon={<UserRound />} label={t("common.phone")} value={user.phone ?? t("common.notSet")} description={t("account.phoneDescription")} />
                    <ProfileCard icon={<ReceiptText />} label={t("account.orders")} value={String(orders.data?.totalCount ?? 0)} description={t("account.ordersDescription")} />
                </div>
            </section>

            <div className="mt-6 grid gap-5 lg:grid-cols-[1.08fr_.92fr]">
                <section className="overflow-hidden rounded-2xl border bg-card">
                    <div className="flex items-center justify-between gap-3 border-b bg-muted/30 p-4 sm:p-5">
                        <div>
                            <p className="flex items-center gap-2 text-sm font-black"><UserRound className="size-5 text-primary" /> {t("account.profileInformation")}</p>
                            <p className="mt-1 text-xs leading-5 text-muted-foreground">{t("account.profileInformationHelp")}</p>
                        </div>
                        {profileEditing ? (
                            <Button type="button" variant="ghost" size="sm" className="rounded-lg" disabled={profileBusy} onClick={() => {
                                setProfileEditing(false);
                                setProfileError(null);
                                setProfileForm({ fullName: user.fullName, email: user.email ?? "", phone: user.phone ?? "" });
                            }}><X /> {t("common.cancel")}</Button>
                        ) : (
                            <Button type="button" variant="outline" size="sm" className="rounded-lg" onClick={() => { setProfileEditing(true); setProfileMessage(null); }}><Pencil /> {t("common.edit")}</Button>
                        )}
                    </div>
                    <div className="p-4 sm:p-5">
                        {profileEditing ? (
                            <div className="grid gap-4">
                                <AccountField label={t("common.fullName")} value={profileForm.fullName} onChange={(value) => setProfileForm((current) => ({ ...current, fullName: value }))} autoComplete="name" required />
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <AccountField label={t("common.email")} value={profileForm.email} onChange={(value) => setProfileForm((current) => ({ ...current, email: value }))} type="email" autoComplete="email" />
                                    <AccountField label={t("common.phone")} value={profileForm.phone} onChange={(value) => setProfileForm((current) => ({ ...current, phone: value }))} autoComplete="tel" placeholder="07xxxxxxxx" />
                                </div>
                                <p className="text-xs leading-5 text-muted-foreground">{t("account.contactChangeHelp")}</p>
                                {profileError ? <StatusMessage error>{profileError}</StatusMessage> : null}
                                <Button type="button" className="w-fit rounded-xl" disabled={profileBusy} onClick={() => void saveProfile()}>
                                    {profileBusy ? <LoaderCircle className="animate-spin" /> : <Save />} {profileBusy ? t("common.saving") : t("common.saveChanges")}
                                </Button>
                            </div>
                        ) : (
                            <div className="grid gap-3 sm:grid-cols-2">
                                <InfoRow icon={<UserRound />} label={t("common.fullName")} value={user.fullName} />
                                <InfoRow icon={<Mail />} label={t("common.email")} value={user.email ?? t("common.notSet")} accent={!user.email} />
                                <InfoRow icon={<Phone />} label={t("common.phone")} value={user.phone ?? t("common.notSet")} accent={!user.phone} />
                                <InfoRow icon={<ShieldCheck />} label={t("account.contactStatus")} value={user.canPlaceOrders ? t("account.checkoutReady") : t("account.verificationRequired")} />
                            </div>
                        )}
                        {!profileEditing && profileMessage ? <div className="mt-4"><StatusMessage>{profileMessage}</StatusMessage></div> : null}
                    </div>
                </section>

                <section className="overflow-hidden rounded-2xl border bg-card">
                    <div className="border-b bg-muted/30 p-4 sm:p-5">
                        <div className="flex items-start gap-3">
                            <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${user.hasPassword ? "bg-primary/10 text-primary" : "bg-amber-500/10 text-amber-700 dark:text-amber-300"}`}><KeyRound className="size-5" /></span>
                            <div>
                                <p className="text-sm font-black">{user.hasPassword ? t("account.changePassword") : t("account.createPassword")}</p>
                                <p className="mt-1 text-xs leading-5 text-muted-foreground">{user.hasPassword ? t("account.changePasswordHelp") : t("account.googlePasswordHelp")}</p>
                            </div>
                        </div>
                    </div>
                    <div className="grid gap-4 p-4 sm:p-5">
                        {user.hasPassword ? (
                            <SecurityPasswordField label={t("account.currentPassword")} value={securityForm.currentPassword} show={showSecurityPassword} onChange={(value) => setSecurityForm((current) => ({ ...current, currentPassword: value }))} onToggle={() => setShowSecurityPassword((value) => !value)} autoComplete="current-password" />
                        ) : null}
                        <SecurityPasswordField label={t("auth.newPassword")} value={securityForm.newPassword} show={showSecurityPassword} onChange={(value) => setSecurityForm((current) => ({ ...current, newPassword: value }))} onToggle={() => setShowSecurityPassword((value) => !value)} autoComplete="new-password" />
                        <SecurityPasswordField label={t("auth.confirmPassword")} value={securityForm.confirmPassword} show={showSecurityPassword} onChange={(value) => setSecurityForm((current) => ({ ...current, confirmPassword: value }))} onToggle={() => setShowSecurityPassword((value) => !value)} autoComplete="new-password" />
                        {securityError ? <StatusMessage error>{securityError}</StatusMessage> : null}
                        {securityMessage ? <StatusMessage>{securityMessage}</StatusMessage> : null}
                        <Button type="button" className="w-fit rounded-xl" disabled={securityBusy || !securityForm.newPassword || !securityForm.confirmPassword || (user.hasPassword && !securityForm.currentPassword)} onClick={() => void savePassword()}>
                            {securityBusy ? <LoaderCircle className="animate-spin" /> : <KeyRound />} {securityBusy ? t("common.saving") : user.hasPassword ? t("account.updatePassword") : t("account.createPasswordAction")}
                        </Button>
                    </div>
                </section>
            </div>

            <section className="mt-6 overflow-hidden rounded-2xl border bg-card">
                <div className="flex flex-col gap-3 border-b bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <p className="flex items-center gap-2 text-sm font-black"><ShieldCheck className="size-5 text-primary" /> {t("account.verifyContact")}</p>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">{t("account.verifyDescription")}</p>
                    </div>
                    <span className={`w-fit rounded-full px-3 py-1.5 text-xs font-bold ${user.canPlaceOrders ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-amber-500/10 text-amber-700 dark:text-amber-300"}`}>
                        {user.canPlaceOrders ? t("account.checkoutReady") : t("account.verificationRequired")}
                    </span>
                </div>
                <div className="grid gap-3 p-6">
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
                </div>
                {verificationChannel ? (
                    <div className="border-t p-4">
                        <label className="block max-w-md">
                            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t("account.verificationCode")}</span>
                            <div className="mt-1.5 flex gap-2">
                                <input
                                    inputMode="numeric"
                                    autoComplete="one-time-code"
                                    maxLength={6}
                                    value={verificationCode}
                                    onChange={(event) => setVerificationCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                                    className="store-input min-w-0 flex-1 font-mono tracking-[0.28em]"
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
                    <p className={`border-t px-4 py-3 text-sm ${verificationError ? "text-destructive" : "text-emerald-700 dark:text-emerald-300"}`}>
                        {verificationError ?? verificationMessage}
                    </p>
                ) : null}
            </section>

            <section className="mt-6">
                <div className="flex items-end justify-between gap-3">
                    <div>
                        <p className="text-xs font-black uppercase tracking-[0.18em] text-primary">{t("account.orderHistory")}</p>
                        <h2 className="mt-2 text-lg font-black tracking-tight sm:text-2xl">{t("account.orderNumbers")}</h2>
                        <p className="mt-2 text-sm text-muted-foreground">{t("account.orderNumbersDescription")}</p>
                    </div>
                    <Button asChild variant="outline" className="hidden rounded-xl sm:flex"><Link viewTransition to="/track-order"><PackageSearch /> {t("account.guestTracking")}</Link></Button>
                </div>

                <div className="mt-6 grid gap-3">
                    {orders.isLoading && <div className="rounded-xl border bg-card p-6 text-center text-muted-foreground">{t("account.loadingOrders")}</div>}
                    {orders.isError && <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-6 text-center text-destructive">{t("account.ordersError")}</div>}
                    {orders.data?.items.map((order) => (
                        <article key={order.id} className="grid gap-5 rounded-2xl border border-border/80 bg-card p-4 shadow-none transition-colors hover:border-primary/30 sm:grid-cols-[1fr_auto] sm:items-center dark:border-white/[0.09]">
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
                            <div className="flex items-center justify-between gap-3 sm:justify-end">
                                <p className="text-lg font-black">{formatMoney(order.total, order.currency)}</p>
                                <Button asChild variant="outline" size="icon" className="rounded-lg"><Link viewTransition to={`/track-order?orderNumber=${encodeURIComponent(order.orderNumber)}`} aria-label={`Track ${order.orderNumber}`}><ArrowRight className="rtl:rotate-180" /></Link></Button>
                            </div>
                        </article>
                    ))}
                    {!orders.isLoading && (!user.customerId || orders.data?.totalCount === 0) && (
                        <div className="rounded-2xl border border-dashed bg-card p-7 text-center">
                            <PackageSearch className="mx-auto size-10 text-muted-foreground" />
                            <h3 className="mt-4 text-lg font-black">{t("account.noOrders")}</h3>
                            <p className="mt-2 text-sm text-muted-foreground">{t("account.noOrdersDescription")}</p>
                            <Button asChild className="mt-5 rounded-xl"><Link viewTransition to="/products">{t("account.startShopping")}</Link></Button>
                        </div>
                    )}
                </div>

                {orders.data ? (
                    <ListPagination
                        page={orders.data.page}
                        totalPages={orders.data.totalPages}
                        disabled={orders.isFetching}
                        onPageChange={setOrderPage}
                    />
                ) : null}
            </section>
        </main>
    );
}

function AccountField({ label, value, onChange, type = "text", autoComplete, placeholder, required }: { label: string; value: string; onChange: (value: string) => void; type?: string; autoComplete?: string; placeholder?: string; required?: boolean }) {
    return (
        <label className="grid gap-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}{required ? " *" : ""}</span>
            <input required={required} type={type} autoComplete={autoComplete} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="store-input" />
        </label>
    );
}

function SecurityPasswordField({ label, value, show, onChange, onToggle, autoComplete }: { label: string; value: string; show: boolean; onChange: (value: string) => void; onToggle: () => void; autoComplete: string }) {
    const { t } = useI18n();
    return (
        <label className="grid gap-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
            <span className="relative">
                <input type={show ? "text" : "password"} minLength={6} autoComplete={autoComplete} value={value} onChange={(event) => onChange(event.target.value)} className="store-input pe-11" />
                <button type="button" onClick={onToggle} className="absolute end-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground" aria-label={show ? t("auth.hidePassword") : t("auth.showPassword")}>{show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button>
            </span>
        </label>
    );
}

function InfoRow({ icon, label, value, accent = false }: { icon: React.ReactNode; label: string; value: string; accent?: boolean }) {
    return <div className={`flex items-center gap-3 rounded-xl border p-3.5 ${accent ? "border-amber-500/20 bg-amber-500/5" : "bg-background"}`}><span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary [&_svg]:size-4">{icon}</span><div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p><p className="mt-1 truncate text-sm font-bold">{value}</p></div></div>;
}

function StatusMessage({ children, error = false }: { children: React.ReactNode; error?: boolean }) {
    return <div role={error ? "alert" : "status"} className={`rounded-xl border p-3 text-sm ${error ? "border-destructive/20 bg-destructive/5 text-destructive" : "border-emerald-500/20 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300"}`}>{children}</div>;
}

function ProfileCard({ icon, label, value, description }: { icon: React.ReactNode; label: string; value: string; description: string }) {
    return <div className="rounded-xl border bg-background p-4"><span className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary [&_svg]:size-5">{icon}</span><p className="mt-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</p><p className="mt-1 text-lg font-black">{value}</p><p className="mt-2 text-xs leading-5 text-muted-foreground">{description}</p></div>;
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
        <div className="flex items-center gap-3 rounded-2xl border bg-background p-4">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary [&_svg]:size-5">{icon}</span>
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
