import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CircleDollarSign, LoaderCircle, Save } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useAdminAuth } from "@/features/auth/auth-context";
import { hasPermission, Permissions } from "@/features/auth/permissions";
import { operationKeys, useOperationQuery } from "@/features/operations/operations-hooks";
import { operationsService } from "@/features/operations/operations-service";
import type { DocumentItem } from "@/features/operations/operations-types";
import { DocumentLines } from "@/pages/purchases";

const today = () => new Date().toISOString().slice(0, 10);
const newItem = (): DocumentItem => ({ productId: 0, quantity: 1, amount: 0 });
export default function ManualSalesPage() {
  const qc = useQueryClient();
  const { user } = useAdminAuth();
  const canManage = hasPermission(user, Permissions.ManualSalesManage);
  const { data: sales, isLoading } = useOperationQuery(operationKeys.sales, operationsService.sales);
  const { data: products } = useOperationQuery(operationKeys.products, operationsService.products);
  const [open, setOpen] = useState(false); const [saving, setSaving] = useState(false);
  const [items, setItems] = useState<DocumentItem[]>([newItem()]);
  const [form, setForm] = useState({ customerName: "", customerPhone: "", saleDate: today(), discount: 0, tax: 0, paidAmount: 0, paymentMethod: "Cash", notes: "" });
  const subtotal = useMemo(() => items.reduce((sum, item) => sum + item.quantity * item.amount, 0), [items]);
  const total = Math.max(0, subtotal - form.discount + form.tax);
  const submit = async () => {
    if (!canManage) return;
    if (items.some(x => !x.productId || x.quantity <= 0 || x.amount < 0)) return toast.error("Complete every sale line.");
    for (const item of items) { const product = products?.find(x => x.id === item.productId); if (product && item.quantity > product.availableQuantity) return toast.error(`${product.name} has only ${product.availableQuantity} available.`); }
    setSaving(true);
    try {
      await operationsService.createSale({ ...form, customerName: form.customerName || null, customerPhone: form.customerPhone || null, customerId: null, items: items.map(x => ({ productId: x.productId, quantity: x.quantity, unitPrice: x.amount })) });
      await Promise.all([qc.invalidateQueries({ queryKey: operationKeys.sales }), qc.invalidateQueries({ queryKey: operationKeys.products }), qc.invalidateQueries({ queryKey: operationKeys.summary }), qc.invalidateQueries({ queryKey: ["inventory"] })]);
      toast.success("Sale recorded and stock deducted."); setOpen(false); setItems([newItem()]); setForm({ customerName: "", customerPhone: "", saleDate: today(), discount: 0, tax: 0, paidAmount: 0, paymentMethod: "Cash", notes: "" });
    } catch (e) { toast.error(message(e)); } finally { setSaving(false); }
  };
  return <div className="space-y-6"><PageHeader title="Manual sales" description="Record in-store or counter sales without changing the storefront order workflow." actions={canManage ? <Button onClick={() => setOpen(true)}><CircleDollarSign className="me-2 size-4" />New sale</Button> : undefined} />
    <Card><CardContent className="p-0"><Table><TableHeader><TableRow><TableHead>Sale</TableHead><TableHead>Date</TableHead><TableHead>Customer</TableHead><TableHead>Items</TableHead><TableHead className="text-end">Total</TableHead><TableHead className="text-end">Paid</TableHead><TableHead>Status</TableHead></TableRow></TableHeader><TableBody>{isLoading ? <Loading colSpan={7} /> : sales?.length ? sales.map(x => <TableRow key={x.id}><TableCell className="font-medium">{x.saleNumber}</TableCell><TableCell>{date(x.saleDate)}</TableCell><TableCell>{x.customerName}</TableCell><TableCell>{x.itemCount}</TableCell><TableCell className="text-end">{money(x.total)}</TableCell><TableCell className="text-end">{money(x.paidAmount)}</TableCell><TableCell><Badge variant={x.paymentStatus === "Paid" ? "default" : "outline"}>{x.paymentStatus}</Badge></TableCell></TableRow>) : <Empty colSpan={7} text="No manual sales have been recorded." />}</TableBody></Table></CardContent></Card>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[94vh] overflow-y-auto sm:max-w-6xl"><DialogHeader><DialogTitle>Record manual sale</DialogTitle><DialogDescription>Available stock is checked again by the server before the sale is saved.</DialogDescription></DialogHeader>
      <div className="grid gap-4 md:grid-cols-4"><Field label="Customer name"><Input value={form.customerName} onChange={e => setForm(x => ({ ...x, customerName: e.target.value }))} placeholder="Walk-in customer" /></Field><Field label="Phone"><Input value={form.customerPhone} onChange={e => setForm(x => ({ ...x, customerPhone: e.target.value }))} /></Field><Field label="Sale date"><Input type="date" value={form.saleDate} onChange={e => setForm(x => ({ ...x, saleDate: e.target.value }))} /></Field><Field label="Payment method"><select className="h-9 w-full rounded-md border bg-background px-3" value={form.paymentMethod} onChange={e => setForm(x => ({ ...x, paymentMethod: e.target.value }))}><option>Cash</option><option>Card</option><option>Bank transfer</option><option>Credit</option></select></Field></div>
      <DocumentLines items={items} setItems={setItems} products={products ?? []} />
      <div className="grid gap-4 md:grid-cols-[1fr_360px]"><Field label="Notes"><Textarea rows={5} value={form.notes} onChange={e => setForm(x => ({ ...x, notes: e.target.value }))} /></Field><Card><CardContent className="space-y-3 p-4"><MoneyRow label="Subtotal" value={subtotal} /><NumberField label="Discount" value={form.discount} set={v => setForm(x => ({ ...x, discount: v }))} /><NumberField label="Tax" value={form.tax} set={v => setForm(x => ({ ...x, tax: v }))} /><div className="border-t pt-3"><MoneyRow label="Sale total" value={total} strong /></div><NumberField label="Paid amount" value={form.paidAmount} set={v => setForm(x => ({ ...x, paidAmount: v }))} /></CardContent></Card></div>
      <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={submit} disabled={saving}>{saving ? <LoaderCircle className="me-2 size-4 animate-spin" /> : <Save className="me-2 size-4" />}Complete sale</Button></DialogFooter>
    </DialogContent></Dialog></div>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="space-y-2"><Label>{label}</Label>{children}</div>; }
function NumberField({ label, value, set }: { label: string; value: number; set: (v: number) => void }) { return <div className="flex items-center justify-between gap-3"><Label>{label}</Label><Input className="w-32 text-end" type="number" min={0} step="0.01" value={value} onChange={e => set(Number(e.target.value))} /></div>; }
function MoneyRow({ label, value, strong = false }: { label: string; value: number; strong?: boolean }) { return <div className={`flex justify-between ${strong ? "text-lg font-bold" : "text-sm"}`}><span>{label}</span><span>{money(value)}</span></div>; }
function Loading({ colSpan }: { colSpan: number }) { return <TableRow><TableCell colSpan={colSpan} className="h-32 text-center"><LoaderCircle className="mx-auto size-5 animate-spin" /></TableCell></TableRow>; }
function Empty({ colSpan, text }: { colSpan: number; text: string }) { return <TableRow><TableCell colSpan={colSpan} className="h-32 text-center text-muted-foreground">{text}</TableCell></TableRow>; }
function money(value: number) { return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(value); }
function date(value: string) { return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`)); }
function message(error: unknown) { return (error as { response?: { data?: { message?: string } }; message?: string }).response?.data?.message ?? (error as Error).message ?? "The operation failed."; }
