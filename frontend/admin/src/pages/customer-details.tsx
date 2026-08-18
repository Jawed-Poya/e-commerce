import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, ArrowLeft, Eye, Globe2, Mail, MapPin, Phone, Save, Search, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { SimpleCombobox } from "@/components/simple-combobox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CustomerLedgerCard } from "@/features/company/customer-ledger-card";
import { useAdminAuth } from "@/features/auth/auth-context";
import { hasPermission, Permissions } from "@/features/auth/permissions";
import { useCompany } from "@/features/company/company-context";
import { ReceiptActions } from "@/features/company/receipt-actions";
import { customerService } from "@/features/customers/customer-service";
import { WhatsAppLink } from "@/features/customers/whatsapp-link";
import { useProductLookupsQuery } from "@/features/products/hooks/use-product-mutation";
import { OrderStatusBadge as StatusBadge } from "@/features/orders/components/order-status-badge";
import { formatMoney } from "@/lib/format-money";
import { toFiniteNumber } from "@/lib/numbers";
import type { CustomerEngagement } from "@/features/customers/customer-types";

export default function CustomerDetailsPage() {
    const id = Number(useParams().id);
    const queryClient = useQueryClient();
    const { user } = useAdminAuth();
    const canViewFinancialReports = hasPermission(user, Permissions.FinancialReportsView);
    const { formatMoney: formatCompanyMoney } = useCompany();
    const query = useQuery({ queryKey: ["customer", id], queryFn: () => customerService.getCustomer(id), enabled: Number.isFinite(id) && id > 0 });
    const engagement = useQuery({
        queryKey: ["customer", id, "engagement"],
        queryFn: () => customerService.getEngagement(id),
        enabled: Number.isFinite(id) && id > 0,
        refetchInterval: 5_000,
        refetchIntervalInBackground: false,
    });
    const { data: lookups } = useProductLookupsQuery();
    const [customerTypeId, setCustomerTypeId] = useState("");

    useEffect(() => {
        if (query.data) {
            setCustomerTypeId(String(query.data.customerTypeId ?? lookups?.defaultCustomerTypeId ?? ""));
        }
    }, [lookups?.defaultCustomerTypeId, query.data]);

    const updateType = useMutation({
        mutationFn: async () => {
            const customer = query.data;
            if (!customer) throw new Error("Customer is not loaded.");
            return customerService.updateCustomer(customer.id, {
                firstName: customer.firstName,
                lastName: customer.lastName,
                phone: customer.phone,
                email: customer.email,
                address: customer.address,
                customerTypeId: customerTypeId ? Number(customerTypeId) : null,
                creditLimit: customer.creditLimit,
                debtDueDays: customer.debtDueDays,
            });
        },
        onSuccess: async () => {
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ["customer", id] }),
                queryClient.invalidateQueries({ queryKey: ["customers"] }),
            ]);
            toast.success("Customer pricing type updated.");
        },
        onError: error => toast.error(getErrorMessage(error)),
    });

    if (query.isLoading) return <div className="p-10 text-center text-muted-foreground">Loading customer...</div>;
    if (!query.data) return <div className="p-10 text-center text-destructive">Customer not found.</div>;
    const customer = query.data;
    const name = [customer.firstName, customer.lastName].filter(Boolean).join(" ");
    return <div className="space-y-5"><PageHeader title={name} description={`Customer since ${new Date(customer.createdAt).toLocaleDateString()}`} actions={<Link to="/customers" className="inline-flex h-8 items-center gap-1 border px-2.5 text-xs hover:bg-muted"><ArrowLeft className="size-4" />Back</Link>} />
        <div className="grid gap-3 sm:grid-cols-3"><BalanceCard label="Outstanding debt" value={formatCompanyMoney(customer.outstandingDebt)} tone={customer.hasOverdueDebt ? "danger" : toFiniteNumber(customer.outstandingDebt) > 0 ? "warning" : "normal"} help={customer.hasOverdueDebt ? "One or more balances are overdue" : `Credit limit ${formatCompanyMoney(customer.creditLimit)}`} /><BalanceCard label="Account credit" value={formatCompanyMoney(customer.accountCredit)} tone={toFiniteNumber(customer.accountCredit) > 0 ? "success" : "normal"} help="Automatically used on the next manual sale" /><BalanceCard label="Debt terms" value={`${toFiniteNumber(customer.debtDueDays)} days`} tone="normal" help="Default due period for new debt" /></div>
        <CustomerActivityCard engagement={engagement.data} loading={engagement.isLoading} />
        <div className="grid gap-5 lg:grid-cols-3"><Card><CardHeader><CardTitle>Profile</CardTitle></CardHeader><CardContent className="space-y-4"><Info icon={<UserRound />} label="Name" value={name} /><Info icon={<Phone />} label="Phone" value={customer.phone} /><WhatsAppLink url={customer.whatsAppUrl} customerName={name} className="w-full" /><Info icon={<Mail />} label="Email" value={customer.email ?? "—"} /><div className="space-y-2"><p className="text-muted-foreground">Customer pricing type</p><SimpleCombobox<number> value={customerTypeId ? Number(customerTypeId) : null} onValueChange={(value) => setCustomerTypeId(value ? String(value) : "")} options={(lookups?.customerTypes ?? []).map((type) => ({ value: type.id, label: type.name, description: type.id === lookups?.defaultCustomerTypeId ? "Default / guests" : undefined }))} placeholder="Select customer pricing type" /><Button className="w-full" size="sm" disabled={updateType.isPending || !customerTypeId || Number(customerTypeId) === customer.customerTypeId} onClick={() => updateType.mutate()}><Save className="size-4" />{updateType.isPending ? "Saving..." : "Save customer type"}</Button><p className="text-xs text-muted-foreground">This tier controls the prices shown after the customer signs in.</p></div>{customer.address && <Info icon={<MapPin />} label="Address" value={customer.address} />}</CardContent></Card>
        <Card className="lg:col-span-2"><CardHeader><CardTitle>Saved addresses</CardTitle></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2">{customer.addresses.map(address => <div key={address.id} className="border p-4"><div className="flex items-center justify-between"><p className="font-semibold">{address.label}</p>{address.isDefaultShipping && <Badge>Default</Badge>}</div><p className="mt-2">{address.recipientName} · {address.phone}</p><p className="mt-1 text-muted-foreground">{[address.addressLine1,address.addressLine2,address.city,address.state,address.country,address.postalCode].filter(Boolean).join(", ")}</p></div>)}{customer.addresses.length === 0 && <p className="text-muted-foreground">No saved addresses.</p>}</CardContent></Card></div>
        <Card><CardHeader><CardTitle>Order history</CardTitle></CardHeader><CardContent className="px-0"><Table><TableHeader><TableRow><TableHead>Order</TableHead><TableHead>Status</TableHead><TableHead>Total</TableHead><TableHead>Date</TableHead><TableHead className="text-end">Receipt</TableHead></TableRow></TableHeader><TableBody>{customer.orders.map(order => <TableRow key={order.id}><TableCell><Link className="font-medium text-primary hover:underline" to={`/orders/${order.id}`}>{order.orderNumber}</Link></TableCell><TableCell><StatusBadge value={order.status} /></TableCell><TableCell>{formatMoney(order.total, order.currency)}</TableCell><TableCell>{new Date(order.createdAt).toLocaleString()}</TableCell><TableCell className="text-end"><ReceiptActions source="orders" id={order.id} compact /></TableCell></TableRow>)}{customer.orders.length === 0 && <TableRow><TableCell colSpan={5} className="h-20 text-center text-muted-foreground">No orders yet.</TableCell></TableRow>}</TableBody></Table></CardContent></Card>
        {canViewFinancialReports ? <CustomerLedgerCard
            customerId={customer.id}
            customerName={name}
            whatsAppUrl={customer.whatsAppUrl}
        /> : null}
    </div>;
}
function getErrorMessage(error: unknown) { return (error as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message ?? (error as Error)?.message ?? "The operation failed."; }
function Info({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) { return <div className="flex items-start gap-2"><span className="mt-0.5 text-muted-foreground">{icon}</span><div><p className="text-muted-foreground">{label}</p><p className="font-medium">{value}</p></div></div>; }
function BalanceCard({ label, value, help, tone }: { label: string; value: string; help: string; tone: "normal" | "warning" | "danger" | "success" }) { const color = tone === "danger" ? "border-destructive/30 bg-destructive/5 text-destructive" : tone === "warning" ? "border-amber-500/30 bg-amber-500/5 text-amber-700" : tone === "success" ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-700" : "bg-card"; return <div className={`rounded-xl border p-4 ${color}`}><p className="text-xs font-medium uppercase tracking-wide opacity-75">{label}</p><p className="mt-2 text-2xl font-bold tabular-nums">{value}</p><p className="mt-1 text-xs opacity-70">{help}</p></div>; }

function CustomerActivityCard({ engagement, loading }: { engagement?: CustomerEngagement; loading: boolean }) {
    const metrics = [
        { icon: Eye, label: "Visits (30 days)", value: toFiniteNumber(engagement?.visitsLast30Days) },
        { icon: Globe2, label: "Unique sessions", value: toFiniteNumber(engagement?.uniqueSessionsLast30Days) },
        { icon: Activity, label: "Product views", value: toFiniteNumber(engagement?.productViewsLast30Days) },
        { icon: Search, label: "Searches", value: toFiniteNumber(engagement?.searchesLast30Days) },
    ];
    return <Card className="overflow-hidden"><CardHeader className="border-b"><div className="flex flex-wrap items-center justify-between gap-3"><div><CardTitle>Live customer activity</CardTitle><p className="mt-1 text-sm text-muted-foreground">Real-time presence and 30-day storefront engagement.</p></div><Badge variant="outline" className={engagement?.isOnline ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700" : "text-muted-foreground"}><span className={`me-2 size-2 rounded-full ${engagement?.isOnline ? "animate-pulse bg-emerald-500" : "bg-muted-foreground/50"}`} />{engagement?.isOnline ? `Online · ${Math.max(1, toFiniteNumber(engagement.activeSessions))} session${toFiniteNumber(engagement.activeSessions) === 1 ? "" : "s"}` : "Offline"}</Badge></div></CardHeader><CardContent className="space-y-4 pt-5">{loading ? <p className="text-sm text-muted-foreground">Loading customer activity…</p> : <><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{metrics.map(({ icon: Icon, label, value }) => <div key={label} className="rounded-lg border bg-muted/20 p-3"><div className="flex items-center gap-2 text-xs text-muted-foreground"><Icon className="size-4 text-primary" />{label}</div><p className="mt-2 text-xl font-bold tabular-nums">{value.toLocaleString()}</p></div>)}</div><div className="grid gap-3 lg:grid-cols-3"><ActivityDetail label={engagement?.isOnline ? "Currently viewing" : "Last visited page"} value={engagement?.pageTitle || friendlyPath(engagement?.currentPath)} help={engagement?.currentPath ?? "No storefront activity recorded"} /><ActivityDetail label="Last seen" value={formatSeen(engagement?.lastSeenAt)} help={engagement?.isOnline ? "Presence refreshes every few seconds" : "The customer is not currently active"} /><ActivityDetail label="Latest search" value={engagement?.lastSearchTerm || "—"} help="Useful for follow-up and stock decisions" /></div></>}</CardContent></Card>;
}

function ActivityDetail({ label, value, help }: { label: string; value: string; help: string }) { return <div className="min-w-0 rounded-lg border p-3"><p className="text-xs font-medium text-muted-foreground">{label}</p><p className="mt-1 truncate font-semibold" title={value}>{value}</p><p className="mt-1 truncate text-xs text-muted-foreground" title={help}>{help}</p></div>; }
function friendlyPath(path?: string | null) { if (!path) return "—"; if (path === "/") return "Home page"; if (path.startsWith("/products/")) return `Product ${path.split("?")[0].split("/").filter(Boolean).at(-1) ?? "page"}`; if (path.startsWith("/products")) return "Shop catalog"; if (path.startsWith("/cart")) return "Shopping cart"; if (path.startsWith("/checkout")) return "Checkout"; return path; }
function formatSeen(value?: string | null) { if (!value) return "Never"; const date = new Date(value); return Number.isNaN(date.getTime()) ? "Unknown" : date.toLocaleString(); }
