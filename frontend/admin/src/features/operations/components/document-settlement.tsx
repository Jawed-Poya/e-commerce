import { ReceiptText, StickyNote } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useTenant } from "@/features/tenancy/tenant-context";

export function DocumentSettlementLayout({
    notes,
    onNotesChange,
    summaryTitle,
    summaryDescription,
    children,
}: {
    notes: string;
    onNotesChange: (value: string) => void;
    summaryTitle: string;
    summaryDescription: string;
    children: React.ReactNode;
}) {
    return (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(360px,420px)] lg:items-stretch">
            <section className="flex min-h-[330px] flex-col">
                <SectionHeading
                    icon={<StickyNote className="size-4" />}
                    title="Notes"
                    description="Add supplier, customer, delivery, or internal details for this document."
                />
                <Textarea
                    className="mt-3 min-h-56 flex-1 resize-none"
                    value={notes}
                    onChange={(event) => onNotesChange(event.target.value)}
                    placeholder="Write any useful notes for this transaction…"
                />
            </section>

            <section className="flex min-h-[330px] flex-col">
                <SectionHeading
                    icon={<ReceiptText className="size-4" />}
                    title={summaryTitle}
                    description={summaryDescription}
                />
                <Card className="mt-3 flex-1 border-border/80 shadow-none">
                    <CardContent className="space-y-4 p-5">{children}</CardContent>
                </Card>
            </section>
        </div>
    );
}

export function AmountInputRow({
    label,
    value,
    onChange,
}: {
    label: string;
    value: number;
    onChange: (value: number) => void;
}) {
    return (
        <div className="grid grid-cols-[1fr_140px] items-center gap-4">
            <Label className="text-sm font-normal text-muted-foreground">
                {label}
            </Label>
            <Input
                className="text-end tabular-nums"
                type="number"
                min={0}
                step="0.01"
                value={value}
                onChange={(event) => onChange(Number(event.target.value))}
            />
        </div>
    );
}

export function MoneySummaryRow({
    label,
    value,
    emphasis = false,
    muted = false,
}: {
    label: string;
    value: number;
    emphasis?: boolean;
    muted?: boolean;
}) {
    const { formatMoney } = useTenant();
    return (
        <div
            className={`flex items-center justify-between gap-4 tabular-nums ${
                emphasis
                    ? "text-lg font-bold"
                    : muted
                      ? "text-sm text-muted-foreground"
                      : "text-sm"
            }`}
        >
            <span>{label}</span>
            <span>{formatMoney(value)}</span>
        </div>
    );
}

function SectionHeading({
    icon,
    title,
    description,
}: {
    icon: React.ReactNode;
    title: string;
    description: string;
}) {
    return (
        <div className="min-h-14">
            <h3 className="flex items-center gap-2 font-semibold">
                <span className="text-primary">{icon}</span>
                {title}
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        </div>
    );
}

