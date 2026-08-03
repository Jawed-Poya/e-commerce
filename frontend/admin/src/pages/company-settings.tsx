import { useEffect, useRef, useState, type DragEvent, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, CheckCircle2, ImagePlus, ListChecks, LoaderCircle, MapPin, MonitorSmartphone, Pencil, Play, Plus, Save, Settings2, Siren, UploadCloud, Volume2, X } from "lucide-react";
import { toast } from "sonner";

import { apiOrigin } from "@/api/axios";
import { PageHeader } from "@/components/page-header";
import { SimpleCombobox } from "@/components/simple-combobox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { companyService, type UpsertCompanyBranch, type UpdateCompanyProfile } from "@/features/company/company-service";
import type { CompanyBranch, CompanySettings } from "@/features/company/company-types";
import { useCompany } from "@/features/company/company-context";
import { useAdminAuth } from "@/features/auth/auth-context";
import { hasPermission, Permissions } from "@/features/auth/permissions";
import { useI18n } from "@/i18n/i18n-provider";
import { expiryAlertSounds, playExpiryAlertSound } from "@/features/notifications/expiry-alert-sounds";

const emptyBranch: UpsertCompanyBranch = {
    name: "",
    code: "",
    phone: null,
    address: null,
    isMain: false,
    isActive: true,
};

