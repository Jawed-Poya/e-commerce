import { useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    Building2,
    Copy,
    Crown,
    ExternalLink,
    Eye,
    HardDrive,
    KeyRound,
    LoaderCircle,
    Package,
    Pencil,
    Plus,
    Save,
    Share2,
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
    StorefrontAccessMode,
    SubscriptionPlan,
    SubscriptionStatus,
    TenantProfile,
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
    const permissionsQuery = useQuery({ queryKey: ["platform", "permission-groups"], queryFn: userService.getPermissions, staleTime: 10 * 60_000 });

    const [createOpen, setCreateOpen] = useState(false);
    const [editing, setEditing] = useState<TenantProfile | null>(null);
    const [editTab, setEditTab] = useState<EditTab>("company");
    const [editForm, setEditForm] = useState<PlatformUpdateTenantRequest | null>(null);
    const [subscriptionTenant, setSubscriptionTenant] = useState<TenantProfile | null>(null);
    const [createForm, setCreateForm] = useState<CreateTenantRequest>(emptyCreateTenant());
    const [subscriptionForm, setSubscriptionForm] = useState<UpdateTenantSubscriptionRequest>(emptySubscription());
    const administratorEmailIsValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(createForm.adminEmail.trim());

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
            setCreateForm(emptyCreateTenant());
            await invalidate();
        },
        onError: (error) => toast.error(message(error, t("tenant.operationFailed"))),
    });
    const updateMutation = useMutation({
        mutationFn: () => tenantService.updateTenant(editing!.id, editForm!),
        onSuccess: async () => {
            toast.success(t("platform.tenantUpdated"));
            setEditing(null);
            setEditForm(null);
            await invalidate();
        },
        onError: (error) => toast.error(message(error, t("tenant.operationFailed"))),
    });
    const subscriptionMutation = useMutation({
        mutationFn: () => tenantService.updateSubscription(subscriptionTenant!.id, subscriptionForm),
        onSuccess: async () => {
            toast.success(t("platform.subscriptionUpdated"));
            setSubscriptionTenant(null);
            await invalidate();
        },
        onError: (error) => toast.error(message(error, t("tenant.operationFailed"))),
    });
    const rotateKeyMutation = useMutation({
        mutationFn: (tenantId: number) => tenantService.rotateTenantStorefrontKey(tenantId),
        onSuccess: async () => {
            toast.success(t("platform.storefrontKeyRotated"));
            await invalidate();
        },
        onError: (error) => toast.error(message(error, t("tenant.operationFailed"))),
    });
    const previewMutation = useMutation({
        mutationFn: (tenantId: number) => tenantService.createTenantPreviewLink(tenantId),
        onSuccess: (result) => window.open(result.url, "_blank", "noopener,noreferrer"),
        onError: (error) => toast.error(message(error, t("tenant.operationFailed"))),
    });

    const openEdit = (tenant: TenantProfile) => {
        setEditing(tenant);
        setEditTab("company");
        setEditForm({
            name: tenant.name,
            slug: tenant.slug,
            legalName: tenant.legalName,
            registrationNumber: tenant.registrationNumber,
            email: tenant.email,
            phone: tenant.phone,
            address: tenant.address,
            logoUrl: tenant.logoUrl,
            faviconUrl: tenant.faviconUrl,
            siteRoutingMode: "PlatformPath",
            storefrontAccessMode: tenant.site.accessMode,
            isStorefrontPublished: tenant.site.isPublished,
            customDomain: null,
            storefrontBaseUrlOverride: null,
            settings: { ...tenant.settings },
            enabledPermissions: [...tenant.enabledPermissions],
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
            ...current,
            subscriptionPlanId: plan.id,
            plan: plan.legacyPlan,
            maxUsers: plan.maxUsers,
            maxBranches: plan.maxBranches,
            maxProducts: plan.maxProducts,
            maxOrdersPerMonth: plan.maxOrdersPerMonth,
            maxStorageMb: plan.maxStorageMb,
            monthlyPrice: plan.monthlyPrice,
            billingCurrencyCode: plan.currencyCode,
        }) : ({ ...current, subscriptionPlanId: null }));
    };
    const permissionGroups = useMemo(() => {
        if (!permissionsQuery.data || !editing?.subscription) return permissionsQuery.data ?? [];
        const plan = plansQuery.data?.find((item) => item.id === editing.subscription?.subscriptionPlanId);
        if (!plan) return permissionsQuery.data;
        const allowed = new Set(plan.enabledPermissions);
        return permissionsQuery.data
            .map((group) => ({ ...group, items: group.items.filter((item) => allowed.has(item.value)) }))
            .filter((group) => group.items.length);
    }, [editing, permissionsQuery.data, plansQuery.data]);

    return (
        <div className="space-y-6">
            <PageHeader
                title={t("platform.title")}
                description={t("platform.description")}
                actions={<Button onClick={() => { setCreateForm(emptyCreateTenant()); setCreateOpen(true); }}><Plus />{t("platform.newTenant")}</Button>}
            />

            {tenantsQuery.isLoading ? (
                <div className="grid min-h-56 place-items-center"><LoaderCircle className="animate-spin" /></div>
            ) : (
                <div className="grid gap-4 xl:grid-cols-2">
                    {tenantsQuery.data?.map((tenant) => (
                        <TenantCard
                            key={tenant.id}
                            tenant={tenant}
                            onEdit={() => openEdit(tenant)}
                            onSubscription={() => openSubscription(tenant)}
                            onPreview={() => previewMutation.mutate(tenant.id)}
                            onShare={() => tenant.site.storefrontUrl && void shareStorefront(tenant.name, tenant.site.storefrontUrl, t)}
                            t={t}
                        />
                    ))}
                </div>
            )}

            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogContent className="max-h-[96dvh] w-[calc(100vw-1rem)] max-w-none overflow-y-auto p-4 sm:max-w-[calc(100vw-2rem)] sm:p-6 2xl:max-w-[1600px]">
                    <DialogHeader>
                        <DialogTitle>{t("platform.createTitle")}</DialogTitle>
                        <DialogDescription>{t("platform.createDescription")}</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-5 py-2 xl:grid-cols-2">
                        <section className="grid content-start gap-4 rounded-xl border p-4 sm:grid-cols-2">
                            <h3 className="sm:col-span-2 font-semibold">{t("platform.companyAndAdmin")}</h3>
                            <Field label={t("tenant.companyName")}><Input value={createForm.name} onChange={(e) => setCreateForm((v) => ({ ...v, name: e.target.value }))} /></Field>
                            <Field label={t("tenant.workspaceSlug")}><Input value={createForm.slug} onChange={(e) => setCreateForm((v) => ({ ...v, slug: e.target.value }))} placeholder="company-name" /></Field>
                            <Field label={t("platform.adminName")}><Input value={createForm.adminFullName} onChange={(e) => setCreateForm((v) => ({ ...v, adminFullName: e.target.value }))} /></Field>
                            <Field label={t("platform.adminEmail")}>
                                <Input type="email" value={createForm.adminEmail} aria-invalid={Boolean(createForm.adminEmail) && !administratorEmailIsValid} onChange={(e) => setCreateForm((v) => ({ ...v, adminEmail: e.target.value }))} />
                                {createForm.adminEmail && !administratorEmailIsValid ? <p className="text-xs text-destructive">{t("platform.adminEmailInvalid")}</p> : null}
                            </Field>
                            <Field label={t("platform.adminPassword")}><Input type="password" value={createForm.adminPassword} onChange={(e) => setCreateForm((v) => ({ ...v, adminPassword: e.target.value }))} /></Field>
                            <Field label={t("platform.currency")}><SimpleCombobox value={createForm.mainCurrencyCode} onValueChange={(value) => value && setCreateForm((v) => ({ ...v, mainCurrencyCode: value }))} options={currencies.map((value) => ({ value, label: value }))} /></Field>
                        </section>

                        <section className="grid content-start gap-4 rounded-xl border p-4 sm:grid-cols-2">
                            <h3 className="sm:col-span-2 font-semibold">{t("platform.siteAccess")}</h3>
                            <Field label={t("platform.storefrontAccess")}>
                                <SimpleCombobox<StorefrontAccessMode>
                                    value={createForm.storefrontAccessMode}
                                    onValueChange={(value) => value && setCreateForm((v) => ({ ...v, storefrontAccessMode: value }))}
                                    options={[
                                        { value: "Public", label: t("platform.access.public"), description: t("platform.access.publicHelp") },
                                        { value: "Private", label: t("platform.access.private"), description: t("platform.access.privateHelp") },
                                    ]}
                                />
                            </Field>
                            <div className="flex items-center justify-between rounded-xl border p-4">
                                <div><Label>{t("platform.publishStorefront")}</Label><p className="mt-1 text-xs text-muted-foreground">{t("platform.publishStorefrontHelp")}</p></div>
                                <Switch checked={createForm.isStorefrontPublished} onCheckedChange={(value) => setCreateForm((v) => ({ ...v, isStorefrontPublished: value }))} />
                            </div>

                            <p className="sm:col-span-2 rounded-xl bg-muted/50 p-3 text-xs leading-5 text-muted-foreground">{t("platform.singleHostAccessHelp")}</p>
                        </section>

                        <section className="grid gap-4 rounded-xl border p-4 sm:grid-cols-2 xl:col-span-2 lg:grid-cols-4">
                            <h3 className="sm:col-span-2 lg:col-span-4 font-semibold">{t("platform.planAndLimits")}</h3>
                            <Field label={t("platform.plan")}><PlanCombobox plans={plansQuery.data ?? []} value={createForm.subscriptionPlanId} onChange={selectCreatePlan} t={t} /></Field>
                            <LimitField icon={<Users className="size-4" />} label={t("tenant.usersLimit")} value={createForm.maxUsers} onChange={(value) => setCreateForm((v) => ({ ...v, maxUsers: value }))} />
                            <LimitField icon={<Warehouse className="size-4" />} label={t("tenant.branchesLimit")} value={createForm.maxBranches} onChange={(value) => setCreateForm((v) => ({ ...v, maxBranches: value }))} />
                            <LimitField icon={<Package className="size-4" />} label={t("tenant.productsLimit")} value={createForm.maxProducts} onChange={(value) => setCreateForm((v) => ({ ...v, maxProducts: value }))} />
                            <LimitField icon={<ShoppingCart className="size-4" />} label={t("platform.ordersLimit")} value={createForm.maxOrdersPerMonth} onChange={(value) => setCreateForm((v) => ({ ...v, maxOrdersPerMonth: value }))} />
                            <LimitField icon={<HardDrive className="size-4" />} label={t("platform.storageLimit")} value={createForm.maxStorageMb} onChange={(value) => setCreateForm((v) => ({ ...v, maxStorageMb: value }))} />
                            <Field label={t("plans.monthlyPrice")}><Input type="number" min={0} value={createForm.monthlyPrice ?? ""} onChange={(e) => setCreateForm((v) => ({ ...v, monthlyPrice: numberOrNull(e.target.value) }))} /></Field>
                        </section>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setCreateOpen(false)}>{t("tenant.cancel")}</Button>
                        <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending || !createForm.name.trim() || !createForm.slug.trim() || !administratorEmailIsValid || createForm.adminPassword.length < 6}>
                            {createMutation.isPending ? <LoaderCircle className="animate-spin" /> : <Plus />}{t("platform.create")}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={Boolean(editing && editForm)} onOpenChange={(open) => { if (!open) { setEditing(null); setEditForm(null); } }}>
                <DialogContent className="h-[96dvh] w-[calc(100vw-1rem)] max-w-none grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden p-0 sm:max-w-[calc(100vw-2rem)] 2xl:max-w-[1720px]">
                    {editing && editForm ? (
                        <>
                            <div className="border-b p-4 sm:p-6"><DialogHeader><DialogTitle>{t("platform.editTenant")}</DialogTitle><DialogDescription>{editing.name}</DialogDescription></DialogHeader></div>
                            <div className="grid min-h-0 flex-1 lg:grid-cols-[230px_minmax(0,1fr)]">
                                <nav className="flex gap-2 overflow-x-auto border-b p-3 lg:flex-col lg:border-b-0 lg:border-e">
                                    {(["company", "site", "settings", "permissions"] as EditTab[]).map((tab) => (
                                        <Button key={tab} variant={editTab === tab ? "secondary" : "ghost"} className="justify-start whitespace-nowrap" onClick={() => setEditTab(tab)}>{t(`platform.tab.${tab}` as never)}</Button>
                                    ))}
                                </nav>
                                <div className="max-h-[calc(96dvh-190px)] overflow-y-auto p-4 sm:p-6">
                                    {editTab === "company" && <CompanyEditor form={editForm} onChange={setEditForm} t={t} />}
                                    {editTab === "site" && (
                                        <SiteEditor
                                            tenant={editing}
                                            form={editForm}
                                            onChange={setEditForm}
                                            onPreview={() => previewMutation.mutate(editing.id)}
                                            onRotate={() => rotateKeyMutation.mutate(editing.id)}
                                            t={t}
                                        />
                                    )}
                                    {editTab === "settings" && <SettingsEditor form={editForm} onChange={setEditForm} t={t} />}
                                    {editTab === "permissions" && <PermissionChecklist groups={permissionGroups} selected={editForm.enabledPermissions} onChange={(enabledPermissions) => setEditForm((current) => current ? ({ ...current, enabledPermissions }) : current)} />}
                                </div>
                            </div>
                            <DialogFooter className="border-t p-4 sm:p-6"><Button variant="outline" onClick={() => { setEditing(null); setEditForm(null); }}>{t("tenant.cancel")}</Button><Button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}><Save />{t("tenant.save")}</Button></DialogFooter>
                        </>
                    ) : null}
                </DialogContent>
            </Dialog>

            <Dialog open={Boolean(subscriptionTenant)} onOpenChange={(open) => !open && setSubscriptionTenant(null)}>
                <DialogContent className="max-h-[96dvh] w-[calc(100vw-1rem)] max-w-none overflow-y-auto p-4 sm:max-w-[calc(100vw-2rem)] sm:p-6 2xl:max-w-[1450px]">
                    <DialogHeader><DialogTitle>{t("platform.manageSubscription")}</DialogTitle><DialogDescription>{subscriptionTenant?.name}</DialogDescription></DialogHeader>
                    <div className="grid gap-4 py-2 sm:grid-cols-2 lg:grid-cols-4">
                        <Field label={t("platform.plan")}><PlanCombobox plans={plansQuery.data ?? []} value={subscriptionForm.subscriptionPlanId} onChange={selectPlan} t={t} /></Field>
                        <Field label={t("tenant.status")}><SimpleCombobox value={subscriptionForm.status} onValueChange={(value) => value && setSubscriptionForm((v) => ({ ...v, status: value as SubscriptionStatus }))} options={statuses.map((value) => ({ value, label: subscriptionStatusLabel(value, t) }))} /></Field>
                        <Field label={t("platform.endsAt")}><Input type="date" value={subscriptionForm.endsAt ?? ""} onChange={(e) => setSubscriptionForm((v) => ({ ...v, endsAt: e.target.value || null }))} /></Field>
                        <Field label={t("platform.currency")}><SimpleCombobox value={subscriptionForm.billingCurrencyCode ?? "USD"} onValueChange={(value) => value && setSubscriptionForm((v) => ({ ...v, billingCurrencyCode: value }))} options={currencies.map((value) => ({ value, label: value }))} /></Field>
                        <LimitField icon={<Users className="size-4" />} label={t("tenant.usersLimit")} value={subscriptionForm.maxUsers} onChange={(value) => setSubscriptionForm((v) => ({ ...v, maxUsers: value }))} />
                        <LimitField icon={<Warehouse className="size-4" />} label={t("tenant.branchesLimit")} value={subscriptionForm.maxBranches} onChange={(value) => setSubscriptionForm((v) => ({ ...v, maxBranches: value }))} />
                        <LimitField icon={<Package className="size-4" />} label={t("tenant.productsLimit")} value={subscriptionForm.maxProducts} onChange={(value) => setSubscriptionForm((v) => ({ ...v, maxProducts: value }))} />
                        <LimitField icon={<ShoppingCart className="size-4" />} label={t("platform.ordersLimit")} value={subscriptionForm.maxOrdersPerMonth} onChange={(value) => setSubscriptionForm((v) => ({ ...v, maxOrdersPerMonth: value }))} />
                        <LimitField icon={<HardDrive className="size-4" />} label={t("platform.storageLimit")} value={subscriptionForm.maxStorageMb} onChange={(value) => setSubscriptionForm((v) => ({ ...v, maxStorageMb: value }))} />
                        <Field label={t("plans.monthlyPrice")}><Input type="number" min={0} value={subscriptionForm.monthlyPrice ?? ""} onChange={(e) => setSubscriptionForm((v) => ({ ...v, monthlyPrice: numberOrNull(e.target.value) }))} /></Field>
                        <div className="sm:col-span-2 lg:col-span-4"><Field label={t("platform.subscriptionNotes")}><Textarea rows={4} value={subscriptionForm.notes ?? ""} onChange={(e) => setSubscriptionForm((v) => ({ ...v, notes: e.target.value || null }))} /></Field></div>
                    </div>
                    <DialogFooter><Button variant="outline" onClick={() => setSubscriptionTenant(null)}>{t("tenant.cancel")}</Button><Button onClick={() => subscriptionMutation.mutate()} disabled={subscriptionMutation.isPending}><Save />{t("platform.updateSubscription")}</Button></DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

