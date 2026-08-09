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
import { useCallback, useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";

import { useCompany } from "../company/company-context";
import { ApiError, imageUrl } from "../../shared/api/api-client";
import { Button } from "../../shared/components/ui/button";
import { cn } from "../../shared/lib/utils";
import { useAuth } from "./auth-context";
import { useI18n } from "../../i18n/i18n-provider";
import { GoogleSignInButton } from "./google-sign-in-button";

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
            navigate(from || "/account", { replace: true, viewTransition: true });
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

    const handleGoogleCredential = useCallback(async (credential: string) => {
        setSubmitting(true);
        setError(null);
        try {
            await auth.googleSignIn(credential);
            const from = (location.state as { from?: string } | null)?.from;
            navigate(from || "/account", { replace: true, viewTransition: true });
        } catch (requestError) {
            setError(requestError instanceof ApiError ? requestError.message : t("auth.requestError"));
        } finally {
            setSubmitting(false);
        }
    }, [auth, location.state, navigate, t]);

    if (auth.isAuthenticated) return <Navigate to="/account" replace />;

    const logo = imageUrl(company?.logoUrl);
    const companyName = company?.name ?? "";

    return (
        <main className="relative isolate overflow-hidden bg-[radial-gradient(circle_at_top_left,color-mix(in_srgb,var(--primary)_10%,transparent),transparent_34%),linear-gradient(to_bottom,var(--background),color-mix(in_srgb,var(--muted)_55%,var(--background)))] px-4 py-6 sm:px-6 sm:py-9 lg:px-8 lg:py-12">
            <div className="pointer-events-none absolute -start-32 top-16 -z-10 size-[28rem] rounded-full bg-primary/[0.08] blur-3xl" />
            <div className="pointer-events-none absolute -end-32 bottom-0 -z-10 size-[30rem] rounded-full bg-brand-orange/[0.07] blur-3xl" />

            <div className="mx-auto grid w-full max-w-[1240px] overflow-hidden rounded-[28px] bg-card shadow-[0_28px_80px_-52px_rgba(15,23,42,.55)] lg:grid-cols-[1.03fr_.97fr]">
                <section className="relative hidden min-h-[650px] bg-muted/[0.32] p-5 lg:block xl:p-6">
                    <div className="relative flex h-full min-h-[610px] flex-col overflow-hidden rounded-[22px] bg-[var(--brand-surface-strong)] shadow-[0_28px_70px_-42px_rgba(15,23,42,.8)]">
                        <div className="absolute -end-24 -top-24 size-80 rounded-full bg-white/[0.10] blur-3xl" />
                        <div className="absolute -bottom-36 -start-24 size-[26rem] rounded-full bg-brand-orange/25 blur-3xl" />
                        <div className="absolute inset-0 bg-[linear-gradient(135deg,transparent_35%,rgba(255,255,255,0.075))]" />

                        <div className="relative z-10 flex items-center justify-between gap-4 p-5 xl:p-6">
                            <Link
                                viewTransition
                                to="/"
                                className="flex min-w-0 items-center gap-2.5 rounded-xl bg-white/[0.08] p-2 pe-3.5 text-white backdrop-blur transition hover:bg-white/[0.13]"
                            >
                                <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-lg bg-white text-primary shadow-lg">
                                    {logo ? (
                                        <img
                                            src={logo}
                                            alt=""
                                            className="size-full object-contain p-1.5"
                                        />
                                    ) : (
                                        <ShoppingBag className="size-5" />
                                    )}
                                </span>
                                <span className="truncate text-sm font-black">
                                    {companyName}
                                </span>
                            </Link>

                            <span className="inline-flex items-center gap-2 rounded-full bg-white/[0.08] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-white backdrop-blur">
                                <ShieldCheck className="size-3.5 text-emerald-300" />
                                {t("auth.secureAccess")}
                            </span>
                        </div>

                        <div className="relative z-10 flex min-h-[260px] flex-1 flex-col items-center justify-center px-8 py-6">
                            <div className="relative grid size-48 place-items-center rounded-[42px] bg-white/[0.08] shadow-[0_32px_70px_-38px_rgba(0,0,0,.85)] backdrop-blur-sm xl:size-56">
                                <div className="absolute -start-7 top-8 size-14 rounded-2xl bg-white/[0.08] backdrop-blur" />
                                <div className="absolute -end-8 bottom-10 size-16 rounded-full bg-brand-orange/20 backdrop-blur" />
                                <span className="grid size-32 place-items-center overflow-hidden rounded-[30px] bg-white text-primary shadow-2xl xl:size-36">
                                    {logo ? (
                                        <img
                                            src={logo}
                                            alt={companyName}
                                            className="size-full object-contain p-5"
                                        />
                                    ) : (
                                        <ShoppingBag className="size-14" />
                                    )}
                                </span>
                            </div>

                            {(company?.phone ||
                                company?.email ||
                                company?.address) && (
                                <div className="mt-6 flex max-w-lg flex-wrap justify-center gap-2">
                                    {company.phone ? (
                                        <ContactChip
                                            icon={<Phone />}
                                            value={company.phone}
                                        />
                                    ) : null}
                                    {company.email ? (
                                        <ContactChip
                                            icon={<Mail />}
                                            value={company.email}
                                        />
                                    ) : null}
                                    {company.address ? (
                                        <ContactChip
                                            icon={<MapPin />}
                                            value={company.address}
                                        />
                                    ) : null}
                                </div>
                            )}
                        </div>

                        <div className="relative z-30 bg-background/[0.96] p-6 text-foreground shadow-[0_-18px_50px_-34px_rgba(15,23,42,.55)] backdrop-blur-xl supports-[backdrop-filter]:bg-background/[0.92] xl:p-7">
                            <span className="inline-flex items-center gap-2 rounded-full bg-primary/[0.09] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-primary">
                                <Sparkles className="size-3.5" />
                                {t("auth.optionalAccount")}
                            </span>
                            <h1 className="mt-4 max-w-xl text-3xl font-black leading-[1.06] tracking-[-0.045em] xl:text-4xl">
                                {t("auth.heroTitle")}
                            </h1>
                            <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
                                {t("auth.heroDescription")}
                            </p>

                            <div className="mt-5 grid gap-2.5 xl:grid-cols-3">
                                <Benefit
                                    icon={<BadgeCheck />}
                                    title={t("auth.pricingBenefit")}
                                    text={t("auth.pricingBenefitHelp")}
                                />
                                <Benefit
                                    icon={<ShieldCheck />}
                                    title={t("auth.checkoutBenefit")}
                                    text={t("auth.checkoutBenefitHelp")}
                                />
                                <Benefit
                                    icon={<UserRound />}
                                    title={t("auth.historyBenefit")}
                                    text={t("auth.historyBenefitHelp")}
                                />
                            </div>
                        </div>
                    </div>
                </section>

                <section className="relative flex min-h-[590px] items-center justify-center overflow-hidden bg-card p-5 sm:p-8 lg:min-h-[650px] xl:p-11">
                    <div className="pointer-events-none absolute -end-20 top-10 size-64 rounded-full bg-primary/[0.055] blur-3xl" />
                    <div className="relative z-10 w-full max-w-[470px]">
                        <div className="mb-7 flex items-center justify-between gap-4 lg:hidden">
                            <Link
                                viewTransition
                                to="/"
                                className="flex min-w-0 items-center gap-3"
                            >
                                <span className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-xl border border-border/75 bg-background text-primary shadow-sm dark:border-white/[0.10]">
                                    {logo ? (
                                        <img
                                            src={logo}
                                            alt=""
                                            className="size-full object-contain p-1.5"
                                        />
                                    ) : (
                                        <ShoppingBag className="size-4.5" />
                                    )}
                                </span>
                                <span className="truncate text-sm font-black">
                                    {companyName}
                                </span>
                            </Link>
                            <Button
                                asChild
                                variant="ghost"
                                size="sm"
                                className="rounded-xl"
                            >
                                <Link viewTransition to="/products">
                                    <ArrowLeft className="size-4 rtl:rotate-180" />
                                    {t("auth.backToStore")}
                                </Link>
                            </Button>
                        </div>

                        <div className="rounded-xl border border-border/75 bg-muted/[0.45] p-1 shadow-inner dark:border-white/[0.10] dark:bg-slate-950/30">
                            <div className="grid grid-cols-2 gap-1">
                                <ModeButton
                                    active={mode === "login"}
                                    onClick={() => {
                                        setMode("login");
                                        setError(null);
                                    }}
                                >
                                    {t("auth.signIn")}
                                </ModeButton>
                                <ModeButton
                                    active={mode === "register"}
                                    onClick={() => {
                                        setMode("register");
                                        setError(null);
                                    }}
                                >
                                    {t("auth.createAccount")}
                                </ModeButton>
                            </div>
                        </div>

                        <div className="mt-7">
                            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.17em] text-primary">
                                <span className="h-px w-7 bg-brand-orange" />
                                {mode === "login"
                                    ? t("auth.welcomeBack")
                                    : t("auth.join", { company: companyName })}
                            </div>
                            <h2 className="mt-3 text-3xl font-black tracking-[-0.045em] sm:text-[34px] sm:leading-tight">
                                {mode === "login"
                                    ? t("auth.signInTitle")
                                    : t("auth.createTitle")}
                            </h2>
                            <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                                {mode === "login"
                                    ? t("auth.loginDescription")
                                    : t("auth.registerDescription")}
                            </p>
                        </div>

                        <div className="mt-6 rounded-2xl border border-border/75 bg-background p-4 shadow-[0_20px_50px_-42px_rgba(15,23,42,.55)] dark:border-white/[0.08] sm:p-5">
                            <GoogleSignInButton
                                onCredential={handleGoogleCredential}
                                disabled={submitting}
                            />
                            <div className="my-4 flex items-center gap-3 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                                <span className="h-px flex-1 bg-border" />
                                {t("auth.orContinueWithPassword")}
                                <span className="h-px flex-1 bg-border" />
                            </div>

                            <form onSubmit={submit} className="grid gap-3.5">
                                {mode === "register" ? (
                                    <>
                                        <div className="grid gap-3 sm:grid-cols-2">
                                            <AuthField
                                                label={t("common.firstName")}
                                                required
                                                value={form.firstName}
                                                onChange={(value) =>
                                                    update("firstName", value)
                                                }
                                            />
                                            <AuthField
                                                label={t("common.lastName")}
                                                value={form.lastName}
                                                onChange={(value) =>
                                                    update("lastName", value)
                                                }
                                            />
                                        </div>
                                        <AuthField
                                            label={t("auth.phone")}
                                            required
                                            value={form.phone}
                                            onChange={(value) =>
                                                update("phone", value)
                                            }
                                            placeholder="07xxxxxxxx"
                                        />
                                        <AuthField
                                            label={t("common.email")}
                                            type="email"
                                            value={form.email}
                                            onChange={(value) =>
                                                update("email", value)
                                            }
                                            placeholder={t("auth.optionalEmail")}
                                        />
                                    </>
                                ) : (
                                    <AuthField
                                        label={t("auth.identifier")}
                                        required
                                        value={form.identifier}
                                        onChange={(value) =>
                                            update("identifier", value)
                                        }
                                        placeholder={t(
                                            "auth.identifierPlaceholder",
                                        )}
                                    />
                                )}

                                <label className="grid gap-1.5">
                                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                        {t("common.password")} *
                                    </span>
                                    <span className="group relative">
                                        <LockKeyhole className="absolute start-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground transition group-focus-within:text-primary" />
                                        <input
                                            required
                                            minLength={6}
                                            autoComplete={
                                                mode === "login"
                                                    ? "current-password"
                                                    : "new-password"
                                            }
                                            type={
                                                showPassword
                                                    ? "text"
                                                    : "password"
                                            }
                                            value={form.password}
                                            onChange={(event) =>
                                                update(
                                                    "password",
                                                    event.target.value,
                                                )
                                            }
                                            className="store-input ps-11 pe-11"
                                            placeholder={t(
                                                "auth.passwordPlaceholder",
                                            )}
                                        />
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setShowPassword(
                                                    (value) => !value,
                                                )
                                            }
                                            className="absolute end-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground"
                                            aria-label={
                                                showPassword
                                                    ? t("auth.hidePassword")
                                                    : t("auth.showPassword")
                                            }
                                        >
                                            {showPassword ? (
                                                <EyeOff className="size-4" />
                                            ) : (
                                                <Eye className="size-4" />
                                            )}
                                        </button>
                                    </span>
                                </label>

                                {error && (
                                    <div
                                        role="alert"
                                        className="rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-sm leading-6 text-destructive"
                                    >
                                        {error}
                                    </div>
                                )}

                                <Button
                                    type="submit"
                                    size="lg"
                                    className="mt-1 h-11 rounded-xl font-black shadow-md shadow-primary/15"
                                    disabled={submitting}
                                >
                                    {submitting
                                        ? t("auth.wait")
                                        : mode === "login"
                                          ? t("auth.signIn")
                                          : t("auth.createAccount")}
                                    {!submitting && (
                                        <ArrowRight className="rtl:rotate-180" />
                                    )}
                                </Button>
                            </form>
                        </div>

                        <div className="mt-4 flex items-start gap-3 rounded-xl border border-border/70 bg-muted/[0.28] p-3.5 dark:border-white/[0.08] dark:bg-slate-950/25">
                            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
                            <p className="text-xs leading-5 text-muted-foreground">
                                {t("auth.optionalHelp")}
                            </p>
                        </div>

                        <Button
                            asChild
                            variant="ghost"
                            className="mt-3 hidden rounded-lg lg:inline-flex"
                        >
                            <Link viewTransition to="/products">
                                <ArrowLeft className="size-4 rtl:rotate-180" />
                                {t("auth.backToStore")}
                            </Link>
                        </Button>
                    </div>
                </section>
            </div>
        </main>
    );
}

