import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Banknote, Box, CheckCircle2, Clock3, MapPin, Phone, Truck, UserRound, XCircle } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { orderService } from "@/features/orders/order-service";
import type { OrderDetails, OrderStatus, PaymentStatus } from "@/features/orders/order-types";
import { formatMoney, StatusBadge } from "./orders";

export default function OrderDetailsPage() {
    const id = Number(useParams().id);
    const queryClient = useQueryClient();
    const query = useQuery({ queryKey: ["order", id], queryFn: () => orderService.getOrder(id), enabled: Number.isFinite(id) && id > 0 });

    const updateStatus = useMutation({
        mutationFn: (status: OrderStatus) => orderService.updateStatus(id, status),
        onSuccess: data => { queryClient.setQueryData(["order", id], data); queryClient.invalidateQueries({ queryKey: ["orders"] }); toast.success("Order status updated."); },
        onError: error => toast.error(getErrorMessage(error)),
    });
    const updatePayment = useMutation({
        mutationFn: ({ status, reference }: { status: PaymentStatus; reference?: string }) => orderService.updatePayment(id, status, reference),
        onSuccess: data => { queryClient.setQueryData(["order", id], data); queryClient.invalidateQueries({ queryKey: ["orders"] }); toast.success("Payment status updated."); },
        onError: error => toast.error(getErrorMessage(error)),
    });

    if (query.isLoading) return <div className="p-10 text-center text-muted-foreground">Loading order...</div>;
    if (!query.data) return <div className="p-10 text-center text-destructive">Order not found.</div>;
    const order = query.data;
    const payment = order.payments[0];

    return <div className="space-y-5">
        <PageHeader title={order.orderNumber} description={`Created ${new Date(order.createdAt).toLocaleString()}`} actions={<Link to="/orders" className="inline-flex h-8 items-center gap-1 border px-2.5 text-xs hover:bg-muted"><ArrowLeft className="size-4" />Back</Link>} />

        <div className="grid gap-3 md:grid-cols-4">
            <SummaryCard icon={<Clock3 />} label="Order status" value={<StatusBadge value={order.status} />} />
            <SummaryCard icon={<Banknote />} label="Payment" value={<StatusBadge value={order.paymentStatus} />} />
            <SummaryCard icon={<Truck />} label="Fulfillment" value={<StatusBadge value={order.fulfillmentStatus} />} />
            <SummaryCard icon={<Box />} label="Total" value={<span className="text-base font-bold">{formatMoney(order.total, order.currency)}</span>} />
        </div>

        <Card>
            <CardHeader><CardTitle>Actions</CardTitle></CardHeader>
            <CardContent className="flex flex-wrap gap-2">
                {nextStatuses(order).map(action => <Button key={action.status} variant={action.status === "Cancelled" ? "destructive" : "default"} disabled={updateStatus.isPending} onClick={() => updateStatus.mutate(action.status)}>{action.icon}{action.label}</Button>)}
                {payment?.method === "BankTransfer" && order.paymentStatus !== "Paid" && <Button variant="outline" disabled={updatePayment.isPending} onClick={() => {
                    const reference = window.prompt("Bank transaction/reference number", payment.externalReference ?? "") ?? undefined;
                    if (reference !== undefined) updatePayment.mutate({ status: "Paid", reference });
                }}><CheckCircle2 />Verify bank payment</Button>}
                {order.paymentStatus === "Pending" && <Button variant="outline" disabled={updatePayment.isPending} onClick={() => updatePayment.mutate({ status: "Failed" })}><XCircle />Mark payment failed</Button>}
            </CardContent>
        </Card>

        <div className="grid gap-5 lg:grid-cols-3">
            <Card><CardHeader><CardTitle>Customer</CardTitle></CardHeader><CardContent className="space-y-3"><Info icon={<UserRound />} label="Name" value={order.customer.name} /><Info icon={<Phone />} label="Phone" value={order.customer.phone} /><Info label="Email" value={order.customer.email ?? "—"} /><Info label="Type" value={order.customer.customerTypeName ?? "Default"} /><Link className="text-primary underline" to={`/customers/${order.customer.id}`}>Open customer profile</Link></CardContent></Card>
            <Card className="lg:col-span-2"><CardHeader><CardTitle>Shipping address</CardTitle></CardHeader><CardContent className="space-y-3"><Info icon={<MapPin />} label="Recipient" value={order.shippingAddress.recipientName} /><p>{[order.shippingAddress.addressLine1, order.shippingAddress.addressLine2, order.shippingAddress.city, order.shippingAddress.state, order.shippingAddress.country, order.shippingAddress.postalCode].filter(Boolean).join(", ")}</p><Info icon={<Phone />} label="Delivery phone" value={order.shippingAddress.phone} />{order.notes && <div className="border-t pt-3"><p className="font-medium">Notes</p><p className="mt-1 text-muted-foreground">{order.notes}</p></div>}</CardContent></Card>
        </div>

        <Card><CardHeader><CardTitle>Items</CardTitle></CardHeader><CardContent className="px-0"><Table><TableHeader><TableRow><TableHead>Product</TableHead><TableHead>Barcode</TableHead><TableHead>Quantity</TableHead><TableHead>Unit price</TableHead><TableHead>Total</TableHead></TableRow></TableHeader><TableBody>{order.items.map(item => <TableRow key={item.id}><TableCell><Link className="font-medium hover:text-primary" to={`/products/${item.productId}`}>{item.productName}</Link></TableCell><TableCell>{item.productBarcode ?? "—"}</TableCell><TableCell>{item.quantity}</TableCell><TableCell>{formatMoney(item.unitPrice, item.currency)}</TableCell><TableCell className="font-semibold">{formatMoney(item.total, item.currency)}</TableCell></TableRow>)}</TableBody></Table></CardContent></Card>

        <div className="grid gap-5 lg:grid-cols-2">
            <Card><CardHeader><CardTitle>Payment record</CardTitle></CardHeader><CardContent className="space-y-3">{payment ? <><Info label="Method" value={payment.method.replace(/([a-z])([A-Z])/g, "$1 $2")} /><Info label="Status" value={payment.status} /><Info label="Amount" value={formatMoney(payment.amount, payment.currency)} /><Info label="Reference" value={payment.externalReference ?? "—"} /><Info label="Paid at" value={payment.paidAt ? new Date(payment.paidAt).toLocaleString() : "—"} />{payment.failureReason && <Info label="Failure reason" value={payment.failureReason} />}</> : <p className="text-muted-foreground">No payment record.</p>}</CardContent></Card>
            <Card><CardHeader><CardTitle>Order totals</CardTitle></CardHeader><CardContent className="space-y-3"><MoneyLine label="Subtotal" value={order.subtotal} order={order} /><MoneyLine label="Discount" value={-order.discountTotal} order={order} /><MoneyLine label="Tax" value={order.taxTotal} order={order} /><MoneyLine label="Shipping" value={order.shippingTotal} order={order} /><div className="flex justify-between border-t pt-3 text-sm font-bold"><span>Total</span><span>{formatMoney(order.total, order.currency)}</span></div></CardContent></Card>
        </div>

        <Card><CardHeader><CardTitle>Status history</CardTitle></CardHeader><CardContent className="space-y-4">{order.statusHistory.map((item, index) => <div key={item.id || index} className="flex gap-3"><span className="mt-1 size-2 rounded-full bg-primary" /><div><div className="flex items-center gap-2"><StatusBadge value={item.toStatus} /><span className="text-muted-foreground">{new Date(item.createdAt).toLocaleString()}</span></div>{item.note && <p className="mt-1 text-muted-foreground">{item.note}</p>}</div></div>)}</CardContent></Card>
    </div>;
}

