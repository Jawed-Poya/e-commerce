import { useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    Building2,
    Copy,
    Crown,
    ExternalLink,
    Globe2,
    HardDrive,
    LoaderCircle,
    Package,
    Pencil,
    Plus,
    Save,
    ShieldCheck,
    ShoppingCart,
    Users,
    Warehouse,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { SimpleCombobox } from "@/components/simple-combobox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { PermissionChecklist } from "@/features/users/components/permission-checklist";
import { userService } from "@/features/users/user-service";
import { tenantFontOptions } from "@/features/tenancy/tenant-fonts";
import { tenantService } from "@/features/tenancy/tenant-service";
import type {
    CreateTenantRequest,
    PlatformUpdateTenantRequest,
    SubscriptionPlan,
    SubscriptionStatus,
    TenantProfile,
    TenantSiteRoutingMode,
    UpdateTenantSubscriptionRequest,
} from "@/features/tenancy/tenant-types";
import { useI18n } from "@/i18n/i18n-provider";

const statuses: SubscriptionStatus[] = ["Trial", "Active", "PastDue", "Suspended", "Cancelled", "Expired"];
const currencies = ["AFN", "USD", "EUR", "GBP", "PKR", "INR"];
type EditTab = "company" | "site" | "settings" | "permissions";

export default function PlatformTenantsPage() {
    const { t } = useI18n();
    const client = useQueryClient();
    const tenantsQuery = useQuery({ queryKey: ["platform-tenants"], queryFn: tenantService.platformTenants });
    const plansQuery = useQuery({ queryKey: ["platform-plans"], queryFn: () => tenantService.plans(false) });
    const platformSettingsQuery = useQuery({ queryKey: ["platform-settings"], queryFn: tenantService.platformSettings });
    const permissionsQuery = useQuery({ queryKey: ["platform", "permission-groups"], queryFn: userService.getPermissions, staleTime: 10 * 60_000 });

    const [createOpen, setCreateOpen] = useState(false);
    const [editing, setEditing] = useState<TenantProfile | null>(null);
    const [editTab, setEditTab] = useState<EditTab>("company");
    const [editForm, setEditForm] = useState<PlatformUpdateTenantRequest | null>(null);
    const [subscriptionTenant, setSubscriptionTenant] = useState<TenantProfile | null>(null);
    const [createForm, setCreateForm] = useState<CreateTenantRequest>(emptyCreateTenant());
    const [subscriptionForm, setSubscriptionForm] = useState<UpdateTenantSubscriptionRequest>(emptySubscription());
    const administratorEmailIsValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(createForm.adminEmail.trim());
    const createRoutingIsValid =
        (createForm.siteRoutingMode !== "CustomDomain" ||
            (Boolean(platformSettingsQuery.data?.allowCustomDomains) && Boolean(createForm.customDomain?.trim()))) &&
        (createForm.siteRoutingMode !== "Subdomain" || Boolean(platformSettingsQuery.data?.rootDomain));

    const openCreateTenant = () => {
        setCreateForm(emptyCreateTenant(platformSettingsQuery.data?.defaultRoutingMode));
        setCreateOpen(true);
    };
    const invalidate = async () => {
        await Promise.all([
            client.invalidateQueries({ queryKey: ["platform-tenants"] }),
            client.invalidateQueries({ queryKey: ["platform-plans"] }),
        ]);
    };
    const createMutation = useMutation({
        mutationFn: () => tenantService.createTenant(createForm),
        onSuccess: async () => {
            toast.success(t("platform.created"));
            setCreateOpen(false);
            setCreateForm(emptyCreateTenant(platformSettingsQuery.data?.defaultRoutingMode));
            await invalidate();
        },
        onError: (error) => toast.error(message(error)),
    });
    const updateMutation = useMutation({
        mutationFn: () => tenantService.updateTenant(editing!.id, editForm!),
        onSuccess: async () => {
            toast.success(t("platform.tenantUpdated"));
            setEditing(null); setEditForm(null);
            await invalidate();
        },
        onError: (error) => toast.error(message(error)),
    });
    const subscriptionMutation = useMutation({
        mutationFn: () => tenantService.updateSubscription(subscriptionTenant!.id, subscriptionForm),
        onSuccess: async () => {
            toast.success(t("platform.subscriptionUpdated"));
            setSubscriptionTenant(null);
            await invalidate();
        },
        onError: (error) => toast.error(message(error)),
    });

    const openEdit = (tenant: TenantProfile) => {
        setEditing(tenant);
        setEditTab("company");
        setEditForm({
            name: tenant.name, slug: tenant.slug, legalName: tenant.legalName, registrationNumber: tenant.registrationNumber,
            email: tenant.email, phone: tenant.phone, address: tenant.address, logoUrl: tenant.logoUrl, faviconUrl: tenant.faviconUrl,
            siteRoutingMode: tenant.site.routingMode, customDomain: tenant.site.customDomain,
            storefrontBaseUrlOverride: tenant.site.storefrontBaseUrlOverride,
            settings: { ...tenant.settings }, enabledPermissions: [...tenant.enabledPermissions],
        });
    };
    const openSubscription = (tenant: TenantProfile) => {
        const current = tenant.subscription;
        setSubscriptionTenant(tenant);
        setSubscriptionForm({
            subscriptionPlanId: current?.subscriptionPlanId ?? null,
            plan: current?.plan ?? null,
            status: current?.status ?? "Active",
            endsAt: current?.endsAt?.slice(0, 10) ?? null,
            maxUsers: current?.maxUsers ?? null,
            maxBranches: current?.maxBranches ?? null,
            maxProducts: current?.maxProducts ?? null,
            maxOrdersPerMonth: current?.maxOrdersPerMonth ?? null,
            maxStorageMb: current?.maxStorageMb ?? null,
            monthlyPrice: current?.monthlyPrice ?? null,
            billingCurrencyCode: current?.billingCurrencyCode ?? "USD",
            notes: current?.notes ?? null,
        });
    };
    const selectCreatePlan = (id: number | null) => {
        const plan = plansQuery.data?.find((item) => item.id === id);
        setCreateForm((current) => plan ? ({
            ...current,
            subscriptionPlanId: plan.id,
            plan: plan.legacyPlan,
            mainCurrencyCode: plan.currencyCode,
            maxUsers: plan.maxUsers,
            maxBranches: plan.maxBranches,
            maxProducts: plan.maxProducts,
            maxOrdersPerMonth: plan.maxOrdersPerMonth,
            maxStorageMb: plan.maxStorageMb,
            monthlyPrice: plan.monthlyPrice,
        }) : ({ ...current, subscriptionPlanId: null, plan: null }));
    };
    const selectPlan = (id: number | null) => {
        const plan = plansQuery.data?.find((item) => item.id === id);
        setSubscriptionForm((current) => plan ? ({
            ...current, subscriptionPlanId: plan.id, plan: plan.legacyPlan,
            maxUsers: plan.maxUsers, maxBranches: plan.maxBranches, maxProducts: plan.maxProducts,
            maxOrdersPerMonth: plan.maxOrdersPerMonth, maxStorageMb: plan.maxStorageMb,
            monthlyPrice: plan.monthlyPrice, billingCurrencyCode: plan.currencyCode,
        }) : ({ ...current, subscriptionPlanId: null }));
    };
    const permissionGroups = useMemo(() => {
        if (!permissionsQuery.data || !editing?.subscription) return permissionsQuery.data ?? [];
        const plan = plansQuery.data?.find((item) => item.id === editing.subscription?.subscriptionPlanId);
        if (!plan) return permissionsQuery.data;
        const allowed = new Set(plan.enabledPermissions);
        return permissionsQuery.data.map((group) => ({ ...group, items: group.items.filter((item) => allowed.has(item.value)) })).filter((group) => group.items.length);
    }, [editing, permissionsQuery.data, plansQuery.data]);

    return (
        <div className="space-y-6">
            <PageHeader title={t("platform.title")} description={t("platform.description")} actions={<Button onClick={openCreateTenant}><Plus />{t("platform.newTenant")}</Button>} />

            {tenantsQuery.isLoading ? <div className="grid min-h-56 place-items-center"><LoaderCircle className="animate-spin" /></div> : (
                <div className="grid gap-4 xl:grid-cols-2">
                    {tenantsQuery.data?.map((tenant) => <TenantCard key={tenant.id} tenant={tenant} onEdit={() => openEdit(tenant)} onSubscription={() => openSubscription(tenant)} t={t} />)}
                </div>
            )}

            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto">
                    <DialogHeader><DialogTitle>{t("platform.createTitle")}</DialogTitle><DialogDescription>{t("platform.createDescription")}</DialogDescription></DialogHeader>
                    <div className="space-y-6 py-2">
                        <section className="grid gap-4 rounded-xl border p-4 sm:grid-cols-2 lg:grid-cols-3">
                            <Field label={t("tenant.companyName")}><Input value={createForm.name} onChange={(e) => setCreateForm((v) => ({ ...v, name: e.target.value }))} /></Field>
                            <Field label={t("tenant.workspaceSlug")}><Input value={createForm.slug} onChange={(e) => setCreateForm((v) => ({ ...v, slug: e.target.value }))} placeholder="company-name" /></Field>
                            <Field label={t("platform.plan")}><PlanCombobox plans={plansQuery.data ?? []} value={createForm.subscriptionPlanId} onChange={selectCreatePlan} /></Field>
                            <Field label={t("platform.adminName")}><Input value={createForm.adminFullName} onChange={(e) => setCreateForm((v) => ({ ...v, adminFullName: e.target.value }))} /></Field>
                            <Field label={t("platform.adminEmail")}><Input type="email" inputMode="email" autoComplete="email" aria-invalid={Boolean(createForm.adminEmail) && !administratorEmailIsValid} value={createForm.adminEmail} onChange={(e) => setCreateForm((v) => ({ ...v, adminEmail: e.target.value }))} />{createForm.adminEmail && !administratorEmailIsValid ? <p className="text-xs text-destructive">{t("platform.adminEmailInvalid")}</p> : null}</Field>
                            <Field label={t("platform.adminPassword")}><Input type="password" value={createForm.adminPassword} onChange={(e) => setCreateForm((v) => ({ ...v, adminPassword: e.target.value }))} /></Field>
                        </section>
                        <section>
                            <div className="mb-3"><h3 className="font-semibold">{t("platform.tab.site")}</h3><p className="text-sm text-muted-foreground">{t("platform.createSiteHelp")}</p></div>
                            <div className="grid gap-4 rounded-xl border p-4 sm:grid-cols-2">
                                <Field label={t("platform.routingMode")}><SimpleCombobox value={createForm.siteRoutingMode} onValueChange={(value) => value && setCreateForm((v) => ({ ...v, siteRoutingMode: value as TenantSiteRoutingMode }))} options={[{ value: "QueryString", label: t("platform.routing.query") }, { value: "Subdomain", label: t("platform.routing.subdomain") }, { value: "CustomDomain", label: t("platform.routing.custom") }]} /></Field>
                                <Field label={t("platform.customDomain")}><Input value={createForm.customDomain ?? ""} onChange={(e) => setCreateForm((v) => ({ ...v, customDomain: e.target.value || null }))} disabled={createForm.siteRoutingMode !== "CustomDomain"} placeholder="shop.company.com" dir="ltr" /></Field>
                                <div className="sm:col-span-2"><Field label={t("platform.storefrontOverride")}><Input value={createForm.storefrontBaseUrlOverride ?? ""} onChange={(e) => setCreateForm((v) => ({ ...v, storefrontBaseUrlOverride: e.target.value || null }))} placeholder={platformSettingsQuery.data?.storefrontBaseUrl ?? "https://shop.example.com"} dir="ltr" /></Field></div>
                            </div>
                        </section>
                        <section>
                            <div className="mb-3"><h3 className="font-semibold">{t("platform.initialLimits")}</h3><p className="text-sm text-muted-foreground">{t("platform.initialLimitsHelp")}</p></div>
                            <div className="grid gap-4 rounded-xl border p-4 sm:grid-cols-2 lg:grid-cols-3">
                                <LimitField icon={<Users />} label={t("tenant.usersLimit")} value={createForm.maxUsers} onChange={(value) => setCreateForm((v) => ({ ...v, maxUsers: value }))} />
                                <LimitField icon={<Warehouse />} label={t("tenant.branchesLimit")} value={createForm.maxBranches} onChange={(value) => setCreateForm((v) => ({ ...v, maxBranches: value }))} />
                                <LimitField icon={<Package />} label={t("tenant.productsLimit")} value={createForm.maxProducts} onChange={(value) => setCreateForm((v) => ({ ...v, maxProducts: value }))} />
                                <LimitField icon={<ShoppingCart />} label={t("platform.ordersLimit")} value={createForm.maxOrdersPerMonth} onChange={(value) => setCreateForm((v) => ({ ...v, maxOrdersPerMonth: value }))} />
                                <LimitField icon={<HardDrive />} label={t("platform.storageLimit")} value={createForm.maxStorageMb} onChange={(value) => setCreateForm((v) => ({ ...v, maxStorageMb: value }))} />
                                <Field label={t("platform.monthlyPrice")}><Input type="number" min={0} value={createForm.monthlyPrice ?? ""} onChange={(e) => setCreateForm((v) => ({ ...v, monthlyPrice: numberOrNull(e.target.value) }))} /></Field>
                                <Field label={t("platform.currency")}><SimpleCombobox value={createForm.mainCurrencyCode} onValueChange={(value) => value && setCreateForm((v) => ({ ...v, mainCurrencyCode: value }))} options={currencies.map((value) => ({ value, label: value }))} /></Field>
                            </div>
                        </section>
                    </div>
                    <DialogFooter><Button variant="outline" onClick={() => setCreateOpen(false)}>{t("tenant.cancel")}</Button><Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending || !createForm.subscriptionPlanId || !administratorEmailIsValid || createForm.adminPassword.length < 6 || !createRoutingIsValid}><Plus />{t("platform.create")}</Button></DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={Boolean(editing && editForm)} onOpenChange={(open) => { if (!open) { setEditing(null); setEditForm(null); } }}>
                <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto p-0">
                    {editing && editForm ? <>
                        <DialogHeader className="border-b px-6 py-5"><DialogTitle>{t("platform.editTenant")}: {editing.name}</DialogTitle><DialogDescription>{t("platform.editTenantHelp")}</DialogDescription></DialogHeader>
                        <div className="flex flex-wrap gap-2 border-b px-6 py-3">
                            {(["company", "site", "settings", "permissions"] as EditTab[]).map((tab) => <Button key={tab} size="sm" variant={editTab === tab ? "default" : "ghost"} onClick={() => setEditTab(tab)}>{t(`platform.tab.${tab}`)}</Button>)}
                        </div>
                        <div className="p-6">
                            {editTab === "company" && <CompanyEditor form={editForm} onChange={setEditForm} t={t} />}
                            {editTab === "site" && <SiteEditor tenant={editing} form={editForm} onChange={setEditForm} t={t} />}
                            {editTab === "settings" && <SettingsEditor form={editForm} onChange={setEditForm} t={t} />}
                            {editTab === "permissions" && <PermissionChecklist groups={permissionGroups} selected={editForm.enabledPermissions} onChange={(enabledPermissions) => setEditForm((v) => v ? ({ ...v, enabledPermissions }) : v)} />}
                        </div>
                        <DialogFooter className="border-t px-6 py-4"><Button variant="outline" onClick={() => { setEditing(null); setEditForm(null); }}>{t("tenant.cancel")}</Button><Button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}><Save />{t("tenant.save")}</Button></DialogFooter>
                    </> : null}
                </DialogContent>
            </Dialog>

            <Dialog open={Boolean(subscriptionTenant)} onOpenChange={(open) => { if (!open) setSubscriptionTenant(null); }}>
                <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
                    <DialogHeader><DialogTitle>{t("platform.manageSubscription")}: {subscriptionTenant?.name}</DialogTitle><DialogDescription>{t("platform.subscriptionLimitsHelp")}</DialogDescription></DialogHeader>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        <Field label={t("platform.plan")}><PlanCombobox plans={plansQuery.data ?? []} value={subscriptionForm.subscriptionPlanId} onChange={selectPlan} /></Field>
                        <Field label={t("tenant.status")}><SimpleCombobox value={subscriptionForm.status} onValueChange={(value) => value && setSubscriptionForm((v) => ({ ...v, status: value as SubscriptionStatus }))} options={statuses.map((value) => ({ value, label: value }))} /></Field>
                        <Field label={t("platform.endsAt")}><Input type="date" value={subscriptionForm.endsAt ?? ""} onChange={(e) => setSubscriptionForm((v) => ({ ...v, endsAt: e.target.value || null }))} /></Field>
                        <LimitField icon={<Users />} label={t("tenant.usersLimit")} value={subscriptionForm.maxUsers} onChange={(value) => setSubscriptionForm((v) => ({ ...v, maxUsers: value }))} />
                        <LimitField icon={<Warehouse />} label={t("tenant.branchesLimit")} value={subscriptionForm.maxBranches} onChange={(value) => setSubscriptionForm((v) => ({ ...v, maxBranches: value }))} />
                        <LimitField icon={<Package />} label={t("tenant.productsLimit")} value={subscriptionForm.maxProducts} onChange={(value) => setSubscriptionForm((v) => ({ ...v, maxProducts: value }))} />
                        <LimitField icon={<ShoppingCart />} label={t("platform.ordersLimit")} value={subscriptionForm.maxOrdersPerMonth} onChange={(value) => setSubscriptionForm((v) => ({ ...v, maxOrdersPerMonth: value }))} />
                        <LimitField icon={<HardDrive />} label={t("platform.storageLimit")} value={subscriptionForm.maxStorageMb} onChange={(value) => setSubscriptionForm((v) => ({ ...v, maxStorageMb: value }))} />
                        <Field label={t("platform.monthlyPrice")}><Input type="number" min={0} value={subscriptionForm.monthlyPrice ?? ""} onChange={(e) => setSubscriptionForm((v) => ({ ...v, monthlyPrice: numberOrNull(e.target.value) }))} /></Field>
                        <Field label={t("platform.currency")}><SimpleCombobox value={subscriptionForm.billingCurrencyCode} onValueChange={(value) => setSubscriptionForm((v) => ({ ...v, billingCurrencyCode: value }))} options={currencies.map((value) => ({ value, label: value }))} /></Field>
                        <div className="sm:col-span-2 lg:col-span-3"><Field label={t("platform.notes")}><Textarea value={subscriptionForm.notes ?? ""} onChange={(e) => setSubscriptionForm((v) => ({ ...v, notes: e.target.value || null }))} /></Field></div>
                    </div>
                    <DialogFooter><Button variant="outline" onClick={() => setSubscriptionTenant(null)}>{t("tenant.cancel")}</Button><Button onClick={() => subscriptionMutation.mutate()} disabled={subscriptionMutation.isPending}><Save />{t("platform.updateSubscription")}</Button></DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

function TenantCard({ tenant, onEdit, onSubscription, t }: { tenant: TenantProfile; onEdit: () => void; onSubscription: () => void; t: ReturnType<typeof useI18n>["t"] }) {
    const copy = async (value: string) => {
        await copyText(value);
        toast.success(t("platform.linkCopied"));
    };
    return <Card className="overflow-hidden"><CardContent className="p-0">
        <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 gap-4"><div className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-xl bg-primary text-primary-foreground">{tenant.logoUrl ? <img src={tenant.logoUrl} alt="" className="size-full object-cover" /> : <Building2 />}</div><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="truncate text-lg font-bold">{tenant.name}</h2><Badge variant={tenant.subscription?.status === "Active" ? "default" : "secondary"}>{tenant.subscription?.status ?? t("platform.noPlan")}</Badge></div><p className="mt-1 text-sm text-muted-foreground">{tenant.slug} · {tenant.subscription?.planName ?? t("platform.noPlan")}</p></div></div>
            <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={onEdit}><Pencil />{t("platform.edit")}</Button><Button size="sm" variant="outline" onClick={onSubscription}><Crown />{t("platform.managePlan")}</Button></div>
        </div>
        <div className="grid gap-px border-y bg-border sm:grid-cols-3"><Stat icon={<Users />} value={tenant.subscription?.maxUsers ?? 0} label={t("tenant.usersLimit")} /><Stat icon={<Warehouse />} value={tenant.subscription?.maxBranches ?? 0} label={t("tenant.branchesLimit")} /><Stat icon={<Package />} value={tenant.subscription?.maxProducts ?? 0} label={t("tenant.productsLimit")} /></div>
        <div className="space-y-3 bg-muted/20 p-4">
            <LinkRow icon={<Globe2 />} label={t("platform.storefrontLink")} value={tenant.site.storefrontUrl} onCopy={() => copy(tenant.site.storefrontUrl)} />
            <LinkRow icon={<ShieldCheck />} label={t("platform.adminLink")} value={tenant.site.adminUrl} onCopy={() => copy(tenant.site.adminUrl)} />
        </div>
    </CardContent></Card>;
}

function LinkRow({ icon, label, value, onCopy }: { icon: ReactNode; label: string; value: string; onCopy: () => void }) {
    return <div className="flex min-w-0 flex-col gap-2 rounded-xl border bg-background p-3 sm:flex-row sm:items-center"><span className="text-primary">{icon}</span><div className="min-w-0 flex-1"><p className="text-xs text-muted-foreground">{label}</p><p className="truncate text-sm font-medium" dir="ltr">{value}</p></div><div className="flex gap-2"><Button size="icon" variant="ghost" onClick={onCopy}><Copy /></Button><Button size="icon" variant="ghost" asChild><a href={value} target="_blank" rel="noreferrer"><ExternalLink /></a></Button></div></div>;
}
function Stat({ icon, value, label }: { icon: ReactNode; value: number; label: string }) { return <div className="flex items-center gap-3 bg-card p-4"><span className="text-primary">{icon}</span><div><p className="font-bold tabular-nums">{value.toLocaleString()}</p><p className="text-xs text-muted-foreground">{label}</p></div></div>; }

function CompanyEditor({ form, onChange, t }: EditorProps) {
    const patch = (values: Partial<PlatformUpdateTenantRequest>) => onChange((current) => current ? ({ ...current, ...values }) : current);
    return <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("tenant.companyName")}><Input value={form.name} onChange={(e) => patch({ name: e.target.value })} /></Field><Field label={t("tenant.workspaceSlug")}><Input value={form.slug} onChange={(e) => patch({ slug: e.target.value })} /></Field>
        <Field label={t("tenant.legalName")}><Input value={form.legalName ?? ""} onChange={(e) => patch({ legalName: e.target.value || null })} /></Field><Field label={t("tenant.registrationNumber")}><Input value={form.registrationNumber ?? ""} onChange={(e) => patch({ registrationNumber: e.target.value || null })} /></Field>
        <Field label={t("tenant.email")}><Input type="email" value={form.email ?? ""} onChange={(e) => patch({ email: e.target.value || null })} /></Field><Field label={t("tenant.phone")}><Input value={form.phone ?? ""} onChange={(e) => patch({ phone: e.target.value || null })} /></Field>
        <Field label={t("tenant.logoUrl")}><Input value={form.logoUrl ?? ""} onChange={(e) => patch({ logoUrl: e.target.value || null })} /></Field><Field label={t("tenant.faviconUrl")}><Input value={form.faviconUrl ?? ""} onChange={(e) => patch({ faviconUrl: e.target.value || null })} /></Field>
        <div className="sm:col-span-2"><Field label={t("tenant.address")}><Textarea value={form.address ?? ""} onChange={(e) => patch({ address: e.target.value || null })} /></Field></div>
    </div>;
}
function SiteEditor({ tenant, form, onChange, t }: EditorProps & { tenant: TenantProfile }) {
    const patch = (values: Partial<PlatformUpdateTenantRequest>) => onChange((current) => current ? ({ ...current, ...values }) : current);
    return <div className="space-y-5"><div className="rounded-xl border bg-primary/5 p-4"><p className="font-semibold">{t("platform.currentStorefrontLink")}</p><a href={tenant.site.storefrontUrl} target="_blank" rel="noreferrer" className="mt-2 block break-all text-sm text-primary underline" dir="ltr">{tenant.site.storefrontUrl}</a></div><div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("platform.routingMode")}><SimpleCombobox value={form.siteRoutingMode} onValueChange={(value) => value && patch({ siteRoutingMode: value as TenantSiteRoutingMode })} options={[{ value: "QueryString", label: t("platform.routing.query") }, { value: "Subdomain", label: t("platform.routing.subdomain") }, { value: "CustomDomain", label: t("platform.routing.custom") }]} /></Field>
        <Field label={t("platform.customDomain")}><Input value={form.customDomain ?? ""} onChange={(e) => patch({ customDomain: e.target.value || null })} placeholder="shop.company.com" dir="ltr" /></Field>
        <div className="sm:col-span-2"><Field label={t("platform.storefrontOverride")}><Input value={form.storefrontBaseUrlOverride ?? ""} onChange={(e) => patch({ storefrontBaseUrlOverride: e.target.value || null })} placeholder="https://shop.example.com" dir="ltr" /></Field></div>
    </div></div>;
}
function SettingsEditor({ form, onChange, t }: EditorProps) {
    const patch = (values: Partial<PlatformUpdateTenantRequest["settings"]>) => onChange((current) => current ? ({ ...current, settings: { ...current.settings, ...values } }) : current);
    const settings = form.settings;
    return <div className="space-y-6"><section className="grid gap-4 rounded-xl border p-4 sm:grid-cols-2 lg:grid-cols-4"><Field label={t("tenant.mainCurrency")}><SimpleCombobox value={settings.mainCurrencyCode} onValueChange={(value) => value && patch({ mainCurrencyCode: value })} options={currencies.map((value) => ({ value, label: value }))} /></Field><Field label={t("tenant.currencySymbol")}><Input value={settings.currencySymbol} onChange={(e) => patch({ currencySymbol: e.target.value })} /></Field><Field label={t("tenant.decimalPlaces")}><Input type="number" min={0} max={4} value={settings.currencyDecimalPlaces} onChange={(e) => patch({ currencyDecimalPlaces: Number(e.target.value) })} /></Field><Field label={t("tenant.baseFontSize")}><Input type="number" min={12} max={22} value={settings.baseFontSize} onChange={(e) => patch({ baseFontSize: Number(e.target.value) })} /></Field></section>
        <section className="grid gap-4 rounded-xl border p-4 sm:grid-cols-2 lg:grid-cols-3"><FontField label={t("tenant.englishFont")} value={settings.englishFontFamily} options={tenantFontOptions.en} onChange={(value) => patch({ englishFontFamily: value })} /><FontField label={t("tenant.dariFont")} value={settings.dariFontFamily} options={tenantFontOptions.dr} onChange={(value) => patch({ dariFontFamily: value })} /><FontField label={t("tenant.pashtoFont")} value={settings.pashtoFontFamily} options={tenantFontOptions.ps} onChange={(value) => patch({ pashtoFontFamily: value })} /></section>
        <section className="grid gap-4 rounded-xl border p-4 sm:grid-cols-2 lg:grid-cols-4"><ColorField label={t("tenant.adminPrimary")} value={settings.adminPrimaryColor} onChange={(value) => patch({ adminPrimaryColor: value })} /><ColorField label={t("tenant.adminSecondary")} value={settings.adminSecondaryColor} onChange={(value) => patch({ adminSecondaryColor: value })} /><ColorField label={t("tenant.storePrimary")} value={settings.storefrontPrimaryColor} onChange={(value) => patch({ storefrontPrimaryColor: value })} /><ColorField label={t("tenant.storeSecondary")} value={settings.storefrontSecondaryColor} onChange={(value) => patch({ storefrontSecondaryColor: value })} /></section>
        <div className="flex items-center justify-between rounded-xl border p-4"><div><Label>{t("tenant.claimManagement")}</Label><p className="mt-1 text-xs text-muted-foreground">{t("tenant.claimManagementHelp")}</p></div><Switch checked={settings.allowTenantUserClaimManagement} onCheckedChange={(value) => patch({ allowTenantUserClaimManagement: value })} /></div>
    </div>;
}

