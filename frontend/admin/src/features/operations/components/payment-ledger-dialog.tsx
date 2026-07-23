import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Banknote, LoaderCircle, Plus } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import type { DocumentPayment, PaymentStatus } from "@/features/operations/operations-types";

interface PaymentLedgerDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    description: string;
    documentNumber: string;
    total: number;
    paidAmount: number;
    remainingAmount: number;
    paymentStatus: PaymentStatus;
    queryKey: readonly unknown[];
    loadPayments: () => Promise<{ data: DocumentPayment[] }>;
    addPayment: (body: unknown) => Promise<unknown>;
    invalidate: readonly (readonly unknown[])[];
    canManage: boolean;
}

const today = () => new Date().toISOString().slice(0, 10);

export function PaymentLedgerDialog(props: PaymentLedgerDialogProps) {
    const queryClient = useQueryClient();
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({ amount: props.remainingAmount, paymentDate: today(), paymentMethod: "Cash", referenceNumber: "", notes: "" });
    const query = useQuery({
        queryKey: props.queryKey,
        queryFn: async () => (await props.loadPayments()).data,
        enabled: props.open,
    });

    const maxAmount = useMemo(() => Math.max(0, props.remainingAmount), [props.remainingAmount]);

    const record = async () => {
        if (form.amount <= 0 || form.amount > maxAmount) {
            toast.error(`Payment must be greater than zero and no more than ${money(maxAmount)}.`);
            return;
        }
        setSaving(true);
        try {
            await props.addPayment({
                amount: form.amount,
                paymentDate: form.paymentDate,
                paymentMethod: form.paymentMethod,
                referenceNumber: nullable(form.referenceNumber),
                notes: nullable(form.notes),
            });
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: props.queryKey }),
                ...props.invalidate.map((key) => queryClient.invalidateQueries({ queryKey: key })),
            ]);
            toast.success("Payment installment recorded.");
            setForm({ amount: 0, paymentDate: today(), paymentMethod: "Cash", referenceNumber: "", notes: "" });
        } catch (error) {
            toast.error(message(error));
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={props.open} onOpenChange={props.onOpenChange}>
            <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
                <DialogHeader>
                    <DialogTitle>{props.title}</DialogTitle>
                    <DialogDescription>{props.description} · {props.documentNumber}</DialogDescription>
                </DialogHeader>

                <div className="grid gap-3 sm:grid-cols-3">
                    <Summary label="Total" value={props.total} />
                    <Summary label="Paid" value={props.paidAmount} />
                    <Summary label="Remaining" value={props.remainingAmount} emphasis />
                </div>

                <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-4 py-3">
                    <span className="text-sm text-muted-foreground">Payment status</span>
                    <PaymentBadge status={props.paymentStatus} />
                </div>

                {props.canManage && maxAmount > 0 ? (
                    <Card>
                        <CardContent className="space-y-4 p-4">
                            <div className="flex items-center gap-2 font-semibold"><Banknote className="size-4" />Add payment</div>
                            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                                <Field label="Amount"><Input type="number" min={0.01} max={maxAmount} step="0.01" value={form.amount} onChange={(event) => setForm((x) => ({ ...x, amount: Number(event.target.value) }))} /></Field>
                                <Field label="Payment date"><Input type="date" value={form.paymentDate} onChange={(event) => setForm((x) => ({ ...x, paymentDate: event.target.value }))} /></Field>
                                <Field label="Method"><select className="h-9 w-full border bg-background px-3 text-sm" value={form.paymentMethod} onChange={(event) => setForm((x) => ({ ...x, paymentMethod: event.target.value }))}><option>Cash</option><option>Card</option><option>Bank transfer</option><option>Cheque</option><option>Other</option></select></Field>
                                <Field label="Reference"><Input value={form.referenceNumber} onChange={(event) => setForm((x) => ({ ...x, referenceNumber: event.target.value }))} /></Field>
                            </div>
                            <Field label="Notes"><Textarea rows={2} value={form.notes} onChange={(event) => setForm((x) => ({ ...x, notes: event.target.value }))} /></Field>
                            <Button onClick={() => void record()} disabled={saving || form.amount <= 0}>
                                {saving ? <LoaderCircle className="me-2 size-4 animate-spin" /> : <Plus className="me-2 size-4" />}
                                Record installment
                            </Button>
                        </CardContent>
                    </Card>
                ) : null}

                <div className="overflow-hidden rounded-lg border">
                    <Table>
                        <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Method</TableHead><TableHead>Reference</TableHead><TableHead>Notes</TableHead><TableHead className="text-end">Amount</TableHead></TableRow></TableHeader>
                        <TableBody>
                            {query.isLoading ? <TableRow><TableCell colSpan={5} className="h-24 text-center"><LoaderCircle className="mx-auto size-5 animate-spin" /></TableCell></TableRow> : query.data?.length ? query.data.map((payment) => <TableRow key={payment.id}><TableCell>{date(payment.paymentDate)}</TableCell><TableCell>{payment.paymentMethod}</TableCell><TableCell>{payment.referenceNumber ?? "—"}</TableCell><TableCell className="max-w-xs truncate">{payment.notes ?? "—"}</TableCell><TableCell className="text-end font-medium">{money(payment.amount)}</TableCell></TableRow>) : <TableRow><TableCell colSpan={5} className="h-24 text-center text-muted-foreground">No payments have been recorded.</TableCell></TableRow>}
                        </TableBody>
                    </Table>
                </div>
                <DialogFooter><Button variant="outline" onClick={() => props.onOpenChange(false)}>Close</Button></DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export function PaymentBadge({ status }: { status: PaymentStatus }) {
    return <Badge variant={status === "Paid" ? "default" : status === "Partial" ? "secondary" : "outline"}>{status}</Badge>;
}

function Summary({ label, value, emphasis = false }: { label: string; value: number; emphasis?: boolean }) { return <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">{label}</p><p className={emphasis ? "mt-1 text-xl font-bold text-primary" : "mt-1 text-xl font-bold"}>{money(value)}</p></CardContent></Card>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="space-y-2"><Label>{label}</Label>{children}</div>; }
function nullable(value: string) { const result = value.trim(); return result || null; }
function money(value: number) { return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(value); }
function date(value: string) { return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`)); }
function message(error: unknown) { return (error as { response?: { data?: { message?: string } }; message?: string }).response?.data?.message ?? (error as Error).message ?? "The operation failed."; }