function nextStatuses(order: OrderDetails): { status: OrderStatus; label: string; icon: React.ReactNode }[] {
    if (order.status === "Pending") return [{ status: "Confirmed", label: "Confirm order", icon: <CheckCircle2 /> }, { status: "Cancelled", label: "Cancel order", icon: <XCircle /> }];
    if (order.status === "Confirmed") return [{ status: "Processing", label: "Start processing", icon: <Box /> }, { status: "Cancelled", label: "Cancel order", icon: <XCircle /> }];
    if (order.status === "Processing") return [{ status: "Delivered", label: "Mark delivered", icon: <Truck /> }, { status: "Cancelled", label: "Cancel order", icon: <XCircle /> }];
    return [];
}
function SummaryCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) { return <Card><CardContent className="flex items-center gap-3"><span className="grid size-9 place-items-center bg-primary/10 text-primary">{icon}</span><div><p className="text-muted-foreground">{label}</p><div className="mt-1">{value}</div></div></CardContent></Card>; }
function Info({ icon, label, value }: { icon?: React.ReactNode; label: string; value: string }) { return <div className="flex items-start gap-2">{icon && <span className="mt-0.5 text-muted-foreground">{icon}</span>}<div><p className="text-muted-foreground">{label}</p><p className="font-medium">{value}</p></div></div>; }
function MoneyLine({ label, value, order }: { label: string; value: number; order: OrderDetails }) { return <div className="flex justify-between"><span className="text-muted-foreground">{label}</span><span>{formatMoney(value, order.currency)}</span></div>; }
function getErrorMessage(error: unknown) { return (error as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message ?? (error as Error)?.message ?? "The operation failed."; }
