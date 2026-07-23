import {
    ArrowRight,
    BadgeCheck,
    Eye,
    EyeOff,
    LockKeyhole,
    ShieldCheck,
    Sparkles,
    UserRound,
} from "lucide-react";
import { useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";

import { ApiError } from "../../shared/api/api-client";
import { Button } from "../../shared/components/ui/button";
import { cn } from "../../shared/lib/utils";
import { useAuth } from "./auth-context";
import { useI18n } from "../../i18n/i18n-provider";

export function AuthPage() {
    const auth = useAuth();
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

    return (
        <main className="mx-auto grid w-full max-w-[1300px] gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8 lg:py-16">
            <section className="relative hidden min-h-[680px] overflow-hidden rounded-[36px] border bg-slate-950 p-10 text-white lg:flex lg:flex-col">
                <div className="absolute -right-32 -top-32 size-96 rounded-full bg-primary/35 blur-3xl" />
                <div className="absolute -bottom-40 -left-24 size-96 rounded-full bg-blue-500/25 blur-3xl" />
                <div className="relative z-10">
                    <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-bold backdrop-blur">
                        <Sparkles className="size-4" /> {t("auth.optionalAccount")}
                    </span>
                    <h1 className="mt-8 max-w-lg text-5xl font-black leading-[1.03] tracking-[-0.055em]">
                        {t("auth.heroTitle")}
                    </h1>
                    <p className="mt-6 max-w-lg text-base leading-8 text-slate-300">
                        {t("auth.heroDescription")}
                    </p>
                </div>

                <div className="relative z-10 mt-auto grid gap-3">
                    <Benefit icon={<BadgeCheck />} title={t("auth.pricingBenefit")} text={t("auth.pricingBenefitHelp")} />
                    <Benefit icon={<ShieldCheck />} title={t("auth.checkoutBenefit")} text={t("auth.checkoutBenefitHelp")} />
                    <Benefit icon={<UserRound />} title={t("auth.historyBenefit")} text={t("auth.historyBenefitHelp")} />
                </div>
            </section>

            <section className="flex min-h-[680px] items-center justify-center rounded-[32px] border bg-card p-5 shadow-[0_24px_80px_rgba(15,23,42,0.08)] sm:p-10">
                <div className="w-full max-w-xl">
                    <div className="grid grid-cols-2 rounded-2xl bg-muted p-1.5">
                        <ModeButton active={mode === "login"} onClick={() => { setMode("login"); setError(null); }}>{t("auth.signIn")}</ModeButton>
                        <ModeButton active={mode === "register"} onClick={() => { setMode("register"); setError(null); }}>{t("auth.createAccount")}</ModeButton>
                    </div>

                    <div className="mt-9">
                        <p className="text-xs font-black uppercase tracking-[0.18em] text-primary">
                            {mode === "login" ? t("auth.welcomeBack") : t("auth.join")}
                        </p>
                        <h2 className="mt-2 text-3xl font-black tracking-[-0.045em] sm:text-4xl">
                            {mode === "login" ? t("auth.signInTitle") : t("auth.createTitle")}
                        </h2>
                        <p className="mt-3 text-sm leading-6 text-muted-foreground">
                            {mode === "login"
                                ? t("auth.loginDescription")
                                : t("auth.registerDescription")}
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
                            <span className="relative">
                                <LockKeyhole className="absolute start-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                                <input
                                    required
                                    minLength={6}
                                    type={showPassword ? "text" : "password"}
                                    value={form.password}
                                    onChange={(event) => update("password", event.target.value)}
                                    className="h-13 w-full rounded-xl border bg-background ps-11 pe-12 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
                                    placeholder={t("auth.passwordPlaceholder")}
                                />
                                <button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute end-3 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={showPassword ? t("auth.hidePassword") : t("auth.showPassword")}>
                                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                                </button>
                            </span>
                        </label>

                        {error && <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">{error}</div>}

                        <Button type="submit" size="lg" className="mt-2 h-13 rounded-xl text-base" disabled={submitting}>
                            {submitting ? t("auth.wait") : mode === "login" ? t("auth.signIn") : t("auth.createAccount")}
                            {!submitting && <ArrowRight className="rtl:rotate-180" />}
                        </Button>
                    </form>

                    <p className="mt-6 text-center text-xs leading-5 text-muted-foreground">
                        {t("auth.optionalHelp")}
                    </p>
                </div>
            </section>
        </main>
    );
}

function ModeButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
    return <button type="button" onClick={onClick} className={cn("rounded-xl px-4 py-3 text-sm font-bold transition", active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>{children}</button>;
}

function AuthField({ label, value, onChange, required, type = "text", placeholder }: { label: string; value: string; onChange: (value: string) => void; required?: boolean; type?: string; placeholder?: string }) {
    return <label className="grid gap-2"><span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}{required ? " *" : ""}</span><input required={required} type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="h-13 rounded-xl border bg-background px-4 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10" /></label>;
}

function Benefit({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
    return <div className="flex gap-4 rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur"><span className="grid size-11 shrink-0 place-items-center rounded-xl bg-white/10 text-primary-foreground [&_svg]:size-5">{icon}</span><div><p className="font-bold">{title}</p><p className="mt-1 text-xs leading-5 text-slate-400">{text}</p></div></div>;
}

function nullable(value: string) {
    const clean = value.trim();
    return clean ? clean : null;
}
