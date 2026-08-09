import { useState } from "react";
import { Plus, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface QuickQuantityEditorProps {
    value: number[];
    step?: number | null;
    onChange: (value: number[]) => void;
    disabled?: boolean;
    compact?: boolean;
}

export function quickQuantitiesMatchStep(values: number[], step: number) {
    return values.length <= 8 && values.every((value) => value > 0 && alignedToStep(value, step));
}

function alignedToStep(value: number, step?: number | null) {
    if (!Number.isFinite(step) || step <= 0) return true;
    const ratio = value / step;
    return Math.abs(ratio - Math.round(ratio)) < 1e-9;
}

export function QuickQuantityEditor({
    value,
    step,
    onChange,
    disabled = false,
    compact = false,
}: QuickQuantityEditorProps) {
    const [draft, setDraft] = useState("");
    const [error, setError] = useState<string | null>(null);

    const add = () => {
        const quantity = Number(draft);
        if (!Number.isFinite(quantity) || quantity <= 0) {
            setError("Enter a quantity greater than zero.");
            return;
        }
        if (step != null && !alignedToStep(quantity, step)) {
            setError(`Use a multiple of the cart step (${step || 1}).`);
            return;
        }
        if (value.includes(quantity)) {
            setDraft("");
            setError(null);
            return;
        }
        if (value.length >= 8) {
            setError("Use at most 8 quick quantities.");
            return;
        }

        onChange([...value, quantity].sort((a, b) => a - b));
        setDraft("");
        setError(null);
    };

    return (
        <div className="space-y-2">
            <div className="flex min-w-0 flex-col gap-2 sm:flex-row">
                <Input
                    type="number"
                    min="0.001"
                    step="any"
                    value={draft}
                    disabled={disabled}
                    placeholder="20"
                    className={cn("min-w-0 flex-1", compact && "h-9")}
                    onChange={(event) => {
                        setDraft(event.target.value);
                        setError(null);
                    }}
                    onKeyDown={(event) => {
                        if (event.key !== "Enter") return;
                        event.preventDefault();
                        add();
                    }}
                />
                <Button
                    type="button"
                    variant="outline"
                    size={compact ? "sm" : "default"}
                    className="shrink-0 sm:w-auto"
                    disabled={disabled || !draft}
                    onClick={add}
                >
                    <Plus className="size-3.5" />
                    Add
                </Button>
            </div>

            {value.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                    {value.map((quantity) => (
                        <Badge
                            key={quantity}
                            variant="secondary"
                            className="gap-1 border border-primary/15 bg-primary/[0.06] px-2 py-1 font-bold text-primary"
                        >
                            {quantity}
                            <button
                                type="button"
                                disabled={disabled}
                                aria-label={`Remove quick quantity ${quantity}`}
                                onClick={() => onChange(value.filter((item) => item !== quantity))}
                                className="rounded-sm opacity-60 transition hover:opacity-100 disabled:pointer-events-none"
                            >
                                <X className="size-3" />
                            </button>
                        </Badge>
                    ))}
                </div>
            ) : null}

            <p className={cn("text-[10px] leading-4", error ? "text-destructive" : "text-muted-foreground")}>
                {error ?? (step == null
                    ? "Default storefront shortcuts, for example 20, 30, 40. Products with their own presets override these values."
                    : "Optional product override. Leave empty to use the default quick quantities from Company Settings. Each value must match the cart step.")}
            </p>
        </div>
    );
}