function TenantCard({ tenant, onEdit, onSubscription, onPreview, onShare, t }: { tenant: TenantProfile; onEdit: () => void; onSubscription: () => void; onPreview: () => void; onShare: () => void; t: ReturnType<typeof useI18n>["t"] }) {
    return (
        <Card className="overflow-hidden">
            <CardContent className="space-y-5 p-5">
                <div className="flex flex-wrap items-start gap-4">
                    <span className="grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary">{tenant.logoUrl ? <img src={tenant.logoUrl} alt="" className="size-10 rounded-xl object-cover" /> : <Building2 />}</span>
                    <div className="min-w-0 flex-1"><h2 className="truncate text-lg font-bold">{tenant.name}</h2><p className="text-sm text-muted-foreground">{tenant.slug}</p></div>
                    <Badge variant={tenant.subscription?.status === "Active" ? "default" : "secondary"}>{tenant.subscription?.planName ?? t("platform.noPlan")}</Badge>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                    <Metric icon={<Users />} label={t("tenant.usersLimit")} value={tenant.subscription?.maxUsers ?? 0} />
                    <Metric icon={<Warehouse />} label={t("tenant.branchesLimit")} value={tenant.subscription?.maxBranches ?? 0} />
                    <Metric icon={<Package />} label={t("tenant.productsLimit")} value={tenant.subscription?.maxProducts ?? 0} />
                </div>

                <div className="space-y-3 rounded-xl border bg-muted/20 p-4">
                    <LinkRow label={t("platform.workspaceCode")} value={tenant.site.workspaceCode} onCopy={() => void copyWithFeedback(tenant.site.workspaceCode, t)} />
                    <LinkRow label={t("platform.adminLink")} value={tenant.site.adminUrl} onCopy={() => void copyWithFeedback(tenant.site.adminUrl, t)} href={tenant.site.adminUrl} />
                    <LinkRow label={t("platform.storefrontLink")} value={tenant.site.storefrontUrl ?? t("platform.storefrontPrivateOrUnpublished")} onCopy={tenant.site.storefrontUrl ? () => void copyWithFeedback(tenant.site.storefrontUrl!, t) : undefined} href={tenant.site.storefrontUrl ?? undefined} />
                </div>

                <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={onEdit}><Pencil />{t("platform.edit")}</Button>
                    <Button variant="outline" onClick={onSubscription}><Crown />{t("platform.managePlan")}</Button>
                    <Button variant="outline" onClick={onPreview}><Eye />{t("platform.previewStorefront")}</Button>
                    {tenant.site.storefrontUrl ? <Button variant="outline" onClick={onShare}><Share2 />{t("platform.shareStorefront")}</Button> : null}
                </div>
            </CardContent>
        </Card>
    );
}