type EditorProps = { form: PlatformUpdateTenantRequest; onChange: React.Dispatch<React.SetStateAction<PlatformUpdateTenantRequest | null>>; t: ReturnType<typeof useI18n>["t"] };
function PlanCombobox({ plans, value, onChange }: { plans: SubscriptionPlan[]; value: number | null; onChange: (value: number | null) => void }) { return <SimpleCombobox value={value} onValueChange={onChange} options={plans.map((plan) => ({ value: plan.id, label: plan.name, description: `${plan.currencyCode} ${plan.monthlyPrice}/month · ${plan.maxUsers} users` }))} />; }
function LimitField({ icon, label, value, onChange }: { icon: ReactNode; label: string; value: number | null; onChange: (value: number | null) => void }) { return <Field label={label}><div className="relative"><span className="absolute start-3 top-2.5 text-muted-foreground">{icon}</span><Input className="ps-10" type="number" min={1} value={value ?? ""} onChange={(e) => onChange(numberOrNull(e.target.value))} /></div></Field>; }
function FontField({ label, value, options, onChange }: { label: string; value: string; options: readonly { value: string; label: string; description?: string }[]; onChange: (value: string) => void }) { return <Field label={label}><SimpleCombobox value={value} onValueChange={(next) => next && onChange(next)} options={[...options]} /></Field>; }
function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <Field label={label}><div className="flex gap-2"><Input type="color" className="w-14 p-1" value={value} onChange={(e) => onChange(e.target.value)} /><Input value={value} onChange={(e) => onChange(e.target.value)} /></div></Field>; }
function Field({ label, children }: { label: string; children: ReactNode }) { return <div className="min-w-0 space-y-2"><Label>{label}</Label>{children}</div>; }
function emptyCreateTenant(defaultRoutingMode: TenantSiteRoutingMode = "QueryString"): CreateTenantRequest {
    return {
        name: "", slug: "", adminFullName: "", adminEmail: "", adminPassword: "",
        subscriptionPlanId: null, plan: null, mainCurrencyCode: "USD",
        siteRoutingMode: defaultRoutingMode, customDomain: null, storefrontBaseUrlOverride: null,
        maxUsers: null, maxBranches: null, maxProducts: null,
        maxOrdersPerMonth: null, maxStorageMb: null, monthlyPrice: null,
    };
}
function emptySubscription(): UpdateTenantSubscriptionRequest { return { subscriptionPlanId: null, plan: null, status: "Active", endsAt: null, maxUsers: null, maxBranches: null, maxProducts: null, maxOrdersPerMonth: null, maxStorageMb: null, monthlyPrice: null, billingCurrencyCode: "USD", notes: null }; }
async function copyText(value: string) {
    if (navigator.clipboard?.writeText) {
        try {
            await navigator.clipboard.writeText(value);
            return;
        } catch {
            // HTTP/LAN deployments may not expose the Clipboard API.
        }
    }
    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
}
function numberOrNull(value: string) { const parsed = Number(value); return value === "" || !Number.isFinite(parsed) ? null : parsed; }
function message(error: unknown) { return error instanceof Error ? error.message : "Operation failed."; }
