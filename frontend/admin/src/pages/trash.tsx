import { useMemo, useState, type ComponentType } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    Boxes,
    Building2,
    Clock3,
    FileText,
    FileX2,
    LoaderCircle,
    Package,
    ReceiptText,
    RotateCcw,
    Search,
    ShoppingCart,
    Trash2,
    UserRound,
    UsersRound,
    Warehouse,
} from "lucide-react";
import { toast } from "sonner";
import { ConfirmActionDialog } from "@/components/confirm-action-dialog";
import { PageHeader } from "@/components/page-header";
import { SimpleCombobox } from "@/components/simple-combobox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { tenantService } from "@/features/tenancy/tenant-service";
import type { TrashItem } from "@/features/tenancy/tenant-types";
import { useI18n } from "@/i18n/i18n-provider";

export default function TrashPage() {
    const client = useQueryClient();
    const { t, language } = useI18n();
    const [search, setSearch] = useState("");
    const [type, setType] = useState("");
    const [branchId, setBranchId] = useState("");
    const [selected, setSelected] = useState<TrashItem | null>(null);
    const query = useQuery({
        queryKey: ["tenant-trash", search, type, branchId],
        queryFn: () =>
            tenantService.trash({
                search: search || undefined,
                entityType: type || undefined,
                branchId: branchId ? Number(branchId) : undefined,
            }),
    });
    const types = useMemo(
        () => [...new Set(query.data?.map((item) => item.entityType) ?? [])].sort(),
        [query.data],
    );
    const branches = useMemo(
        () =>
            [...new Map(
                (query.data ?? [])
                    .filter((item) => item.branchId && item.branchName)
                    .map((item) => [item.branchId!, item.branchName!]),
            ).entries()].sort((left, right) => left[1].localeCompare(right[1])),
        [query.data],
    );
    const refresh = () =>
        client.invalidateQueries({ queryKey: ["tenant-trash"] });
    const restore = useMutation({
        mutationFn: tenantService.restoreTrash,
        onSuccess: async () => {
            toast.success(t("trash.restored"));
            setSelected(null);
            await refresh();
        },
        onError: (error) => toast.error(message(error, t("tenant.operationFailed"))),
    });
    const purge = useMutation({
        mutationFn: tenantService.purgeTrash,
        onSuccess: async () => {
            toast.success(t("trash.purged"));
            setSelected(null);
            await refresh();
        },
        onError: (error) => toast.error(message(error, t("tenant.operationFailed"))),
    });

    const locale = language === "en" ? "en-US" : language === "ps" ? "ps-AF" : "fa-AF";

    return (
        <div className="space-y-6">
            <PageHeader
                title={t("trash.title")}
                description={t("trash.description")}
            />
            <Card>
                <CardContent className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-[1fr_220px_220px_auto]">
                    <div className="relative md:col-span-2 xl:col-span-1">
                        <Search className="absolute start-3 top-2.5 size-4 text-muted-foreground" />
                        <Input
                            className="ps-9"
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder={t("trash.search")}
                        />
                    </div>
                    <SimpleCombobox
                        value={type}
                        onValueChange={(value) => setType(value ?? "")}
                        options={[
                            { value: "", label: t("trash.allTypes") },
                            ...types.map((value) => ({
                                value,
                                label: human(value),
                            })),
                        ]}
                    />
                    <SimpleCombobox
                        value={branchId}
                        onValueChange={(value) => setBranchId(value ?? "")}
                        options={[
                            { value: "", label: t("reports.allBranches") },
                            ...branches.map(([id, name]) => ({
                                value: String(id),
                                label: name,
                            })),
                        ]}
                    />
                    <Button variant="outline" onClick={() => query.refetch()}>
                        {t("trash.refresh")}
                    </Button>
                </CardContent>
            </Card>

            {query.isLoading ? (
                <div className="grid min-h-56 place-items-center">
                    <LoaderCircle className="animate-spin" />
                </div>
            ) : query.data?.length ? (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {query.data.map((item) => (
                        <TrashCard
                            key={item.id}
                            item={item}
                            locale={locale}
                            restoring={restore.isPending}
                            purging={purge.isPending}
                            onInspect={() => setSelected(item)}
                            onRestore={() => restore.mutate(item.id)}
                            onPurge={() => purge.mutate(item.id)}
                        />
                    ))}
                </div>
            ) : (
                <Card>
                    <CardContent className="grid min-h-56 place-items-center text-center">
                        <div>
                            <FileX2 className="mx-auto size-10 text-muted-foreground" />
                            <h2 className="mt-4 font-bold">{t("trash.empty")}</h2>
                            <p className="mt-1 text-sm text-muted-foreground">
                                {t("trash.emptyHelp")}
                            </p>
                        </div>
                    </CardContent>
                </Card>
            )}

            <TrashDetailsDialog
                item={selected}
                locale={locale}
                open={Boolean(selected)}
                onOpenChange={(open) => !open && setSelected(null)}
            />
        </div>
    );
}

