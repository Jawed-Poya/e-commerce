import { ReceiptText, StickyNote } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCompany } from "@/features/company/company-context";

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
    max,
}: {
    label: string;
    value: number;
    onChange: (value: number) => void;
    max?: number;
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
                max={max}
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
    onClick,
    actionHint,
}: {
    label: string;
    value: number;
    emphasis?: boolean;
    muted?: boolean;
    onClick?: () => void;
    actionHint?: string;
}) {
    const { formatMoney } = useCompany();
    const content = (
        <>
            <span>{label}</span>
            <span>{formatMoney(value)}</span>
        </>
    );
    const className = `flex w-full items-center justify-between gap-4 rounded-lg tabular-nums ${
        emphasis
            ? "text-lg font-bold"
            : muted
              ? "text-sm text-muted-foreground"
              : "text-sm"
    } ${onClick ? "-mx-2 px-2 py-2 text-start transition hover:bg-primary/8 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30" : ""}`;

    return onClick ? (
        <button type="button" className={className} onClick={onClick} title={actionHint}>
            {content}
        </button>
    ) : (
        <div className={className}>{content}</div>
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
