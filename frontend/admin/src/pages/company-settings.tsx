import { useEffect, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    Building2,
    CheckCircle2,
    Crown,
    GitBranch,
    Info,
    LoaderCircle,
    Palette,
    Pencil,
    Plus,
    Save,
    WalletCards,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { SimpleCombobox } from "@/components/simple-combobox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { tenantService } from "@/features/tenancy/tenant-service";
import type { Branch, TenantSettings } from "@/features/tenancy/tenant-types";
import { useTenant } from "@/features/tenancy/tenant-context";
import { useI18n } from "@/i18n/i18n-provider";

const currencies = [
    ["AFN", "Afghan Afghani", "؋"],
    ["USD", "US Dollar", "$"],
    ["EUR", "Euro", "€"],
    ["GBP", "British Pound", "£"],
    ["PKR", "Pakistani Rupee", "₨"],
    ["INR", "Indian Rupee", "₹"],
] as const;

const fonts = [
    "Inter",
    "Manrope",
    "Poppins",
    "Vazirmatn",
    "Noto Sans Arabic",
    "Tahoma",
    "Arial",
];

type Tab = "profile" | "branches" | "appearance" | "subscription";

const blankBranch: Omit<Branch, "id"> = {
    name: "",
    code: "",
    phone: null,
    address: null,
    isMain: false,
    isActive: true,
};

export default function CompanySettingsPage() {
    const client = useQueryClient();
    const { formatMoney } = useTenant();
    const { t, language } = useI18n();
    const [tab, setTab] = useState<Tab>("profile");
    const query = useQuery({
        queryKey: ["tenant", "profile"],
        queryFn: tenantService.profile,
    });
    const [profile, setProfile] = useState({
        name: "",
        legalName: "",
        registrationNumber: "",
        email: "",
        phone: "",
        address: "",
        logoUrl: "",
        faviconUrl: "",
    });
    const [settings, setSettings] = useState<TenantSettings | null>(null);
    const [branchOpen, setBranchOpen] = useState(false);
    const [branchId, setBranchId] = useState<number | null>(null);
    const [branch, setBranch] = useState(blankBranch);

    useEffect(() => {
        if (!query.data) return;
        const item = query.data;
        setProfile({
            name: item.name,
            legalName: item.legalName ?? "",
            registrationNumber: item.registrationNumber ?? "",
            email: item.email ?? "",
            phone: item.phone ?? "",
            address: item.address ?? "",
            logoUrl: item.logoUrl ?? "",
            faviconUrl: item.faviconUrl ?? "",
        });
        setSettings(item.settings);
    }, [query.data]);

    const refresh = async () => {
        await Promise.all([
            client.invalidateQueries({ queryKey: ["tenant"] }),
            client.invalidateQueries({ queryKey: ["tenant", "profile"] }),
        ]);
    };

    const saveProfile = useMutation({
        mutationFn: () =>
            tenantService.updateProfile({
                ...profile,
                legalName: profile.legalName || null,
                registrationNumber: profile.registrationNumber || null,
                email: profile.email || null,
                phone: profile.phone || null,
                address: profile.address || null,
                logoUrl: profile.logoUrl || null,
                faviconUrl: profile.faviconUrl || null,
            }),
        onSuccess: async () => {
            toast.success(t("tenant.profileUpdated"));
            await refresh();
        },
        onError: (error) => toast.error(message(error, t("tenant.operationFailed"))),
    });

    const saveSettings = useMutation({
        mutationFn: () => tenantService.updateSettings(settings!),
        onSuccess: async () => {
            toast.success(t("tenant.settingsUpdated"));
            await refresh();
        },
        onError: (error) => toast.error(message(error, t("tenant.operationFailed"))),
    });

    const saveBranch = useMutation({
        mutationFn: () =>
            branchId
                ? tenantService.updateBranch(branchId, branch)
                : tenantService.createBranch(branch),
        onSuccess: async () => {
            toast.success(
                branchId ? t("tenant.branchUpdated") : t("tenant.branchCreated"),
            );
            setBranchOpen(false);
            await refresh();
        },
        onError: (error) => toast.error(message(error, t("tenant.operationFailed"))),
    });

    const openBranch = (item?: Branch) => {
        setBranchId(item?.id ?? null);
        setBranch(
            item
                ? {
                      name: item.name,
                      code: item.code,
                      phone: item.phone,
                      address: item.address,
                      isMain: item.isMain,
                      isActive: item.isActive,
                  }
                : blankBranch,
        );
        setBranchOpen(true);
    };

    if (query.isLoading || !settings) {
        return (
            <div className="grid min-h-64 place-items-center">
                <LoaderCircle className="animate-spin" />
            </div>
        );
    }

    if (!query.data) {
        return (
            <Card>
                <CardContent className="p-8 text-center">
                    {t("tenant.loadError")}
                </CardContent>
            </Card>
        );
    }

    const tenant = query.data;
    const locale = language === "en" ? "en-US" : language === "ps" ? "ps-AF" : "fa-AF";

    return (
        <div className="space-y-6">
            <PageHeader
                title={t("tenant.companyTitle")}
                description={t("tenant.companyDescription")}
            />

            <div className="flex max-w-full gap-2 overflow-x-auto border-b pb-3">
                <TabButton
                    active={tab === "profile"}
                    onClick={() => setTab("profile")}
                    icon={<Building2 />}
                >
                    {t("tenant.profile")}
                </TabButton>
                <TabButton
                    active={tab === "branches"}
                    onClick={() => setTab("branches")}
                    icon={<GitBranch />}
                >
                    {t("tenant.branches")}
                </TabButton>
                <TabButton
                    active={tab === "appearance"}
                    onClick={() => setTab("appearance")}
                    icon={<Palette />}
                >
                    {t("tenant.appearance")}
                </TabButton>
                <TabButton
                    active={tab === "subscription"}
                    onClick={() => setTab("subscription")}
                    icon={<Crown />}
                >
                    {t("tenant.subscription")}
                </TabButton>
            </div>

            {tab === "profile" && (
                <Card>
                    <CardHeader>
                        <CardTitle>{t("tenant.companyProfile")}</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-5 md:grid-cols-2">
                        <Field label={t("tenant.companyName")}>
                            <Input
                                value={profile.name}
                                onChange={(event) =>
                                    setProfile((current) => ({
                                        ...current,
                                        name: event.target.value,
                                    }))
                                }
                            />
                        </Field>
                        <Field label={t("tenant.legalName")}>
                            <Input
                                value={profile.legalName}
                                onChange={(event) =>
                                    setProfile((current) => ({
                                        ...current,
                                        legalName: event.target.value,
                                    }))
                                }
                            />
                        </Field>
                        <Field label={t("tenant.registrationNumber")}>
                            <Input
                                value={profile.registrationNumber}
                                onChange={(event) =>
                                    setProfile((current) => ({
                                        ...current,
                                        registrationNumber: event.target.value,
                                    }))
                                }
                            />
                        </Field>
                        <Field label={t("tenant.workspaceSlug")}>
                            <Input value={tenant.slug} disabled />
                            <p className="text-xs text-muted-foreground">
                                {t("tenant.slugHelp")}
                            </p>
                        </Field>
                        <Field label={t("tenant.email")}>
                            <Input
                                type="email"
                                value={profile.email}
                                onChange={(event) =>
                                    setProfile((current) => ({
                                        ...current,
                                        email: event.target.value,
                                    }))
                                }
                            />
                        </Field>
                        <Field label={t("tenant.phone")}>
                            <Input
                                value={profile.phone}
                                onChange={(event) =>
                                    setProfile((current) => ({
                                        ...current,
                                        phone: event.target.value,
                                    }))
                                }
                            />
                        </Field>
                        <Field label={t("tenant.logoUrl")}>
                            <Input
                                value={profile.logoUrl}
                                onChange={(event) =>
                                    setProfile((current) => ({
                                        ...current,
                                        logoUrl: event.target.value,
                                    }))
                                }
                            />
                        </Field>
                        <Field label={t("tenant.faviconUrl")}>
                            <Input
                                value={profile.faviconUrl}
                                onChange={(event) =>
                                    setProfile((current) => ({
                                        ...current,
                                        faviconUrl: event.target.value,
                                    }))
                                }
                            />
                        </Field>
                        <div className="space-y-2 md:col-span-2">
                            <Label>{t("tenant.address")}</Label>
                            <Textarea
                                rows={3}
                                value={profile.address}
                                onChange={(event) =>
                                    setProfile((current) => ({
                                        ...current,
                                        address: event.target.value,
                                    }))
                                }
                            />
                        </div>
                        <div className="md:col-span-2">
                            <Button
                                onClick={() => saveProfile.mutate()}
                                disabled={saveProfile.isPending || !profile.name.trim()}
                            >
                                <Save />
                                {saveProfile.isPending
                                    ? t("tenant.saving")
                                    : t("tenant.saveProfile")}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {tab === "branches" && (
                <div className="space-y-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h2 className="text-xl font-bold">{t("tenant.branches")}</h2>
                            <p className="text-sm text-muted-foreground">
                                {t("tenant.branchHelp")}
                            </p>
                        </div>
                        <Button onClick={() => openBranch()}>
                            <Plus />
                            {t("tenant.addBranch")}
                        </Button>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                        {tenant.branches.map((item) => (
                            <Card key={item.id} className="overflow-hidden">
                                <CardContent className="p-5">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <h3 className="truncate font-bold">{item.name}</h3>
                                                {item.isMain && <Badge>{t("tenant.main")}</Badge>}
                                                {!item.isActive && (
                                                    <Badge variant="outline">
                                                        {t("tenant.inactive")}
                                                    </Badge>
                                                )}
                                            </div>
                                            <p className="mt-1 text-xs text-muted-foreground">
                                                {item.code}
                                            </p>
                                        </div>
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            onClick={() => openBranch(item)}
                                            aria-label={t("tenant.editBranch")}
                                        >
                                            <Pencil />
                                        </Button>
                                    </div>
                                    <div className="mt-5 space-y-2 text-sm">
                                        <p>{item.phone || t("tenant.noPhone")}</p>
                                        <p className="text-muted-foreground">
                                            {item.address || t("tenant.noAddress")}
                                        </p>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>
            )}

            {tab === "appearance" && (
                <Card>
                    <CardHeader>
                        <CardTitle>{t("tenant.currencyAppearance")}</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                        <Field label={t("tenant.mainCurrency")}>
                            <SimpleCombobox
                                value={settings.mainCurrencyCode}
                                onValueChange={(value) => {
                                    const currency = currencies.find(
                                        (item) => item[0] === value,
                                    );
                                    if (!currency) return;
                                    setSettings((current) =>
                                        current
                                            ? {
                                                  ...current,
                                                  mainCurrencyCode: currency[0],
                                                  currencySymbol: currency[2],
                                              }
                                            : current,
                                    );
                                }}
                                options={currencies.map((item) => ({
                                    value: item[0],
                                    label: `${item[0]} · ${item[1]}`,
                                    description: item[2],
                                }))}
                            />
                        </Field>
                        <Field label={t("tenant.currencySymbol")}>
                            <Input
                                value={settings.currencySymbol}
                                onChange={(event) =>
                                    setSettings((current) =>
                                        current
                                            ? {
                                                  ...current,
                                                  currencySymbol: event.target.value,
                                              }
                                            : current,
                                    )
                                }
                            />
                        </Field>
                        <Field label={t("tenant.symbolPosition")}>
                            <SimpleCombobox
                                value={settings.currencyPosition}
                                onValueChange={(value) =>
                                    value &&
                                    setSettings((current) =>
                                        current
                                            ? {
                                                  ...current,
                                                  currencyPosition: value as "before" | "after",
                                              }
                                            : current,
                                    )
                                }
                                options={[
                                    {
                                        value: "before",
                                        label: t("tenant.beforeAmount"),
                                    },
                                    {
                                        value: "after",
                                        label: t("tenant.afterAmount"),
                                    },
                                ]}
                            />
                        </Field>
                        <Field label={t("tenant.decimalPlaces")}>
                            <Input
                                type="number"
                                min={0}
                                max={4}
                                value={settings.currencyDecimalPlaces}
                                onChange={(event) =>
                                    setSettings((current) =>
                                        current
                                            ? {
                                                  ...current,
                                                  currencyDecimalPlaces: Number(
                                                      event.target.value,
                                                  ),
                                              }
                                            : current,
                                    )
                                }
                            />
                        </Field>
                        <Preview
                            title={t("tenant.mainCurrency")}
                            value={formatMoney(12345.67, settings.mainCurrencyCode)}
                            icon={<WalletCards />}
                        />
                        <Field label={t("tenant.baseFontSize")}>
                            <Input
                                type="number"
                                min={12}
                                max={22}
                                value={settings.baseFontSize}
                                onChange={(event) =>
                                    setSettings((current) =>
                                        current
                                            ? {
                                                  ...current,
                                                  baseFontSize: Number(event.target.value),
                                              }
                                            : current,
                                    )
                                }
                            />
                        </Field>
                        <ColorField
                            label={t("tenant.adminPrimary")}
                            value={settings.adminPrimaryColor}
                            onChange={(value) =>
                                setSettings((current) =>
                                    current
                                        ? { ...current, adminPrimaryColor: value }
                                        : current,
                                )
                            }
                        />
                        <ColorField
                            label={t("tenant.adminSecondary")}
                            value={settings.adminSecondaryColor}
                            onChange={(value) =>
                                setSettings((current) =>
                                    current
                                        ? { ...current, adminSecondaryColor: value }
                                        : current,
                                )
                            }
                        />
                        <ColorField
                            label={t("tenant.storePrimary")}
                            value={settings.storefrontPrimaryColor}
                            onChange={(value) =>
                                setSettings((current) =>
                                    current
                                        ? { ...current, storefrontPrimaryColor: value }
                                        : current,
                                )
                            }
                        />
                        <ColorField
                            label={t("tenant.storeSecondary")}
                            value={settings.storefrontSecondaryColor}
                            onChange={(value) =>
                                setSettings((current) =>
                                    current
                                        ? { ...current, storefrontSecondaryColor: value }
                                        : current,
                                )
                            }
                        />
                        <Field label={t("tenant.englishFont")}>
                            <FontCombobox
                                value={settings.englishFontFamily}
                                onValueChange={(value) =>
                                    setSettings((current) =>
                                        current
                                            ? { ...current, englishFontFamily: value }
                                            : current,
                                    )
                                }
                            />
                        </Field>
                        <Field label={t("tenant.dariFont")}>
                            <FontCombobox
                                value={settings.dariFontFamily}
                                onValueChange={(value) =>
                                    setSettings((current) =>
                                        current
                                            ? { ...current, dariFontFamily: value }
                                            : current,
                                    )
                                }
                            />
                        </Field>
                        <Field label={t("tenant.pashtoFont")}>
                            <FontCombobox
                                value={settings.pashtoFontFamily}
                                onValueChange={(value) =>
                                    setSettings((current) =>
                                        current
                                            ? { ...current, pashtoFontFamily: value }
                                            : current,
                                    )
                                }
                            />
                        </Field>
                        <Field label={t("tenant.trashRetention")}>
                            <Input
                                type="number"
                                min={1}
                                max={3650}
                                value={settings.trashRetentionDays}
                                onChange={(event) =>
                                    setSettings((current) =>
                                        current
                                            ? {
                                                  ...current,
                                                  trashRetentionDays: Number(
                                                      event.target.value,
                                                  ),
                                              }
                                            : current,
                                    )
                                }
                            />
                        </Field>
                        <div className="flex items-center justify-between gap-3 border p-4 md:col-span-2">
                            <div>
                                <p className="font-medium">
                                    {t("tenant.claimManagement")}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    {t("tenant.claimManagementHelp")}
                                </p>
                            </div>
                            <Switch
                                checked={settings.allowTenantUserClaimManagement}
                                onCheckedChange={(checked) =>
                                    setSettings((current) =>
                                        current
                                            ? {
                                                  ...current,
                                                  allowTenantUserClaimManagement: checked,
                                              }
                                            : current,
                                    )
                                }
                            />
                        </div>
                        <div className="flex gap-3 border border-primary/20 bg-primary/5 p-4 md:col-span-2 xl:col-span-3">
                            <Info className="mt-0.5 size-5 shrink-0 text-primary" />
                            <p className="text-sm leading-6 text-muted-foreground">
                                {t("tenant.currencyHistoryHelp")}
                            </p>
                        </div>
                        <div className="md:col-span-2 xl:col-span-3">
                            <Button
                                onClick={() => saveSettings.mutate()}
                                disabled={saveSettings.isPending}
                            >
                                <Save />
                                {saveSettings.isPending
                                    ? t("tenant.saving")
                                    : t("tenant.saveSettings")}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {tab === "subscription" && (
                <div className="grid gap-4 lg:grid-cols-[1.2fr_.8fr]">
                    <Card className="tenant-gradient overflow-hidden">
                        <CardContent className="p-6">
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <p className="text-xs font-bold uppercase tracking-widest text-primary">
                                        {t("tenant.currentPlan")}
                                    </p>
                                    <h2 className="mt-2 text-3xl font-black">
                                        {tenant.subscription?.plan ?? "—"}
                                    </h2>
                                    <p className="mt-2 text-sm text-muted-foreground">
                                        {t("tenant.status")}: {tenant.subscription?.status ?? "—"}
                                    </p>
                                    <p className="mt-1 text-xs text-muted-foreground">
                                        {t("tenant.validUntil")}: {tenant.subscription?.endsAt
                                            ? new Intl.DateTimeFormat(locale, {
                                                  dateStyle: "medium",
                                              }).format(
                                                  new Date(tenant.subscription.endsAt),
                                              )
                                            : t("tenant.noExpiry")}
                                    </p>
                                </div>
                                <Crown className="size-10 shrink-0 text-primary" />
                            </div>
                            <div className="mt-7 grid gap-3 sm:grid-cols-3">
                                <Limit
                                    label={t("tenant.usersLimit")}
                                    value={tenant.subscription?.maxUsers ?? 0}
                                    locale={locale}
                                />
                                <Limit
                                    label={t("tenant.branchesLimit")}
                                    value={tenant.subscription?.maxBranches ?? 0}
                                    locale={locale}
                                />
                                <Limit
                                    label={t("tenant.productsLimit")}
                                    value={tenant.subscription?.maxProducts ?? 0}
                                    locale={locale}
                                />
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader>
                            <CardTitle>{t("tenant.enabledCapabilities")}</CardTitle>
                        </CardHeader>
                        <CardContent className="max-h-80 space-y-2 overflow-y-auto">
                            {tenant.enabledPermissions.map((permission) => (
                                <div
                                    key={permission}
                                    className="flex items-center gap-2 text-sm"
                                >
                                    <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
                                    <span className="break-all">{permission}</span>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                </div>
            )}

            <Dialog open={branchOpen} onOpenChange={setBranchOpen}>
                <DialogContent className="max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>
                            {branchId ? t("tenant.editBranch") : t("tenant.addBranch")}
                        </DialogTitle>
                        <DialogDescription>{t("tenant.branchHelp")}</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Field label={t("tenant.branchName")}>
                            <Input
                                value={branch.name}
                                onChange={(event) =>
                                    setBranch((current) => ({
                                        ...current,
                                        name: event.target.value,
                                    }))
                                }
                            />
                        </Field>
                        <Field label={t("tenant.branchCode")}>
                            <Input
                                value={branch.code}
                                onChange={(event) =>
                                    setBranch((current) => ({
                                        ...current,
                                        code: event.target.value.toUpperCase(),
                                    }))
                                }
                            />
                        </Field>
                        <Field label={t("tenant.phone")}>
                            <Input
                                value={branch.phone ?? ""}
                                onChange={(event) =>
                                    setBranch((current) => ({
                                        ...current,
                                        phone: event.target.value || null,
                                    }))
                                }
                            />
                        </Field>
                        <div className="space-y-3 rounded-lg border p-3">
                            <Toggle
                                label={t("tenant.activeBranch")}
                                checked={branch.isActive}
                                disabled={branch.isMain}
                                onChange={(checked) =>
                                    setBranch((current) => ({
                                        ...current,
                                        isActive: checked,
                                    }))
                                }
                            />
                            <Toggle
                                label={t("tenant.mainBranch")}
                                checked={branch.isMain}
                                onChange={(checked) =>
                                    setBranch((current) => ({
                                        ...current,
                                        isMain: checked,
                                        isActive: checked ? true : current.isActive,
                                    }))
                                }
                            />
                        </div>
                        <div className="space-y-2 sm:col-span-2">
                            <Label>{t("tenant.address")}</Label>
                            <Textarea
                                value={branch.address ?? ""}
                                onChange={(event) =>
                                    setBranch((current) => ({
                                        ...current,
                                        address: event.target.value || null,
                                    }))
                                }
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setBranchOpen(false)}>
                            {t("tenant.cancel")}
                        </Button>
                        <Button
                            onClick={() => saveBranch.mutate()}
                            disabled={
                                saveBranch.isPending ||
                                !branch.name.trim() ||
                                !branch.code.trim()
                            }
                        >
                            {saveBranch.isPending && (
                                <LoaderCircle className="animate-spin" />
                            )}
                            {t("tenant.save")}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

function TabButton({
    active,
    onClick,
    icon,
    children,
}: {
    active: boolean;
    onClick: () => void;
    icon: ReactNode;
    children: ReactNode;
}) {
    return (
        <Button
            className="shrink-0"
            variant={active ? "default" : "ghost"}
            onClick={onClick}
        >
            {icon}
            {children}
        </Button>
    );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="min-w-0 space-y-2">
            <Label>{label}</Label>
            {children}
        </div>
    );
}

function Toggle({
    label,
    checked,
    disabled = false,
    onChange,
}: {
    label: string;
    checked: boolean;
    disabled?: boolean;
    onChange: (value: boolean) => void;
}) {
    return (
        <div className="flex items-center justify-between gap-3">
            <Label>{label}</Label>
            <Switch
                checked={checked}
                disabled={disabled}
                onCheckedChange={onChange}
            />
        </div>
    );
}

function ColorField({
    label,
    value,
    onChange,
}: {
    label: string;
    value: string;
    onChange: (value: string) => void;
}) {
    return (
        <Field label={label}>
            <div className="flex gap-2">
                <Input
                    type="color"
                    value={value}
                    onChange={(event) => onChange(event.target.value)}
                    className="w-14 shrink-0 p-1"
                />
                <Input value={value} onChange={(event) => onChange(event.target.value)} />
            </div>
        </Field>
    );
}

function FontCombobox({
    value,
    onValueChange,
}: {
    value: string;
    onValueChange: (value: string) => void;
}) {
    return (
        <SimpleCombobox
            value={value}
            onValueChange={(next) => next && onValueChange(next)}
            options={fonts.map((font) => ({ value: font, label: font }))}
        />
    );
}

function Preview({
    title,
    value,
    icon,
}: {
    title: string;
    value: string;
    icon: ReactNode;
}) {
    return (
        <div className="border bg-muted/30 p-4">
            <div className="flex items-center gap-2 text-muted-foreground">
                {icon}
                <span className="text-xs">{title}</span>
            </div>
            <p className="mt-2 break-words text-xl font-bold">{value}</p>
        </div>
    );
}

function Limit({
    label,
    value,
    locale,
}: {
    label: string;
    value: number;
    locale: string;
}) {
    return (
        <div className="border bg-background/70 p-4">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-1 text-xl font-bold">
                {value.toLocaleString(locale)}
            </p>
        </div>
    );
}

function message(error: unknown, fallback: string) {
    return (
        (error as { response?: { data?: { message?: string } } })?.response?.data
            ?.message || (error instanceof Error ? error.message : fallback)
    );
}