export default function CompanySettingsPage() {
    const queryClient = useQueryClient();
    const { user } = useAdminAuth();
    const { formatMoney } = useCompany();
    const { tr } = useI18n();
    const canManageProfile = hasPermission(user, Permissions.CompanyProfileManage);
    const canManageSettings = hasPermission(user, Permissions.CompanySettingsManage);
    const canManageOperationLimits = hasPermission(user, Permissions.OperationLineLimitsManage);
    const canManageBranches = hasPermission(user, Permissions.CompanyBranchesManage);
    const profileQuery = useQuery({ queryKey: ["company", "profile"], queryFn: companyService.profile });
    const [profile, setProfile] = useState<UpdateCompanyProfile | null>(null);
    const [settings, setSettings] = useState<CompanySettings | null>(null);
    const [branchDialog, setBranchDialog] = useState(false);
    const [editingBranch, setEditingBranch] = useState<CompanyBranch | null>(null);
    const [branch, setBranch] = useState<UpsertCompanyBranch>(emptyBranch);
    const [expiryPeriodInput, setExpiryPeriodInput] = useState("30");

    useEffect(() => {
        if (!profileQuery.data) return;
        const value = profileQuery.data;
        setProfile({
            name: value.name,
            legalName: value.legalName,
            registrationNumber: value.registrationNumber,
            email: value.email,
            phone: value.phone,
            address: value.address,
            logoUrl: value.logoUrl,
            faviconUrl: value.faviconUrl,
        });
        setSettings(value.settings);
    }, [profileQuery.data]);

    const applyCompany = (updated: NonNullable<typeof profileQuery.data>) => {
        queryClient.setQueryData(["company", "profile"], updated);
        setProfile({
            name: updated.name,
            legalName: updated.legalName,
            registrationNumber: updated.registrationNumber,
            email: updated.email,
            phone: updated.phone,
            address: updated.address,
            logoUrl: updated.logoUrl,
            faviconUrl: updated.faviconUrl,
        });
        setSettings(updated.settings);
        void queryClient.invalidateQueries({ queryKey: ["company", "public-profile"] });
    };

    const refreshCompany = async () => {
        await Promise.all([
            queryClient.invalidateQueries({ queryKey: ["company", "profile"] }),
            queryClient.invalidateQueries({ queryKey: ["company", "public-profile"] }),
        ]);
    };

    const saveProfile = useMutation({
        mutationFn: companyService.updateProfile,
        onSuccess: (updated) => {
            applyCompany(updated);
            toast.success(tr("Company profile updated."));
        },
        onError: (error) => toast.error(tr(message(error))),
    });
    const saveSettings = useMutation({
        mutationFn: companyService.updateSettings,
        onSuccess: (updated) => {
            applyCompany(updated);
            toast.success(tr("Company settings updated."));
        },
        onError: (error) => toast.error(tr(message(error))),
    });
    const saveOperationLimits = useMutation({
        mutationFn: companyService.updateOperationLimits,
        onSuccess: (updated) => {
            applyCompany(updated);
            toast.success(tr("Operation line limits updated."));
        },
        onError: (error) => toast.error(tr(message(error))),
    });
    const saveBranch = useMutation({
        mutationFn: () => editingBranch
            ? companyService.updateBranch(editingBranch.id, branch)
            : companyService.createBranch(branch),
        onSuccess: async () => {
            toast.success(tr(editingBranch ? "Branch updated." : "Branch created."));
            setBranchDialog(false);
            await refreshCompany();
        },
        onError: (error) => toast.error(tr(message(error))),
    });

    const openBranch = (value?: CompanyBranch) => {
        setEditingBranch(value ?? null);
        setBranch(value ? {
            name: value.name,
            code: value.code,
            phone: value.phone,
            address: value.address,
            isMain: value.isMain,
            isActive: value.isActive,
        } : emptyBranch);
        setBranchDialog(true);
    };

    const savedProfile = profileQuery.data
        ? {
              name: profileQuery.data.name,
              legalName: profileQuery.data.legalName,
              registrationNumber: profileQuery.data.registrationNumber,
              email: profileQuery.data.email,
              phone: profileQuery.data.phone,
              address: profileQuery.data.address,
              logoUrl: profileQuery.data.logoUrl,
              faviconUrl: profileQuery.data.faviconUrl,
          }
        : null;
    const profileChanged = Boolean(savedProfile && JSON.stringify(profile) !== JSON.stringify(savedProfile));
    const editableSettings = ({ maximumPurchaseLines: _purchase, maximumManualSaleLines: _sale, ...value }: CompanySettings) => value;
    const settingsChanged = Boolean(
        profileQuery.data &&
        settings &&
        JSON.stringify(editableSettings(settings)) !== JSON.stringify(editableSettings(profileQuery.data.settings)),
    );
    const operationLimitsChanged = Boolean(
        profileQuery.data &&
        settings &&
        (settings.maximumPurchaseLines !== profileQuery.data.settings.maximumPurchaseLines ||
            settings.maximumManualSaleLines !== profileQuery.data.settings.maximumManualSaleLines),
    );
    const previewMoney = new Intl.NumberFormat("en-US", {
        minimumFractionDigits: settings?.currencyDecimalPlaces ?? 2,
        maximumFractionDigits: settings?.currencyDecimalPlaces ?? 2,
    }).format(123456.78);
    const moneyPreview = settings
        ? settings.currencyPosition === "after"
            ? `${previewMoney} ${settings.currencySymbol || settings.mainCurrencyCode}`
            : `${settings.currencySymbol || settings.mainCurrencyCode} ${previewMoney}`
        : formatMoney(123456.78);

    const addExpiryPeriod = () => {
        if (!settings) return;
        const value = clampExpiryPeriod(expiryPeriodInput);
        const periods = [...new Set([...settings.expiryAlertPeriods, value, 0])]
            .sort((a, b) => b - a)
            .slice(0, 12);
        setSettings({ ...settings, expiryAlertPeriods: periods });
        setExpiryPeriodInput("");
    };

    const removeExpiryPeriod = (value: number) => {
        if (!settings || value === 0) return;
        setSettings({
            ...settings,
            expiryAlertPeriods: settings.expiryAlertPeriods.filter((period) => period !== value),
        });
    };

    const previewExpiryAlertSound = async () => {
        if (!settings) return;
        try {
            await playExpiryAlertSound(settings.expiryAlertSound);
        } catch {
            toast.error(tr("The browser blocked audio. Click anywhere in the admin app, then test again."));
        }
    };

    if (profileQuery.isLoading || (profileQuery.isSuccess && (!profile || !settings))) {
        return <div className="grid min-h-[60vh] place-items-center"><LoaderCircle className="size-7 animate-spin text-primary" /></div>;
    }

    if (profileQuery.isError || !profileQuery.data || !profile || !settings) {
        return (
            <Card className="mx-auto mt-10 max-w-lg shadow-none">
                <CardContent className="space-y-4 p-8 text-center">
                    <p className="text-sm font-medium text-destructive">
                        Could not load the company profile.
                    </p>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => void profileQuery.refetch()}
                    >
                        Try again
                    </Button>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            <PageHeader
                title={tr("Company settings")}
                description={tr("Manage one company profile, branches, currency, appearance, and operational preferences.")}
            />

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(380px,.8fr)]">
                <Card className="shadow-none">
                    <CardHeader className="border-b bg-muted/20">
                        <CardTitle className="flex items-center gap-2"><Building2 className="size-5 text-primary" /> Company profile</CardTitle>
                    </CardHeader>
                    <CardContent className="p-5">
                        <form
                            className="grid gap-5 sm:grid-cols-2"
                            onSubmit={(event: FormEvent) => {
                                event.preventDefault();
                                saveProfile.mutate(profile);
                            }}
                        >
                            <fieldset disabled={!canManageProfile} className="contents">
                            <Field label="Company name"><Input required value={profile.name} onChange={(event) => setProfile({ ...profile, name: event.target.value })} /></Field>
                            <Field label="Legal name"><Input value={profile.legalName ?? ""} onChange={(event) => setProfile({ ...profile, legalName: nullable(event.target.value) })} /></Field>
                            <Field label="Registration number"><Input value={profile.registrationNumber ?? ""} onChange={(event) => setProfile({ ...profile, registrationNumber: nullable(event.target.value) })} /></Field>
                            <Field label="Email"><Input type="email" value={profile.email ?? ""} onChange={(event) => setProfile({ ...profile, email: nullable(event.target.value) })} /></Field>
                            <Field label="Phone"><Input value={profile.phone ?? ""} onChange={(event) => setProfile({ ...profile, phone: nullable(event.target.value) })} /></Field>
                            <section className="space-y-4 rounded-2xl bg-muted/35 p-4 sm:col-span-2">
                                <div className="flex items-start gap-3">
                                    <div className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
                                        <MonitorSmartphone className="size-5" />
                                    </div>
                                    <div>
                                        <p className="font-semibold">Brand assets</p>
                                        <p className="mt-1 text-xs leading-5 text-muted-foreground">
                                            These images are used by the admin header, storefront, browser tab, shortcuts, and installed PWA.
                                        </p>
                                    </div>
                                </div>
                                <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(260px,.8fr)]">
                                    <BrandAssetUploader
                                        assetType="logo"
                                        label="Company logo"
                                        description="Recommended: transparent image, at least 512 × 256 pixels."
                                        value={profile.logoUrl}
                                        disabled={!canManageProfile}
                                        companyName={profile.name}
                                        onChange={(logoUrl) => setProfile({ ...profile, logoUrl })}
                                    />
                                    <BrandAssetUploader
                                        assetType="favicon"
                                        label="Favicon and app icon"
                                        description="Recommended: square image, at least 512 × 512 pixels."
                                        value={profile.faviconUrl}
                                        disabled={!canManageProfile}
                                        compact
                                        companyName={profile.name}
                                        onChange={(faviconUrl) => setProfile({ ...profile, faviconUrl })}
                                    />
                                </div>
                            </section>
                            <div className="space-y-2 sm:col-span-2"><Label>Address</Label><Textarea value={profile.address ?? ""} onChange={(event) => setProfile({ ...profile, address: nullable(event.target.value) })} /></div>
                            <div className="sm:col-span-2 flex items-center justify-between gap-3">
                                {!canManageProfile && <p className="text-xs text-muted-foreground">You can view this profile but cannot edit it.</p>}
                                <Button type="submit" className="ms-auto" disabled={saveProfile.isPending || !profileChanged || !profile.name.trim()}><Save />{saveProfile.isPending ? "Saving…" : "Save profile"}</Button>
                            </div>
                            </fieldset>
                        </form>
                    </CardContent>
                </Card>

                <Card className="shadow-none">
                    <CardHeader className="border-b bg-muted/20">
                        <div className="flex items-center justify-between gap-3">
                            <div><CardTitle className="flex items-center gap-2"><MapPin className="size-5 text-primary" /> Branches</CardTitle><p className="mt-1 text-xs text-muted-foreground">Use branches for stock, users, sales, and filtered reports.</p></div>
                            <Button size="sm" disabled={!canManageBranches} onClick={() => openBranch()}><Plus /> Add</Button>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-3 p-4">
                        {profileQuery.data?.branches.map((item) => (
                            <div key={item.id} className="rounded-xl border bg-card p-4">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <div className="flex flex-wrap items-center gap-2"><span className="font-semibold">{item.name}</span><Badge variant="secondary">{item.code}</Badge>{item.isMain && <Badge>Main</Badge>}{!item.isActive && <Badge variant="outline">Inactive</Badge>}</div>
                                        <p className="mt-2 text-xs text-muted-foreground">{item.phone || "No phone"} · {item.address || "No address"}</p>
                                    </div>
                                    <Button variant="ghost" size="icon-sm" disabled={!canManageBranches} onClick={() => openBranch(item)}><Pencil className="size-4" /></Button>
                                </div>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            </div>

            <Card className="shadow-none">
                <CardHeader className="border-b bg-muted/20">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <CardTitle className="flex items-center gap-2">
                                <ListChecks className="size-5 text-primary" />
                                {tr("Operation product-line limits")}
                            </CardTitle>
                            <p className="mt-1 text-xs text-muted-foreground">
                                {tr("Control how many products a normal purchase or manual sale can contain. Users with the override permission can continue up to the 500-line safety limit.")}
                            </p>
                        </div>
                        <Badge variant="outline">{tr("System safety limit")}: 500</Badge>
                    </div>
                </CardHeader>
                <CardContent className="p-5">
                    <form
                        className="space-y-5"
                        onSubmit={(event) => {
                            event.preventDefault();
                            saveOperationLimits.mutate({
                                maximumPurchaseLines: settings.maximumPurchaseLines,
                                maximumManualSaleLines: settings.maximumManualSaleLines,
                            });
                        }}
                    >
                        <fieldset disabled={!canManageOperationLimits} className="space-y-5">
                            <div className="grid gap-5 md:grid-cols-2">
                                <Field label={tr("Maximum purchase lines")}>
                                    <Input
                                        type="number"
                                        min={1}
                                        max={500}
                                        value={settings.maximumPurchaseLines}
                                        onChange={(event) => setSettings({
                                            ...settings,
                                            maximumPurchaseLines: clampLineLimit(event.target.value),
                                        })}
                                    />
                                </Field>
                                <Field label={tr("Maximum manual-sale lines")}>
                                    <Input
                                        type="number"
                                        min={1}
                                        max={500}
                                        value={settings.maximumManualSaleLines}
                                        onChange={(event) => setSettings({
                                            ...settings,
                                            maximumManualSaleLines: clampLineLimit(event.target.value),
                                        })}
                                    />
                                </Field>
                            </div>
                            <div className="flex flex-col gap-3 rounded-xl bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
                                <p className="text-xs leading-5 text-muted-foreground">
                                    {tr("The configured limit applies to normal users. Assign")} <span className="font-semibold text-foreground">{tr("Operation line-limit override")}</span> {tr("only to trusted supervisors.")}
                                </p>
                                <Button
                                    type="submit"
                                    className="shrink-0"
                                    disabled={saveOperationLimits.isPending || !operationLimitsChanged}
                                >
                                    {saveOperationLimits.isPending ? <LoaderCircle className="animate-spin" /> : <Save />}
                                    {saveOperationLimits.isPending ? tr("Saving…") : tr("Save line limits")}
                                </Button>
                            </div>
                            {!canManageOperationLimits ? (
                                <p className="text-xs text-muted-foreground">{tr("You can view these limits but do not have permission to change them.")}</p>
                            ) : null}
                        </fieldset>
                    </form>
                </CardContent>
            </Card>

            <Card className="shadow-none">
                <CardHeader className="border-b bg-muted/20"><CardTitle className="flex items-center gap-2"><Settings2 className="size-5 text-primary" /> Currency, appearance, and retention</CardTitle></CardHeader>
                <CardContent className="p-5">
                    <form
                        className="space-y-6"
                        onSubmit={(event) => {
                            event.preventDefault();
                            saveSettings.mutate(settings);
                        }}
                    >
                        <fieldset disabled={!canManageSettings} className="space-y-6">
                        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                            <Field label="Main currency"><Input maxLength={3} value={settings.mainCurrencyCode} onChange={(event) => setSettings({ ...settings, mainCurrencyCode: event.target.value.toUpperCase() })} /></Field>
                            <Field label="Currency symbol"><Input value={settings.currencySymbol} onChange={(event) => setSettings({ ...settings, currencySymbol: event.target.value })} /></Field>
                            <Field label="Symbol position"><SimpleCombobox value={settings.currencyPosition} onValueChange={(value) => value && setSettings({ ...settings, currencyPosition: value as "before" | "after" })} options={[{ value: "before", label: "Before amount" }, { value: "after", label: "After amount" }]} /></Field>
                            <Field label="Decimal places"><Input type="number" min={0} max={4} value={settings.currencyDecimalPlaces} onChange={(event) => setSettings({ ...settings, currencyDecimalPlaces: Number(event.target.value) })} /></Field>
                        </div>

                        <div className="rounded-xl border bg-muted/20 p-4"><p className="text-sm font-semibold">Money preview</p><p className="mt-2 text-2xl font-bold tabular-nums text-primary">{moneyPreview}</p></div>

                        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                            <ColorField label="Admin primary" value={settings.adminPrimaryColor} onChange={(value) => setSettings({ ...settings, adminPrimaryColor: value })} />
                            <ColorField label="Admin secondary" value={settings.adminSecondaryColor} onChange={(value) => setSettings({ ...settings, adminSecondaryColor: value })} />
                            <ColorField label="Store primary" value={settings.storefrontPrimaryColor} onChange={(value) => setSettings({ ...settings, storefrontPrimaryColor: value })} />
                            <ColorField label="Store secondary" value={settings.storefrontSecondaryColor} onChange={(value) => setSettings({ ...settings, storefrontSecondaryColor: value })} />
                        </div>

                        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                            <Field label="English font"><Input value={settings.englishFontFamily} onChange={(event) => setSettings({ ...settings, englishFontFamily: event.target.value })} /></Field>
                            <Field label="Dari font"><Input value={settings.dariFontFamily} onChange={(event) => setSettings({ ...settings, dariFontFamily: event.target.value })} /></Field>
                            <Field label="Pashto font"><Input value={settings.pashtoFontFamily} onChange={(event) => setSettings({ ...settings, pashtoFontFamily: event.target.value })} /></Field>
                            <Field label="Base font size"><Input type="number" min={12} max={22} value={settings.baseFontSize} onChange={(event) => setSettings({ ...settings, baseFontSize: Number(event.target.value) })} /></Field>
                            <Field label="Trash retention days"><Input type="number" min={1} max={3650} value={settings.trashRetentionDays} onChange={(event) => setSettings({ ...settings, trashRetentionDays: Number(event.target.value) })} /></Field>
                            <Field label="Notification retention days"><Input type="number" min={1} max={3650} value={settings.notificationRetentionDays} onChange={(event) => setSettings({ ...settings, notificationRetentionDays: Number(event.target.value) })} /></Field>
                            <div className="flex items-center justify-between gap-4 rounded-xl border p-4 sm:col-span-2"><div><p className="text-sm font-semibold">Allow permission assignment</p><p className="mt-1 text-xs text-muted-foreground">Administrators can assign permissions they already hold.</p></div><Switch checked={settings.allowUserClaimManagement} onCheckedChange={(checked) => setSettings({ ...settings, allowUserClaimManagement: checked })} /></div>
                        </div>

                        <section className="overflow-hidden rounded-2xl border border-destructive/20 bg-destructive/[0.035]">
                            <div className="flex flex-col gap-3 border-b border-destructive/15 p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5">
                                <div className="flex items-start gap-3">
                                    <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-destructive text-destructive-foreground shadow-sm">
                                        <Siren className="size-5" />
                                    </span>
                                    <div>
                                        <p className="font-bold">Inventory expiry alerts</p>
                                        <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">
                                            Notify administrators when a stocked lot is expired or enters the configured warning window. Alerts are deduplicated per lot and expiry date.
                                        </p>
                                    </div>
                                </div>
                                <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-destructive/20 bg-background px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-destructive">
                                    <Volume2 className="size-3" /> Critical alert
                                </span>
                            </div>

                            <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-2">
                                <Toggle
                                    label="Enable expiry alerts"
                                    description="Create real-time admin notifications for expiring and expired stock lots."
                                    checked={settings.expiryAlertsEnabled}
                                    onCheckedChange={(checked) => setSettings({ ...settings, expiryAlertsEnabled: checked })}
                                />
                                <div className="space-y-3 lg:col-span-2">
                                    <div>
                                        <Label>Expiry alert periods</Label>
                                        <p className="mt-1 text-xs text-muted-foreground">Add the exact days before expiry when a new alert should fire. Day 0 is the expiry date and cannot be removed.</p>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {settings.expiryAlertPeriods.map((period) => (
                                            <Badge key={period} variant="secondary" className="gap-1.5 px-3 py-1.5">
                                                {period === 0 ? "Expiry day" : `${period} day${period === 1 ? "" : "s"} before`}
                                                {period !== 0 ? (
                                                    <button type="button" disabled={!settings.expiryAlertsEnabled} onClick={() => removeExpiryPeriod(period)} aria-label={`Remove ${period}-day alert`} className="rounded-full p-0.5 hover:bg-background">
                                                        <X className="size-3" />
                                                    </button>
                                                ) : null}
                                            </Badge>
                                        ))}
                                    </div>
                                    <div className="flex max-w-md gap-2">
                                        <Input
                                            type="number"
                                            min={0}
                                            max={365}
                                            value={expiryPeriodInput}
                                            disabled={!settings.expiryAlertsEnabled || settings.expiryAlertPeriods.length >= 12}
                                            onChange={(event) => setExpiryPeriodInput(event.target.value)}
                                            onKeyDown={(event) => {
                                                if (event.key === "Enter") {
                                                    event.preventDefault();
                                                    addExpiryPeriod();
                                                }
                                            }}
                                            placeholder="Example: 60"
                                        />
                                        <Button type="button" variant="outline" disabled={!settings.expiryAlertsEnabled || !expiryPeriodInput.trim() || settings.expiryAlertPeriods.length >= 12} onClick={addExpiryPeriod}>
                                            <Plus /> Add period
                                        </Button>
                                    </div>
                                </div>
                                <Toggle
                                    label="Play danger sound"
                                    description="Play one warning sound when new unread expiry alerts arrive."
                                    checked={settings.expiryAlertSoundEnabled}
                                    onCheckedChange={(checked) => setSettings({ ...settings, expiryAlertSoundEnabled: checked })}
                                />
                                <Field label="Danger sound">
                                    <div className="flex gap-2">
                                        <SimpleCombobox
                                            value={settings.expiryAlertSound}
                                            disabled={!settings.expiryAlertSoundEnabled}
                                            onValueChange={(value) => value && setSettings({
                                                ...settings,
                                                expiryAlertSound: value as CompanySettings["expiryAlertSound"],
                                            })}
                                            options={[...expiryAlertSounds]}
                                            placeholder="Select warning sound"
                                        />
                                        <Button
                                            type="button"
                                            variant="outline"
                                            className="shrink-0"
                                            disabled={!settings.expiryAlertSoundEnabled}
                                            onClick={() => void previewExpiryAlertSound()}
                                        >
                                            <Play className="size-4" /> Test
                                        </Button>
                                    </div>
                                </Field>
                            </div>
                        </section>
                        <div className="flex items-center justify-between gap-3">
                            {!canManageSettings && <p className="text-xs text-muted-foreground">You can view these settings but cannot edit them.</p>}
                            <Button type="submit" className="ms-auto" disabled={saveSettings.isPending || !settingsChanged}><Save />{saveSettings.isPending ? "Saving…" : "Save settings"}</Button>
                        </div>
                        </fieldset>
                    </form>
                </CardContent>
            </Card>

            <Dialog open={branchDialog} onOpenChange={setBranchDialog}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader><DialogTitle>{editingBranch ? "Edit branch" : "Add branch"}</DialogTitle><DialogDescription>Branches are optional operational locations inside this company.</DialogDescription></DialogHeader>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Field label="Branch name"><Input value={branch.name} onChange={(event) => setBranch({ ...branch, name: event.target.value })} /></Field>
                        <Field label="Code"><Input value={branch.code} onChange={(event) => setBranch({ ...branch, code: event.target.value.toUpperCase() })} /></Field>
                        <Field label="Phone"><Input value={branch.phone ?? ""} onChange={(event) => setBranch({ ...branch, phone: nullable(event.target.value) })} /></Field>
                        <Field label="Address"><Input value={branch.address ?? ""} onChange={(event) => setBranch({ ...branch, address: nullable(event.target.value) })} /></Field>
                        <Toggle label="Main branch" description="Use this as the default location." checked={branch.isMain} onCheckedChange={(checked) => setBranch({ ...branch, isMain: checked, isActive: checked ? true : branch.isActive })} />
                        <Toggle label="Active" description="Allow operations in this branch." checked={branch.isActive} onCheckedChange={(checked) => setBranch({ ...branch, isActive: checked })} />
                    </div>
                    <DialogFooter><Button type="button" variant="outline" onClick={() => setBranchDialog(false)}>Cancel</Button><Button type="button" disabled={!canManageBranches || saveBranch.isPending || !branch.name.trim() || !branch.code.trim()} onClick={() => saveBranch.mutate()}>{saveBranch.isPending ? <LoaderCircle className="animate-spin" /> : <Save />} Save branch</Button></DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return <div className="space-y-2"><Label>{label}</Label>{children}</div>;
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
    return <Field label={label}><div className="flex gap-2"><Input type="color" className="w-14 px-1" value={value} onChange={(event) => onChange(event.target.value)} /><Input value={value} onChange={(event) => onChange(event.target.value)} /></div></Field>;
}

function Toggle({ label, description, checked, onCheckedChange }: { label: string; description: string; checked: boolean; onCheckedChange: (value: boolean) => void }) {
    return <div className="flex items-center justify-between gap-4 rounded-xl border p-4"><div><p className="text-sm font-semibold">{label}</p><p className="mt-1 text-xs text-muted-foreground">{description}</p></div><Switch checked={checked} onCheckedChange={onCheckedChange} /></div>;
}


function BrandAssetUploader({
    assetType,
    label,
    description,
    value,
    onChange,
    disabled,
    compact = false,
    companyName,
}: {
    assetType: "logo" | "favicon";
    label: string;
    description: string;
    value: string | null;
    onChange: (value: string | null) => void;
    disabled?: boolean;
    compact?: boolean;
    companyName: string;
}) {
    const inputRef = useRef<HTMLInputElement>(null);
    const { tr } = useI18n();
    const upload = useMutation({
        mutationFn: (file: File) => companyService.uploadBrandAsset(assetType, file),
        onSuccess: (imageUrl) => {
            onChange(imageUrl);
            toast.success(tr(assetType === "logo" ? "Company logo uploaded." : "Company favicon uploaded."));
        },
        onError: (error) => toast.error(tr(message(error))),
    });

    const choose = (file?: File) => {
        if (!file) return;
        if (!file.type.startsWith("image/")) {
            toast.error(tr("Choose a valid image file."));
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            toast.error(tr("The image must not exceed 5 MB."));
            return;
        }
        upload.mutate(file);
    };

    const handleDrop = (event: DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        if (!disabled && !upload.isPending) choose(event.dataTransfer.files[0]);
    };

    const preview = value
        ? /^https?:/i.test(value)
            ? value
            : `${apiOrigin}${value.startsWith("/") ? value : `/${value}`}`
        : null;

    return (
        <div className="overflow-hidden rounded-2xl bg-background shadow-sm ring-1 ring-border/60">
            <div className="flex items-center justify-between gap-3 border-b border-border/50 px-4 py-3">
                <div>
                    <Label className="font-semibold">{label}</Label>
                    <p className="mt-1 text-xs text-muted-foreground">{description}</p>
                </div>
                {value ? (
                    <Badge variant="secondary" className="gap-1">
                        <CheckCircle2 className="size-3" /> Ready
                    </Badge>
                ) : (
                    <Badge variant="outline">Not uploaded</Badge>
                )}
            </div>
            <div
                onDragOver={(event) => event.preventDefault()}
                onDrop={handleDrop}
                className="group relative p-4"
            >
                <input
                    ref={inputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/avif"
                    className="sr-only"
                    disabled={disabled || upload.isPending}
                    onChange={(event) => {
                        choose(event.target.files?.[0]);
                        event.currentTarget.value = "";
                    }}
                />

                {compact ? (
                    <div className="grid min-h-44 place-items-center rounded-xl bg-muted/45 p-5">
                        <div className="space-y-3 text-center">
                            <div className="mx-auto grid size-24 place-items-center overflow-hidden rounded-[1.4rem] bg-background p-3 shadow-xl ring-1 ring-black/5 dark:ring-white/10">
                                {preview ? <img src={preview} alt="" className="size-full object-contain" /> : <ImagePlus className="size-8 text-muted-foreground" />}
                            </div>
                            <div className="mx-auto flex max-w-52 items-center gap-2 rounded-lg bg-background/95 px-3 py-2 text-start text-xs shadow-md ring-1 ring-black/5 dark:ring-white/10">
                                <div className="size-4 overflow-hidden rounded bg-muted">
                                    {preview ? <img src={preview} alt="" className="size-full object-contain" /> : null}
                                </div>
                                <span className="truncate">{companyName || "Company"}</span>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="grid min-h-52 place-items-center overflow-hidden rounded-xl bg-gradient-to-br from-muted/60 to-muted/20 p-6">
                        {preview ? (
                            <img src={preview} alt="" className="max-h-36 w-full object-contain" />
                        ) : (
                            <div className="text-center">
                                <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-background shadow-sm ring-1 ring-border/60">
                                    <ImagePlus className="size-7 text-muted-foreground" />
                                </div>
                                <p className="mt-3 text-sm font-medium">No logo uploaded</p>
                            </div>
                        )}
                    </div>
                )}

                <div className="mt-4 flex flex-wrap items-center gap-2">
                    <Button type="button" size="sm" variant="outline" disabled={disabled || upload.isPending} onClick={() => inputRef.current?.click()}>
                        {upload.isPending ? <LoaderCircle className="animate-spin" /> : <UploadCloud />}
                        {upload.isPending ? tr("Uploading…") : tr(value ? "Replace image" : "Upload image")}
                    </Button>
                    {value ? (
                        <Button type="button" size="sm" variant="ghost" disabled={disabled || upload.isPending} onClick={() => onChange(null)}>
                            <X /> {tr("Remove image")}
                        </Button>
                    ) : null}
                    <span className="ms-auto text-[11px] text-muted-foreground">PNG, JPG, WEBP or AVIF · max 5 MB</span>
                </div>
                {value ? <p className="mt-3 text-[11px] font-medium text-primary">{tr("Save the company profile to publish this asset everywhere.")}</p> : null}
            </div>
        </div>
    );
}

function clampLineLimit(value: string) {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed)) return 1;
    return Math.max(1, Math.min(parsed, 500));
}

function clampExpiryPeriod(value: string) {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed)) return 0;
    return Math.max(0, Math.min(parsed, 365));
}

function nullable(value: string) {
    const clean = value.trim();
    return clean || null;
}

function message(error: unknown) {
    return (error as { response?: { data?: { message?: string } }; message?: string }).response?.data?.message ?? (error as Error).message ?? "The operation failed.";
}
