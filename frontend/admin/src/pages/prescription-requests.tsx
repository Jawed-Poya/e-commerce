import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    CheckCircle2,
    Clock3,
    Download,
    FileImage,
    FileText,
    LoaderCircle,
    Mail,
    Phone,
    Search,
    ShieldCheck,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { SimpleCombobox } from "@/components/simple-combobox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useAdminAuth } from "@/features/auth/auth-context";
import { hasPermission, Permissions } from "@/features/auth/permissions";
import { prescriptionService } from "@/features/prescriptions/prescription-service";
import type {
    AdminPrescriptionRequest,
    PrescriptionRequestStatus,
} from "@/features/prescriptions/prescription-types";
import { useI18n } from "@/i18n/i18n-provider";
import { cn } from "@/lib/utils";

const statusDefinitions: {
    value: PrescriptionRequestStatus;
    label: string;
}[] = [
    { value: "Pending", label: "Pending" },
    { value: "Reviewing", label: "Reviewing" },
    { value: "Contacted", label: "Contacted" },
    { value: "Completed", label: "Completed" },
    { value: "Rejected", label: "Rejected" },
];

export default function PrescriptionRequestsPage() {
    const queryClient = useQueryClient();
    const { user } = useAdminAuth();
    const { tr } = useI18n();
    const canManage = hasPermission(user, Permissions.OrdersManage);
    const statusOptions = useMemo(
        () => statusDefinitions.map((item) => ({ ...item, label: tr(item.label) })),
        [tr],
    );
    const [search, setSearch] = useState("");
    const [debounced, setDebounced] = useState("");
    const [status, setStatus] = useState<PrescriptionRequestStatus | null>(null);
    const [page, setPage] = useState(1);

    useEffect(() => {
        const timer = window.setTimeout(() => setDebounced(search.trim()), 250);
        return () => window.clearTimeout(timer);
    }, [search]);

    useEffect(() => setPage(1), [debounced, status]);

    const requests = useQuery({
        queryKey: ["admin-prescription-requests", debounced, status, page],
        queryFn: () =>
            prescriptionService.list({
                search: debounced || undefined,
                status: status ?? undefined,
                page,
                pageSize: 12,
            }),
    });

    const update = useMutation({
        mutationFn: ({
            id,
            value,
        }: {
            id: number;
            value: {
                status: PrescriptionRequestStatus;
                adminNotes?: string | null;
            };
        }) => prescriptionService.updateStatus(id, value),
        onSuccess: async () => {
            toast.success(tr("Prescription request updated."));
            await queryClient.invalidateQueries({
                queryKey: ["admin-prescription-requests"],
            });
        },
        onError: (error) => toast.error(errorMessage(error, tr)),
    });

    return (
        <div className="space-y-5">
            <PageHeader
                title={tr("Prescription requests")}
                description={tr(
                    "Review customer prescription uploads, contact the customer, and track each request through completion.",
                )}
            />

            <Card className="border-primary/20 bg-primary/5">
                <CardContent className="flex gap-3 p-5">
                    <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" />
                    <div>
                        <p className="font-semibold">
                            {tr("Private medical attachment workflow")}
                        </p>
                        <p className="mt-1 text-sm leading-6 text-muted-foreground">
                            {tr(
                                "Attachments are stored outside the public web folder and can only be downloaded by authorized order staff.",
                            )}
                        </p>
                    </div>
                </CardContent>
            </Card>

            <div className="grid gap-3 rounded-2xl border bg-card p-4 md:grid-cols-[minmax(0,1fr)_260px]">
                <div className="relative">
                    <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder={tr(
                            "Search request number, customer, phone, or email...",
                        )}
                        className="ps-9"
                    />
                </div>
                <SimpleCombobox
                    value={status}
                    onValueChange={setStatus}
                    options={statusOptions}
                    placeholder={tr("All statuses")}
                    emptyText={tr("No status found.")}
                />
            </div>

            {requests.isLoading ? (
                <div className="grid gap-4 xl:grid-cols-2">
                    {Array.from({ length: 4 }).map((_, index) => (
                        <Skeleton key={index} className="h-80 rounded-2xl" />
                    ))}
                </div>
            ) : requests.isError ? (
                <Card className="border-destructive/30 bg-destructive/5">
                    <CardContent className="p-8 text-center text-sm text-destructive">
                        {tr(
                            "Prescription requests could not be loaded. Check the API and try again.",
                        )}
                    </CardContent>
                </Card>
            ) : requests.data?.items.length ? (
                <div className="grid gap-4 xl:grid-cols-2">
                    {requests.data.items.map((request) => (
                        <PrescriptionRequestCard
                            key={request.id}
                            request={request}
                            canManage={canManage}
                            pending={
                                update.isPending &&
                                update.variables?.id === request.id
                            }
                            statusOptions={statusOptions}
                            onSave={(value) =>
                                update.mutate({ id: request.id, value })
                            }
                        />
                    ))}
                </div>
            ) : (
                <Card>
                    <CardContent className="px-6 py-16 text-center">
                        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-muted text-muted-foreground">
                            <FileText className="size-6" />
                        </span>
                        <h2 className="mt-4 text-lg font-black">
                            {tr("No prescription requests found")}
                        </h2>
                        <p className="mt-2 text-sm text-muted-foreground">
                            {tr(
                                "New customer prescription uploads will appear here.",
                            )}
                        </p>
                    </CardContent>
                </Card>
            )}

            {(requests.data?.totalPages ?? 1) > 1 ? (
                <div className="flex items-center justify-between gap-3 rounded-2xl border bg-card px-4 py-3">
                    <span className="text-sm text-muted-foreground">
                        {tr("Page")} {requests.data?.page} {tr("of")}{" "}
                        {requests.data?.totalPages} · {requests.data?.totalCount}{" "}
                        {tr("requests")}
                    </span>
                    <div className="flex gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            disabled={page <= 1}
                            onClick={() =>
                                setPage((current) => Math.max(1, current - 1))
                            }
                        >
                            {tr("Previous")}
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            disabled={page >= (requests.data?.totalPages ?? 1)}
                            onClick={() => setPage((current) => current + 1)}
                        >
                            {tr("Next")}
                        </Button>
                    </div>
                </div>
            ) : null}
        </div>
    );
}

