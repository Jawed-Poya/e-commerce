import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Globe2, LoaderCircle, Save, Settings2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { SimpleCombobox } from "@/components/simple-combobox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { tenantService } from "@/features/tenancy/tenant-service";
import type { PlatformSettings, TenantSiteRoutingMode } from "@/features/tenancy/tenant-types";
import { useI18n } from "@/i18n/i18n-provider";

export default function PlatformSettingsPage() {
    const { t } = useI18n();
    const client = useQueryClient();
    const query = useQuery({ queryKey: ["platform-settings"], queryFn: tenantService.platformSettings });
    const [form, setForm] = useState<PlatformSettings | null>(null);
    useEffect(() => { if (query.data) setForm({ ...query.data }); }, [query.data]);
    const mutation = useMutation({
        mutationFn: () => tenantService.updatePlatformSettings(form!),
        onSuccess: async (data) => {
            setForm(data); toast.success(t("platform.settingsUpdated"));
            await Promise.all([client.invalidateQueries({ queryKey: ["platform-settings"] }), client.invalidateQueries({ queryKey: ["platform-tenants"] })]);
        },
        onError: (error) => toast.error(error instanceof Error ? error.message : t("tenant.operationFailed")),
    });
    if (query.isLoading || !form) return <div className="grid min-h-64 place-items-center"><LoaderCircle className="animate-spin" /></div>;
    return <div className="space-y-6">
        <PageHeader title={t("platform.settingsTitle")} description={t("platform.settingsDescription")} actions={<Button onClick={() => mutation.mutate()} disabled={mutation.isPending}><Save />{t("tenant.save")}</Button>} />
        <Alert><Globe2 /><AlertTitle>{t("platform.linkSystemTitle")}</AlertTitle><AlertDescription>{t("platform.linkSystemHelp")}</AlertDescription></Alert>
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
            <Card><CardHeader><CardTitle className="flex items-center gap-2"><Settings2 className="size-5 text-primary" />{t("platform.routingDefaults")}</CardTitle></CardHeader><CardContent className="grid gap-5 sm:grid-cols-2">
                <Field label={t("platform.storefrontBaseUrl")} help={t("platform.storefrontBaseUrlHelp")}><Input dir="ltr" value={form.storefrontBaseUrl} onChange={(e) => setForm((v) => v && ({ ...v, storefrontBaseUrl: e.target.value }))} placeholder="https://shop.example.com" /></Field>
                <Field label={t("platform.adminBaseUrl")} help={t("platform.adminBaseUrlHelp")}><Input dir="ltr" value={form.adminBaseUrl} onChange={(e) => setForm((v) => v && ({ ...v, adminBaseUrl: e.target.value }))} placeholder="https://admin.example.com" /></Field>
                <Field label={t("platform.rootDomain")} help={t("platform.rootDomainHelp")}><Input dir="ltr" value={form.rootDomain ?? ""} onChange={(e) => setForm((v) => v && ({ ...v, rootDomain: e.target.value || null }))} placeholder="example.com" /></Field>
                <Field label={t("platform.defaultRouting")} help={t("platform.defaultRoutingHelp")}><SimpleCombobox value={form.defaultRoutingMode} onValueChange={(value) => value && setForm((v) => v && ({ ...v, defaultRoutingMode: value as TenantSiteRoutingMode }))} options={[{ value: "QueryString", label: t("platform.routing.query") }, { value: "Subdomain", label: t("platform.routing.subdomain") }, { value: "CustomDomain", label: t("platform.routing.custom") }]} /></Field>
                <div className="flex items-center justify-between rounded-xl border p-4 sm:col-span-2"><div><Label>{t("platform.allowCustomDomains")}</Label><p className="mt-1 text-xs text-muted-foreground">{t("platform.allowCustomDomainsHelp")}</p></div><Switch checked={form.allowCustomDomains} onCheckedChange={(value) => setForm((v) => v && ({ ...v, allowCustomDomains: value }))} /></div>
            </CardContent></Card>
            <Card><CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="size-5 text-primary" />{t("platform.routingExamples")}</CardTitle></CardHeader><CardContent className="space-y-4 text-sm">
                <Example title={t("platform.routing.query")} value={`${form.storefrontBaseUrl}${form.storefrontBaseUrl.includes("?") ? "&" : "?"}tenant=acme`} />
                <Example title={t("platform.routing.subdomain")} value={form.rootDomain ? `https://acme.${form.rootDomain}` : t("platform.configureRootDomain")} />
                <Example title={t("platform.routing.custom")} value="https://shop.acme.com" />
                <Button variant="outline" className="w-full" asChild><a href={form.storefrontBaseUrl} target="_blank" rel="noreferrer"><ExternalLink />{t("platform.openStorefrontBase")}</a></Button>
            </CardContent></Card>
        </div>
    </div>;
}
function Field({ label, help, children }: { label: string; help: string; children: React.ReactNode }) { return <div className="min-w-0 space-y-2"><Label>{label}</Label>{children}<p className="text-xs leading-5 text-muted-foreground">{help}</p></div>; }
function Example({ title, value }: { title: string; value: string }) { return <div className="rounded-xl border bg-muted/30 p-3"><p className="text-xs font-semibold text-muted-foreground">{title}</p><p className="mt-1 break-all font-mono text-xs" dir="ltr">{value}</p></div>; }
