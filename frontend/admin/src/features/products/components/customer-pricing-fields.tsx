import { BadgeDollarSign } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface CustomerPriceDraft {
    id?: number;
    customerTypeId: number;
    customerTypeName: string;
    regularPrice: number;
    salePrice: number | null;
    startDate: string | null;
    endDate: string | null;
    isDefault: boolean;
    enabled: boolean;
}

interface CustomerPricingFieldsProps {
    prices: CustomerPriceDraft[];
    onChange: (prices: CustomerPriceDraft[]) => void;
    disabled?: boolean;
    compact?: boolean;
}

export function createCustomerPriceDrafts(
    customerTypes: { id: number; name: string }[],
    defaultCustomerTypeId: number,
    existing: Partial<CustomerPriceDraft>[] = [],
): CustomerPriceDraft[] {
    return customerTypes.map((type) => {
        const price = existing.find((item) => item.customerTypeId === type.id);
        return {
            id: price?.id,
            customerTypeId: type.id,
            customerTypeName: type.name,
            regularPrice: Number(price?.regularPrice ?? 0),
            salePrice: price?.salePrice == null ? null : Number(price.salePrice),
            startDate: price?.startDate ?? null,
            endDate: price?.endDate ?? null,
            isDefault: type.id === defaultCustomerTypeId,
            enabled: Boolean(price?.enabled ?? price?.id) || type.id === defaultCustomerTypeId,
        };
    });
}

export function CustomerPricingFields({ prices, onChange, disabled = false, compact = false }: CustomerPricingFieldsProps) {
    const change = (index: number, patch: Partial<CustomerPriceDraft>) => onChange(prices.map((price, priceIndex) => priceIndex === index ? { ...price, ...patch } : price));

    return (
        <section className="space-y-3 rounded-xl border bg-muted/10 p-4">
            <div className="flex items-start gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><BadgeDollarSign className="size-5" /></span>
                <div><h4 className="font-semibold">Customer-type pricing</h4><p className="text-xs text-muted-foreground">The default customer price is required. Enable other rows only when they need a different price.</p></div>
            </div>
            <div className={compact ? "grid gap-3 xl:grid-cols-2" : "space-y-3"}>
                {prices.map((price, index) => (
                    <div key={price.customerTypeId} className="rounded-lg border bg-background p-3">
                        <div className="mb-3 flex flex-wrap items-center gap-2">
                            <Checkbox checked={price.enabled} disabled={disabled || price.isDefault} onCheckedChange={(checked) => change(index, { enabled: checked === true })} />
                            <span className="min-w-0 flex-1 truncate text-sm font-medium">{price.customerTypeName}</span>
                            {price.isDefault ? <Badge>Default</Badge> : null}
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                            <Field label="Regular price"><Input type="number" min={0} step="0.01" disabled={disabled || !price.enabled} value={price.regularPrice} onChange={(event) => change(index, { regularPrice: Number(event.target.value) })} /></Field>
                            <Field label="Sale price"><Input type="number" min={0} step="0.01" disabled={disabled || !price.enabled} value={price.salePrice ?? ""} onChange={(event) => change(index, { salePrice: event.target.value ? Number(event.target.value) : null })} /></Field>
                            <Field label="Sale starts"><Input type="date" disabled={disabled || !price.enabled || price.salePrice == null} value={price.startDate ?? ""} onChange={(event) => change(index, { startDate: event.target.value || null })} /></Field>
                            <Field label="Sale ends"><Input type="date" disabled={disabled || !price.enabled || price.salePrice == null} value={price.endDate ?? ""} onChange={(event) => change(index, { endDate: event.target.value || null })} /></Field>
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
}

export function activePriceInputs(prices: CustomerPriceDraft[]) {
    return prices.filter((price) => price.enabled).map((price) => ({
        id: price.id,
        customerTypeId: price.customerTypeId,
        regularPrice: Number(price.regularPrice),
        salePrice: price.salePrice == null ? null : Number(price.salePrice),
        startDate: price.startDate,
        endDate: price.endDate,
    }));
}

export function validatePriceDrafts(prices: CustomerPriceDraft[]): string | null {
    const defaultPrice = prices.find((price) => price.isDefault);
    if (!defaultPrice?.enabled) return "A default customer price is required.";
    for (const price of prices.filter((item) => item.enabled)) {
        if (price.regularPrice < 0 || (price.salePrice != null && price.salePrice < 0)) return "Prices cannot be negative.";
        if (price.salePrice != null && price.salePrice > price.regularPrice) return "Sale price cannot exceed regular price.";
        if (price.startDate && price.endDate && price.endDate < price.startDate) return "Sale end date cannot be earlier than its start date.";
    }
    return null;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="space-y-1.5"><Label className="text-xs">{label}</Label>{children}</div>; }
