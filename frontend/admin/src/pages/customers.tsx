import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Eye, LoaderCircle, Plus, Rows3, Search, Trash2 } from "lucide-react";
import { useDeferredValue, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

import { ListPagination } from "@/components/list-pagination";
import { SimpleCombobox } from "@/components/simple-combobox";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useCompany } from "@/features/company/company-context";
import { customerService } from "@/features/customers/customer-service";
import type { CustomerDetails, UpsertCustomerRequest } from "@/features/customers/customer-types";
import { WhatsAppLink } from "@/features/customers/whatsapp-link";
import { useProductLookupsQuery } from "@/features/products/hooks/use-product-mutation";

type CustomerForm = {
    id?: number;
    firstName: string;
    lastName: string;
    phone: string;
    email: string;
    address: string;
    customerTypeId: string;
    creditLimit: string;
    debtDueDays: string;
};

const emptyForm = (): CustomerForm => ({ firstName: "", lastName: "", phone: "", email: "", address: "", customerTypeId: "", creditLimit: "", debtDueDays: "" });
const customerSheetGridClass = "grid grid-cols-[48px_150px_150px_160px_190px_150px_140px_130px_320px_48px] gap-2";

export default function CustomersPage() {
    const queryClient = useQueryClient();
    const { formatMoney } = useCompany();
    const { data: lookups } = useProductLookupsQuery();
    const [search, setSearch] = useState("");
    const deferredSearch = useDeferredValue(search.trim());
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [open, setOpen] = useState(false);
    const [bulkOpen, setBulkOpen] = useState(false);
    const [bulkLoading, setBulkLoading] = useState(false);
    const [bulkSaving, setBulkSaving] = useState(false);
    const [selected, setSelected] = useState<number[]>([]);
    const [form, setForm] = useState<CustomerForm>(emptyForm);
    const [rows, setRows] = useState<CustomerForm[]>([]);

    const query = useQuery({
        queryKey: ["customers", deferredSearch, page, pageSize],
        queryFn: () => customerService.getCustomers({ search: deferredSearch || undefined, page, pageSize }),
        refetchInterval: 20_000,
    });
    const create = useMutation({
        mutationFn: (request: UpsertCustomerRequest) => customerService.createCustomer(request),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ["customers"] });
            setOpen(false);
            setForm(emptyForm());
            toast.success("Customer created.");
        },
        onError: (error) => toast.error(getErrorMessage(error)),
    });

    const submit = (event: FormEvent) => {
        event.preventDefault();
        create.mutate(toRequest(form, lookups?.defaultCustomerTypeId ?? null));
    };

    const openBulkSheet = async () => {
        setBulkOpen(true);
        if (!selected.length) {
            setRows([emptyForm(), emptyForm(), emptyForm()]);
            return;
        }
        setBulkLoading(true);
        try {
            const customers = await Promise.all(selected.map((id) => customerService.getCustomer(id)));
            setRows(customers.map(toForm));
        } catch (error) {
            toast.error(getErrorMessage(error));
            setBulkOpen(false);
        } finally {
            setBulkLoading(false);
        }
    };

    const saveBulk = async () => {
        const meaningfulRows = rows.filter((row) => row.id || row.firstName.trim() || row.phone.trim());
        const invalid = meaningfulRows.findIndex((row) => !row.firstName.trim() || !row.phone.trim());
        if (invalid >= 0) return toast.error(`Row ${invalid + 1}: first name and phone are required.`);
        const phones = meaningfulRows.map((row) => row.phone.replace(/\s/g, ""));
        if (new Set(phones).size !== phones.length) return toast.error("Each bulk row must use a different phone number.");
        if (!meaningfulRows.length) return toast.error("Add at least one customer row.");

        setBulkSaving(true);
        try {
            await Promise.all(meaningfulRows.map((row) => row.id
                ? customerService.updateCustomer(row.id, toRequest(row, lookups?.defaultCustomerTypeId ?? null))
                : customerService.createCustomer(toRequest(row, lookups?.defaultCustomerTypeId ?? null))));
            await queryClient.invalidateQueries({ queryKey: ["customers"] });
            toast.success(`${meaningfulRows.length} customer row(s) saved.`);
            setSelected([]);
            setBulkOpen(false);
        } catch (error) {
            toast.error(getErrorMessage(error));
        } finally {
            setBulkSaving(false);
        }
    };

    const data = query.data;
    const allVisibleSelected = Boolean(data?.items.length) && data!.items.every((item) => selected.includes(item.id));

    return (
        <div className="space-y-5">
            <PageHeader
                title="Customers"
                description="Customer balances, credit, debt alerts, account history, and bulk maintenance in one place."
                actions={<div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => void openBulkSheet()}><Rows3 />{selected.length ? `Bulk edit (${selected.length})` : "Bulk create"}</Button><Button onClick={() => setOpen(true)}><Plus />Add customer</Button></div>}
            />
            <Card><CardContent><div className="relative max-w-xl"><Search className="absolute start-2 top-2 size-4 text-muted-foreground" /><Input className="ps-8" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search name, phone or email..." /></div></CardContent></Card>
            <Card>
                <CardContent className="overflow-x-auto px-0">
                    <Table className="min-w-[1120px]">
                        <TableHeader><TableRow><TableHead className="w-10"><Checkbox checked={allVisibleSelected} onCheckedChange={(checked) => setSelected(checked === true ? data?.items.map((item) => item.id) ?? [] : [])} /></TableHead><TableHead>Customer</TableHead><TableHead>Phone</TableHead><TableHead>Type</TableHead><TableHead>Sales</TableHead><TableHead>Outstanding debt</TableHead><TableHead>Account credit</TableHead><TableHead>Last order</TableHead><TableHead /></TableRow></TableHeader>
                        <TableBody>
                            {query.isLoading ? <TableRow><TableCell colSpan={9} className="h-24 text-center text-muted-foreground">Loading customers...</TableCell></TableRow> : null}
                            {data?.items.map((customer) => (
                                <TableRow key={customer.id} className={customer.hasOverdueDebt ? "bg-destructive/[0.035]" : undefined}>
                                    <TableCell><Checkbox checked={selected.includes(customer.id)} onCheckedChange={(checked) => setSelected((current) => checked === true ? [...new Set([...current, customer.id])] : current.filter((id) => id !== customer.id))} /></TableCell>
                                    <TableCell><div className="flex items-center gap-2"><span className="font-semibold">{customer.name}</span>{customer.isOnline ? <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700"><span className="size-2 animate-pulse rounded-full bg-emerald-500" />Online{customer.activeSessions > 1 ? ` · ${customer.activeSessions}` : ""}</Badge> : null}{customer.hasOverdueDebt ? <Badge variant="destructive"><AlertTriangle className="size-3" />Overdue</Badge> : null}</div><div className="text-muted-foreground">{customer.email ?? "No email"}</div></TableCell>
                                    <TableCell><a className="hover:text-primary hover:underline" href={`tel:${customer.phone}`}>{customer.phone}</a></TableCell>
                                    <TableCell>{customer.customerTypeName ?? "Default"}</TableCell>
                                    <TableCell>{formatMoney(customer.totalSpent)}</TableCell>
                                    <TableCell><span className={customer.outstandingDebt > 0 ? "font-semibold text-destructive" : "text-muted-foreground"}>{formatMoney(customer.outstandingDebt)}</span><div className="text-xs text-muted-foreground">Limit {formatMoney(customer.creditLimit)}</div></TableCell>
                                    <TableCell><span className={customer.accountCredit > 0 ? "font-semibold text-emerald-600" : "text-muted-foreground"}>{formatMoney(customer.accountCredit)}</span></TableCell>
                                    <TableCell>{customer.lastOrderAt ? new Date(customer.lastOrderAt).toLocaleString() : "—"}</TableCell>
                                    <TableCell><div className="flex justify-end gap-2"><WhatsAppLink url={customer.whatsAppUrl} customerName={customer.name} compact /><Link className={buttonVariants({ size: "sm", variant: "outline" })} to={`/customers/${customer.id}`}><Eye className="size-3.5" />View</Link></div></TableCell>
                                </TableRow>
                            ))}
                            {!query.isLoading && data?.items.length === 0 ? <TableRow><TableCell colSpan={9} className="h-24 text-center text-muted-foreground">No customers found.</TableCell></TableRow> : null}
                        </TableBody>
                    </Table>
                </CardContent>
                <ListPagination page={page} pageSize={pageSize} totalCount={data?.totalCount ?? 0} totalPages={data?.totalPages} disabled={query.isFetching} onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} />
            </Card>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="sm:max-w-2xl"><form onSubmit={submit}><DialogHeader><DialogTitle>Add customer</DialogTitle><DialogDescription>Create the account and optional customer-specific credit policy.</DialogDescription></DialogHeader><CustomerFields form={form} setForm={setForm} customerTypes={lookups?.customerTypes ?? []} defaultCustomerTypeId={lookups?.defaultCustomerTypeId ?? null} /><DialogFooter><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" disabled={create.isPending || !form.firstName.trim() || !form.phone.trim()}>{create.isPending ? "Saving..." : "Create customer"}</Button></DialogFooter></form></DialogContent>
            </Dialog>

            <Sheet open={bulkOpen} onOpenChange={setBulkOpen}>
                <SheetContent className="!w-screen !max-w-none border-0" side="right">
                    <SheetHeader className="border-b"><SheetTitle>Customer sheet</SheetTitle><SheetDescription>{selected.length ? "Edit selected customers together." : "Create several customers in a spreadsheet-style form."} Empty rows are ignored.</SheetDescription></SheetHeader>
                    <div className="min-h-0 flex-1 overflow-auto p-4">
                        {bulkLoading ? <div className="grid h-48 place-items-center"><LoaderCircle className="size-6 animate-spin" /></div> : (
                            <div className="w-full min-w-[1560px] overflow-hidden rounded-xl border">
                                <div className={`${customerSheetGridClass} sticky top-0 z-10 border-b bg-muted p-2 text-xs font-bold shadow-sm`}><span>#</span><span>First name *</span><span>Last name</span><span>Phone *</span><span>Email</span><span>Customer type</span><span>Credit limit</span><span>Debt due days</span><span>Address</span><span /></div>
                                {rows.map((row, index) => <BulkCustomerRow key={`${row.id ?? "new"}-${index}`} row={row} index={index} customerTypes={lookups?.customerTypes ?? []} defaultCustomerTypeId={lookups?.defaultCustomerTypeId ?? null} onChange={(next) => setRows((current) => current.map((item, itemIndex) => itemIndex === index ? next : item))} onRemove={() => setRows((current) => current.filter((_, itemIndex) => itemIndex !== index))} />)}
                            </div>
                        )}
                    </div>
                    <SheetFooter className="flex-row justify-between border-t"><Button variant="outline" onClick={() => setRows((current) => [...current, emptyForm()])}><Plus />Add row</Button><div className="flex gap-2"><Button variant="outline" onClick={() => setBulkOpen(false)}>Cancel</Button><Button disabled={bulkSaving || bulkLoading} onClick={() => void saveBulk()}>{bulkSaving ? <LoaderCircle className="animate-spin" /> : <Rows3 />}Save sheet</Button></div></SheetFooter>
                </SheetContent>
            </Sheet>
        </div>
    );
}

