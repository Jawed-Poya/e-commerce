import {
    Combobox,
    ComboboxContent,
    ComboboxEmpty,
    ComboboxInput,
    ComboboxItem,
    ComboboxList,
} from "@/components/ui/combobox";
import { cn } from "@/lib/utils";

export interface SimpleComboboxOption<T extends string | number = string> {
    value: T;
    label: string;
    description?: string;
}

export function SimpleCombobox<T extends string | number>({
    value,
    onValueChange,
    options,
    placeholder = "Select…",
    emptyText = "No option found.",
    disabled,
    className,
}: {
    value: T | null | undefined;
    onValueChange: (value: T | null) => void;
    options: SimpleComboboxOption<T>[];
    placeholder?: string;
    emptyText?: string;
    disabled?: boolean;
    className?: string;
}) {
    const selected = options.find((option) => option.value === value) ?? null;
    return (
        <Combobox
            items={options}
            value={selected}
            onValueChange={(option) => onValueChange((option as SimpleComboboxOption<T> | null)?.value ?? null)}
            itemToStringLabel={(option) => option ? (option as SimpleComboboxOption<T>).label : ""}
            disabled={disabled}
        >
            <ComboboxInput className={cn("w-full", className)} placeholder={placeholder} showClear={value !== null && value !== undefined && value !== ""} />
            <ComboboxContent>
                <ComboboxList>
                    {options.map((option) => (
                        <ComboboxItem key={String(option.value)} value={option}>
                            <div className="min-w-0">
                                <p className="truncate font-medium">{option.label}</p>
                                {option.description ? <p className="truncate text-[11px] text-muted-foreground">{option.description}</p> : null}
                            </div>
                        </ComboboxItem>
                    ))}
                </ComboboxList>
                <ComboboxEmpty>{emptyText}</ComboboxEmpty>
            </ComboboxContent>
        </Combobox>
    );
}
