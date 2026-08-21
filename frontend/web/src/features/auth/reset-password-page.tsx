import { ArrowLeft, CheckCircle2, Eye, EyeOff, KeyRound, LockKeyhole, ShoppingBag } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";

import { useCompany } from "../company/company-context";
import { ApiError, imageUrl } from "../../shared/api/api-client";
import { Button } from "../../shared/components/ui/button";
import { useI18n } from "../../i18n/i18n-provider";
import { useAuth } from "./auth-context";
import { resetCustomerPassword } from "./auth-api";

export function ResetPasswordPage() {
    const auth = useAuth();
    const { company } = useCompany();
    const { t } = useI18n();
    const [params] = useSearchParams();
    const email = params.get("email")?.trim() ?? "";
    const token = params.get("token") ?? "";
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [complete, setComplete] = useState(false);

    if (auth.isAuthenticated) return <Navigate to="/account" replace />;

    const submit = async (event: FormEvent) => {
        event.preventDefault();
        setError(null);
        if (!email || !token) {
            setError(t("auth.resetLinkInvalid"));
            return;
        }
        if (password !== confirmPassword) {
            setError(t("account.passwordsDoNotMatch"));
            return;
        }

        setBusy(true);
        try {
            await resetCustomerPassword(email, token, password);
            setComplete(true);
            setPassword("");
            setConfirmPassword("");
        } catch (requestError) {
            setError(requestError instanceof ApiError ? requestError.message : t("auth.requestError"));
        } finally {
            setBusy(false);
        }
    };

    const logo = imageUrl(company?.logoUrl);

    return (
        <main className="relative isolate grid min-h-[70vh] place-items-center overflow-hidden bg-[radial-gradient(circle_at_top,color-mix(in_srgb,var(--primary)_10%,transparent),transparent_42%),linear-gradient(to_bottom,var(--background),color-mix(in_srgb,var(--muted)_55%,var(--background)))] px-4 py-10 sm:px-6">
            <div className="pointer-events-none absolute -start-20 top-12 -z-10 size-72 rounded-full bg-primary/[0.08] blur-3xl" />
            <section className="w-full max-w-lg overflow-hidden rounded-2xl border border-border/80 bg-card shadow-none dark:border-white/[0.09]">
                <div className="border-b bg-muted/30 p-5 sm:p-6">
                    <div className="flex items-center gap-3">
                        <span className="grid size-11 place-items-center overflow-hidden rounded-xl bg-primary text-primary-foreground shadow-md shadow-primary/20">
                            {logo ? <img src={logo} alt="" className="size-full bg-white object-contain p-1.5" /> : <ShoppingBag className="size-5" />}
                        </span>
                        <div className="min-w-0">
                            <p className="truncate text-sm font-black">{company?.name}</p>
                            <p className="text-xs text-muted-foreground">{t("auth.passwordRecovery")}</p>
                        </div>
                    </div>
                </div>

                <div className="p-5 sm:p-7">
                    {complete ? (
                        <div className="text-center">
                            <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-300">
                                <CheckCircle2 className="size-7" />
                            </span>
                            <h1 className="mt-5 text-2xl font-black tracking-tight">{t("auth.resetCompleteTitle")}</h1>
                            <p className="mt-2 text-sm leading-6 text-muted-foreground">{t("auth.resetCompleteDescription")}</p>
                            <Button asChild className="mt-6 h-11 rounded-xl px-6 font-black">
                                <Link viewTransition to="/account/login"><KeyRound /> {t("auth.signIn")}</Link>
                            </Button>
                        </div>
                    ) : (
                        <>
                            <span className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary"><KeyRound className="size-5" /></span>
                            <h1 className="mt-4 text-2xl font-black tracking-tight sm:text-3xl">{t("auth.createNewPassword")}</h1>
                            <p className="mt-2 text-sm leading-6 text-muted-foreground">{email ? t("auth.resetForEmail", { email }) : t("auth.resetLinkInvalid")}</p>

                            <form onSubmit={submit} className="mt-6 grid gap-4">
                                <PasswordInput
                                    label={t("auth.newPassword")}
                                    value={password}
                                    show={showPassword}
                                    onChange={setPassword}
                                    onToggle={() => setShowPassword((value) => !value)}
                                />
                                <PasswordInput
                                    label={t("auth.confirmPassword")}
                                    value={confirmPassword}
                                    show={showPassword}
                                    onChange={setConfirmPassword}
                                    onToggle={() => setShowPassword((value) => !value)}
                                />
                                {error ? <div role="alert" className="rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">{error}</div> : null}
                                <Button type="submit" size="lg" className="h-11 rounded-xl font-black" disabled={busy || !email || !token}>
                                    {busy ? t("auth.wait") : t("auth.resetPasswordAction")}
                                </Button>
                            </form>

                            <Link viewTransition to="/account/login" className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-muted-foreground transition hover:text-foreground">
                                <ArrowLeft className="size-4 rtl:rotate-180" /> {t("auth.backToSignIn")}
                            </Link>
                        </>
                    )}
                </div>
            </section>
        </main>
    );
}

function PasswordInput({ label, value, show, onChange, onToggle }: { label: string; value: string; show: boolean; onChange: (value: string) => void; onToggle: () => void }) {
    const { t } = useI18n();
    return (
        <label className="grid gap-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
            <span className="group relative">
                <LockKeyhole className="absolute start-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary" />
                <input required minLength={6} autoComplete="new-password" type={show ? "text" : "password"} value={value} onChange={(event) => onChange(event.target.value)} className="store-input ps-11 pe-11" />
                <button type="button" onClick={onToggle} className="absolute end-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground" aria-label={show ? t("auth.hidePassword") : t("auth.showPassword")}>
                    {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
            </span>
        </label>
    );
}
