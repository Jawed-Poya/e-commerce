import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, LoaderCircle, MapPin, Pencil, Plus, Save, Settings2 } from "lucide-react";
import { toast } from "sonner";

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
    const { formatMoney } = useCompany();
    const profileQuery = useQuery({ queryKey: ["company", "profile"], queryFn: companyService.profile });
    const [profile, setProfile] = useState<UpdateCompanyProfile | null>(null);
    const [settings, setSettings] = useState<CompanySettings | null>(null);
    const [branchDialog, setBranchDialog] = useState(false);
    const [editingBranch, setEditingBranch] = useState<CompanyBranch | null>(null);
    const [branch, setBranch] = useState<UpsertCompanyBranch>(emptyBranch);

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

    const refresh = async () => {
        await Promise.all([
            queryClient.invalidateQueries({ queryKey: ["company"] }),
            queryClient.invalidateQueries({ queryKey: ["company", "public-profile"] }),
        ]);
    };

    const saveProfile = useMutation({
        mutationFn: companyService.updateProfile,
        onSuccess: async () => {
            toast.success("Company profile updated.");
            await refresh();
        },
        onError: (error) => toast.error(message(error)),
    });
    const saveSettings = useMutation({
        mutationFn: companyService.updateSettings,
        onSuccess: async () => {
            toast.success("Company settings updated.");
            await refresh();
        },
        onError: (error) => toast.error(message(error)),
    });
    const saveBranch = useMutation({
        mutationFn: () => editingBranch
            ? companyService.updateBranch(editingBranch.id, branch)
            : companyService.createBranch(branch),
        onSuccess: async () => {
            toast.success(editingBranch ? "Branch updated." : "Branch created.");
            setBranchDialog(false);
            await refresh();
        },
        onError: (error) => toast.error(message(error)),
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

    if (profileQuery.isLoading || !profile || !settings) {
        return <div className="grid min-h-[60vh] place-items-center"><LoaderCircle className="size-7 animate-spin text-primary" /></div>;
    }

    if (profileQuery.isError) {
        return <Card><CardContent className="p-8 text-center text-destructive">Could not load the company profile.</CardContent></Card>;
    }

    return (
        <div className="space-y-6">
            <PageHeader
                title="Company settings"
                description="Manage one company profile, branches, currency, appearance, and operational preferences."
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
                            <Field label="Company name"><Input required value={profile.name} onChange={(event) => setProfile({ ...profile, name: event.target.value })} /></Field>
                            <Field label="Legal name"><Input value={profile.legalName ?? ""} onChange={(event) => setProfile({ ...profile, legalName: nullable(event.target.value) })} /></Field>
                            <Field label="Registration number"><Input value={profile.registrationNumber ?? ""} onChange={(event) => setProfile({ ...profile, registrationNumber: nullable(event.target.value) })} /></Field>
                            <Field label="Email"><Input type="email" value={profile.email ?? ""} onChange={(event) => setProfile({ ...profile, email: nullable(event.target.value) })} /></Field>
                            <Field label="Phone"><Input value={profile.phone ?? ""} onChange={(event) => setProfile({ ...profile, phone: nullable(event.target.value) })} /></Field>
                            <Field label="Logo URL"><Input value={profile.logoUrl ?? ""} onChange={(event) => setProfile({ ...profile, logoUrl: nullable(event.target.value) })} /></Field>
                            <Field label="Favicon URL"><Input value={profile.faviconUrl ?? ""} onChange={(event) => setProfile({ ...profile, faviconUrl: nullable(event.target.value) })} /></Field>
                            <div className="space-y-2 sm:col-span-2"><Label>Address</Label><Textarea value={profile.address ?? ""} onChange={(event) => setProfile({ ...profile, address: nullable(event.target.value) })} /></div>
                            <div className="sm:col-span-2 flex justify-end"><Button disabled={saveProfile.isPending}><Save />{saveProfile.isPending ? "Saving…" : "Save profile"}</Button></div>
                        </form>
                    </CardContent>
                </Card>

                <Card className="shadow-none">
                    <CardHeader className="border-b bg-muted/20">
                        <div className="flex items-center justify-between gap-3">
                            <div><CardTitle className="flex items-center gap-2"><MapPin className="size-5 text-primary" /> Branches</CardTitle><p className="mt-1 text-xs text-muted-foreground">Use branches for stock, users, sales, and filtered reports.</p></div>
                            <Button size="sm" onClick={() => openBranch()}><Plus /> Add</Button>
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
                                    <Button variant="ghost" size="icon-sm" onClick={() => openBranch(item)}><Pencil className="size-4" /></Button>
                                </div>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            </div>

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
                        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                            <Field label="Main currency"><Input maxLength={3} value={settings.mainCurrencyCode} onChange={(event) => setSettings({ ...settings, mainCurrencyCode: event.target.value.toUpperCase() })} /></Field>
                            <Field label="Currency symbol"><Input value={settings.currencySymbol} onChange={(event) => setSettings({ ...settings, currencySymbol: event.target.value })} /></Field>
                            <Field label="Symbol position"><SimpleCombobox value={settings.currencyPosition} onValueChange={(value) => value && setSettings({ ...settings, currencyPosition: value as "before" | "after" })} options={[{ value: "before", label: "Before amount" }, { value: "after", label: "After amount" }]} /></Field>
                            <Field label="Decimal places"><Input type="number" min={0} max={4} value={settings.currencyDecimalPlaces} onChange={(event) => setSettings({ ...settings, currencyDecimalPlaces: Number(event.target.value) })} /></Field>
                        </div>

                        <div className="rounded-xl border bg-muted/20 p-4"><p className="text-sm font-semibold">Money preview</p><p className="mt-2 text-2xl font-bold tabular-nums text-primary">{formatMoney(123456.78, settings.mainCurrencyCode)}</p></div>

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
                        <div className="flex justify-end"><Button disabled={saveSettings.isPending}><Save />{saveSettings.isPending ? "Saving…" : "Save settings"}</Button></div>
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
                    <DialogFooter><Button variant="outline" onClick={() => setBranchDialog(false)}>Cancel</Button><Button disabled={saveBranch.isPending || !branch.name.trim() || !branch.code.trim()} onClick={() => saveBranch.mutate()}>{saveBranch.isPending ? <LoaderCircle className="animate-spin" /> : <Save />} Save branch</Button></DialogFooter>
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

function nullable(value: string) {
    const clean = value.trim();
    return clean || null;
}

function message(error: unknown) {
    return (error as { response?: { data?: { message?: string } }; message?: string }).response?.data?.message ?? (error as Error).message ?? "The operation failed.";
}