function CompanyEditor({ form, onChange, t }: EditorProps) {
    const patch = (values: Partial<PlatformUpdateTenantRequest>) => onChange((current) => current ? ({ ...current, ...values }) : current);
    return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Field label={t("tenant.companyName")}><Input value={form.name} onChange={(e) => patch({ name: e.target.value })} /></Field>
        <Field label={t("tenant.workspaceSlug")}><Input value={form.slug} onChange={(e) => patch({ slug: e.target.value })} /></Field>
        <Field label={t("tenant.legalName")}><Input value={form.legalName ?? ""} onChange={(e) => patch({ legalName: e.target.value || null })} /></Field>
        <Field label={t("tenant.registrationNumber")}><Input value={form.registrationNumber ?? ""} onChange={(e) => patch({ registrationNumber: e.target.value || null })} /></Field>
        <Field label={t("tenant.email")}><Input type="email" value={form.email ?? ""} onChange={(e) => patch({ email: e.target.value || null })} /></Field>
        <Field label={t("tenant.phone")}><Input value={form.phone ?? ""} onChange={(e) => patch({ phone: e.target.value || null })} /></Field>
        <Field label={t("tenant.logoUrl")}><Input value={form.logoUrl ?? ""} onChange={(e) => patch({ logoUrl: e.target.value || null })} /></Field>
        <Field label={t("tenant.faviconUrl")}><Input value={form.faviconUrl ?? ""} onChange={(e) => patch({ faviconUrl: e.target.value || null })} /></Field>
        <div className="sm:col-span-2 xl:col-span-3"><Field label={t("tenant.address")}><Textarea value={form.address ?? ""} onChange={(e) => patch({ address: e.target.value || null })} /></Field></div>
    </div>;
}

