import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { LoaderCircle } from "lucide-react";

import {
    Combobox,
    ComboboxContent,
    ComboboxEmpty,
    ComboboxInput,
    ComboboxItem,
    ComboboxList,
} from "@/components/ui/combobox";
import { cn } from "@/lib/utils";

interface Identifiable {
    id: number;
}

interface ServerSearchComboboxProps<T extends Identifiable> {
    value: T | null;
    onValueChange: (value: T | null) => void;
    queryKey: readonly unknown[];
    search: (search: string) => Promise<T[]>;
    getLabel: (item: T) => string;
    getDescription?: (item: T) => string | null | undefined;
    placeholder?: string;
    emptyText?: string;
    disabled?: boolean;
    allowClear?: boolean;
    className?: string;
}

export function ServerSearchCombobox<T extends Identifiable>({
    value,
    onValueChange,
    queryKey,
    search,
    getLabel,
    getDescription,
    placeholder = "Search…",
    emptyText = "No matching records.",
    disabled = false,
    allowClear = true,
    className,
}: ServerSearchComboboxProps<T>) {
    const [inputValue, setInputValue] = useState(value ? getLabel(value) : "");
    const [debouncedSearch, setDebouncedSearch] = useState("");

    useEffect(() => {
        const handle = window.setTimeout(() => {
            setDebouncedSearch(inputValue.trim());
        }, 250);

        return () => window.clearTimeout(handle);
    }, [inputValue]);

    useEffect(() => {
        setInputValue(value ? getLabel(value) : "");
        // The selected identifier is the stable synchronization boundary.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value?.id]);

    const query = useQuery({
        queryKey: [...queryKey, debouncedSearch],
        queryFn: () => search(debouncedSearch),
        enabled: !disabled,
        staleTime: 30_000,
    });

    const items = useMemo(() => {
        const results = query.data ?? [];
        if (!value || results.some((item) => item.id === value.id)) return results;
        return [value, ...results];
    }, [query.data, value]);

    return (
        <Combobox
            items={items}
            value={value}
            inputValue={inputValue}
            onInputValueChange={(next) => setInputValue(next)}
            onValueChange={(next) => onValueChange((next as T | null) ?? null)}
            itemToStringLabel={(item) => (item ? getLabel(item as T) : "")}
            filter={null}
            disabled={disabled}
        >
            <ComboboxInput
                className={cn("w-full", className)}
                placeholder={placeholder}
                showClear={allowClear && Boolean(value)}
            />
            <ComboboxContent>
                <ComboboxList>
                    {items.map((item) => (
                        <ComboboxItem key={item.id} value={item}>
                            <span className="min-w-0 flex-1">
                                <span className="block truncate font-medium">
                                    {getLabel(item)}
                                </span>
                                {getDescription?.(item) ? (
                                    <span className="block truncate text-[11px] text-muted-foreground">
                                        {getDescription(item)}
                                    </span>
                                ) : null}
                            </span>
                        </ComboboxItem>
                    ))}
                </ComboboxList>
                {query.isFetching ? (
                    <div className="flex items-center justify-center gap-2 border-t px-3 py-2 text-xs text-muted-foreground">
                        <LoaderCircle className="size-3.5 animate-spin" />
                        Searching…
                    </div>
                ) : null}
                <ComboboxEmpty>{emptyText}</ComboboxEmpty>
            </ComboboxContent>
        </Combobox>
    );
}
