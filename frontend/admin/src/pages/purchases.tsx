import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CreditCard, LoaderCircle, PackagePlus, Pencil, Save, Truck } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-header";
import { ServerSearchCombobox } from "@/components/server-search-combobox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useAdminAuth } from "@/features/auth/auth-context";
import { hasPermission, Permissions } from "@/features/auth/permissions";
import { DocumentLines, newDocumentItem } from "@/features/operations/components/document-lines";
import { PaymentBadge, PaymentLedgerDialog } from "@/features/operations/components/payment-ledger-dialog";
import { operationKeys, useOperationQuery } from "@/features/operations/operations-hooks";
import { operationsService } from "@/features/operations/operations-service";
import type { DocumentItem, Purchase, Supplier } from "@/features/operations/operations-types";

const today = () => new Date().toISOString().slice(0, 10);
const emptySupplier = () => ({ name: "", contactPerson: "", phone: "", email: "", address: "", taxNumber: "", isActive: true });

export default function PurchasesPage() {
    const queryClient = useQueryClient();
    const { user } = useAdminAuth();
    const canManage = hasPermission(user, Permissions.PurchasesManage);
    const { data: purchases, isLoading } = useOperationQuery(operationKeys.purchases, operationsService.purchases);
    const { data: suppliers, isLoading: suppliersLoading } = useOperationQuery(operationKeys.suppliers, () => operationsService.suppliersResponse("", 100));
    const [tab, setTab] = useState<"purchases" | "suppliers">("purchases");
    const [purchaseOpen, setPurchaseOpen] = useState(false);
    const [supplierOpen, setSupplierOpen] = useState(false);
    const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
    const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
    const [selectedPurchase, setSelectedPurchase] = useState<Purchase | null>(null);
    const [saving, setSaving] = useState(false);
    const [items, setItems] = useState<DocumentItem[]>([newDocumentItem()]);
    const [form, setForm] = useState({ purchaseDate: today(), discount: 0, tax: 0, otherCost: 0, paidAmount: 0, paymentMethod: "Cash", paymentReferenceNumber: "", referenceNumber: "", notes: "" });
    const [supplier, setSupplier] = useState(emptySupplier);

    const subtotal = useMemo(() => items.reduce((sum, item) => sum + item.quantity * item.amount, 0), [items]);
    const total = Math.max(0, subtotal - form.discount + form.tax + form.otherCost);

    const resetPurchase = () => {
        setItems([newDocumentItem()]); setSelectedSupplier(null);
        setForm({ purchaseDate: today(), discount: 0, tax: 0, otherCost: 0, paidAmount: 0, paymentMethod: "Cash", paymentReferenceNumber: "", referenceNumber: "", notes: "" });
    };
    const openSupplier = (item?: Supplier) => {
        setEditingSupplier(item ?? null);
        setSupplier(item ? { name: item.name, contactPerson: item.contactPerson ?? "", phone: item.phone ?? "", email: item.email ?? "", address: item.address ?? "", taxNumber: item.taxNumber ?? "", isActive: item.isActive } : emptySupplier());
        setSupplierOpen(true);
    };
    const submit = async () => {
        if (!canManage) return;
        if (items.some((item) => !item.productId || item.quantity <= 0 || item.amount < 0)) return toast.error("Complete every purchase line.");
        if (new Set(items.map((item) => item.productId)).size !== items.length) return toast.error("Each product may appear only once.");
        if (form.paidAmount < 0 || form.paidAmount > total) return toast.error("Opening payment must be between zero and the purchase total.");
        setSaving(true);
        try {
            await operationsService.createPurchase({ ...form, supplierId: selectedSupplier?.id ?? null, paymentReferenceNumber: nullable(form.paymentReferenceNumber), referenceNumber: nullable(form.referenceNumber), notes: nullable(form.notes), items: items.map((item) => ({ productId: item.productId, quantity: item.quantity, unitCost: item.amount, lotNumber: nullable(item.lotNumber ?? ""), expireDate: item.expireDate || null })) });
            await Promise.all([queryClient.invalidateQueries({ queryKey: operationKeys.purchases }), queryClient.invalidateQueries({ queryKey: operationKeys.summary }), queryClient.invalidateQueries({ queryKey: ["inventory"] })]);
            toast.success("Purchase received and inventory updated."); setPurchaseOpen(false); resetPurchase();
        } catch (error) { toast.error(message(error)); } finally { setSaving(false); }
    };
    const saveSupplier = async () => {
        if (!supplier.name.trim()) return toast.error("Supplier name is required.");
        setSaving(true);
        try {
            await operationsService.saveSupplier(editingSupplier?.id ?? null, { name: supplier.name.trim(), contactPerson: nullable(supplier.contactPerson), phone: nullable(supplier.phone), email: nullable(supplier.email), address: nullable(supplier.address), taxNumber: nullable(supplier.taxNumber), isActive: supplier.isActive });
            await queryClient.invalidateQueries({ queryKey: operationKeys.suppliers });
            toast.success(editingSupplier ? "Supplier updated." : "Supplier created."); setSupplierOpen(false);
        } catch (error) { toast.error(message(error)); } finally { setSaving(false); }
    };

    return <div className="space-y-6">
        <PageHeader title="Purchases" description="Receive inventory, track supplier credit, and settle balances with an auditable payment history." actions={canManage ? <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => openSupplier()}><Truck className="me-2 size-4" />New supplier</Button><Button onClick={() => setPurchaseOpen(true)}><PackagePlus className="me-2 size-4" />New purchase</Button></div> : undefined} />
        <div className="inline-flex rounded-lg border bg-muted/40 p-1"><Button size="sm" variant={tab === "purchases" ? "default" : "ghost"} onClick={() => setTab("purchases")}>Purchases</Button><Button size="sm" variant={tab === "suppliers" ? "default" : "ghost"} onClick={() => setTab("suppliers")}>Suppliers</Button></div>
        {tab === "purchases" ? <Card><CardContent className="p-0"><Table><TableHeader><TableRow><TableHead>Purchase</TableHead><TableHead>Date</TableHead><TableHead>Supplier</TableHead><TableHead>Items</TableHead><TableHead className="text-end">Total</TableHead><TableHead className="text-end">Paid</TableHead><TableHead className="text-end">Balance</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader><TableBody>{isLoading ? <Loading colSpan={9} /> : purchases?.length ? purchases.map((purchase) => <TableRow key={purchase.id}><TableCell className="font-medium">{purchase.purchaseNumber}</TableCell><TableCell>{date(purchase.purchaseDate)}</TableCell><TableCell>{purchase.supplierName ?? "Direct purchase"}</TableCell><TableCell>{purchase.itemCount}</TableCell><TableCell className="text-end">{money(purchase.total)}</TableCell><TableCell className="text-end">{money(purchase.paidAmount)}</TableCell><TableCell className="text-end">{money(purchase.remainingAmount)}</TableCell><TableCell><PaymentBadge status={purchase.paymentStatus} /></TableCell><TableCell>{purchase.paymentStatus !== "Paid" || purchase.paidAmount > 0 ? <Button size="sm" variant="outline" onClick={() => setSelectedPurchase(purchase)}><CreditCard className="me-2 size-4" />Payments</Button> : null}</TableCell></TableRow>) : <Empty colSpan={9} text="No purchases have been recorded." />}</TableBody></Table></CardContent></Card> : <Card><CardContent className="p-0"><Table><TableHeader><TableRow><TableHead>Supplier</TableHead><TableHead>Contact</TableHead><TableHead>Phone / email</TableHead><TableHead>Tax number</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader><TableBody>{suppliersLoading ? <Loading colSpan={6} /> : suppliers?.length ? suppliers.map((item) => <TableRow key={item.id}><TableCell><p className="font-medium">{item.name}</p><p className="text-xs text-muted-foreground">{item.address ?? "No address"}</p></TableCell><TableCell>{item.contactPerson ?? "—"}</TableCell><TableCell>{item.phone ?? "—"}<p className="text-xs text-muted-foreground">{item.email ?? ""}</p></TableCell><TableCell>{item.taxNumber ?? "—"}</TableCell><TableCell><Badge variant={item.isActive ? "default" : "outline"}>{item.isActive ? "Active" : "Inactive"}</Badge></TableCell><TableCell>{canManage ? <Button size="icon" variant="ghost" onClick={() => openSupplier(item)}><Pencil className="size-4" /></Button> : null}</TableCell></TableRow>) : <Empty colSpan={6} text="No suppliers have been added." />}</TableBody></Table></CardContent></Card>}

        <Dialog open={purchaseOpen} onOpenChange={setPurchaseOpen}><DialogContent className="max-h-[94vh] overflow-y-auto sm:max-w-6xl"><DialogHeader><DialogTitle>Receive purchase</DialogTitle><DialogDescription>Record products and optionally enter the first supplier payment. Additional installments remain available from the purchase table.</DialogDescription></DialogHeader><div className="grid gap-4 md:grid-cols-3"><Field label="Supplier"><ServerSearchCombobox<Supplier> value={selectedSupplier} onValueChange={setSelectedSupplier} queryKey={["operations", "supplier-search"]} search={(search) => operationsService.suppliers(search, 20)} getLabel={(item) => item.name} getDescription={(item) => [item.contactPerson, item.phone].filter(Boolean).join(" · ")} placeholder="Search supplier…" /></Field><Field label="Purchase date"><Input type="date" value={form.purchaseDate} onChange={(event) => setForm((x) => ({ ...x, purchaseDate: event.target.value }))} /></Field><Field label="Supplier reference"><Input value={form.referenceNumber} onChange={(event) => setForm((x) => ({ ...x, referenceNumber: event.target.value }))} /></Field></div><DocumentLines items={items} setItems={setItems} mode="purchase" /><div className="grid gap-5 md:grid-cols-[1fr_380px] md:items-start"><Field label="Notes"><Textarea rows={7} value={form.notes} onChange={(event) => setForm((x) => ({ ...x, notes: event.target.value }))} /></Field><div className="space-y-3"><h3 className="font-semibold">Purchase totals</h3><Card><CardContent className="space-y-3 p-4"><MoneyRow label="Subtotal" value={subtotal} /><NumberField label="Discount" value={form.discount} set={(value) => setForm((x) => ({ ...x, discount: value }))} /><NumberField label="Tax" value={form.tax} set={(value) => setForm((x) => ({ ...x, tax: value }))} /><NumberField label="Other cost" value={form.otherCost} set={(value) => setForm((x) => ({ ...x, otherCost: value }))} /><div className="border-t pt-3"><MoneyRow label="Total" value={total} strong /></div><NumberField label="Opening payment" value={form.paidAmount} set={(value) => setForm((x) => ({ ...x, paidAmount: value }))} /><Field label="Payment method"><select className="h-9 w-full border bg-background px-3 text-sm" value={form.paymentMethod} onChange={(event) => setForm((x) => ({ ...x, paymentMethod: event.target.value }))}><option>Cash</option><option>Bank transfer</option><option>Card</option><option>Cheque</option><option>Credit</option></select></Field><Field label="Payment reference"><Input value={form.paymentReferenceNumber} onChange={(event) => setForm((x) => ({ ...x, paymentReferenceNumber: event.target.value }))} /></Field><MoneyRow label="Remaining after save" value={Math.max(0, total - form.paidAmount)} /></CardContent></Card></div></div><DialogFooter><Button variant="outline" onClick={() => setPurchaseOpen(false)}>Cancel</Button><Button onClick={() => void submit()} disabled={saving}>{saving ? <LoaderCircle className="me-2 size-4 animate-spin" /> : <Save className="me-2 size-4" />}Receive purchase</Button></DialogFooter></DialogContent></Dialog>
        <Dialog open={supplierOpen} onOpenChange={setSupplierOpen}><DialogContent><DialogHeader><DialogTitle>{editingSupplier ? "Edit supplier" : "New supplier"}</DialogTitle><DialogDescription>Supplier details are available for future purchases and server-side search.</DialogDescription></DialogHeader><div className="grid gap-4 sm:grid-cols-2"><Field label="Supplier name"><Input value={supplier.name} onChange={(event) => setSupplier((x) => ({ ...x, name: event.target.value }))} /></Field><Field label="Contact person"><Input value={supplier.contactPerson} onChange={(event) => setSupplier((x) => ({ ...x, contactPerson: event.target.value }))} /></Field><Field label="Phone"><Input value={supplier.phone} onChange={(event) => setSupplier((x) => ({ ...x, phone: event.target.value }))} /></Field><Field label="Email"><Input value={supplier.email} onChange={(event) => setSupplier((x) => ({ ...x, email: event.target.value }))} /></Field><Field label="Tax number"><Input value={supplier.taxNumber} onChange={(event) => setSupplier((x) => ({ ...x, taxNumber: event.target.value }))} /></Field><div className="flex items-end"><label className="flex h-9 items-center gap-2"><Checkbox checked={supplier.isActive} onCheckedChange={(checked) => setSupplier((x) => ({ ...x, isActive: checked === true }))} />Active supplier</label></div><div className="space-y-2 sm:col-span-2"><Label>Address</Label><Textarea value={supplier.address} onChange={(event) => setSupplier((x) => ({ ...x, address: event.target.value }))} /></div></div><DialogFooter><Button variant="outline" onClick={() => setSupplierOpen(false)}>Cancel</Button><Button onClick={() => void saveSupplier()} disabled={saving}>{saving ? <LoaderCircle className="me-2 size-4 animate-spin" /> : <Save className="me-2 size-4" />}Save supplier</Button></DialogFooter></DialogContent></Dialog>
        {selectedPurchase ? <PaymentLedgerDialog open={Boolean(selectedPurchase)} onOpenChange={(open) => { if (!open) setSelectedPurchase(null); }} title="Purchase payments" description="Record supplier installments without modifying earlier payments" documentNumber={selectedPurchase.purchaseNumber} total={selectedPurchase.total} paidAmount={selectedPurchase.paidAmount} remainingAmount={selectedPurchase.remainingAmount} paymentStatus={selectedPurchase.paymentStatus} queryKey={operationKeys.purchasePayments(selectedPurchase.id)} loadPayments={() => operationsService.purchasePayments(selectedPurchase.id)} addPayment={(body) => operationsService.addPurchasePayment(selectedPurchase.id, body)} invalidate={[operationKeys.purchases, operationKeys.summary]} canManage={canManage} /> : null}
    </div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="space-y-2"><Label>{label}</Label>{children}</div>; }