function SiteEditor({ tenant, form, onChange, onPreview, onRotate, t }: EditorProps & { tenant: TenantProfile; onPreview: () => void; onRotate: () => void }) {
    const patch = (values: Partial<PlatformUpdateTenantRequest>) => onChange((current) => current ? ({ ...current, ...values }) : current);
    return (
        <div className="space-y-5">
            <div className="grid gap-4 xl:grid-cols-2">
                <div className="rounded-xl border bg-primary/5 p-4">
                    <p className="font-semibold">{t("platform.storefrontConnection")}</p>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{t("platform.singleHostAccessHelp")}</p>
                    <dl className="mt-4 grid gap-3 text-sm">
                        <div><dt className="text-muted-foreground">{t("platform.workspaceCode")}</dt><dd className="mt-1 font-mono">{tenant.site.workspaceCode}</dd></div>
                        <div><dt className="text-muted-foreground">{t("platform.storefrontKey")}</dt><dd className="mt-1 break-all font-mono text-xs" dir="ltr">{tenant.site.storefrontKey}</dd></div>
                    </dl>
                </div>
                <div className="rounded-xl border p-4">
                    <p className="font-semibold">{t("platform.generatedLinks")}</p>
                    <div className="mt-3 space-y-3">
                        <LinkRow label={t("platform.adminLink")} value={tenant.site.adminUrl} onCopy={() => void copyWithFeedback(tenant.site.adminUrl, t)} href={tenant.site.adminUrl} />
                        <LinkRow label={t("platform.storefrontLink")} value={tenant.site.storefrontUrl ?? t("platform.storefrontPrivateOrUnpublished")} onCopy={tenant.site.storefrontUrl ? () => void copyWithFeedback(tenant.site.storefrontUrl!, t) : undefined} onShare={tenant.site.storefrontUrl ? () => void shareStorefront(tenant.name, tenant.site.storefrontUrl!, t) : undefined} href={tenant.site.storefrontUrl ?? undefined} />
                    </div>
                </div>
            </div>

            <div className="grid gap-4 rounded-xl border p-4 sm:grid-cols-2 xl:grid-cols-3">
                <Field label={t("platform.storefrontAccess")}>
                    <SimpleCombobox<StorefrontAccessMode>
                        value={form.storefrontAccessMode}
                        onValueChange={(value) => value && patch({ storefrontAccessMode: value })}
                        options={[
                            { value: "Public", label: t("platform.access.public"), description: t("platform.access.publicHelp") },
                            { value: "Private", label: t("platform.access.private"), description: t("platform.access.privateHelp") },
                        ]}
                    />
                </Field>
                <div className="flex items-center justify-between rounded-xl border p-4">
                    <div><Label>{t("platform.publishStorefront")}</Label><p className="mt-1 text-xs text-muted-foreground">{t("platform.publishStorefrontHelp")}</p></div>
                    <Switch checked={form.isStorefrontPublished} onCheckedChange={(value) => patch({ isStorefrontPublished: value })} />
                </div>

            </div>

            <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={onPreview}><Eye />{t("platform.generatePreview")}</Button>
                <Button variant="outline" onClick={onRotate}><KeyRound />{t("platform.rotateStorefrontKey")}</Button>
            </div>
            <p className="text-xs leading-5 text-muted-foreground">{t("platform.rotateStorefrontKeyHelp")}</p>
        </div>
    );
}

