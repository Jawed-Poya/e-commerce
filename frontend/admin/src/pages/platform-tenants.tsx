import { useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    Building2,
    Crown,
    LoaderCircle,
    Package,
    Palette,
    Pencil,
    Plus,
    Save,
    ShieldCheck,
    Users,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { SimpleCombobox } from "@/components/simple-combobox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { resolveTenantFontStack, tenantFontOptions, type TenantLanguage } from "@/features/tenancy/tenant-fonts";
import { permissionGroupsForPlan } from "@/features/tenancy/tenant-permissions";
import { tenantService } from "@/features/tenancy/tenant-service";
import type {
    PlatformUpdateTenantRequest,
    SubscriptionStatus,
    TenantPlan,
    TenantProfile,
} from "@/features/tenancy/tenant-types";
import { PermissionChecklist } from "@/features/users/components/permission-checklist";
import { userService } from "@/features/users/user-service";
import { useI18n } from "@/i18n/i18n-provider";

const plans: TenantPlan[] = ["Free", "Premium", "Full", "Enterprise"];
const statuses: SubscriptionStatus[] = [
    "Trial",
    "Active",
    "PastDue",
    "Suspended",
    "Cancelled",
    "Expired",
];
const currencyCodes = ["AFN", "USD", "EUR", "GBP", "PKR", "INR"];
type EditTab = "company" | "settings" | "permissions";
type Translator = ReturnType<typeof useI18n>["t"];

export default function PlatformTenantsPage() {
    const client = useQueryClient();
    const { t, language } = useI18n();
    const query = useQuery({
        queryKey: ["platform-tenants"],
        queryFn: tenantService.platformTenants,
    });
    const permissionsQuery = useQuery({
        queryKey: ["platform", "permission-groups"],
        queryFn: userService.getPermissions,
        staleTime: 10 * 60_000,
    });
    const [open, setOpen] = useState(false);
    const [subscriptionTenant, setSubscriptionTenant] =
        useState<TenantProfile | null>(null);
    const [editTenant, setEditTenant] = useState<TenantProfile | null>(null);
    const [editForm, setEditForm] =
        useState<PlatformUpdateTenantRequest | null>(null);
    const [editTab, setEditTab] = useState<EditTab>("company");
    const [form, setForm] = useState({
        name: "",
        slug: "",
        adminFullName: "",
        adminEmail: "",
        adminPassword: "",
        plan: "Free" as TenantPlan,
        mainCurrencyCode: "USD",
    });
    const administratorEmailIsValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        form.adminEmail.trim(),
    );
    const [subscription, setSubscription] = useState({
        plan: "Free" as TenantPlan,
        status: "Active" as SubscriptionStatus,
        endsAt: "",
    });

    const refresh = () =>
        client.invalidateQueries({ queryKey: ["platform-tenants"] });
    const create = useMutation({
        mutationFn: () => tenantService.createTenant(form),
        onSuccess: async () => {
            toast.success(t("platform.created"));
            setOpen(false);
            setForm({
                name: "",
                slug: "",
                adminFullName: "",
                adminEmail: "",
                adminPassword: "",
                plan: "Free",
                mainCurrencyCode: "USD",
            });
            await refresh();
        },
        onError: (error) =>
            toast.error(message(error, t("tenant.operationFailed"))),
    });
    const updateSubscription = useMutation({
        mutationFn: () =>
            tenantService.updateSubscription(subscriptionTenant!.id, {
                ...subscription,
                endsAt: subscription.endsAt || null,
            }),
        onSuccess: async () => {
            toast.success(t("platform.subscriptionUpdated"));
            setSubscriptionTenant(null);
            await refresh();
        },
        onError: (error) =>
            toast.error(message(error, t("tenant.operationFailed"))),
    });
    const updateTenant = useMutation({
        mutationFn: () => tenantService.updateTenant(editTenant!.id, editForm!),
        onSuccess: async () => {
            toast.success(t("platform.companyUpdated"));
            setEditTenant(null);
            setEditForm(null);
            await refresh();
        },
        onError: (error) =>
            toast.error(message(error, t("tenant.operationFailed"))),
    });

    const editSubscription = (tenant: TenantProfile) => {
        setSubscriptionTenant(tenant);
        setSubscription({
            plan: tenant.subscription?.plan ?? "Free",
            status: tenant.subscription?.status ?? "Active",
            endsAt: tenant.subscription?.endsAt?.slice(0, 10) ?? "",
        });
    };

    const editCompany = (tenant: TenantProfile) => {
        setEditTenant(tenant);
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
            settings: { ...tenant.settings },
            enabledPermissions: [...tenant.enabledPermissions],
        });
    };

    const permissionGroups = useMemo(
        () =>
            permissionGroupsForPlan(
                permissionsQuery.data ?? [],
                editTenant?.subscription?.plan ?? "Free",
            ),
        [editTenant?.subscription?.plan, permissionsQuery.data],
    );
    const locale =
        language === "en" ? "en-US" : language === "ps" ? "ps-AF" : "fa-AF";

    return (
        <div className="space-y-6">
            <PageHeader
                title={t("platform.title")}
                description={t("platform.description")}
                actions={
                    <Button onClick={() => setOpen(true)}>
                        <Plus />
                        {t("platform.newTenant")}
                    </Button>
                }
            />

            {query.isLoading ? (
                <div className="grid min-h-64 place-items-center">
                    <LoaderCircle className="animate-spin" />
                </div>
            ) : query.data?.length ? (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {query.data.map((item) => (
                        <Card key={item.id} className="overflow-hidden">
                            <CardContent className="p-5">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex min-w-0 items-center gap-3">
                                        <span className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-xl bg-primary/10 text-primary">
                                            {item.logoUrl ? (
                                                <img
                                                    src={item.logoUrl}
                                                    alt=""
                                                    className="size-full object-cover"
                                                />
                                            ) : (
                                                <Building2 />
                                            )}
                                        </span>
                                        <div className="min-w-0">
                                            <h2 className="truncate font-bold">
                                                {item.name}
                                            </h2>
                                            <p className="truncate text-xs text-muted-foreground">
                                                {item.slug}
                                            </p>
                                        </div>
                                    </div>
                                    <Badge>
                                        {item.subscription?.plan ??
                                            t("platform.noPlan")}
                                    </Badge>
                                </div>
                                <div className="mt-5 grid grid-cols-3 gap-2 text-center">
                                    <Limit
                                        icon={<Building2 />}
                                        label={t("tenant.branches")}
                                        value={`${item.branches.length.toLocaleString(locale)}/${(
                                            item.subscription?.maxBranches ?? 0
                                        ).toLocaleString(locale)}`}
                                    />
                                    <Limit
                                        icon={<Users />}
                                        label={t("tenant.usersLimit")}
                                        value={(
                                            item.subscription?.maxUsers ?? 0
                                        ).toLocaleString(locale)}
                                    />
                                    <Limit
                                        icon={<Package />}
                                        label={t("tenant.productsLimit")}
                                        value={(
                                            item.subscription?.maxProducts ?? 0
                                        ).toLocaleString(locale)}
                                    />
                                </div>
                                <div className="mt-5 grid gap-2 border-t pt-4 sm:grid-cols-2">
                                    <Button
                                        variant="outline"
                                        onClick={() => editCompany(item)}
                                    >
                                        <Pencil />
                                        {t("platform.editCompany")}
                                    </Button>
                                    <Button
                                        variant="outline"
                                        onClick={() => editSubscription(item)}
                                    >
                                        <Crown />
                                        {t("platform.managePlan")}
                                    </Button>
                                </div>
                                <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                                    <span>{t("tenant.enabledCapabilities")}</span>
                                    <strong className="text-foreground">
                                        {item.enabledPermissions.length.toLocaleString(
                                            locale,
                                        )}
                                    </strong>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            ) : (
                <Card>
                    <CardContent className="grid min-h-52 place-items-center text-center">
                        <div>
                            <Building2 className="mx-auto size-10 text-muted-foreground" />
                            <h2 className="mt-4 font-semibold">
                                {t("platform.empty")}
                            </h2>
                            <p className="mt-1 text-sm text-muted-foreground">
                                {t("platform.emptyHelp")}
                            </p>
                        </div>
                    </CardContent>
                </Card>
            )}

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>{t("platform.createTitle")}</DialogTitle>
                        <DialogDescription>
                            {t("platform.createDescription")}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Field label={t("tenant.companyName")}>
                            <Input
                                value={form.name}
                                onChange={(event) =>
                                    setForm((current) => ({
                                        ...current,
                                        name: event.target.value,
                                    }))
                                }
                            />
                        </Field>
                        <Field label={t("tenant.workspaceSlug")}>
                            <Input
                                value={form.slug}
                                onChange={(event) =>
                                    setForm((current) => ({
                                        ...current,
                                        slug: normalizeSlug(event.target.value),
                                    }))
                                }
                            />
                        </Field>
                        <Field label={t("platform.adminName")}>
                            <Input
                                value={form.adminFullName}
                                onChange={(event) =>
                                    setForm((current) => ({
                                        ...current,
                                        adminFullName: event.target.value,
                                    }))
                                }
                            />
                        </Field>
                        <Field label={t("platform.adminEmail")}>
                            <Input
                                type="email"
                                inputMode="email"
                                autoComplete="email"
                                aria-invalid={
                                    Boolean(form.adminEmail) &&
                                    !administratorEmailIsValid
                                }
                                value={form.adminEmail}
                                onChange={(event) =>
                                    setForm((current) => ({
                                        ...current,
                                        adminEmail: event.target.value,
                                    }))
                                }
                            />
                            {form.adminEmail && !administratorEmailIsValid ? (
                                <p className="mt-1 text-xs text-destructive">
                                    {t("platform.adminEmailInvalid")}
                                </p>
                            ) : null}
                        </Field>
                        <Field label={t("platform.adminPassword")}>
                            <Input
                                type="password"
                                value={form.adminPassword}
                                onChange={(event) =>
                                    setForm((current) => ({
                                        ...current,
                                        adminPassword: event.target.value,
                                    }))
                                }
                            />
                        </Field>
                        <Field label={t("platform.plan")}>
                            <SimpleCombobox
                                value={form.plan}
                                onValueChange={(value) =>
                                    value &&
                                    setForm((current) => ({
                                        ...current,
                                        plan: value as TenantPlan,
                                    }))
                                }
                                options={plans.map((value) => ({
                                    value,
                                    label: value,
                                }))}
                            />
                        </Field>
                        <Field label={t("platform.currency")}>
                            <SimpleCombobox
                                value={form.mainCurrencyCode}
                                onValueChange={(value) =>
                                    value &&
                                    setForm((current) => ({
                                        ...current,
                                        mainCurrencyCode: value,
                                    }))
                                }
                                options={currencyCodes.map((value) => ({
                                    value,
                                    label: value,
                                }))}
                            />
                        </Field>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setOpen(false)}>
                            {t("tenant.cancel")}
                        </Button>
                        <Button
                            onClick={() => create.mutate()}
                            disabled={
                                create.isPending ||
                                !form.name.trim() ||
                                !form.slug.trim() ||
                                !form.adminFullName.trim() ||
                                !administratorEmailIsValid ||
                                form.adminPassword.length < 6
                            }
                        >
                            {create.isPending && (
                                <LoaderCircle className="animate-spin" />
                            )}
                            {t("platform.create")}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog
                open={Boolean(editTenant && editForm)}
                onOpenChange={(value) => {
                    if (!value) {
                        setEditTenant(null);
                        setEditForm(null);
                    }
                }}
            >
                <DialogContent className="flex max-h-[94vh] flex-col overflow-hidden p-0 sm:max-w-5xl">
                    <DialogHeader className="border-b px-6 py-5">
                        <DialogTitle>{t("platform.editTitle")}</DialogTitle>
                        <DialogDescription>
                            {t("platform.editDescription")}
                        </DialogDescription>
                    </DialogHeader>
                    {editTenant && editForm ? (
                        <div className="flex min-h-0 flex-1 flex-col">
                            <div className="flex gap-2 overflow-x-auto border-b px-6 py-3">
                                <EditTabButton
                                    active={editTab === "company"}
                                    onClick={() => setEditTab("company")}
                                    icon={<Building2 />}
                                >
                                    {t("platform.companyTab")}
                                </EditTabButton>
                                <EditTabButton
                                    active={editTab === "settings"}
                                    onClick={() => setEditTab("settings")}
                                    icon={<Palette />}
                                >
                                    {t("platform.settingsTab")}
                                </EditTabButton>
                                <EditTabButton
                                    active={editTab === "permissions"}
                                    onClick={() => setEditTab("permissions")}
                                    icon={<ShieldCheck />}
                                >
                                    {t("platform.permissionsTab")}
                                </EditTabButton>
                            </div>
                            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
                                {editTab === "company" ? (
                                    <CompanyEditor
                                        form={editForm}
                                        onChange={setEditForm}
                                        t={t}
                                    />
                                ) : editTab === "settings" ? (
                                    <SettingsEditor
                                        form={editForm}
                                        onChange={setEditForm}
                                        t={t}
                                    />
                                ) : permissionsQuery.isLoading ? (
                                    <div className="grid min-h-64 place-items-center">
                                        <LoaderCircle className="animate-spin" />
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        <div className="rounded-xl border bg-muted/30 p-4 text-sm text-muted-foreground">
                                            {t("platform.permissionsHelp")}
                                            <strong className="ms-1 text-foreground">
                                                {editTenant.subscription?.plan ?? "Free"}
                                            </strong>
                                        </div>
                                        <PermissionChecklist
                                            groups={permissionGroups}
                                            selected={editForm.enabledPermissions}
                                            onChange={(enabledPermissions) =>
                                                setEditForm((current) =>
                                                    current
                                                        ? {
                                                              ...current,
                                                              enabledPermissions,
                                                          }
                                                        : current,
                                                )
                                            }
                                        />
                                    </div>
                                )}
                            </div>
                            <DialogFooter className="border-t px-6 py-4">
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        setEditTenant(null);
                                        setEditForm(null);
                                    }}
                                >
                                    {t("tenant.cancel")}
                                </Button>
                                <Button
                                    onClick={() => updateTenant.mutate()}
                                    disabled={
                                        updateTenant.isPending ||
                                        !editForm.name.trim() ||
                                        !editForm.slug.trim()
                                    }
                                >
                                    {updateTenant.isPending ? (
                                        <LoaderCircle className="animate-spin" />
                                    ) : (
                                        <Save />
                                    )}
                                    {t("platform.saveCompany")}
                                </Button>
                            </DialogFooter>
                        </div>
                    ) : null}
                </DialogContent>
            </Dialog>

            <Dialog
                open={Boolean(subscriptionTenant)}
                onOpenChange={(value) => !value && setSubscriptionTenant(null)}
            >
                <DialogContent className="max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{t("platform.manageSubscription")}</DialogTitle>
                        <DialogDescription>
                            {t("platform.subscriptionHelp")}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4">
                        <Field label={t("platform.plan")}>
                            <SimpleCombobox
                                value={subscription.plan}
                                onValueChange={(value) =>
                                    value &&
                                    setSubscription((current) => ({
                                        ...current,
                                        plan: value as TenantPlan,
                                    }))
                                }
                                options={plans.map((value) => ({
                                    value,
                                    label: value,
                                }))}
                            />
                        </Field>
                        <Field label={t("tenant.status")}>
                            <SimpleCombobox
                                value={subscription.status}
                                onValueChange={(value) =>
                                    value &&
                                    setSubscription((current) => ({
                                        ...current,
                                        status: value as SubscriptionStatus,
                                    }))
                                }
                                options={statuses.map((value) => ({
                                    value,
                                    label: value,
                                }))}
                            />
                        </Field>
                        <Field label={t("platform.endsAt")}>
                            <Input
                                type="date"
                                value={subscription.endsAt}
                                onChange={(event) =>
                                    setSubscription((current) => ({
                                        ...current,
                                        endsAt: event.target.value,
                                    }))
                                }
                            />
                        </Field>
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setSubscriptionTenant(null)}
                        >
                            {t("tenant.cancel")}
                        </Button>
                        <Button
                            onClick={() => updateSubscription.mutate()}
                            disabled={updateSubscription.isPending}
                        >
                            {updateSubscription.isPending && (
                                <LoaderCircle className="animate-spin" />
                            )}
                            {t("platform.updateSubscription")}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