function TrashCard({
    item,
    locale,
    restoring,
    purging,
    onInspect,
    onRestore,
    onPurge,
}: {
    item: TrashItem;
    locale: string;
    restoring: boolean;
    purging: boolean;
    onInspect: () => void;
    onRestore: () => void;
    onPurge: () => void;
}) {
    const { t } = useI18n();
    const Icon = iconFor(item.entityType);
    return (
        <Card className="overflow-hidden">
            <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-destructive/10 text-destructive">
                            <Icon className="size-5" />
                        </span>
                        <div className="min-w-0">
                            <Badge variant="secondary">{human(item.entityType)}</Badge>
                            <h3 className="mt-2 truncate text-lg font-bold">
                                {item.displayName}
                            </h3>
                            <p className="mt-1 text-xs text-muted-foreground">
                                {t("trash.identifier")} {item.entityId}
                                {item.branchName ? ` · ${item.branchName}` : ""}
                            </p>
                        </div>
                    </div>
                    <Trash2 className="size-5 shrink-0 text-destructive" />
                </div>
                <div className="mt-5 space-y-2 border-y py-4 text-xs text-muted-foreground">
                    <p>
                        {t("trash.deleted")} {new Intl.DateTimeFormat(locale, {
                            dateStyle: "medium",
                            timeStyle: "short",
                        }).format(new Date(item.deletedAt))}
                    </p>
                    <p className="flex items-center gap-2">
                        <Clock3 className="size-3.5" />
                        {t("trash.scheduled")} {new Intl.DateTimeFormat(locale, {
                            dateStyle: "medium",
                        }).format(new Date(item.scheduledPurgeAt))}
                    </p>
                    {item.deletedByName && (
                        <p>
                            {t("trash.by")} {item.deletedByName}
                        </p>
                    )}
                </div>
                <div className="mt-4 grid grid-cols-[1fr_auto_auto] gap-2">
                    <Button variant="ghost" onClick={onInspect}>
                        <FileText />
                        {t("trash.details")}
                    </Button>
                    <Button
                        size="icon"
                        variant="outline"
                        onClick={onRestore}
                        disabled={restoring}
                        aria-label={t("trash.restore")}
                    >
                        {restoring ? (
                            <LoaderCircle className="animate-spin" />
                        ) : (
                            <RotateCcw />
                        )}
                    </Button>
                    <ConfirmActionDialog
                        title={t("trash.deleteTitle")}
                        description={t("trash.deleteDescription")}
                        confirmLabel={t("trash.deleteForever")}
                        onConfirm={onPurge}
                        trigger={
                            <Button
                                size="icon"
                                variant="destructive"
                                disabled={purging}
                                aria-label={t("trash.deleteForever")}
                            >
                                {purging ? (
                                    <LoaderCircle className="animate-spin" />
                                ) : (
                                    <Trash2 />
                                )}
                            </Button>
                        }
                    />
                </div>
            </CardContent>
        </Card>
    );
}

function TrashDetailsDialog({
    item,
    locale,
    open,
    onOpenChange,
}: {
    item: TrashItem | null;
    locale: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const { t } = useI18n();
    const fields = snapshotFields(item?.snapshotJson);
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>{item?.displayName ?? t("trash.details")}</DialogTitle>
                    <DialogDescription>
                        {item
                            ? `${human(item.entityType)} · ${t("trash.identifier")} ${item.entityId}`
                            : t("trash.description")}
                    </DialogDescription>
                </DialogHeader>
                {item && (
                    <div className="space-y-4">
                        <div className="grid gap-3 rounded-xl border bg-muted/30 p-4 sm:grid-cols-2">
                            <Detail label={t("trash.deleted")}>
                                {new Intl.DateTimeFormat(locale, {
                                    dateStyle: "medium",
                                    timeStyle: "short",
                                }).format(new Date(item.deletedAt))}
                            </Detail>
                            <Detail label={t("trash.scheduled")}>
                                {new Intl.DateTimeFormat(locale, {
                                    dateStyle: "medium",
                                }).format(new Date(item.scheduledPurgeAt))}
                            </Detail>
                            <Detail label={t("reports.branchColumn")}>
                                {item.branchName ?? t("reports.company")}
                            </Detail>
                            <Detail label={t("trash.by")}>
                                {item.deletedByName ?? "—"}
                            </Detail>
                        </div>
                        <div className="space-y-2">
                            <h3 className="font-semibold">{t("trash.snapshot")}</h3>
                            {fields.length ? (
                                <div className="grid gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-2">
                                    {fields.map(([key, value]) => (
                                        <div key={key} className="min-w-0 bg-background p-3">
                                            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                                                {human(key)}
                                            </p>
                                            <p className="mt-1 break-words text-sm font-medium">
                                                {value}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-muted-foreground">
                                    {t("trash.noSnapshot")}
                                </p>
                            )}
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}

function Detail({ label, children }: { label: string; children: string }) {
    return (
        <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-1 text-sm font-medium">{children}</p>
        </div>
    );
}

function snapshotFields(snapshot: string | null | undefined): [string, string][] {
    if (!snapshot) return [];
    try {
        const parsed = JSON.parse(snapshot) as Record<string, unknown>;
        return Object.entries(parsed)
            .filter(([, value]) =>
                ["string", "number", "boolean"].includes(typeof value),
            )
            .slice(0, 16)
            .map(([key, value]) => [key, String(value)]);
    } catch {
        return [];
    }
}

function iconFor(type: string): ComponentType<{ className?: string }> {
    const icons: Record<string, ComponentType<{ className?: string }>> = {
        Product: Package,
        Customer: UserRound,
        Order: ShoppingCart,
        GeneralType: Boxes,
        Supplier: Building2,
        Purchase: ReceiptText,
        InventorySale: ReceiptText,
        Staff: UsersRound,
        StaffSalaryPayment: ReceiptText,
        Expense: ReceiptText,
        Warehouse,
    };
    return icons[type] ?? FileText;
}

function human(value: string) {
    return value.replace(/([a-z])([A-Z])/g, "$1 $2");
}

function message(error: unknown, fallback: string) {
    return (
        (error as { response?: { data?: { message?: string } } })?.response?.data
            ?.message || (error instanceof Error ? error.message : fallback)
    );
}
