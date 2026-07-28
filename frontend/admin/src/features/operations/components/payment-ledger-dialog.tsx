import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Banknote, LoaderCircle, Plus, WalletCards } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { SimpleCombobox } from "@/components/simple-combobox";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useCompany } from "@/features/company/company-context";
import type {
    DocumentPayment,
    PaymentStatus,
} from "@/features/operations/operations-types";
import { useI18n } from "@/i18n/i18n-provider";

interface SettledDocument {
    id: number;
    total?: number;
    netAmount?: number;
    paidAmount: number;
    remainingAmount: number;
    paymentStatus: PaymentStatus;
}

interface PaymentLedgerDialogProps<TDocument extends SettledDocument> {
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
    addPayment: (body: unknown) => Promise<{ data: TDocument }>;
    onDocumentUpdated: (document: TDocument) => void;
    invalidate: readonly (readonly unknown[])[];
    canManage: boolean;
}

const today = () => new Date().toISOString().slice(0, 10);

export function PaymentLedgerDialog<TDocument extends SettledDocument>(
    props: PaymentLedgerDialogProps<TDocument>,
) {
    const queryClient = useQueryClient();
    const { formatMoney } = useCompany();
    const { tr, language } = useI18n();
    const [saving, setSaving] = useState(false);
    const [summary, setSummary] = useState({
        total: props.total,
        paidAmount: props.paidAmount,
        remainingAmount: props.remainingAmount,
        paymentStatus: props.paymentStatus,
    });
    const [form, setForm] = useState({
        amount: props.remainingAmount,
        paymentDate: today(),
        paymentMethod: "Cash",
        referenceNumber: "",
        notes: "",
    });

    useEffect(() => {
        setSummary({
            total: props.total,
            paidAmount: props.paidAmount,
            remainingAmount: props.remainingAmount,
            paymentStatus: props.paymentStatus,
        });
        setForm((current) => ({
            ...current,
            amount: Math.max(0, props.remainingAmount),
        }));
    }, [
        props.documentNumber,
        props.total,
        props.paidAmount,
        props.remainingAmount,
        props.paymentStatus,
    ]);

    const query = useQuery({
        queryKey: props.queryKey,
        queryFn: async () => (await props.loadPayments()).data,
        enabled: props.open,
    });

    const maxAmount = useMemo(
        () => Math.max(0, summary.remainingAmount),
        [summary.remainingAmount],
    );

    const record = async () => {
        if (form.amount <= 0 || form.amount > maxAmount) {
            toast.error(
                `${tr("Payment must be greater than zero and no more than")} ${formatMoney(maxAmount)}.`,
            );
            return;
        }

        setSaving(true);
        try {
            const response = await props.addPayment({
                amount: form.amount,
                paymentDate: form.paymentDate,
                paymentMethod: form.paymentMethod,
                referenceNumber: nullable(form.referenceNumber),
                notes: nullable(form.notes),
            });
            const updated = response.data;
            props.onDocumentUpdated(updated);
            const updatedTotal = updated.total ?? updated.netAmount ?? summary.total;
            setSummary({
                total: updatedTotal,
                paidAmount: updated.paidAmount,
                remainingAmount: updated.remainingAmount,
                paymentStatus: updated.paymentStatus,
            });
            setForm({
                amount: Math.max(0, updated.remainingAmount),
                paymentDate: today(),
                paymentMethod: "Cash",
                referenceNumber: "",
                notes: "",
            });

            for (const key of props.invalidate) {
                queryClient.setQueryData(key, (current: unknown) =>
                    Array.isArray(current)
                        ? current.map((item) =>
                              isDocumentWithId(item) && item.id === updated.id
                                  ? { ...item, ...updated }
                                  : item,
                          )
                        : current,
                );
            }

            await Promise.all([
                queryClient.invalidateQueries({ queryKey: props.queryKey }),
                ...props.invalidate.map((key) =>
                    queryClient.invalidateQueries({ queryKey: key }),
                ),
            ]);
            toast.success(tr("Payment installment recorded."));
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
                    <DialogDescription>
                        {props.description} · {props.documentNumber}
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-3 sm:grid-cols-3">
                    <Summary label={tr("Total")} value={summary.total} />
                    <Summary label={tr("Paid")} value={summary.paidAmount} />
                    <Summary
                        label={tr("Remaining")}
                        value={summary.remainingAmount}
                        emphasis
                    />
                </div>

                <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-4 py-3">
                    <span className="text-sm text-muted-foreground">
                        {tr("Payment status")}
                    </span>
                    <PaymentBadge status={summary.paymentStatus} />
                </div>

                {props.canManage && maxAmount > 0 ? (
                    <Card>
                        <CardContent className="space-y-4 p-4">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <div className="flex items-center gap-2 font-semibold">
                                    <Banknote className="size-4" />
                                    {tr("Add payment")}
                                </div>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() =>
                                        setForm((current) => ({
                                            ...current,
                                            amount: maxAmount,
                                        }))
                                    }
                                >
                                    <WalletCards className="me-2 size-4" />
                                    {tr("Pay remaining balance")}
                                </Button>
                            </div>
                            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                                <Field label={tr("Amount")}>
                                    <Input
                                        type="number"
                                        min={0.01}
                                        max={maxAmount}
                                        step="0.01"
                                        value={form.amount}
                                        onChange={(event) =>
                                            setForm((current) => ({
                                                ...current,
                                                amount: Number(event.target.value),
                                            }))
                                        }
                                    />
                                </Field>
                                <Field label={tr("Payment date")}>
                                    <Input
                                        type="date"
                                        value={form.paymentDate}
                                        onChange={(event) =>
                                            setForm((current) => ({
                                                ...current,
                                                paymentDate: event.target.value,
                                            }))
                                        }
                                    />
                                </Field>
                                <Field label={tr("Method")}>
                                    <SimpleCombobox
                                        value={form.paymentMethod}
                                        onValueChange={(value) =>
                                            setForm((current) => ({
                                                ...current,
                                                paymentMethod: value ?? "Cash",
                                            }))
                                        }
                                        options={[
                                            "Cash",
                                            "Card",
                                            "Bank transfer",
                                            "Cheque",
                                            "Other",
                                        ].map((value) => ({
                                            value,
                                            label: tr(value),
                                        }))}
                                        placeholder={tr("Select payment method")}
                                    />
                                </Field>
                                <Field label={tr("Reference")}>
                                    <Input
                                        value={form.referenceNumber}
                                        onChange={(event) =>
                                            setForm((current) => ({
                                                ...current,
                                                referenceNumber: event.target.value,
                                            }))
                                        }
                                    />
                                </Field>
                            </div>
                            <Field label={tr("Notes")}>
                                <Textarea
                                    rows={2}
                                    value={form.notes}
                                    onChange={(event) =>
                                        setForm((current) => ({
                                            ...current,
                                            notes: event.target.value,
                                        }))
                                    }
                                />
                            </Field>
                            <Button
                                type="button"
                                onClick={() => void record()}
                                disabled={saving || form.amount <= 0}
                            >
                                {saving ? (
                                    <LoaderCircle className="me-2 size-4 animate-spin" />
                                ) : (
                                    <Plus className="me-2 size-4" />
                                )}
                                {tr("Record installment")}
                            </Button>
                        </CardContent>
                    </Card>
                ) : null}

                <div className="overflow-hidden rounded-lg border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>{tr("Date")}</TableHead>
                                <TableHead>{tr("Method")}</TableHead>
                                <TableHead>{tr("Reference")}</TableHead>
                                <TableHead>{tr("Notes")}</TableHead>
                                <TableHead className="text-end">
                                    {tr("Amount")}
                                </TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {query.isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-24 text-center">
                                        <LoaderCircle className="mx-auto size-5 animate-spin" />
                                    </TableCell>
                                </TableRow>
                            ) : query.data?.length ? (
                                query.data.map((payment) => (
                                    <TableRow key={payment.id}>
                                        <TableCell>{date(payment.paymentDate, language)}</TableCell>
                                        <TableCell>{tr(payment.paymentMethod)}</TableCell>
                                        <TableCell>{payment.referenceNumber ?? "—"}</TableCell>
                                        <TableCell className="max-w-xs truncate">
                                            {payment.notes ?? "—"}
                                        </TableCell>
                                        <TableCell className="text-end font-medium">
                                            {formatMoney(payment.amount)}
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell
                                        colSpan={5}
                                        className="h-24 text-center text-muted-foreground"
                                    >
                                        {tr("No payments have been recorded.")}
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
                <DialogFooter>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => props.onOpenChange(false)}
                    >
                        {tr("Close")}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export function PaymentBadge({ status }: { status: PaymentStatus }) {
    const { tr } = useI18n();
    return (
        <Badge
            variant={
                status === "Paid"
                    ? "default"
                    : status === "Partial"
                      ? "secondary"
                      : "outline"
            }
        >
            {tr(status)}
        </Badge>
    );
}

function Summary({
    label,
    value,
    emphasis = false,
}: {
    label: string;
    value: number;
    emphasis?: boolean;
}) {
    const { formatMoney } = useCompany();
    return (
        <Card>
            <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p
                    className={
                        emphasis
                            ? "mt-1 text-xl font-bold text-primary"
                            : "mt-1 text-xl font-bold"
                    }
                >
                    {formatMoney(value)}
                </p>
            </CardContent>
        </Card>
    );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="space-y-2">
            <Label>{label}</Label>
            {children}
        </div>
    );
}

function isDocumentWithId(value: unknown): value is { id: number } {
    return Boolean(
        value &&
            typeof value === "object" &&
            "id" in value &&
            typeof (value as { id: unknown }).id === "number",
    );
}

function nullable(value: string) {
    const result = value.trim();
    return result || null;
}

function date(value: string, language: string) {
    const locale = language === "en" ? "en-US" : language === "ps" ? "ps-AF" : "fa-AF";
    return new Intl.DateTimeFormat(locale, {
        dateStyle: "medium",
        timeZone: "UTC",
    }).format(new Date(`${value}T00:00:00Z`));
}

function message(error: unknown) {
    return (
        (error as { response?: { data?: { message?: string } }; message?: string })
            .response?.data?.message ??
        (error as Error).message ??
        "The operation failed."
    );
}
