import { useDeferredValue, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, BarChart3, ChevronDown, Clock3, Globe2, ListFilter, LoaderCircle, Search, ShieldCheck, UserCheck, Users } from "lucide-react";
import { Link } from "react-router-dom";

import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { useI18n } from "@/i18n/i18n-provider";
import { toFiniteNumber } from "@/lib/numbers";
import { auditService } from "./audit-service";
import {
    AuditActions,
    type AuditAction,
    type ActivityLogItem,
    type CustomerVisitItem,
} from "./audit-types";

const PageSize = 50;

export default function AuditPage() {
    const { tr } = useI18n();
    const [view, setView] = useState<"activities" | "visits">("activities");
    const [search, setSearch] = useState("");
    const [action, setAction] = useState<AuditAction | "">("");
    const [page, setPage] = useState(1);
    const deferredSearch = useDeferredValue(search.trim());

    useEffect(() => setPage(1), [view, deferredSearch, action]);

    const activities = useQuery({
        queryKey: ["audit", "activities", deferredSearch, action, page],
        queryFn: async () => (await auditService.activities(deferredSearch, action, page, PageSize)).data,
        enabled: view === "activities",
    });
    const visits = useQuery({
        queryKey: ["audit", "visits", deferredSearch, page],
        queryFn: async () => (await auditService.visits(deferredSearch, page, PageSize)).data,
        enabled: view === "visits",
    });
    const analytics = useQuery({
        queryKey: ["audit", "visit-analytics"],
        queryFn: async () => (await auditService.visitAnalytics()).data,
        enabled: view === "visits",
        refetchInterval: 5_000,
        refetchIntervalInBackground: false,
        refetchOnWindowFocus: true,
    });

    const activeQuery = view === "activities" ? activities : visits;
    const total = view === "activities" ? activities.data?.total ?? 0 : visits.data?.total ?? 0;
    const shown = view === "activities" ? activities.data?.items.length ?? 0 : visits.data?.items.length ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / PageSize));

    return (
        <div className="space-y-6">
            <PageHeader
                title={tr("Audit and visitor logs")}
                description={tr("Review administrator changes and privacy-conscious storefront visit metadata from one searchable history.")}
            />

            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="inline-flex w-fit rounded-xl bg-muted p-1">
                    <Button
                        size="sm"
                        variant={view === "activities" ? "default" : "ghost"}
                        onClick={() => setView("activities")}
                    >
                        <Activity className="me-2 size-4" />
                        {tr("User activity")}
                    </Button>
                    <Button
                        size="sm"
                        variant={view === "visits" ? "default" : "ghost"}
                        onClick={() => setView("visits")}
                    >
                        <Globe2 className="me-2 size-4" />
                        {tr("Customer visits")}
                    </Button>
                </div>
                <div className="flex w-full flex-col gap-2 sm:flex-row lg:max-w-2xl lg:justify-end">
                    {view === "activities" ? (
                        <DropdownMenu>
                            <DropdownMenuTrigger
                                render={
                                    <Button
                                        variant="outline"
                                        className="justify-between sm:min-w-44"
                                    />
                                }
                            >
                                <span className="flex items-center gap-2">
                                    <ListFilter className="size-4" />
                                    {action ? tr(action) : tr("All actions")}
                                </span>
                                <ChevronDown className="size-4 text-muted-foreground" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="max-h-80 min-w-56 overflow-y-auto">
                                <DropdownMenuLabel>{tr("Filter by action")}</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => setAction("")}>
                                    {tr("All actions")}
                                </DropdownMenuItem>
                                {AuditActions.map((item) => (
                                    <DropdownMenuItem key={item} onClick={() => setAction(item)}>
                                        <ActionBadge action={item} />
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    ) : null}
                    <div className="relative min-w-0 flex-1">
                        <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            className="ps-9"
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder={tr(
                                view === "activities"
                                    ? "Search user, action, route or IP…"
                                    : "Search customer, page, browser or IP…",
                            )}
                        />
                    </div>
                </div>
            </div>

            {view === "visits" && analytics.data ? (
                <VisitorCrm analytics={analytics.data} />
            ) : null}

            <Card className="overflow-hidden shadow-none">
                <CardContent className="p-0">
                    {activeQuery.isLoading ? (
                        <div className="grid min-h-64 place-items-center">
                            <LoaderCircle className="size-6 animate-spin" />
                        </div>
                    ) : activeQuery.isError ? (
                        <div className="grid min-h-64 place-items-center px-6 text-center">
                            <div>
                                <p className="font-medium text-destructive">{tr("Audit records could not be loaded.")}</p>
                                <Button className="mt-4" variant="outline" onClick={() => void activeQuery.refetch()}>
                                    {tr("Try again")}
                                </Button>
                            </div>
                        </div>
                    ) : view === "activities" ? (
                        <ActivityTable items={activities.data?.items ?? []} />
                    ) : (
                        <VisitTable items={visits.data?.items ?? []} />
                    )}
                </CardContent>
            </Card>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm leading-6 text-muted-foreground">
                    {tr("Showing")} {shown} {tr("of")} {total} {tr("records")}.
                    {" "}{tr("Request bodies, passwords, payment data, and tokens are never stored in these logs.")}
                </p>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" disabled={page <= 1 || activeQuery.isFetching} onClick={() => setPage((current) => Math.max(1, current - 1))}>{tr("Previous")}</Button>
                    <span className="min-w-20 text-center text-xs text-muted-foreground">{tr("Page")} {page} / {totalPages}</span>
                    <Button variant="outline" size="sm" disabled={page >= totalPages || activeQuery.isFetching} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>{tr("Next")}</Button>
                </div>
            </div>
        </div>
    );
}

function VisitorCrm({ analytics }: { analytics: import("./audit-types").VisitAnalytics }) {
    const { locale, tr } = useI18n();
    const guests = Math.max(0, toFiniteNumber(analytics.onlineVisitors) - toFiniteNumber(analytics.authenticatedOnlineVisitors));
    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-sm">
                <span className="flex items-center gap-2 font-medium text-emerald-700 dark:text-emerald-300"><span className="size-2 animate-pulse rounded-full bg-emerald-500" />{tr("Live customer presence")}</span>
                <span className="text-xs text-muted-foreground">{tr("Updated")} {formatDate(analytics.generatedAt, locale)} · {tr("refreshes every 5 seconds")}</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <MetricCard icon={Users} label={tr("Online visitors")} value={analytics.onlineVisitors} detail={`${guests} ${tr("guests")}`} />
                <MetricCard icon={UserCheck} label={tr("Known customers online")} value={analytics.authenticatedOnlineVisitors} detail={tr("Linked to customer profiles")} />
                <MetricCard icon={Activity} label={tr("Visits in 24 hours")} value={analytics.visitsLast24Hours} detail={`${analytics.uniqueVisitorsLast24Hours} ${tr("unique visitors")}`} />
                <MetricCard icon={BarChart3} label={tr("Product demand signals")} value={analytics.topProducts.length + analytics.topSearches.length} detail={tr("Page views and searches, not heartbeats")} />
            </div>
            <div className="grid gap-4 xl:grid-cols-3">
                <InsightList
                    title={tr("Most visited products")}
                    empty={tr("No product-page visits yet.")}
                    items={analytics.topProducts.map((item) => ({ label: item.label, detail: item.path, value: item.visits }))}
                />
                <InsightList
                    title={tr("Most searched items")}
                    empty={tr("No storefront searches yet.")}
                    items={analytics.topSearches.map((item) => ({ label: item.term, detail: tr("Search term"), value: item.searches }))}
                />
                <Card className="shadow-none">
                    <CardContent className="p-4">
                        <div className="mb-3 flex items-center justify-between">
                            <p className="font-semibold">{tr("Currently browsing")}</p>
                            <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700">{tr("Live")}</Badge>
                        </div>
                        <div className="max-h-64 space-y-2 overflow-y-auto pe-1">
                            {analytics.activeVisitors.length ? analytics.activeVisitors.map((visitor) => (
                                <div key={visitor.sessionId} className="rounded-lg border p-3">
                                    <div className="flex items-start justify-between gap-2">
                                        {visitor.customerId ? <Link className="truncate text-sm font-semibold text-primary hover:underline" to={`/customers/${visitor.customerId}`}>{visitor.customerName ?? tr("Known customer")}</Link> : <p className="truncate text-sm font-medium">{tr("Guest visitor")}</p>}
                                        <span className="size-2 shrink-0 rounded-full bg-emerald-500" />
                                    </div>
                                    <p className="mt-1 truncate text-xs font-medium" title={visitor.pageTitle ?? visitor.currentPath}>{visitor.pageTitle || friendlyPath(visitor.currentPath)}</p>
                                    <p className="truncate text-[11px] text-muted-foreground" title={visitor.currentPath}>{visitor.currentPath}</p>
                                    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground"><span>{[visitor.deviceType, visitor.browser].filter(Boolean).join(" · ") || tr("Unknown device")}</span><span className="flex items-center gap-1"><Clock3 className="size-3" />{duration(visitor.firstSeenAt, visitor.lastSeenAt)}</span></div>
                                </div>
                            )) : <p className="py-8 text-center text-sm text-muted-foreground">{tr("No visitors are active right now.")}</p>}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

function MetricCard({ icon: Icon, label, value, detail }: { icon: typeof Activity; label: string; value: number; detail: string }) {
    return (
        <Card className="shadow-none">
            <CardContent className="flex items-center gap-3 p-4">
                <div className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary"><Icon className="size-5" /></div>
                <div className="min-w-0"><p className="text-2xl font-bold">{toFiniteNumber(value).toLocaleString()}</p><p className="text-sm font-medium">{label}</p><p className="truncate text-xs text-muted-foreground">{detail}</p></div>
            </CardContent>
        </Card>
    );
}

function InsightList({ title, empty, items }: { title: string; empty: string; items: { label: string; detail: string; value: number }[] }) {
    const { tr } = useI18n();
    const maximum = Math.max(1, ...items.map((item) => item.value));
    return (
        <Card className="shadow-none">
            <CardContent className="p-4">
                <p className="mb-3 font-semibold">{title}</p>
                <div className="max-h-64 space-y-3 overflow-y-auto pe-1">
                    {items.length ? items.map((item) => (
                        <div key={`${item.label}-${item.detail}`}>
                            <div className="flex items-start justify-between gap-3 text-sm"><div className="min-w-0"><p className="truncate font-medium" title={item.label}>{item.label}</p><p className="truncate text-xs text-muted-foreground" title={item.detail}>{item.detail}</p></div><span className="font-semibold">{item.value} {tr("visits")}</span></div>
                            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(6, (item.value / maximum) * 100)}%` }} /></div>
                        </div>
                    )) : <p className="py-8 text-center text-sm text-muted-foreground">{empty}</p>}
                </div>
            </CardContent>
        </Card>
    );
}

function ActivityTable({ items }: { items: ActivityLogItem[] }) {
    const { locale, tr } = useI18n();
    return (
        <div className="overflow-x-auto">
            <Table className="min-w-[920px]">
                <TableHeader>
                    <TableRow>
                        <TableHead>{tr("Time / user")}</TableHead>
                        <TableHead>{tr("Action")}</TableHead>
                        <TableHead>{tr("Request")}</TableHead>
                        <TableHead>{tr("Device")}</TableHead>
                        <TableHead>{tr("IP address")}</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {items.length ? items.map((item) => (
                        <TableRow key={item.id}>
                            <TableCell>
                                <p className="font-medium">{item.userName ?? tr("Authenticated user")}</p>
                                <p className="text-xs text-muted-foreground">{formatDate(item.createdAt, locale)}</p>
                            </TableCell>
                            <TableCell>
                                <ActionBadge action={item.action} />
                                <p className="mt-1 text-xs text-muted-foreground">{tr(item.entityName)}{item.entityId ? ` #${item.entityId}` : ""}</p>
                            </TableCell>
                            <TableCell className="max-w-md">
                                <div className="flex items-center gap-2">
                                    <Badge variant={item.statusCode && item.statusCode >= 400 ? "destructive" : "secondary"}>{item.httpMethod ?? "API"} {item.statusCode ?? "—"}</Badge>
                                    <span className="text-xs text-muted-foreground">{item.durationMs ?? 0} ms</span>
                                </div>
                                <p className="mt-1 text-xs font-medium text-foreground">{tr(item.description)}</p>
                                <p className="mt-1 truncate text-xs text-muted-foreground" title={item.path ?? ""}>{item.path ?? "—"}</p>
                                {item.changes ? (
                                    <details className="mt-2 rounded-lg bg-muted/45 p-2 text-xs">
                                        <summary className="cursor-pointer select-none font-medium text-foreground">
                                            {tr("View changed fields")}
                                        </summary>
                                        <pre className="mt-2 max-h-52 overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-5 text-muted-foreground" dir="ltr">
                                            {formatAuditChanges(item.changes)}
                                        </pre>
                                    </details>
                                ) : null}
                            </TableCell>
                            <TableCell>
                                <p>{tr(item.deviceType ?? "Unknown")}</p>
                                <p className="text-xs text-muted-foreground">{[item.browser, item.operatingSystem].filter(Boolean).join(" · ") || "—"}</p>
                            </TableCell>
                            <TableCell className="font-mono text-xs" dir="ltr">{item.ipAddress ?? "—"}</TableCell>
                        </TableRow>
                    )) : <Empty colSpan={5} />}
                </TableBody>
            </Table>
        </div>
    );
}

function ActionBadge({ action }: { action: string }) {
    const { tr } = useI18n();
    const className =
        action === "Create" || action === "Restore" || action === "Activate"
            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
            : action === "Update" || action === "Assign" || action === "Sync"
                ? "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300"
                : action === "Delete" || action === "Reject" || action === "Deactivate" || action === "CancelOrder"
                    ? "border-destructive/30 bg-destructive/10 text-destructive"
                    : action === "Login" || action === "Approve" || action === "PlaceOrder"
                        ? "border-primary/30 bg-primary/10 text-primary"
                        : "border-border bg-muted/50 text-muted-foreground";

    return (
        <Badge variant="outline" className={className}>
            {tr(action === "Create" ? "Add" : action)}
        </Badge>
    );
}

function VisitTable({ items }: { items: CustomerVisitItem[] }) {
    const { locale, tr } = useI18n();
    return (
        <div className="overflow-x-auto">
            <Table className="min-w-[920px]">
                <TableHeader>
                    <TableRow>
                        <TableHead>{tr("Time / visitor")}</TableHead>
                        <TableHead>{tr("Visited page")}</TableHead>
                        <TableHead>{tr("Device")}</TableHead>
                        <TableHead>{tr("Session")}</TableHead>
                        <TableHead>{tr("IP address")}</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {items.length ? items.map((item) => (
                        <TableRow key={item.id}>
                            <TableCell>
                                <p className="font-medium">{item.customerName ?? tr("Guest visitor")}</p>
                                <p className="text-xs text-muted-foreground">{formatDate(item.createdAt, locale)}</p>
                            </TableCell>
                            <TableCell className="max-w-md">
                                <p className="truncate font-medium" title={item.path}>{item.path}</p>
                                <p className="truncate text-xs text-muted-foreground" title={item.referrer ?? ""}>{item.referrer || tr("Direct visit")}</p>
                            </TableCell>
                            <TableCell>
                                <div className="flex items-center gap-2"><ShieldCheck className="size-4 text-muted-foreground" />{tr(item.deviceType ?? "Unknown")}</div>
                                <p className="text-xs text-muted-foreground">{[item.browser, item.operatingSystem].filter(Boolean).join(" · ") || "—"}</p>
                            </TableCell>
                            <TableCell>
                                <Badge variant={item.isAuthenticated ? "default" : "outline"}>{tr(item.isAuthenticated ? "Signed in" : "Guest")}</Badge>
                                <p className="mt-1 max-w-36 truncate font-mono text-[11px] text-muted-foreground" dir="ltr" title={item.sessionId}>{item.sessionId}</p>
                            </TableCell>
                            <TableCell className="font-mono text-xs" dir="ltr">{item.ipAddress ?? "—"}</TableCell>
                        </TableRow>
                    )) : <Empty colSpan={5} />}
                </TableBody>
            </Table>
        </div>
    );
}

function Empty({ colSpan }: { colSpan: number }) {
    const { tr } = useI18n();
    return <TableRow><TableCell colSpan={colSpan} className="h-48 text-center text-muted-foreground">{tr("No matching log records.")}</TableCell></TableRow>;
}

function formatDate(value: string, locale: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function duration(start: string, end: string) { const milliseconds = Math.max(0, new Date(end).getTime() - new Date(start).getTime()); if (!Number.isFinite(milliseconds)) return "—"; const minutes = Math.max(1, Math.round(milliseconds / 60_000)); return minutes < 60 ? `${minutes}m` : `${Math.floor(minutes / 60)}h ${minutes % 60}m`; }
function friendlyPath(path: string) { if (path === "/") return "Home page"; if (path.startsWith("/products/")) return `Product ${path.split("?")[0].split("/").filter(Boolean).at(-1) ?? "page"}`; if (path.startsWith("/products")) return "Shop catalog"; if (path.startsWith("/cart")) return "Shopping cart"; if (path.startsWith("/checkout")) return "Checkout"; if (path.startsWith("/account")) return "Customer account"; return path; }

function formatAuditChanges(value: string) {
    try {
        return JSON.stringify(JSON.parse(value), null, 2);
    } catch {
        return value;
    }
}
