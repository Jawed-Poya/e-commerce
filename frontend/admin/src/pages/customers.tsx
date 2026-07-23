import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, Plus, Search } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Combobox, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList } from "@/components/ui/combobox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { customerService } from "@/features/customers/customer-service";
import { useProductLookupsQuery } from "@/features/products/hooks/use-product-mutation";
import type { UpsertCustomerRequest } from "@/features/customers/customer-types";
import { formatMoney } from "./orders";

const emptyForm = { firstName: "", lastName: "", phone: "", email: "", address: "", customerTypeId: "" };

export default function CustomersPage() {
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const [open, setOpen] = useState(false);
    const [form, setForm] = useState(emptyForm);
    const queryClient = useQueryClient();
    const { data: lookups } = useProductLookupsQuery();
    const query = useQuery({ queryKey: ["customers", search, page], queryFn: () => customerService.getCustomers({ search: search || undefined, page, pageSize: 20 }) });
    const create = useMutation({ mutationFn: (request: UpsertCustomerRequest) => customerService.createCustomer(request), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["customers"] }); setOpen(false); setForm(emptyForm); toast.success("Customer created."); }, onError: error => toast.error(getErrorMessage(error)) });

    const submit = (event: FormEvent) => {
        event.preventDefault();
        create.mutate({
            firstName: form.firstName.trim(),
            lastName: clean(form.lastName),
            phone: form.phone.trim(),
            email: clean(form.email),
            address: clean(form.address),
            customerTypeId: form.customerTypeId
                ? Number(form.customerTypeId)
                : (lookups?.defaultCustomerTypeId ?? null),
        });
    };
    const data = query.data;

    return <div className="space-y-5">
        <PageHeader title="Customers" description="Customers are created automatically during checkout and can also be added manually." actions={<Button onClick={() => setOpen(true)}><Plus />Add customer</Button>} />
        <Card><CardContent><div className="relative max-w-xl"><Search className="absolute left-2 top-2 size-4 text-muted-foreground" /><Input className="pl-8" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search name, phone or email..." /></div></CardContent></Card>
        <Card><CardContent className="px-0"><Table><TableHeader><TableRow><TableHead>Customer</TableHead><TableHead>Phone</TableHead><TableHead>Type</TableHead><TableHead>Orders</TableHead><TableHead>Delivered spend</TableHead><TableHead>Last order</TableHead><TableHead /></TableRow></TableHeader><TableBody>
            {query.isLoading && <TableRow><TableCell colSpan={7} className="h-24 text-center text-muted-foreground">Loading customers...</TableCell></TableRow>}
            {data?.items.map(customer => <TableRow key={customer.id}><TableCell><div className="font-semibold">{customer.name}</div><div className="text-muted-foreground">{customer.email ?? "No email"}</div></TableCell><TableCell>{customer.phone}</TableCell><TableCell>{customer.customerTypeName ?? "Default"}</TableCell><TableCell>{customer.orderCount}</TableCell><TableCell>{formatMoney(customer.totalSpent, "USD")}</TableCell><TableCell>{customer.lastOrderAt ? new Date(customer.lastOrderAt).toLocaleString() : "—"}</TableCell><TableCell><Link className="inline-flex h-7 items-center gap-1 border px-2 hover:bg-muted" to={`/customers/${customer.id}`}><Eye className="size-3.5" />View</Link></TableCell></TableRow>)}
            {!query.isLoading && data?.items.length === 0 && <TableRow><TableCell colSpan={7} className="h-24 text-center text-muted-foreground">No customers found.</TableCell></TableRow>}
        </TableBody></Table></CardContent></Card>
        {data && data.totalPages > 1 && <div className="flex items-center justify-between text-xs"><span>Page {data.page} of {data.totalPages}</span><div className="flex gap-2"><Button variant="outline" disabled={!data.hasPreviousPage} onClick={() => setPage(x => x - 1)}>Previous</Button><Button variant="outline" disabled={!data.hasNextPage} onClick={() => setPage(x => x + 1)}>Next</Button></div></div>}

        <Dialog open={open} onOpenChange={setOpen}><DialogContent className="sm:max-w-lg"><form onSubmit={submit}><DialogHeader><DialogTitle>Add customer</DialogTitle><DialogDescription>Create a customer without placing an order.</DialogDescription></DialogHeader><div className="my-5 grid gap-4 sm:grid-cols-2"><Field label="First name" value={form.firstName} onChange={value => setForm(x => ({ ...x, firstName: value }))} required /><Field label="Last name" value={form.lastName} onChange={value => setForm(x => ({ ...x, lastName: value }))} /><Field label="Phone" value={form.phone} onChange={value => setForm(x => ({ ...x, phone: value }))} required /><Field label="Email" value={form.email} onChange={value => setForm(x => ({ ...x, email: value }))} /><div className="space-y-2"><Label>Customer type</Label><Combobox items={lookups?.customerTypes ?? []} value={(lookups?.customerTypes ?? []).find(type => String(type.id) === (form.customerTypeId || String(lookups?.defaultCustomerTypeId ?? ""))) ?? null} onValueChange={value => setForm(x => ({ ...x, customerTypeId: value ? String((value as { id: number }).id) : "" }))} itemToStringLabel={item => item ? (item as { name: string }).name : ""}><ComboboxInput className="w-full" placeholder="Search customer type…" showClear={false} /><ComboboxContent><ComboboxList>{lookups?.customerTypes.map(type => <ComboboxItem key={type.id} value={type}>{type.name}{type.id === lookups.defaultCustomerTypeId ? " (Default / guests)" : ""}</ComboboxItem>)}</ComboboxList><ComboboxEmpty>No customer type found.</ComboboxEmpty></ComboboxContent></Combobox></div><div className="sm:col-span-2 space-y-2"><Label>Address</Label><Textarea value={form.address} onChange={e => setForm(x => ({ ...x, address: e.target.value }))} /></div></div><DialogFooter><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" disabled={create.isPending || !form.firstName.trim() || !form.phone.trim()}>{create.isPending ? "Saving..." : "Create customer"}</Button></DialogFooter></form></DialogContent></Dialog>
    </div>;
}
function Field({ label, value, onChange, required }: { label: string; value: string; onChange: (value: string) => void; required?: boolean }) { return <div className="space-y-2"><Label>{label}{required && " *"}</Label><Input value={value} onChange={e => onChange(e.target.value)} /></div>; }
function clean(value: string) { const result = value.trim(); return result || null; }
function getErrorMessage(error: unknown) { return (error as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message ?? (error as Error)?.message ?? "The operation failed."; }