function NumberField({ label, value, set }: { label: string; value: number; set: (value: number) => void }) { return <div className="flex items-center justify-between gap-3"><Label>{label}</Label><Input className="w-32 text-end" type="number" min={0} step="0.01" value={value} onChange={(event) => set(Number(event.target.value))} /></div>; }
function MoneyRow({ label, value, strong = false }: { label: string; value: number; strong?: boolean }) { return <div className={`flex justify-between ${strong ? "text-lg font-bold" : "text-sm"}`}><span>{label}</span><span>{money(value)}</span></div>; }
function Loading({ colSpan }: { colSpan: number }) { return <TableRow><TableCell colSpan={colSpan} className="h-32 text-center"><LoaderCircle className="mx-auto size-5 animate-spin" /></TableCell></TableRow>; }
function Empty({ colSpan, text }: { colSpan: number; text: string }) { return <TableRow><TableCell colSpan={colSpan} className="h-32 text-center text-muted-foreground">{text}</TableCell></TableRow>; }
function nullable(value: string) { const result = value.trim(); return result || null; }
function money(value: number) { return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(value); }
function date(value: string) { return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`)); }
function message(error: unknown) { return (error as { response?: { data?: { message?: string } }; message?: string }).response?.data?.message ?? (error as Error).message ?? "The operation failed."; }