function SettingsEditor({ form, onChange, t }: EditorProps) {
    const patch = (values: Partial<PlatformUpdateTenantRequest["settings"]>) => onChange((current) => current ? ({ ...current, settings: { ...current.settings, ...values } }) : current);
    const settings = form.settings;
    return <div className="space-y-6">
        <section className="grid gap-4 rounded-xl border p-4 sm:grid-cols-2 xl:grid-cols-4">
            <Field label={t("tenant.mainCurrency")}><SimpleCombobox value={settings.mainCurrencyCode} onValueChange={(value) => value && patch({ mainCurrencyCode: value })} options={currencies.map((value) => ({ value, label: value }))} /></Field>
            <Field label={t("tenant.currencySymbol")}><Input value={settings.currencySymbol} onChange={(e) => patch({ currencySymbol: e.target.value })} /></Field>
            <Field label={t("tenant.decimalPlaces")}><Input type="number" min={0} max={4} value={settings.currencyDecimalPlaces} onChange={(e) => patch({ currencyDecimalPlaces: Number(e.target.value) })} /></Field>
            <Field label={t("tenant.baseFontSize")}><Input type="number" min={12} max={22} value={settings.baseFontSize} onChange={(e) => patch({ baseFontSize: Number(e.target.value) })} /></Field>
            <Field label={t("tenant.trashRetention")}><Input type="number" min={1} max={3650} value={settings.trashRetentionDays} onChange={(e) => patch({ trashRetentionDays: Number(e.target.value) })} /></Field>
            <Field label={t("notifications.retentionDays")}><Input type="number" min={1} max={365} value={settings.notificationRetentionDays} onChange={(e) => patch({ notificationRetentionDays: Number(e.target.value) })} /></Field>
        </section>
        <section className="grid gap-4 rounded-xl border p-4 sm:grid-cols-2 xl:grid-cols-3">
            <FontField label={t("tenant.englishFont")} value={settings.englishFontFamily} options={tenantFontOptions.en} onChange={(value) => patch({ englishFontFamily: value })} />
            <FontField label={t("tenant.dariFont")} value={settings.dariFontFamily} options={tenantFontOptions.dr} onChange={(value) => patch({ dariFontFamily: value })} />
            <FontField label={t("tenant.pashtoFont")} value={settings.pashtoFontFamily} options={tenantFontOptions.ps} onChange={(value) => patch({ pashtoFontFamily: value })} />
        </section>
        <section className="grid gap-4 rounded-xl border p-4 sm:grid-cols-2 xl:grid-cols-4">
            <ColorField label={t("tenant.adminPrimary")} value={settings.adminPrimaryColor} onChange={(value) => patch({ adminPrimaryColor: value })} />
            <ColorField label={t("tenant.adminSecondary")} value={settings.adminSecondaryColor} onChange={(value) => patch({ adminSecondaryColor: value })} />
            <ColorField label={t("tenant.storePrimary")} value={settings.storefrontPrimaryColor} onChange={(value) => patch({ storefrontPrimaryColor: value })} />
            <ColorField label={t("tenant.storeSecondary")} value={settings.storefrontSecondaryColor} onChange={(value) => patch({ storefrontSecondaryColor: value })} />
        </section>
        <div className="flex items-center justify-between rounded-xl border p-4"><div><Label>{t("tenant.claimManagement")}</Label><p className="mt-1 text-xs text-muted-foreground">{t("tenant.claimManagementHelp")}</p></div><Switch checked={settings.allowTenantUserClaimManagement} onCheckedChange={(value) => patch({ allowTenantUserClaimManagement: value })} /></div>
    </div>;
}

