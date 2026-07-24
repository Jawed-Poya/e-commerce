import { useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    Building2,
    Crown,
    LoaderCircle,
    Package,
    Plus,
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
import { tenantService } from "@/features/tenancy/tenant-service";
import type {
    SubscriptionStatus,
    TenantPlan,
    TenantProfile,
} from "@/features/tenancy/tenant-types";
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

export default function PlatformTenantsPage() {
    const client = useQueryClient();
    const { t, language } = useI18n();
    const query = useQuery({
        queryKey: ["platform-tenants"],
        queryFn: tenantService.platformTenants,
    });
    const [open, setOpen] = useState(false);
    const [subscriptionTenant, setSubscriptionTenant] =
        useState<TenantProfile | null>(null);
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
        onError: (error) => toast.error(message(error, t("tenant.operationFailed"))),
    });
    const update = useMutation({
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
        onError: (error) => toast.error(message(error, t("tenant.operationFailed"))),
    });

    const editSubscription = (tenant: TenantProfile) => {
        setSubscriptionTenant(tenant);
        setSubscription({
            plan: tenant.subscription?.plan ?? "Free",
            status: tenant.subscription?.status ?? "Active",
            endsAt: tenant.subscription?.endsAt?.slice(0, 10) ?? "",
        });
    };

    const locale = language === "en" ? "en-US" : language === "ps" ? "ps-AF" : "fa-AF";

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
                                        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                                            <Building2 />
                                        </span>
                                        <div className="min-w-0">
                                            <h2 className="truncate font-bold">{item.name}</h2>
                                            <p className="truncate text-xs text-muted-foreground">
                                                {item.slug}
                                            </p>
                                        </div>
                                    </div>
                                    <Badge>{item.subscription?.plan ?? t("platform.noPlan")}</Badge>
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
                                        value={(item.subscription?.maxUsers ?? 0).toLocaleString(
                                            locale,
                                        )}
                                    />
                                    <Limit
                                        icon={<Package />}
                                        label={t("tenant.productsLimit")}
                                        value={(item.subscription?.maxProducts ?? 0).toLocaleString(
                                            locale,
                                        )}
                                    />
                                </div>
                                <div className="mt-5 flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
                                    <div>
                                        <p className="text-xs text-muted-foreground">
                                            {t("tenant.subscription")}
                                        </p>
                                        <p className="font-medium">
                                            {item.subscription?.status ?? "—"}
                                        </p>
                                    </div>
                                    <Button
                                        variant="outline"
                                        onClick={() => editSubscription(item)}
                                    >
                                        <Crown />
                                        {t("platform.managePlan")}
                                    </Button>
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
                                        slug: event.target.value
                                            .toLowerCase()
                                            .replace(/[^a-z0-9-]/g, "-"),
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
                                aria-invalid={Boolean(form.adminEmail) && !administratorEmailIsValid}
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
                                options={plans.map((value) => ({ value, label: value }))}
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
                                options={plans.map((value) => ({ value, label: value }))}
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
                            onClick={() => update.mutate()}
                            disabled={update.isPending}
                        >
                            {update.isPending && (
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

function Field({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="space-y-2">
            <Label>{label}</Label>
            {children}
        </div>
    );
}

function Limit({
    icon,
    label,
    value,
}: {
    icon: ReactNode;
    label: string;
    value: string;
}) {
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

function message(error: unknown, fallback: string) {
    return (
        (error as { response?: { data?: { message?: string } } })?.response?.data
            ?.message || (error instanceof Error ? error.message : fallback)
    );
}
