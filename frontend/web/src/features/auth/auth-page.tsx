import {
    ArrowLeft,
    ArrowRight,
    BadgeCheck,
    Eye,
    EyeOff,
    LockKeyhole,
    Mail,
    MapPin,
    Phone,
    ShieldCheck,
    ShoppingBag,
    Sparkles,
    UserRound,
} from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";

import { useCompany } from "../company/company-context";
import { ApiError, imageUrl } from "../../shared/api/api-client";
import { Button } from "../../shared/components/ui/button";
import { cn } from "../../shared/lib/utils";
import { useAuth } from "./auth-context";
import { useI18n } from "../../i18n/i18n-provider";

export function AuthPage() {
    const auth = useAuth();
    const { company } = useCompany();
    const { t } = useI18n();
    const navigate = useNavigate();
    const location = useLocation();
    const [mode, setMode] = useState<"login" | "register">("login");
    const [showPassword, setShowPassword] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [form, setForm] = useState({
        firstName: "",
        lastName: "",
        phone: "",
        email: "",
        identifier: "",
        password: "",
    });

    if (auth.isAuthenticated) return <Navigate to="/account" replace />;

    const update = (field: keyof typeof form, value: string) => {
        setForm((current) => ({ ...current, [field]: value }));
        setError(null);
    };

    const submit = async (event: FormEvent) => {
        event.preventDefault();
        setSubmitting(true);
        setError(null);

        try {
            if (mode === "login") {
                await auth.login({
                    identifier: form.identifier.trim(),
                    password: form.password,
                });
            } else {
                await auth.register({
                    firstName: form.firstName.trim(),
                    lastName: nullable(form.lastName),
                    phone: form.phone.trim(),
                    email: nullable(form.email),
                    password: form.password,
                });
            }

            const from = (location.state as { from?: string } | null)?.from;
            navigate(from || "/account", { replace: true });
        } catch (requestError) {
            setError(
                requestError instanceof ApiError
                    ? requestError.message
                    : t("auth.requestError"),
            );
        } finally {
            setSubmitting(false);
        }
    };

    const logo = imageUrl(company?.logoUrl);
    const companyName = company?.name ?? "EasyCart";

    return (
        <main className="relative isolate overflow-hidden border-y bg-muted/20 px-4 py-8 sm:px-6 sm:py-12 lg:px-8 lg:py-16">
            <div className="pointer-events-none absolute -start-24 -top-24 -z-10 size-96 rounded-full bg-primary/10 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-32 -end-24 -z-10 size-96 rounded-full bg-primary/5 blur-3xl" />

            <div className="mx-auto grid w-full max-w-[1380px] overflow-hidden rounded-[30px] border bg-background/92 shadow-[0_28px_90px_rgba(15,23,42,0.13)] backdrop-blur-xl lg:grid-cols-[1.04fr_.96fr]">
                <section className="relative hidden min-h-[720px] overflow-hidden bg-primary p-10 text-primary-foreground lg:flex lg:flex-col xl:p-14">
                    <div className="absolute -end-24 -top-24 size-80 rounded-full bg-white/15 blur-3xl" />
                    <div className="absolute -bottom-28 -start-20 size-96 rounded-full bg-[var(--brand-orange)] opacity-30 blur-3xl" />
                    <div className="absolute inset-0 bg-[linear-gradient(135deg,transparent_30%,rgba(255,255,255,0.08))]" />

                    <div className="relative z-10 flex items-center justify-between gap-4">
                        <Link to="/" className="flex min-w-0 items-center gap-3 rounded-2xl border border-white/15 bg-white/10 p-2.5 pe-4 backdrop-blur transition hover:bg-white/15">
                            <span className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-xl bg-white text-primary shadow-lg">
                                {logo ? <img src={logo} alt="" className="size-full object-contain p-1.5" /> : <ShoppingBag className="size-5" />}
                            </span>
                            <span className="truncate text-sm font-black">{companyName}</span>
                        </Link>

                        <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.16em] backdrop-blur">
                            <ShieldCheck className="size-3.5" /> {t("auth.secureAccess")}
                        </span>
                    </div>

                    <div className="relative z-10 my-auto py-12">
                        <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-bold backdrop-blur">
                            <Sparkles className="size-4" /> {t("auth.optionalAccount")}
                        </span>
                        <h1 className="mt-7 max-w-xl text-5xl font-black leading-[1.02] tracking-[-0.06em] xl:text-6xl">
                            {t("auth.heroTitle")}
                        </h1>
                        <p className="mt-6 max-w-xl text-base leading-8 text-primary-foreground/75">
                            {t("auth.heroDescription")}
                        </p>
                    </div>

                    <div className="relative z-10 grid gap-3 xl:grid-cols-3">
                        <Benefit icon={<BadgeCheck />} title={t("auth.pricingBenefit")} text={t("auth.pricingBenefitHelp")} />
                        <Benefit icon={<ShieldCheck />} title={t("auth.checkoutBenefit")} text={t("auth.checkoutBenefitHelp")} />
                        <Benefit icon={<UserRound />} title={t("auth.historyBenefit")} text={t("auth.historyBenefitHelp")} />
                    </div>

                    {(company?.phone || company?.email || company?.address) && (
                        <div className="relative z-10 mt-5 flex flex-wrap gap-2 text-[11px] text-primary-foreground/75">
                            {company.phone ? (
                                <ContactChip icon={<Phone />} value={company.phone} />
                            ) : null}
                            {company.email ? (
                                <ContactChip icon={<Mail />} value={company.email} />
                            ) : null}
                            {company.address ? (
                                <ContactChip icon={<MapPin />} value={company.address} />
                            ) : null}
                        </div>
                    )}
                </section>

                <section className="flex min-h-[680px] items-center justify-center p-5 sm:p-9 lg:min-h-[720px] xl:p-14">
                    <div className="w-full max-w-[560px]">
                        <div className="mb-8 flex items-center justify-between gap-4 lg:hidden">
                            <Link to="/" className="flex min-w-0 items-center gap-3">
                                <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-xl border bg-card text-primary shadow-sm">
                                    {logo ? <img src={logo} alt="" className="size-full object-contain p-1.5" /> : <ShoppingBag className="size-4" />}
                                </span>
                                <span className="truncate text-sm font-black">{companyName}</span>
                            </Link>
                            <Button asChild variant="ghost" size="sm" className="rounded-xl">
                                <Link to="/products"><ArrowLeft className="size-4 rtl:rotate-180" />{t("auth.backToStore")}</Link>
                            </Button>
                        </div>

                        <div className="rounded-[24px] border bg-muted/50 p-1.5 shadow-inner">
                            <div className="grid grid-cols-2 gap-1">
                                <ModeButton active={mode === "login"} onClick={() => { setMode("login"); setError(null); }}>{t("auth.signIn")}</ModeButton>
                                <ModeButton active={mode === "register"} onClick={() => { setMode("register"); setError(null); }}>{t("auth.createAccount")}</ModeButton>
                            </div>
                        </div>

                        <div className="mt-9">
                            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-primary">
                                {mode === "login" ? t("auth.welcomeBack") : t("auth.join")}
                            </p>
                            <h2 className="mt-2 text-3xl font-black tracking-[-0.045em] sm:text-[2.65rem] sm:leading-tight">
                                {mode === "login" ? t("auth.signInTitle") : t("auth.createTitle")}
                            </h2>
                            <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">
                                {mode === "login" ? t("auth.loginDescription") : t("auth.registerDescription")}
                            </p>
                        </div>

                        <form onSubmit={submit} className="mt-8 grid gap-4">
                            {mode === "register" ? (
                                <>
                                    <div className="grid gap-4 sm:grid-cols-2">
                                        <AuthField label={t("common.firstName")} required value={form.firstName} onChange={(value) => update("firstName", value)} />
                                        <AuthField label={t("common.lastName")} value={form.lastName} onChange={(value) => update("lastName", value)} />
                                    </div>
                                    <AuthField label={t("auth.phone")} required value={form.phone} onChange={(value) => update("phone", value)} placeholder="+93 ..." />
                                    <AuthField label={t("common.email")} type="email" value={form.email} onChange={(value) => update("email", value)} placeholder={t("auth.optionalEmail")} />
                                </>
                            ) : (
                                <AuthField label={t("auth.identifier")} required value={form.identifier} onChange={(value) => update("identifier", value)} placeholder={t("auth.identifierPlaceholder")} />
                            )}

                            <label className="grid gap-2">
                                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t("common.password")} *</span>
                                <span className="group relative">
                                    <LockKeyhole className="absolute start-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground transition group-focus-within:text-primary" />
                                    <input
                                        required
                                        minLength={6}
                                        autoComplete={mode === "login" ? "current-password" : "new-password"}
                                        type={showPassword ? "text" : "password"}
                                        value={form.password}
                                        onChange={(event) => update("password", event.target.value)}
                                        className="h-14 w-full rounded-2xl border bg-background ps-11 pe-12 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
                                        placeholder={t("auth.passwordPlaceholder")}
                                    />
                                    <button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute end-3 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-xl text-muted-foreground transition hover:bg-muted hover:text-foreground" aria-label={showPassword ? t("auth.hidePassword") : t("auth.showPassword")}>
                                        {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                                    </button>
                                </span>
                            </label>

                            {error && <div role="alert" className="rounded-2xl border border-destructive/20 bg-destructive/5 p-4 text-sm leading-6 text-destructive">{error}</div>}

                            <Button type="submit" size="lg" className="mt-2 h-14 rounded-2xl text-base font-bold shadow-lg shadow-primary/15" disabled={submitting}>
                                {submitting ? t("auth.wait") : mode === "login" ? t("auth.signIn") : t("auth.createAccount")}
                                {!submitting && <ArrowRight className="rtl:rotate-180" />}
                            </Button>
                        </form>

                        <div className="mt-6 flex items-start gap-3 rounded-2xl border bg-muted/30 p-4">
                            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
                            <p className="text-xs leading-5 text-muted-foreground">{t("auth.optionalHelp")}</p>
                        </div>

                        <Button asChild variant="ghost" className="mt-4 hidden rounded-xl lg:inline-flex">
                            <Link to="/products"><ArrowLeft className="size-4 rtl:rotate-180" />{t("auth.backToStore")}</Link>
                        </Button>
                    </div>
                </section>
            </div>
        </main>
    );
}

function ModeButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
    return <button type="button" onClick={onClick} className={cn("rounded-[18px] px-4 py-3.5 text-sm font-bold transition", active ? "bg-background text-foreground shadow-sm ring-1 ring-border" : "text-muted-foreground hover:bg-background/60 hover:text-foreground")}>{children}</button>;
}

function AuthField({ label, value, onChange, required, type = "text", placeholder }: { label: string; value: string; onChange: (value: string) => void; required?: boolean; type?: string; placeholder?: string }) {
    const autoComplete = type === "email" ? "email" : label.toLowerCase().includes("phone") ? "tel" : undefined;
    return <label className="grid gap-2"><span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}{required ? " *" : ""}</span><input required={required} type={type} autoComplete={autoComplete} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="h-14 rounded-2xl border bg-background px-4 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10" /></label>;
}

function Benefit({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
    return <div className="rounded-2xl border border-white/12 bg-white/[0.08] p-4 backdrop-blur"><span className="grid size-10 place-items-center rounded-xl bg-white/12 text-primary-foreground [&_svg]:size-4">{icon}</span><p className="mt-3 text-sm font-bold">{title}</p><p className="mt-1 text-[11px] leading-5 text-primary-foreground/65">{text}</p></div>;
}

function ContactChip({ icon, value }: { icon: React.ReactNode; value: string }) {
    return (
        <span className="inline-flex min-w-0 items-center gap-2 rounded-full border border-white/12 bg-white/[0.08] px-3 py-2 backdrop-blur">
            <span className="shrink-0 [&_svg]:size-3.5">{icon}</span>
            <span className="max-w-56 truncate">{value}</span>
        </span>
    );
}

function nullable(value: string) {
    const clean = value.trim();
    return clean ? clean : null;
}