type EditorProps = { form: PlatformUpdateTenantRequest; onChange: React.Dispatch<React.SetStateAction<PlatformUpdateTenantRequest | null>>; t: ReturnType<typeof useI18n>["t"] };
function PlanCombobox({ plans, value, onChange, t }: { plans: SubscriptionPlan[]; value: number | null; onChange: (value: number | null) => void; t: ReturnType<typeof useI18n>["t"] }) { return <SimpleCombobox value={value} onValueChange={onChange} options={plans.map((plan) => ({ value: plan.id, label: plan.name, description: `${plan.currencyCode} ${plan.monthlyPrice} · ${plan.maxUsers} ${t("platform.usersShort")}` }))} />; }
function LimitField({ icon, label, value, onChange }: { icon: ReactNode; label: string; value: number | null; onChange: (value: number | null) => void }) { return <Field label={label}><div className="relative"><span className="absolute start-3 top-2.5 text-muted-foreground">{icon}</span><Input className="ps-10" type="number" min={1} value={value ?? ""} onChange={(e) => onChange(numberOrNull(e.target.value))} /></div></Field>; }
function FontField({ label, value, options, onChange }: { label: string; value: string; options: readonly { value: string; label: string; description?: string }[]; onChange: (value: string) => void }) { return <Field label={label}><SimpleCombobox value={value} onValueChange={(next) => next && onChange(next)} options={[...options]} /></Field>; }
function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <Field label={label}><div className="flex gap-2"><Input type="color" className="w-14 p-1" value={value} onChange={(e) => onChange(e.target.value)} /><Input value={value} onChange={(e) => onChange(e.target.value)} /></div></Field>; }
function Field({ label, children }: { label: string; children: ReactNode }) { return <div className="min-w-0 space-y-2"><Label>{label}</Label>{children}</div>; }
function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: number }) { return <div className="rounded-xl border p-3"><span className="flex items-center gap-2 text-xs text-muted-foreground">{icon}{label}</span><p className="mt-2 text-lg font-bold">{value.toLocaleString()}</p></div>; }
function LinkRow({ label, value, onCopy, onShare, href }: { label: string; value: string; onCopy?: () => void; onShare?: () => void; href?: string }) { return <div className="min-w-0"><p className="text-xs font-semibold text-muted-foreground">{label}</p><div className="mt-1 flex min-w-0 items-center gap-1"><code className="min-w-0 flex-1 truncate text-xs" dir="ltr">{value}</code>{onCopy ? <Button type="button" variant="ghost" size="icon" onClick={onCopy}><Copy className="size-4" /></Button> : null}{onShare ? <Button type="button" variant="ghost" size="icon" onClick={onShare}><Share2 className="size-4" /></Button> : null}{href ? <Button type="button" variant="ghost" size="icon" render={<a href={href} target="_blank" rel="noreferrer" />}><ExternalLink className="size-4" /></Button> : null}</div></div>; }
function emptyCreateTenant(): CreateTenantRequest {
    return {
        name: "", slug: "", adminFullName: "", adminEmail: "", adminPassword: "",
        subscriptionPlanId: null, plan: null, mainCurrencyCode: "USD",
        siteRoutingMode: "PlatformPath", storefrontAccessMode: "Public", isStorefrontPublished: true,
        customDomain: null, storefrontBaseUrlOverride: null,
        maxUsers: null, maxBranches: null, maxProducts: null,
        maxOrdersPerMonth: null, maxStorageMb: null, monthlyPrice: null,
    };
}
function emptySubscription(): UpdateTenantSubscriptionRequest { return { subscriptionPlanId: null, plan: null, status: "Active", endsAt: null, maxUsers: null, maxBranches: null, maxProducts: null, maxOrdersPerMonth: null, maxStorageMb: null, monthlyPrice: null, billingCurrencyCode: "USD", notes: null }; }
async function copyText(value: string) {
    if (navigator.clipboard?.writeText) {
        try {
            await navigator.clipboard.writeText(value);
            return true;
        } catch {
            // LAN HTTP fallback below.
        }
    }
    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand("copy");
    textarea.remove();
    return copied;
}

async function copyWithFeedback(value: string, t: ReturnType<typeof useI18n>["t"]) {
    const copied = await copyText(value);
    copied ? toast.success(t("platform.linkCopied")) : toast.error(t("platform.linkCopyFailed"));
}

async function shareStorefront(name: string, url: string, t: ReturnType<typeof useI18n>["t"]) {
    if (navigator.share) {
        try {
            await navigator.share({ title: name, text: t("platform.shareStorefrontText"), url });
            return;
        } catch (error) {
            if ((error as DOMException)?.name === "AbortError") return;
        }
    }
    await copyWithFeedback(url, t);
}
function numberOrNull(value: string) { const parsed = Number(value); return value === "" || !Number.isFinite(parsed) ? null : parsed; }
function subscriptionStatusLabel(status: SubscriptionStatus, t: ReturnType<typeof useI18n>["t"]) {
    return t(`subscription.status.${status}` as never);
}
function message(error: unknown, fallback: string) { return error instanceof Error ? error.message : fallback; }