function CustomerFields({ form, setForm, customerTypes, defaultCustomerTypeId }: { form: CustomerForm; setForm: React.Dispatch<React.SetStateAction<CustomerForm>>; customerTypes: { id: number; name: string }[]; defaultCustomerTypeId: number | null }) {
    return <div className="my-5 grid gap-4 sm:grid-cols-2"><Field label="First name *"><Input value={form.firstName} onChange={(event) => setForm((x) => ({ ...x, firstName: event.target.value }))} /></Field><Field label="Last name"><Input value={form.lastName} onChange={(event) => setForm((x) => ({ ...x, lastName: event.target.value }))} /></Field><Field label="Phone *"><Input value={form.phone} onChange={(event) => setForm((x) => ({ ...x, phone: event.target.value }))} /></Field><Field label="Email"><Input type="email" value={form.email} onChange={(event) => setForm((x) => ({ ...x, email: event.target.value }))} /></Field><Field label="Customer type"><CustomerTypeSelect value={form.customerTypeId} options={customerTypes} defaultId={defaultCustomerTypeId} onChange={(customerTypeId) => setForm((x) => ({ ...x, customerTypeId }))} /></Field><Field label="Credit limit override"><Input type="number" min={0} value={form.creditLimit} placeholder="Use company limit" onChange={(event) => setForm((x) => ({ ...x, creditLimit: event.target.value }))} /></Field><Field label="Debt due days override"><Input type="number" min={0} max={3650} value={form.debtDueDays} placeholder="Use company default" onChange={(event) => setForm((x) => ({ ...x, debtDueDays: event.target.value }))} /></Field><div className="space-y-2 sm:col-span-2"><Label>Address</Label><Textarea value={form.address} onChange={(event) => setForm((x) => ({ ...x, address: event.target.value }))} /></div></div>;
}

