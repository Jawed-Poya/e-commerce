import { useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    ArchiveRestore,
    DatabaseBackup,
    DatabaseZap,
    HardDriveUpload,
    LoaderCircle,
    RefreshCw,
    Server,
    ShieldAlert,
    Sparkles,
    Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { SimpleCombobox } from "@/components/simple-combobox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAdminAuth } from "@/features/auth/auth-context";
import { hasPermission, Permissions } from "@/features/auth/permissions";
import { companyService } from "@/features/company/company-service";
import { maintenanceService } from "@/features/maintenance/maintenance-service";
import { useI18n } from "@/i18n/i18n-provider";
import { formatDecimal, toFiniteNumber } from "@/lib/numbers";

type ConfirmationAction =
    | { kind: "restore"; phrase: string; backupFileName: string }
    | { kind: "clear-branch"; phrase: string; branchId: number }
    | { kind: "clear-all"; phrase: string }
    | { kind: "seed"; phrase: string };

export default function DatabaseMaintenancePage() {
    const { tr, locale } = useI18n();
    const { user } = useAdminAuth();
    const queryClient = useQueryClient();
    const statusQuery = useQuery({ queryKey: ["maintenance", "status"], queryFn: maintenanceService.status });
    const companyQuery = useQuery({ queryKey: ["company", "profile"], queryFn: companyService.profile });
    const canBackup = hasPermission(user, Permissions.DatabaseBackup);
    const canRestore = hasPermission(user, Permissions.DatabaseRestore);
    const canClearBranch = hasPermission(user, Permissions.BranchDataClear);
    const canClearAll = hasPermission(user, Permissions.AllBusinessDataClear);
    const canSeed = hasPermission(user, Permissions.DemoDataSeed) && canClearAll;
    const backupsQuery = useQuery({
        queryKey: ["maintenance", "backups"],
        queryFn: maintenanceService.backups,
        enabled: (canBackup || canRestore) && statusQuery.data?.backupConfigured === true,
    });
    const [backupFileName, setBackupFileName] = useState<string | null>(null);
    const [branchId, setBranchId] = useState<number | null>(null);
    const [action, setAction] = useState<ConfirmationAction | null>(null);
    const [confirmation, setConfirmation] = useState("");

    const backups = backupsQuery.data ?? [];
    const selectedBackup = backupFileName ?? backups[0]?.fileName ?? null;
    const branches = companyQuery.data?.branches ?? [];
    const selectedBranch = branches.find((item) => item.id === branchId) ?? branches[0] ?? null;

    const backupMutation = useMutation({
        mutationFn: maintenanceService.createBackup,
        onSuccess: async (backup) => {
            toast.success(tr("Database backup created."));
            setBackupFileName(backup.fileName);
            await queryClient.invalidateQueries({ queryKey: ["maintenance", "backups"] });
        },
        onError: (error) => toast.error(tr(message(error))),
    });
    const actionMutation = useMutation({
        mutationFn: async (value: ConfirmationAction) => {
            if (value.kind === "restore") return maintenanceService.restore(value.backupFileName, confirmation);
            if (value.kind === "clear-branch") return maintenanceService.clear({ scope: "branch", branchId: value.branchId, confirmation });
            if (value.kind === "clear-all") return maintenanceService.clear({ scope: "all", confirmation });
            return maintenanceService.seedDemo(confirmation);
        },
        onSuccess: async (_result, value) => {
            toast.success(tr(value.kind === "restore"
                ? "Database restored. Refresh the application and sign in again."
                : value.kind === "seed"
                    ? "Professional demo data loaded."
                    : "Business data cleared."));
            setAction(null);
            setConfirmation("");
            await queryClient.invalidateQueries();
        },
        onError: (error) => toast.error(tr(message(error))),
    });

    const openAction = (value: ConfirmationAction) => {
        setAction(value);
        setConfirmation("");
    };
    const refresh = async () => {
        await statusQuery.refetch();
        if ((canBackup || canRestore) && statusQuery.data?.backupConfigured) {
            await backupsQuery.refetch();
        }
    };
    const confirmationMeta = useMemo(() => action ? actionCopy(action.kind, tr) : null, [action, tr]);

    if (statusQuery.isLoading) return <div className="grid min-h-[55vh] place-items-center"><LoaderCircle className="size-7 animate-spin text-primary" /></div>;
    if (statusQuery.isError || !statusQuery.data) {
        return <Alert variant="destructive"><ShieldAlert /><AlertTitle>{tr("Maintenance settings could not be loaded")}</AlertTitle><AlertDescription>{tr(message(statusQuery.error))}</AlertDescription></Alert>;
    }

    const status = statusQuery.data;
    return (
        <div className="space-y-5 sm:space-y-6">
            <PageHeader
                title={tr("Database maintenance")}
                description={tr("Back up, restore, seed, or clear business data using separate high-trust permissions and typed confirmations.")}
                actions={<Button variant="outline" size="sm" onClick={() => void refresh()}><RefreshCw />{tr("Refresh")}</Button>}
            />

            <Alert>
                <ShieldAlert />
                <AlertTitle>{tr("Protected maintenance area")}</AlertTitle>
                <AlertDescription>{tr("Company settings, branches, users, roles, and permissions are preserved when business data is cleared. Database restore replaces the complete database and should always start with a verified backup.")}</AlertDescription>
            </Alert>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatusCard icon={<Server />} label={tr("Database")} value={status.databaseName} detail={status.hostPlatform} />
                <StatusCard icon={<HardDriveUpload />} label={tr("Upload storage")} value={tr("Portable path")} detail={status.uploadDirectory} />
                <StatusCard icon={<DatabaseBackup />} label={tr("Backup")} value={status.backupConfigured ? tr("Configured") : tr("Not configured")} detail={status.backupDirectory ?? tr("Add DatabaseMaintenance:BackupDirectory")} />
                <StatusCard icon={<ArchiveRestore />} label={tr("Restore")} value={status.restoreEnabled ? tr("Enabled") : tr("Disabled")} detail={tr("Restore is opt-in for production safety")} />
            </div>

            <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,.65fr)]">
                <Card>
                    <CardHeader className="border-b bg-muted/20">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div><CardTitle className="flex items-center gap-2"><DatabaseBackup className="size-4 text-primary" />{tr("SQL Server backups")}</CardTitle><p className="mt-1 text-xs text-muted-foreground">{tr("Full copy-only backups stored on the SQL Server machine.")}</p></div>
                            <Button size="sm" disabled={!canBackup || !status.backupConfigured || backupMutation.isPending} onClick={() => backupMutation.mutate()}>{backupMutation.isPending ? <LoaderCircle className="animate-spin" /> : <DatabaseBackup />}{tr("Create backup")}</Button>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {!status.backupConfigured ? (
                            <div className="border border-dashed p-5 text-center text-xs text-muted-foreground">{tr("Configure a backup directory on the SQL Server host. Grant the SQL Server service account read/write access, then restart the API.")}</div>
                        ) : backupsQuery.isLoading ? (
                            <div className="grid min-h-32 place-items-center"><LoaderCircle className="animate-spin" /></div>
                        ) : backups.length ? backups.map((backup) => (
                            <button key={`${backup.fileName}-${backup.finishedAt}`} type="button" onClick={() => setBackupFileName(backup.fileName)} className={`flex w-full flex-col gap-2 border p-3 text-start transition-colors sm:flex-row sm:items-center sm:justify-between ${selectedBackup === backup.fileName ? "border-primary bg-primary/5" : "hover:bg-muted/40"}`}>
                                <span className="min-w-0"><b className="block truncate text-xs">{backup.fileName}</b><span className="mt-1 block text-[10px] text-muted-foreground">{new Date(backup.finishedAt ?? backup.startedAt).toLocaleString(locale)} · {formatBytes(backup.sizeBytes)}</span></span>
                                <Badge variant={selectedBackup === backup.fileName ? "default" : "outline"}>{backup.backupType}</Badge>
                            </button>
                        )) : <div className="border border-dashed p-5 text-center text-xs text-muted-foreground">{tr("No backups have been created from this database yet.")}</div>}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="border-b bg-muted/20"><CardTitle className="flex items-center gap-2"><ArchiveRestore className="size-4 text-primary" />{tr("Restore database")}</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2"><Label>{tr("Backup file")}</Label><SimpleCombobox value={selectedBackup} onValueChange={setBackupFileName} options={backups.map((item) => ({ value: item.fileName, label: item.fileName, description: formatBytes(item.sizeBytes) }))} placeholder={tr("Select backup")} emptyText={tr("No backup found")} /></div>
                        <p className="text-xs leading-5 text-muted-foreground">{tr("Restore verifies the backup, disconnects active database sessions, replaces the current database, and returns it to multi-user mode.")}</p>
                        <Button variant="destructive" className="w-full" disabled={!canRestore || !status.restoreEnabled || !selectedBackup} onClick={() => selectedBackup && openAction({ kind: "restore", backupFileName: selectedBackup, phrase: `RESTORE ${status.databaseName}` })}><ArchiveRestore />{tr("Restore selected backup")}</Button>
                    </CardContent>
                </Card>
            </div>

            <Card className="border-destructive/25">
                <CardHeader className="border-b border-destructive/20 bg-destructive/5"><CardTitle className="flex items-center gap-2 text-destructive"><DatabaseZap className="size-4" />{tr("Business data reset")}</CardTitle><p className="mt-1 text-xs text-muted-foreground">{tr("Permanent operations for test resets, branch closure, or loading a clean professional demo.")}</p></CardHeader>
                <CardContent className="grid gap-4 lg:grid-cols-3">
                    <ActionCard icon={<Trash2 />} title={tr("Clear one branch")} description={tr("Remove products, transactions, customers, staff, notifications, and audit data belonging to one branch.")} controls={<><SimpleCombobox<number> value={selectedBranch?.id ?? null} onValueChange={setBranchId} options={branches.map((item) => ({ value: item.id, label: item.name, description: item.code }))} placeholder={tr("Select branch")} /><Button variant="outline" disabled={!canClearBranch || !selectedBranch} onClick={() => selectedBranch && openAction({ kind: "clear-branch", branchId: selectedBranch.id, phrase: `CLEAR BRANCH ${selectedBranch.code}` })}>{tr("Clear branch")}</Button></>} />
                    <ActionCard icon={<DatabaseZap />} title={tr("Clear all business data")} description={tr("Remove business data from every branch while keeping company configuration and administrator access.")} controls={<Button variant="destructive" disabled={!canClearAll} onClick={() => openAction({ kind: "clear-all", phrase: "CLEAR ALL BUSINESS DATA" })}>{tr("Clear all business data")}</Button>} />
                    <ActionCard icon={<Sparkles />} title={tr("Load professional demo")} description={tr("Clear current business data and create 20 products, illustrated categories, 10 multi-item purchases, 10 multi-item sales, sample bills, orders, expenses, and staff examples.")} controls={<Button disabled={!canSeed} onClick={() => openAction({ kind: "seed", phrase: "LOAD DEMO DATA" })}><Sparkles />{tr("Load demo data")}</Button>} />
                </CardContent>
            </Card>

            <Dialog open={Boolean(action)} onOpenChange={(open) => { if (!open && !actionMutation.isPending) setAction(null); }}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader><DialogTitle>{confirmationMeta?.title}</DialogTitle><DialogDescription>{confirmationMeta?.description}</DialogDescription></DialogHeader>
                    {action ? <div className="space-y-3"><div className="bg-muted p-3 font-mono text-xs" dir="ltr">{action.phrase}</div><div className="space-y-2"><Label>{tr("Type the confirmation exactly")}</Label><Input autoFocus value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder={action.phrase} dir="ltr" autoComplete="off" /></div></div> : null}
                    <DialogFooter><Button variant="outline" disabled={actionMutation.isPending} onClick={() => setAction(null)}>{tr("Cancel")}</Button><Button variant="destructive" disabled={!action || confirmation !== action.phrase || actionMutation.isPending} onClick={() => action && actionMutation.mutate(action)}>{actionMutation.isPending ? <LoaderCircle className="animate-spin" /> : <ShieldAlert />}{confirmationMeta?.button}</Button></DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

function StatusCard({ icon, label, value, detail }: { icon: ReactNode; label: string; value: string; detail: string }) {
    return <Card size="sm"><CardContent className="flex min-w-0 items-start gap-3"><span className="grid size-9 shrink-0 place-items-center bg-primary/10 text-primary">{icon}</span><span className="min-w-0"><span className="block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</span><b className="mt-1 block truncate text-sm">{value}</b><span className="mt-1 block truncate text-[10px] text-muted-foreground" title={detail}>{detail}</span></span></CardContent></Card>;
}

function ActionCard({ icon, title, description, controls }: { icon: ReactNode; title: string; description: string; controls: ReactNode }) {
    return <section className="flex flex-col border bg-background p-4"><span className="grid size-9 place-items-center bg-destructive/10 text-destructive">{icon}</span><h3 className="mt-3 text-sm font-semibold">{title}</h3><p className="mt-1 flex-1 text-xs leading-5 text-muted-foreground">{description}</p><div className="mt-4 grid gap-2">{controls}</div></section>;
}

function actionCopy(kind: ConfirmationAction["kind"], tr: (value: string) => string) {
    if (kind === "restore") return { title: tr("Restore the database?"), description: tr("All current database content will be replaced by the selected backup. Active sessions will be disconnected."), button: tr("Restore database") };
    if (kind === "seed") return { title: tr("Replace data with demo records?"), description: tr("Current business data will be permanently cleared before realistic sample records are inserted."), button: tr("Load demo") };
    return { title: tr("Permanently clear business data?"), description: tr("This cannot be undone without restoring a database backup."), button: tr("Clear data") };
}

function formatBytes(value: number) {
    const safeValue = Math.max(0, toFiniteNumber(value));
    if (!safeValue) return "—";
    if (safeValue < 1024 * 1024) return `${formatDecimal(safeValue / 1024, 1)} KB`;
    if (safeValue < 1024 * 1024 * 1024) return `${formatDecimal(safeValue / 1024 / 1024, 1)} MB`;
    return `${formatDecimal(safeValue / 1024 / 1024 / 1024, 2)} GB`;
}

function message(error: unknown) {
    return (error as { response?: { data?: { message?: string } }; message?: string }).response?.data?.message ?? (error as Error)?.message ?? "The operation failed.";
}
