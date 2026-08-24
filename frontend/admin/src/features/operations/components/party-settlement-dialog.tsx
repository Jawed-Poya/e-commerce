import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
    ArrowDownToLine,
    ArrowUpFromLine,
    Landmark,
    LoaderCircle,
    ReceiptText,
    ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";

import { SimpleCombobox } from "@/components/simple-combobox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCompany } from "@/features/company/company-context";
import { operationsService } from "@/features/operations/operations-service";
import type {
    RecordDocumentPayment,
} from "@/features/operations/operations-types";
import { getApiErrorMessage } from "@/lib/api-error";

export type PartySettlementKind = "customer-receipt" | "supplier-payment";

interface PartySettlementDialogProps {
    open: boolean;
    kind: PartySettlementKind;
    party: { id: number; name: string };
    onOpenChange: (open: boolean) => void;
}

const today = () => new Date().toISOString().slice(0, 10);
const paymentMethods = ["Cash", "Card", "Bank transfer", "Cheque", "Mobile money", "Other"];

export function PartySettlementDialog({
    open,
    kind,
    party,
    onOpenChange,
}: PartySettlementDialogProps) {
    const queryClient = useQueryClient();
    const { formatMoney } = useCompany();
    const customerReceipt = kind === "customer-receipt";
    const queryKey = ["operations", "party-settlement-documents", kind, party.id] as const;
    const documents = useQuery({
        queryKey,
        queryFn: async () => (
            customerReceipt
                ? await operationsService.customerSettlementDocuments(party.id)
                : await operationsService.supplierSettlementDocuments(party.id)
        ).data,
        enabled: open,
    });
    const [documentId, setDocumentId] = useState<number | null>(null);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({
        amount: 0,
        paymentDate: today(),
        paymentMethod: "Cash",
        referenceNumber: "",
        notes: "",
    });

    useEffect(() => {
        if (!open) return;
        const first = documents.data?.[0] ?? null;
        setDocumentId((current) => documents.data?.some((item) => item.id === current) ? current : first?.id ?? null);
    }, [documents.data, open]);

    const selectedDocument = useMemo(
        () => documents.data?.find((item) => item.id === documentId) ?? null,
        [documentId, documents.data],
    );

    useEffect(() => {
        if (!open) return;
        setForm((current) => ({
            ...current,
            amount: selectedDocument?.remainingAmount ?? 0,
        }));
    }, [open, selectedDocument]);

    const requiresReference = form.paymentMethod !== "Cash" && form.paymentMethod !== "Other";

    const close = () => {
        setDocumentId(null);
        setForm({
            amount: 0,
            paymentDate: today(),
            paymentMethod: "Cash",
            referenceNumber: "",
            notes: "",
        });
        onOpenChange(false);
    };

    const record = async () => {
        if (!selectedDocument) {
            toast.error(customerReceipt ? "Select the sale this receipt settles." : "Select the purchase this payment settles.");
            return;
        }
        if (form.amount <= 0 || form.amount > selectedDocument.remainingAmount) {
            toast.error(`Amount must be greater than zero and no more than ${formatMoney(selectedDocument.remainingAmount, selectedDocument.currencyCode)}.`);
            return;
        }
        if (!form.paymentDate) {
            toast.error("Select the payment date.");
            return;
        }
        if (requiresReference && !form.referenceNumber.trim()) {
            toast.error(`A reference is required for ${form.paymentMethod.toLowerCase()} payments.`);
            return;
        }

        const body: RecordDocumentPayment = {
            amount: form.amount,
            paymentDate: form.paymentDate,
            paymentMethod: form.paymentMethod,
            referenceNumber: nullable(form.referenceNumber),
            notes: nullable(form.notes),
        };

        setSaving(true);
        try {
            if (customerReceipt) {
                await operationsService.addSalePayment(selectedDocument.id, body);
            } else {
                await operationsService.addPurchasePayment(selectedDocument.id, body);
            }
            await Promise.all([
                queryClient.invalidateQueries({ queryKey }),
                queryClient.invalidateQueries({ queryKey: ["journal-vouchers"] }),
                queryClient.invalidateQueries({ queryKey: ["customer-ledger", party.id] }),
                queryClient.invalidateQueries({ queryKey: ["operations", "supplier-ledger", party.id] }),
                queryClient.invalidateQueries({ queryKey: ["operations", customerReceipt ? "sales" : "purchases"] }),
            ]);
            toast.success(customerReceipt
                ? `Payment received from ${party.name} and posted to ${selectedDocument.documentNumber}.`
                : `Payment to ${party.name} posted to ${selectedDocument.documentNumber}.`);
            close();
        } catch (error) {
            toast.error(getApiErrorMessage(error, customerReceipt
                ? "The customer payment could not be recorded."
                : "The supplier payment could not be recorded."));
        } finally {
            setSaving(false);
        }
    };

    const DirectionIcon = customerReceipt ? ArrowDownToLine : ArrowUpFromLine;
    const directionLabel = customerReceipt ? "Money received" : "Money paid";
    const sourceLabel = customerReceipt ? "Apply to sale" : "Apply to purchase";

    return (
        <Dialog open={open} onOpenChange={(next) => !next && !saving && close()}>
            <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
                <DialogHeader>
                    <DialogTitle>{customerReceipt ? "Receive customer payment" : "Pay supplier"}</DialogTitle>
                    <DialogDescription>
                        Record one real settlement against its source document. The balanced accounting voucher is created automatically.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-px overflow-hidden border bg-border sm:grid-cols-3">
                    <Summary label={customerReceipt ? "Customer" : "Supplier"} value={party.name} />
                    <Summary label="Open documents" value={documents.data ? String(documents.data.length) : "—"} />
                    <Summary label="Direction" value={directionLabel} icon={<DirectionIcon />} />
                </div>

                {documents.isLoading ? (
                    <div className="grid min-h-48 place-items-center border border-dashed">
                        <LoaderCircle className="size-6 animate-spin text-primary" />
                    </div>
                ) : documents.isError ? (
                    <div className="border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                        {getApiErrorMessage(documents.error, "Open documents could not be loaded.")}
                    </div>
                ) : documents.data?.length ? (
                    <div className="space-y-5">
                        <div className="grid gap-4 sm:grid-cols-2">
                            <Field label={`${sourceLabel} *`} className="sm:col-span-2">
                                <SimpleCombobox<number>
                                    value={documentId}
                                    onValueChange={setDocumentId}
                                    options={documents.data.map((document) => ({
                                        value: document.id,
                                        label: document.documentNumber,
                                        description: `${shortDate(document.documentDate)} · ${formatMoney(document.remainingAmount, document.currencyCode)} remaining`,
                                    }))}
                                    placeholder={customerReceipt ? "Select an outstanding sale" : "Select an outstanding purchase"}
                                    emptyText="No outstanding documents found."
                                />
                            </Field>
                            <Field label={selectedDocument ? `Amount (${selectedDocument.currencyCode}) *` : "Amount *"}>
                                <Input
                                    type="number"
                                    min={0.01}
                                    max={selectedDocument?.remainingAmount ?? undefined}
                                    step="0.01"
                                    value={form.amount || ""}
                                    onChange={(event) => setForm((current) => ({ ...current, amount: Number(event.target.value) }))}
                                />
                            </Field>
                            <Field label="Payment date *">
                                <Input type="date" value={form.paymentDate} onChange={(event) => setForm((current) => ({ ...current, paymentDate: event.target.value }))} />
                            </Field>
                            <Field label="Method *">
                                <SimpleCombobox<string>
                                    value={form.paymentMethod}
                                    onValueChange={(paymentMethod) => setForm((current) => ({ ...current, paymentMethod: paymentMethod ?? "Cash" }))}
                                    options={paymentMethods.map((value) => ({ value, label: value }))}
                                    placeholder="Select payment method"
                                />
                            </Field>
                            <Field label={requiresReference ? "Reference *" : "Reference"}>
                                <Input value={form.referenceNumber} onChange={(event) => setForm((current) => ({ ...current, referenceNumber: event.target.value }))} placeholder={requiresReference ? "Bank, cheque, or transaction reference" : "Optional receipt reference"} />
                            </Field>
                            <Field label="Notes" className="sm:col-span-2">
                                <Textarea rows={2} value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Optional business note" />
                            </Field>
                        </div>

                        <div className="border border-primary/20 bg-primary/5 p-4">
                            <div className="flex items-start gap-3">
                                <span className="grid size-9 shrink-0 place-items-center bg-primary text-primary-foreground"><Landmark className="size-4" /></span>
                                <div>
                                    <div className="flex flex-wrap items-center gap-2"><p className="text-sm font-semibold">Accounting effect</p><Badge variant="outline">Automatic</Badge>{selectedDocument ? <Badge variant="secondary">{selectedDocument.currencyCode}</Badge> : null}</div>
                                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                                        {customerReceipt
                                            ? "Cash or bank increases; the customer receivable decreases by the same amount."
                                            : "The supplier payable decreases; cash or bank decreases by the same amount."}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="grid min-h-52 place-items-center border border-dashed bg-muted/10 p-6 text-center">
                        <div>
                            <ReceiptText className="mx-auto size-8 text-muted-foreground" />
                            <p className="mt-3 font-semibold">No outstanding {customerReceipt ? "sales" : "purchases"}</p>
                            <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-muted-foreground">
                                There is no source document to settle. This action intentionally does not create an unsupported debit or credit directly on the party account.
                            </p>
                        </div>
                    </div>
                )}

                <div className="flex items-start gap-2 border bg-muted/20 p-3 text-xs leading-5 text-muted-foreground">
                    <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
                    Returns, refunds, write-offs, and corrections must be recorded from their original workflow or with a controlled adjustment—never disguised as a payment.
                </div>

                <DialogFooter>
                    <Button type="button" variant="outline" disabled={saving} onClick={close}>Cancel</Button>
                    <Button type="button" disabled={saving || !selectedDocument || form.amount <= 0} onClick={() => void record()}>
                        {saving ? <LoaderCircle className="animate-spin" /> : <DirectionIcon />}
                        {saving ? "Posting…" : customerReceipt ? "Receive and post" : "Pay and post"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function Summary({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
    return <div className="bg-background p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 flex items-center gap-2 truncate font-semibold">{icon}{value}</p></div>;
}

function Field({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
    return <div className={className}><Label className="mb-2 block">{label}</Label>{children}</div>;
}

function nullable(value: string) {
    const clean = value.trim();
    return clean || null;
}

function shortDate(value: string) {
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${value.slice(0, 10)}T00:00:00Z`));
}