function BulkCustomerRow({ row, index, customerTypes, defaultCustomerTypeId, onChange, onRemove }: { row: CustomerForm; index: number; customerTypes: { id: number; name: string }[]; defaultCustomerTypeId: number | null; onChange: (row: CustomerForm) => void; onRemove: () => void }) {
    const field = (key: keyof CustomerForm, value: string) => onChange({ ...row, [key]: value });
    return <div className={`${customerSheetGridClass} border-b p-2 last:border-b-0`}><span className="self-center text-center font-semibold text-muted-foreground">{index + 1}</span><Input value={row.firstName} onChange={(event) => field("firstName", event.target.value)} /><Input value={row.lastName} onChange={(event) => field("lastName", event.target.value)} /><Input value={row.phone} onChange={(event) => field("phone", event.target.value)} /><Input type="email" value={row.email} onChange={(event) => field("email", event.target.value)} /><CustomerTypeSelect value={row.customerTypeId} options={customerTypes} defaultId={defaultCustomerTypeId} onChange={(value) => field("customerTypeId", value)} /><Input type="number" min={0} value={row.creditLimit} onChange={(event) => field("creditLimit", event.target.value)} /><Input type="number" min={0} max={3650} value={row.debtDueDays} onChange={(event) => field("debtDueDays", event.target.value)} /><Input aria-label={`Address for customer row ${index + 1}`} placeholder="Street, city, area or delivery details" title={row.address || "Customer address"} value={row.address} onChange={(event) => field("address", event.target.value)} /><Button type="button" aria-label={`Remove customer row ${index + 1}`} size="icon" variant="ghost" onClick={onRemove}><Trash2 className="size-4 text-destructive" /></Button></div>;
}