function CompanyEditor({
    form,
    onChange,
    t,
}: {
    form: PlatformUpdateTenantRequest;
    onChange: Dispatch<SetStateAction<PlatformUpdateTenantRequest | null>>;
    t: Translator;
}) {
    const patch = (values: Partial<PlatformUpdateTenantRequest>) =>
        onChange((current) => (current ? { ...current, ...values } : current));
    return (
        <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("tenant.companyName")}>
                <Input value={form.name} onChange={(event) => patch({ name: event.target.value })} />
            </Field>
            <Field label={t("tenant.workspaceSlug")}>
                <Input value={form.slug} onChange={(event) => patch({ slug: normalizeSlug(event.target.value) })} />
            </Field>
            <Field label={t("tenant.legalName")}>
                <Input value={form.legalName ?? ""} onChange={(event) => patch({ legalName: event.target.value || null })} />
            </Field>
            <Field label={t("tenant.registrationNumber")}>
                <Input value={form.registrationNumber ?? ""} onChange={(event) => patch({ registrationNumber: event.target.value || null })} />
            </Field>
            <Field label={t("tenant.email")}>
                <Input type="email" value={form.email ?? ""} onChange={(event) => patch({ email: event.target.value || null })} />
            </Field>
            <Field label={t("tenant.phone")}>
                <Input value={form.phone ?? ""} onChange={(event) => patch({ phone: event.target.value || null })} />
            </Field>
            <Field label={t("tenant.logoUrl")}>
                <Input value={form.logoUrl ?? ""} onChange={(event) => patch({ logoUrl: event.target.value || null })} />
            </Field>
            <Field label={t("tenant.faviconUrl")}>
                <Input value={form.faviconUrl ?? ""} onChange={(event) => patch({ faviconUrl: event.target.value || null })} />
            </Field>
            <div className="sm:col-span-2">
                <Field label={t("tenant.address")}>
                    <Textarea value={form.address ?? ""} onChange={(event) => patch({ address: event.target.value || null })} />
                </Field>
            </div>
        </div>
    );
}