function PrescriptionRequestCard({
    request,
    canManage,
    pending,
    statusOptions,
    onSave,
}: {
    request: AdminPrescriptionRequest;
    canManage: boolean;
    pending: boolean;
    statusOptions: { value: PrescriptionRequestStatus; label: string }[];
    onSave: (value: {
        status: PrescriptionRequestStatus;
        adminNotes?: string | null;
    }) => void;
}) {
    const { tr, language } = useI18n();
    const [status, setStatus] = useState<PrescriptionRequestStatus>(
        request.status,
    );
    const [adminNotes, setAdminNotes] = useState(request.adminNotes ?? "");
    const download = useMutation({
        mutationFn: () => prescriptionService.downloadAttachment(request.id),
        onError: (error) => toast.error(errorMessage(error, tr)),
    });

    useEffect(() => {
        setStatus(request.status);
        setAdminNotes(request.adminNotes ?? "");
    }, [request.adminNotes, request.status]);

    const changed =
        status !== request.status ||
        adminNotes.trim() !== (request.adminNotes ?? "");

    return (
        <Card className="overflow-hidden">
            <CardContent className="space-y-5 p-5">
                <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <StatusBadge
                                status={request.status}
                                options={statusOptions}
                            />
                            <Badge
                                variant="outline"
                                className="font-mono text-[11px]"
                            >
                                {request.requestNumber}
                            </Badge>
                        </div>
                        <h2 className="mt-3 truncate text-lg font-black">
                            {request.fullName}
                        </h2>
                        <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Clock3 className="size-3.5" />
                            {new Date(request.createdAt).toLocaleString(
                                language === "en" ? "en-US" : "fa-AF",
                            )}
                        </p>
                    </div>
                    <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
                        {request.contentType === "application/pdf" ? (
                            <FileText className="size-5" />
                        ) : (
                            <FileImage className="size-5" />
                        )}
                    </span>
                </div>

                <div className="grid gap-2 text-sm sm:grid-cols-2">
                    <a
                        href={`tel:${request.phone}`}
                        className="flex items-center gap-2 rounded-xl border bg-muted/20 p-3 transition hover:border-primary/30 hover:text-primary"
                    >
                        <Phone className="size-4" />
                        <span className="truncate">{request.phone}</span>
                    </a>
                    {request.email ? (
                        <a
                            href={`mailto:${request.email}`}
                            className="flex items-center gap-2 rounded-xl border bg-muted/20 p-3 transition hover:border-primary/30 hover:text-primary"
                        >
                            <Mail className="size-4" />
                            <span className="truncate">{request.email}</span>
                        </a>
                    ) : (
                        <div className="flex items-center gap-2 rounded-xl border bg-muted/20 p-3 text-muted-foreground">
                            <Mail className="size-4" /> {tr("No email provided")}
                        </div>
                    )}
                </div>

                <div className="rounded-xl border bg-muted/20 p-4">
                    <p className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">
                        {tr("Customer note")}
                    </p>
                    <p className="mt-2 whitespace-pre-line text-sm leading-6">
                        {request.notes || tr("No additional note was provided.")}
                    </p>
                </div>

                <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-between"
                    disabled={download.isPending}
                    onClick={() => download.mutate()}
                >
                    <span className="min-w-0 truncate">
                        {request.originalFileName}
                    </span>
                    <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                        {formatFileSize(request.fileSize)}
                        {download.isPending ? (
                            <LoaderCircle className="size-4 animate-spin" />
                        ) : (
                            <Download className="size-4" />
                        )}
                    </span>
                </Button>

                <div className="grid gap-3 border-t pt-4">
                    <SimpleCombobox
                        value={status}
                        onValueChange={(value) => value && setStatus(value)}
                        options={statusOptions}
                        disabled={!canManage || pending}
                    />
                    <Textarea
                        value={adminNotes}
                        onChange={(event) => setAdminNotes(event.target.value)}
                        placeholder={tr("Internal follow-up notes...")}
                        disabled={!canManage || pending}
                        maxLength={1500}
                    />
                    {canManage ? (
                        <Button
                            type="button"
                            disabled={!changed || pending}
                            onClick={() =>
                                onSave({
                                    status,
                                    adminNotes: adminNotes.trim() || null,
                                })
                            }
                        >
                            {pending ? (
                                <LoaderCircle className="size-4 animate-spin" />
                            ) : (
                                <CheckCircle2 className="size-4" />
                            )}
                            {tr("Save request status")}
                        </Button>
                    ) : null}
                </div>
            </CardContent>
        </Card>
    );
}

function StatusBadge({
    status,
    options,
}: {
    status: PrescriptionRequestStatus;
    options: { value: PrescriptionRequestStatus; label: string }[];
}) {
    const option = options.find((item) => item.value === status);
    return (
        <Badge
            className={cn(
                status === "Pending" && "bg-amber-500 text-white hover:bg-amber-500",
                status === "Reviewing" && "bg-blue-600 text-white hover:bg-blue-600",
                status === "Contacted" && "bg-violet-600 text-white hover:bg-violet-600",
                status === "Completed" && "bg-emerald-600 text-white hover:bg-emerald-600",
                status === "Rejected" && "bg-slate-600 text-white hover:bg-slate-600",
            )}
        >
            {option?.label ?? "—"}
        </Badge>
    );
}

function formatFileSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function errorMessage(error: unknown, tr: (text: string) => string) {
    if (typeof error === "object" && error && "message" in error)
        return String(error.message);
    return tr("The prescription request operation failed.");
}
