import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Mail, MapPin, Phone, UserRound } from "lucide-react";
import { Link, useParams } from "react-router-dom";

import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { customerService } from "@/features/customers/customer-service";
import { formatMoney, StatusBadge } from "./orders";

export default function CustomerDetailsPage() {
    const id = Number(useParams().id);
    const query = useQuery({ queryKey: ["customer", id], queryFn: () => customerService.getCustomer(id), enabled: Number.isFinite(id) && id > 0 });
    if (query.isLoading) return <div className="p-10 text-center text-muted-foreground">Loading customer...</div>;
    if (!query.data) return <div className="p-10 text-center text-destructive">Customer not found.</div>;
    const customer = query.data;
    const name = [customer.firstName, customer.lastName].filter(Boolean).join(" ");
    return <div className="space-y-5"><PageHeader title={name} description={`Customer since ${new Date(customer.createdAt).toLocaleDateString()}`} actions={<Link to="/customers" className="inline-flex h-8 items-center gap-1 border px-2.5 text-xs hover:bg-muted"><ArrowLeft className="size-4" />Back</Link>} />
        <div className="grid gap-5 lg:grid-cols-3"><Card><CardHeader><CardTitle>Profile</CardTitle></CardHeader><CardContent className="space-y-4"><Info icon={<UserRound />} label="Name" value={name} /><Info icon={<Phone />} label="Phone" value={customer.phone} /><Info icon={<Mail />} label="Email" value={customer.email ?? "—"} /><div><p className="text-muted-foreground">Customer type</p><Badge variant="outline" className="mt-1">{customer.customerTypeName ?? "Default"}</Badge></div>{customer.address && <Info icon={<MapPin />} label="Address" value={customer.address} />}</CardContent></Card>
        <Card className="lg:col-span-2"><CardHeader><CardTitle>Saved addresses</CardTitle></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2">{customer.addresses.map(address => <div key={address.id} className="border p-4"><div className="flex items-center justify-between"><p className="font-semibold">{address.label}</p>{address.isDefaultShipping && <Badge>Default</Badge>}</div><p className="mt-2">{address.recipientName} · {address.phone}</p><p className="mt-1 text-muted-foreground">{[address.addressLine1,address.addressLine2,address.city,address.state,address.country,address.postalCode].filter(Boolean).join(", ")}</p></div>)}{customer.addresses.length === 0 && <p className="text-muted-foreground">No saved addresses.</p>}</CardContent></Card></div>
        <Card><CardHeader><CardTitle>Order history</CardTitle></CardHeader><CardContent className="px-0"><Table><TableHeader><TableRow><TableHead>Order</TableHead><TableHead>Status</TableHead><TableHead>Total</TableHead><TableHead>Date</TableHead></TableRow></TableHeader><TableBody>{customer.orders.map(order => <TableRow key={order.id}><TableCell><Link className="font-medium text-primary hover:underline" to={`/orders/${order.id}`}>{order.orderNumber}</Link></TableCell><TableCell><StatusBadge value={order.status} /></TableCell><TableCell>{formatMoney(order.total, order.currency)}</TableCell><TableCell>{new Date(order.createdAt).toLocaleString()}</TableCell></TableRow>)}{customer.orders.length === 0 && <TableRow><TableCell colSpan={4} className="h-20 text-center text-muted-foreground">No orders yet.</TableCell></TableRow>}</TableBody></Table></CardContent></Card>
    </div>;
}
function Info({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) { return <div className="flex items-start gap-2"><span className="mt-0.5 text-muted-foreground">{icon}</span><div><p className="text-muted-foreground">{label}</p><p className="font-medium">{value}</p></div></div>; }