function SettingsEditor({
    form,
    onChange,
    t,
}: {
    form: PlatformUpdateTenantRequest;
    onChange: Dispatch<SetStateAction<PlatformUpdateTenantRequest | null>>;
    t: Translator;
}) {
    const patch = (values: Partial<PlatformUpdateTenantRequest["settings"]>) =>
        onChange((current) =>
            current
                ? { ...current, settings: { ...current.settings, ...values } }
                : current,
        );
    const settings = form.settings;
    return (
        <div className="space-y-6">
            <section className="grid gap-4 rounded-xl border p-4 sm:grid-cols-2 lg:grid-cols-4">
                <Field label={t("tenant.mainCurrency")}>
                    <SimpleCombobox
                        value={settings.mainCurrencyCode}
                        onValueChange={(value) => value && patch({ mainCurrencyCode: value })}
                        options={currencyCodes.map((value) => ({ value, label: value }))}
                    />
                </Field>
                <Field label={t("tenant.currencySymbol")}>
                    <Input value={settings.currencySymbol} onChange={(event) => patch({ currencySymbol: event.target.value })} />
                </Field>
                <Field label={t("tenant.symbolPosition")}>
                    <SimpleCombobox
                        value={settings.currencyPosition}
                        onValueChange={(value) => value && patch({ currencyPosition: value as "before" | "after" })}
                        options={[
                            { value: "before", label: t("tenant.beforeAmount") },
                            { value: "after", label: t("tenant.afterAmount") },
                        ]}
                    />
                </Field>
                <Field label={t("tenant.decimalPlaces")}>
                    <Input type="number" min={0} max={4} value={settings.currencyDecimalPlaces} onChange={(event) => patch({ currencyDecimalPlaces: Number(event.target.value) })} />
                </Field>
            </section>
            <section className="grid gap-4 rounded-xl border p-4 sm:grid-cols-2 lg:grid-cols-4">
                <ColorField label={t("tenant.adminPrimary")} value={settings.adminPrimaryColor} onChange={(value) => patch({ adminPrimaryColor: value })} />
                <ColorField label={t("tenant.adminSecondary")} value={settings.adminSecondaryColor} onChange={(value) => patch({ adminSecondaryColor: value })} />
                <ColorField label={t("tenant.storePrimary")} value={settings.storefrontPrimaryColor} onChange={(value) => patch({ storefrontPrimaryColor: value })} />
                <ColorField label={t("tenant.storeSecondary")} value={settings.storefrontSecondaryColor} onChange={(value) => patch({ storefrontSecondaryColor: value })} />
            </section>
            <section className="grid gap-4 rounded-xl border p-4 sm:grid-cols-2 lg:grid-cols-3">
                <FontField language="en" label={t("tenant.englishFont")} value={settings.englishFontFamily} options={tenantFontOptions.en} onChange={(value) => patch({ englishFontFamily: value })} />
                <FontField language="dr" label={t("tenant.dariFont")} value={settings.dariFontFamily} options={tenantFontOptions.dr} onChange={(value) => patch({ dariFontFamily: value })} />
                <FontField language="ps" label={t("tenant.pashtoFont")} value={settings.pashtoFontFamily} options={tenantFontOptions.ps} onChange={(value) => patch({ pashtoFontFamily: value })} />
                <Field label={t("tenant.baseFontSize")}>
                    <Input type="number" min={12} max={22} value={settings.baseFontSize} onChange={(event) => patch({ baseFontSize: Number(event.target.value) })} />
                </Field>
                <Field label={t("tenant.trashRetention")}>
                    <Input type="number" min={1} max={3650} value={settings.trashRetentionDays} onChange={(event) => patch({ trashRetentionDays: Number(event.target.value) })} />
                </Field>
                <div className="flex items-center justify-between gap-4 rounded-xl border p-4 sm:col-span-2 lg:col-span-1">
                    <div>
                        <Label>{t("tenant.claimManagement")}</Label>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">
                            {t("tenant.claimManagementHelp")}
                        </p>
                    </div>
                    <Switch checked={settings.allowTenantUserClaimManagement} onCheckedChange={(checked) => patch({ allowTenantUserClaimManagement: checked })} />
                </div>
            </section>
        </div>
    );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="space-y-2">
            <Label>{label}</Label>
            {children}
        </div>
    );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
    return (
        <Field label={label}>
            <div className="flex gap-2">
                <Input type="color" className="w-14 p-1" value={value} onChange={(event) => onChange(event.target.value)} />
                <Input value={value} onChange={(event) => onChange(event.target.value)} />
            </div>
        </Field>
    );
}

