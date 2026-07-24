import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, Crown, HardDrive, LoaderCircle, Package, Pencil, Plus, Save, ShoppingCart, Users, Warehouse } from "lucide-react";
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
import { tenantService } from "@/features/tenancy/tenant-service";
import type { SubscriptionPlan, TenantPlan, UpsertSubscriptionPlanRequest } from "@/features/tenancy/tenant-types";
import { useI18n } from "@/i18n/i18n-provider";

const legacyPlans: TenantPlan[] = ["Free", "Premium", "Full", "Enterprise"];
const currencies = ["AFN", "USD", "EUR", "GBP", "PKR", "INR"];

export default function SubscriptionPlansPage() {
    const { t } = useI18n();
    const client = useQueryClient();
    const plansQuery = useQuery({ queryKey: ["platform-plans"], queryFn: () => tenantService.plans(true) });
    const permissionsQuery = useQuery({ queryKey: ["platform", "permission-groups"], queryFn: userService.getPermissions, staleTime: 10 * 60_000 });
    const [editing, setEditing] = useState<SubscriptionPlan | null>(null);
    const [form, setForm] = useState<UpsertSubscriptionPlanRequest | null>(null);
    const refresh = () => client.invalidateQueries({ queryKey: ["platform-plans"] });
    const save = useMutation({ mutationFn: () => editing ? tenantService.updatePlan(editing.id, form!) : tenantService.createPlan(form!), onSuccess: async () => { toast.success(t("plans.saved")); setEditing(null); setForm(null); await refresh(); }, onError: (error) => toast.error(message(error, t("tenant.operationFailed"))) });
    const archive = useMutation({ mutationFn: tenantService.archivePlan, onSuccess: async () => { toast.success(t("plans.archived")); await refresh(); }, onError: (error) => toast.error(message(error, t("tenant.operationFailed"))) });
    const openCreate = () => { setEditing(null); setForm(emptyPlan()); };
    const openEdit = (plan: SubscriptionPlan) => { setEditing(plan); setForm({ code: plan.code, name: plan.name, description: plan.description, isActive: plan.isActive, sortOrder: plan.sortOrder, legacyPlan: plan.legacyPlan, monthlyPrice: plan.monthlyPrice, yearlyPrice: plan.yearlyPrice, currencyCode: plan.currencyCode, maxUsers: plan.maxUsers, maxBranches: plan.maxBranches, maxProducts: plan.maxProducts, maxOrdersPerMonth: plan.maxOrdersPerMonth, maxStorageMb: plan.maxStorageMb, enabledPermissions: [...plan.enabledPermissions] }); };
    const groups = useMemo(() => permissionsQuery.data ?? [], [permissionsQuery.data]);
    return <div className="space-y-6"><PageHeader title={t("plans.title")} description={t("plans.description")} actions={<Button onClick={openCreate}><Plus />{t("plans.new")}</Button>} />
        {plansQuery.isLoading ? <div className="grid min-h-64 place-items-center"><LoaderCircle className="animate-spin" /></div> : <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">{plansQuery.data?.map((plan) => <Card key={plan.id} className={!plan.isActive ? "opacity-65" : ""}><CardContent className="p-5"><div className="flex items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><h2 className="text-lg font-bold">{plan.name}</h2>{plan.isSystem && <Badge variant="secondary">{t("plans.builtIn")}</Badge>}{!plan.isActive && <Badge variant="outline">{t("tenant.inactive")}</Badge>}</div><p className="mt-1 text-sm text-muted-foreground">{plan.description}</p></div><Crown className="text-primary" /></div><p className="mt-5 text-3xl font-black">{plan.currencyCode} {plan.monthlyPrice}<span className="text-sm font-normal text-muted-foreground">/{t("plans.month")}</span></p><div className="mt-5 grid grid-cols-2 gap-2 text-xs"><Limit icon={<Users />} label={t("tenant.usersLimit")} value={plan.maxUsers} /><Limit icon={<Warehouse />} label={t("tenant.branchesLimit")} value={plan.maxBranches} /><Limit icon={<Package />} label={t("tenant.productsLimit")} value={plan.maxProducts} /><Limit icon={<ShoppingCart />} label={t("platform.ordersLimit")} value={plan.maxOrdersPerMonth} /><Limit icon={<HardDrive />} label={t("platform.storageLimit")} value={`${plan.maxStorageMb} MB`} /><Limit icon={<Crown />} label={t("plans.permissions")} value={plan.enabledPermissions.length} /></div><div className="mt-5 flex gap-2"><Button variant="outline" className="flex-1" onClick={() => openEdit(plan)}><Pencil />{t("platform.edit")}</Button>{!plan.isSystem && <Button variant="ghost" size="icon" onClick={() => archive.mutate(plan.id)}><Archive /></Button>}</div></CardContent></Card>)}</div>}
        <Dialog open={Boolean(form)} onOpenChange={(open) => { if (!open) { setEditing(null); setForm(null); } }}><DialogContent className="max-h-[96dvh] w-[calc(100vw-1rem)] max-w-none overflow-y-auto p-4 sm:max-w-[calc(100vw-2rem)] sm:p-6 2xl:max-w-[1600px]">{form && <><DialogHeader><DialogTitle>{editing ? t("plans.edit") : t("plans.create")}</DialogTitle><DialogDescription>{t("plans.formHelp")}</DialogDescription></DialogHeader><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><Field label={t("plans.name")}><Input value={form.name} onChange={(e) => patch(setForm, { name: e.target.value })} /></Field><Field label={t("plans.code")}><Input value={form.code} disabled={Boolean(editing?.isSystem)} onChange={(e) => patch(setForm, { code: e.target.value })} /></Field><Field label={t("plans.tier")}><SimpleCombobox value={form.legacyPlan} onValueChange={(value) => value && patch(setForm, { legacyPlan: value as TenantPlan })} options={legacyPlans.map((value) => ({ value, label: planTierLabel(value, t) }))} /></Field><Field label={t("plans.sortOrder")}><Input type="number" value={form.sortOrder} onChange={(e) => patch(setForm, { sortOrder: Number(e.target.value) })} /></Field><div className="sm:col-span-2 lg:col-span-4"><Field label={t("plans.descriptionLabel")}><Textarea value={form.description ?? ""} onChange={(e) => patch(setForm, { description: e.target.value || null })} /></Field></div><Field label={t("plans.monthlyPrice")}><Input type="number" min={0} value={form.monthlyPrice} onChange={(e) => patch(setForm, { monthlyPrice: Number(e.target.value) })} /></Field><Field label={t("plans.yearlyPrice")}><Input type="number" min={0} value={form.yearlyPrice} onChange={(e) => patch(setForm, { yearlyPrice: Number(e.target.value) })} /></Field><Field label={t("platform.currency")}><SimpleCombobox value={form.currencyCode} onValueChange={(value) => value && patch(setForm, { currencyCode: value })} options={currencies.map((value) => ({ value, label: value }))} /></Field><div className="flex items-center justify-between rounded-xl border p-4"><Label>{t("plans.active")}</Label><Switch checked={form.isActive} onCheckedChange={(value) => patch(setForm, { isActive: value })} /></div><LimitInput label={t("tenant.usersLimit")} value={form.maxUsers} onChange={(value) => patch(setForm, { maxUsers: value })} /><LimitInput label={t("tenant.branchesLimit")} value={form.maxBranches} onChange={(value) => patch(setForm, { maxBranches: value })} /><LimitInput label={t("tenant.productsLimit")} value={form.maxProducts} onChange={(value) => patch(setForm, { maxProducts: value })} /><LimitInput label={t("platform.ordersLimit")} value={form.maxOrdersPerMonth} onChange={(value) => patch(setForm, { maxOrdersPerMonth: value })} /><LimitInput label={t("platform.storageLimit")} value={form.maxStorageMb} onChange={(value) => patch(setForm, { maxStorageMb: value })} /></div><div className="mt-6"><h3 className="mb-3 font-semibold">{t("plans.permissions")}</h3><PermissionChecklist groups={groups} selected={form.enabledPermissions} onChange={(enabledPermissions) => patch(setForm, { enabledPermissions })} /></div><DialogFooter><Button variant="outline" onClick={() => { setEditing(null); setForm(null); }}>{t("tenant.cancel")}</Button><Button onClick={() => save.mutate()} disabled={save.isPending}><Save />{t("tenant.save")}</Button></DialogFooter></>}</DialogContent></Dialog>
    </div>;
}
function Limit({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) { return <div className="flex items-center gap-2 rounded-lg bg-muted/50 p-2"><span className="text-primary">{icon}</span><div><p className="font-bold">{value}</p><p className="text-muted-foreground">{label}</p></div></div>; }
function LimitInput({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) { return <Field label={label}><Input type="number" min={1} value={value} onChange={(e) => onChange(Math.max(1, Number(e.target.value)))} /></Field>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="min-w-0 space-y-2"><Label>{label}</Label>{children}</div>; }
function patch(setter: React.Dispatch<React.SetStateAction<UpsertSubscriptionPlanRequest | null>>, values: Partial<UpsertSubscriptionPlanRequest>) { setter((current) => current ? ({ ...current, ...values }) : current); }
function emptyPlan(): UpsertSubscriptionPlanRequest { return { code: "", name: "", description: null, isActive: true, sortOrder: 50, legacyPlan: "Premium", monthlyPrice: 0, yearlyPrice: 0, currencyCode: "USD", maxUsers: 10, maxBranches: 2, maxProducts: 1000, maxOrdersPerMonth: 5000, maxStorageMb: 5120, enabledPermissions: [] }; }
function planTierLabel(plan: TenantPlan, t: ReturnType<typeof useI18n>["t"]) {
    const keys: Record<TenantPlan, string> = {
        Free: "plans.tier.Free",
        Premium: "plans.tier.Premium",
        Full: "plans.tier.Full",
        Enterprise: "plans.tier.Enterprise",
    };
    return t(keys[plan] as never);
}
function message(error: unknown, fallback: string) { return error instanceof Error ? error.message : fallback; }