function CustomerTypeSelect({ value, options, defaultId, onChange }: { value: string; options: { id: number; name: string }[]; defaultId: number | null; onChange: (value: string) => void }) {
    const selectedValue = value || (defaultId ? String(defaultId) : null);
    return (
        <SimpleCombobox<string>
            value={selectedValue}
            onValueChange={(next) => onChange(next ?? "")}
            options={options.map((option) => ({
                value: String(option.id),
                label: option.name,
                description: option.id === defaultId ? "Default customer type" : undefined,
            }))}
            placeholder="Select customer type"
            emptyText="No customer types found."
        />
    );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="space-y-2"><Label>{label}</Label>{children}</div>; }
function clean(value: string) { const result = value.trim(); return result || null; }
function toRequest(form: CustomerForm, defaultCustomerTypeId: number | null): UpsertCustomerRequest { return { firstName: form.firstName.trim(), lastName: clean(form.lastName), phone: form.phone.trim(), email: clean(form.email), address: clean(form.address), customerTypeId: form.customerTypeId ? Number(form.customerTypeId) : defaultCustomerTypeId, creditLimit: form.creditLimit === "" ? null : Number(form.creditLimit), debtDueDays: form.debtDueDays === "" ? null : Number(form.debtDueDays) }; }
function toForm(customer: CustomerDetails): CustomerForm { return { id: customer.id, firstName: customer.firstName, lastName: customer.lastName ?? "", phone: customer.phone, email: customer.email ?? "", address: customer.address ?? "", customerTypeId: customer.customerTypeId ? String(customer.customerTypeId) : "", creditLimit: customer.creditLimit ? String(customer.creditLimit) : "", debtDueDays: String(customer.debtDueDays) }; }
function getErrorMessage(error: unknown) { return (error as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message ?? (error as Error)?.message ?? "The operation failed."; }