function ModeButton({
    active,
    onClick,
    children,
}: {
    active: boolean;
    onClick: () => void;
    children: React.ReactNode;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                "rounded-lg px-4 py-2.5 text-sm font-bold transition",
                active
                    ? "bg-background text-foreground shadow-sm ring-1 ring-border dark:ring-white/12"
                    : "text-muted-foreground hover:bg-background/60 hover:text-foreground",
            )}
        >
            {children}
        </button>
    );
}

function AuthField({
    label,
    value,
    onChange,
    required,
    type = "text",
    placeholder,
}: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    required?: boolean;
    type?: string;
    placeholder?: string;
}) {
    const autoComplete =
        type === "email"
            ? "email"
            : label.toLowerCase().includes("phone")
              ? "tel"
              : undefined;

    return (
        <label className="grid gap-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {label}
                {required ? " *" : ""}
            </span>
            <input
                required={required}
                type={type}
                autoComplete={autoComplete}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                placeholder={placeholder}
                className="store-input"
            />
        </label>
    );
}

function Benefit({
    icon,
    title,
    text,
}: {
    icon: React.ReactNode;
    title: string;
    text: string;
}) {
    return (
        <div className="rounded-xl border border-border/70 bg-muted/[0.32] p-3 dark:border-white/[0.07] dark:bg-white/[0.025]">
            <span className="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary [&_svg]:size-4">
                {icon}
            </span>
            <p className="mt-2 text-xs font-black">{title}</p>
            <p className="mt-1 line-clamp-2 text-[10px] leading-4 text-muted-foreground">
                {text}
            </p>
        </div>
    );
}

function ContactChip({
    icon,
    value,
}: {
    icon: React.ReactNode;
    value: string;
}) {
    return (
        <span className="inline-flex min-w-0 items-center gap-2 rounded-full bg-white/[0.08] px-3 py-1.5 text-[11px] font-semibold text-white/80 backdrop-blur">
            <span className="shrink-0 text-white [&_svg]:size-3.5">
                {icon}
            </span>
            <span className="max-w-56 truncate">{value}</span>
        </span>
    );
}

function nullable(value: string) {
    const clean = value.trim();
    return clean ? clean : null;
}
