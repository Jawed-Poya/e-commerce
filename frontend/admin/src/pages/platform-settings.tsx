import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, LoaderCircle, Save, Server, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { tenantService } from "@/features/tenancy/tenant-service";
import type { PlatformSettings } from "@/features/tenancy/tenant-types";
import { useI18n } from "@/i18n/i18n-provider";

export default function PlatformSettingsPage() {
    const { t } = useI18n();
    const client = useQueryClient();
    const query = useQuery({ queryKey: ["platform-settings"], queryFn: tenantService.platformSettings });
    const [form, setForm] = useState<PlatformSettings | null>(null);
    useEffect(() => { if (query.data) setForm({ ...query.data, rootDomain: null, defaultRoutingMode: "PlatformPath", allowCustomDomains: false }); }, [query.data]);
    const mutation = useMutation({
        mutationFn: () => tenantService.updatePlatformSettings(form!),
        onSuccess: async (data) => {
            setForm(data);
            toast.success(t("platform.settingsUpdated"));
            await Promise.all([
                client.invalidateQueries({ queryKey: ["platform-settings"] }),
                client.invalidateQueries({ queryKey: ["platform-tenants"] }),
            ]);
        },
        onError: (error) => toast.error(error instanceof Error ? error.message : t("tenant.operationFailed")),
    });
    if (query.isLoading || !form) return <div className="grid min-h-64 place-items-center"><LoaderCircle className="animate-spin" /></div>;

    return (
        <div className="space-y-6">
            <PageHeader
                title={t("platform.settingsTitle")}
                description={t("platform.singleHostSettingsDescription")}
                actions={<Button onClick={() => mutation.mutate()} disabled={mutation.isPending}><Save />{t("tenant.save")}</Button>}
            />
            <Alert>
                <ShieldCheck />
                <AlertTitle>{t("platform.singleHostTitle")}</AlertTitle>
                <AlertDescription>{t("platform.singleHostDescription")}</AlertDescription>
            </Alert>
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
                <Card>
                    <CardHeader><CardTitle className="flex items-center gap-2"><Server className="size-5 text-primary" />{t("platform.sharedHosts")}</CardTitle></CardHeader>
                    <CardContent className="grid gap-5 md:grid-cols-2">
                        <Field label={t("platform.storefrontBaseUrl")} help={t("platform.storefrontBaseUrlSingleHelp")}>
                            <Input dir="ltr" value={form.storefrontBaseUrl} onChange={(event) => setForm((value) => value && ({ ...value, storefrontBaseUrl: event.target.value }))} placeholder="https://shop.example.com" />
                        </Field>
                        <Field label={t("platform.adminBaseUrl")} help={t("platform.adminBaseUrlSingleHelp")}>
                            <Input dir="ltr" value={form.adminBaseUrl} onChange={(event) => setForm((value) => value && ({ ...value, adminBaseUrl: event.target.value }))} placeholder="https://admin.example.com" />
                        </Field>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader><CardTitle>{t("platform.accessFlow")}</CardTitle></CardHeader>
                    <CardContent className="space-y-4 text-sm leading-6 text-muted-foreground">
                        <p>{t("platform.accessFlowAdmin")}</p>
                        <p>{t("platform.accessFlowStorefront")}</p>
                        <p>{t("platform.accessFlowPreview")}</p>
                        <Button
                            variant="outline"
                            className="w-full"
                            render={<a href={form.storefrontBaseUrl} target="_blank" rel="noreferrer" />}
                        >
                            <ExternalLink />{t("platform.openStorefrontBase")}
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

function Field({ label, help, children }: { label: string; help: string; children: React.ReactNode }) {
    return <div className="min-w-0 space-y-2"><Label>{label}</Label>{children}<p className="text-xs leading-5 text-muted-foreground">{help}</p></div>;
}
