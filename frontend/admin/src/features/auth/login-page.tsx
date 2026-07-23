import { useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { Eye, EyeOff, LoaderCircle, LockKeyhole, ShieldCheck, ShoppingBag } from "lucide-react";
import { AxiosError } from "axios";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAdminAuth } from "./auth-context";
import { getDefaultAdminRoute } from "./permissions";
import { resolveTenantSlug, saveTenantSlug } from "@/features/tenancy/tenant-storage";
import { useI18n } from "@/i18n/i18n-provider";
import { useTenant } from "@/features/tenancy/tenant-context";

export default function AdminLoginPage() {
    const auth = useAdminAuth();
    const { t } = useI18n();
    const { tenant } = useTenant();
    const navigate = useNavigate();
    const location = useLocation();
    const [tenantSlug, setTenantSlug] = useState(resolveTenantSlug);
    const [identifier, setIdentifier] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (!auth.loading && auth.isAuthenticated)
        return (
            <Navigate
                to={getDefaultAdminRoute(
                    auth.user?.permissions ?? [],
                    auth.user?.roles ?? [],
                )}
                replace
            />
        );

    const submit = async (event: FormEvent) => {
        event.preventDefault();
        setSubmitting(true);
        setError(null);
        try {
            saveTenantSlug(tenantSlug);
            await auth.login({ identifier: identifier.trim(), password });
            const storedUser = JSON.parse(
                localStorage.getItem("easycart-admin-session") ?? "null",
            ) as { permissions?: string[]; roles?: string[] } | null;
            const from = (location.state as { from?: string } | null)?.from;
            navigate(
                from ||
                    getDefaultAdminRoute(
                        storedUser?.permissions ?? [],
                        storedUser?.roles ?? [],
                    ),
                { replace: true },
            );
        } catch (requestError) {
            const apiMessage = (requestError as AxiosError<{ message?: string }>).response?.data?.message;
            setError(apiMessage || (requestError instanceof Error ? requestError.message : t("auth.failed")));
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <main className="grid min-h-screen bg-muted/30 lg:grid-cols-[1.05fr_.95fr]">
            <section className="relative hidden overflow-hidden bg-slate-950 p-12 text-white lg:flex lg:flex-col">
                <div className="absolute -right-32 -top-40 size-[34rem] rounded-full bg-primary/35 blur-3xl" />
                <div className="absolute -bottom-44 -left-28 size-[30rem] rounded-full bg-blue-500/25 blur-3xl" />
                <div className="relative z-10 flex items-center gap-3 text-xl font-black"><span className="grid size-11 place-items-center rounded-2xl bg-primary shadow-lg shadow-primary/30"><ShoppingBag /></span>{tenant?.name ? `${tenant.name} · ${t("auth.brand")}` : t("auth.brand")}</div>
                <div className="relative z-10 my-auto max-w-xl">
                    <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-bold"><ShieldCheck className="size-4" />{t("auth.protected")}</span>
                    <h1 className="mt-7 text-6xl font-black leading-[1.02] tracking-[-0.06em]">{t("auth.heroTitle")}</h1>
                    <p className="mt-6 text-base leading-8 text-slate-300">{t("auth.heroDescription")}</p>
                </div>
                <p className="relative z-10 text-xs text-slate-400">{t("auth.environmentHelp")}</p>
            </section>

            <section className="flex items-center justify-center p-5 sm:p-10">
                <form onSubmit={submit} className="w-full max-w-md rounded-[30px] border bg-card p-7 shadow-[0_28px_90px_rgba(15,23,42,0.12)] sm:p-10">
                    <span className="grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary"><LockKeyhole className="size-7" /></span>
                    <p className="mt-7 text-xs font-black uppercase tracking-[0.2em] text-primary">{t("auth.access")}</p>
                    <h2 className="mt-2 text-4xl font-black tracking-[-0.05em]">{t("auth.welcome")}</h2>
                    <p className="mt-3 text-sm leading-6 text-muted-foreground">{t("auth.description")}</p>

                    <div className="mt-8 grid gap-5">
                        <label className="grid gap-2"><Label htmlFor="tenant">{t("auth.company")}</Label><Input id="tenant" value={tenantSlug} onChange={(event) => { setTenantSlug(event.target.value); setError(null); }} placeholder={t("auth.companyPlaceholder")} required className="h-12 rounded-xl" /><span className="text-xs text-muted-foreground">{t("auth.companyHelp")}</span></label>
                        <label className="grid gap-2"><Label htmlFor="identifier">{t("auth.identifier")}</Label><Input id="identifier" autoFocus autoComplete="username" value={identifier} onChange={(event) => { setIdentifier(event.target.value); setError(null); }} placeholder={t("auth.identifierPlaceholder")} required className="h-12 rounded-xl" /></label>
                        <label className="grid gap-2"><Label htmlFor="password">{t("auth.password")}</Label><div className="relative"><Input id="password" type={showPassword ? "text" : "password"} autoComplete="current-password" value={password} onChange={(event) => { setPassword(event.target.value); setError(null); }} required className="h-12 rounded-xl pe-12" /><button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute end-1 top-1 grid size-10 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={showPassword ? t("auth.hidePassword") : t("auth.showPassword")}>{showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button></div></label>
                        {error && <div className="rounded-xl border border-destructive/25 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>}
                        <Button type="submit" size="lg" disabled={submitting || !identifier.trim() || !password} className="h-12 rounded-xl font-bold">{submitting ? <><LoaderCircle className="animate-spin" />{t("auth.signingIn")}</> : <>{t("auth.signIn")}</>}</Button>
                    </div>
                </form>
            </section>
        </main>
    );
}