function FontField({ language, label, value, options, onChange }: { language: TenantLanguage; label: string; value: string; options: { value: string; label: string }[]; onChange: (value: string) => void }) {
    const preview = language === "en"
        ? "The quick brown fox · English preview"
        : language === "dr"
          ? "نمونهٔ زندهٔ فونت دری برای فروشگاه و مدیریت"
          : "د پښتو لیکدود ژوندۍ بېلګه د پلورنځي او مدیریت لپاره";
    return (
        <Field label={label}>
            <div className="space-y-2">
                <SimpleCombobox value={value} onValueChange={(next) => next && onChange(next)} options={options} />
                <p
                    dir={language === "en" ? "ltr" : "rtl"}
                    lang={language === "en" ? "en" : language === "dr" ? "fa-AF" : "ps"}
                    className="rounded-lg border bg-muted/30 px-3 py-2 text-sm"
                    style={{ fontFamily: resolveTenantFontStack(language, value) }}
                >
                    {preview}
                </p>
            </div>
        </Field>
    );
}

function EditTabButton({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: ReactNode; children: ReactNode }) {
    return (
        <Button type="button" variant={active ? "default" : "ghost"} onClick={onClick} className="shrink-0">
            {icon}
            {children}
        </Button>
    );
}

function Limit({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
    return (
        <div className="min-w-0 rounded-xl bg-muted/50 p-3">
            <div className="mx-auto flex size-7 items-center justify-center text-primary [&>svg]:size-4">
                {icon}
            </div>
            <p className="mt-1 truncate text-[10px] uppercase text-muted-foreground">
                {label}
            </p>
            <p className="mt-1 break-words font-bold">{value}</p>
        </div>
    );
}

function normalizeSlug(value: string) {
    return value.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-");
}

function message(error: unknown, fallback: string) {
    return (
        (error as { response?: { data?: { message?: string } } })?.response?.data
            ?.message || (error instanceof Error ? error.message : fallback)
    );
}
