import { useQuery } from "@tanstack/react-query";
import { Eye, RefreshCw, Search } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { orderService } from "@/features/orders/order-service";
import type { OrderStatus, PaymentStatus } from "@/features/orders/order-types";

export default function OrdersPage() {
    const [search, setSearch] = useState("");
    const [status, setStatus] = useState<OrderStatus | "">("");
    const [paymentStatus, setPaymentStatus] = useState<PaymentStatus | "">("");
    const [page, setPage] = useState(1);

    const query = useQuery({
        queryKey: ["orders", search, status, paymentStatus, page],
        queryFn: () => orderService.getOrders({ search: search || undefined, status, paymentStatus, page, pageSize: 20 }),
    });

    const data = query.data;

    return <div className="space-y-5">
        <PageHeader title="Orders" description="Review orders, verify offline payments, and control fulfillment." actions={<Button variant="outline" onClick={() => query.refetch()}><RefreshCw className={query.isFetching ? "animate-spin" : ""} />Refresh</Button>} />

        <Card>
            <CardContent className="grid gap-3 md:grid-cols-[1fr_200px_200px]">
                <div className="relative"><Search className="absolute left-2 top-2 size-4 text-muted-foreground" /><Input className="pl-8" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Order number, customer or phone..." /></div>
                <select className="h-8 border bg-background px-2 text-xs" value={status} onChange={e => { setStatus(e.target.value as OrderStatus | ""); setPage(1); }}><option value="">All order statuses</option>{["Pending","Confirmed","Processing","Delivered","Cancelled"].map(x => <option key={x}>{x}</option>)}</select>
                <select className="h-8 border bg-background px-2 text-xs" value={paymentStatus} onChange={e => { setPaymentStatus(e.target.value as PaymentStatus | ""); setPage(1); }}><option value="">All payment statuses</option>{["Pending","Paid","Failed","Cancelled"].map(x => <option key={x}>{x}</option>)}</select>
            </CardContent>
        </Card>

        <Card>
            <CardContent className="px-0">
                <Table>
                    <TableHeader><TableRow><TableHead>Order</TableHead><TableHead>Customer</TableHead><TableHead>Payment</TableHead><TableHead>Status</TableHead><TableHead>Items</TableHead><TableHead>Total</TableHead><TableHead>Date</TableHead><TableHead /></TableRow></TableHeader>
                    <TableBody>
                        {query.isLoading && <TableRow><TableCell colSpan={8} className="h-24 text-center text-muted-foreground">Loading orders...</TableCell></TableRow>}
                        {query.isError && <TableRow><TableCell colSpan={8} className="h-24 text-center text-destructive">Orders could not be loaded.</TableCell></TableRow>}
                        {data?.items.map(order => <TableRow key={order.id}>
                            <TableCell><div className="font-semibold">{order.orderNumber}</div><div className="text-muted-foreground">#{order.id}</div></TableCell>
                            <TableCell><div>{order.customerName}</div><div className="text-muted-foreground">{order.customerPhone}</div></TableCell>
                            <TableCell><StatusBadge value={order.paymentStatus} /><div className="mt-1 text-muted-foreground">{splitWords(order.paymentMethod)}</div></TableCell>
                            <TableCell><StatusBadge value={order.status} /></TableCell>
                            <TableCell>{order.itemCount}</TableCell>
                            <TableCell className="font-semibold">{formatMoney(order.total, order.currency)}</TableCell>
                            <TableCell>{new Date(order.createdAt).toLocaleString()}</TableCell>
                            <TableCell><Link className="inline-flex h-7 items-center gap-1 border px-2 hover:bg-muted" to={`/orders/${order.id}`}><Eye className="size-3.5" />View</Link></TableCell>
                        </TableRow>)}
                        {!query.isLoading && data?.items.length === 0 && <TableRow><TableCell colSpan={8} className="h-24 text-center text-muted-foreground">No orders found.</TableCell></TableRow>}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>

        {data && data.totalPages > 1 && <div className="flex items-center justify-between text-xs"><span>Page {data.page} of {data.totalPages} · {data.totalCount} orders</span><div className="flex gap-2"><Button variant="outline" disabled={!data.hasPreviousPage} onClick={() => setPage(x => x - 1)}>Previous</Button><Button variant="outline" disabled={!data.hasNextPage} onClick={() => setPage(x => x + 1)}>Next</Button></div></div>}
    </div>;
}

export function StatusBadge({ value }: { value: string }) {
    const variant = value === "Paid" || value === "Delivered" || value === "Fulfilled" ? "default" : value === "Failed" || value === "Cancelled" ? "destructive" : value === "Pending" ? "secondary" : "outline";
    return <Badge variant={variant}>{value}</Badge>;
}

export function formatMoney(amount: number, currency: string) {
    try { return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amount); }
    catch { return `${currency} ${amount.toFixed(2)}`; }
}

function splitWords(value: string) { return value.replace(/([a-z])([A-Z])/g, "$1 $2"); }
