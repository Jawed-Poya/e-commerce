import { Check, ShieldCheck } from "lucide-react";

import { Checkbox } from "@/components/ui/checkbox";
import type { PermissionGroup } from "../user-types";

export function PermissionChecklist({
    groups,
    selected,
    onChange,
    disabled = false,
}: {
    groups: PermissionGroup[];
    selected: string[];
    onChange: (permissions: string[]) => void;
    disabled?: boolean;
}) {
    const selectedSet = new Set(selected);

    const toggle = (permission: string, checked: boolean) => {
        const next = new Set(selected);
        if (checked) next.add(permission);
        else next.delete(permission);
        onChange([...next]);
    };

    const toggleGroup = (group: PermissionGroup) => {
        const allSelected = group.items.every((item) => selectedSet.has(item.value));
        const next = new Set(selected);
        group.items.forEach((item) => {
            if (allSelected) next.delete(item.value);
            else next.add(item.value);
        });
        onChange([...next]);
    };

    return (
        <div className="grid gap-3 lg:grid-cols-2">
            {groups.map((group) => {
                const selectedCount = group.items.filter((item) =>
                    selectedSet.has(item.value),
                ).length;
                return (
                    <section key={group.group} className="border bg-muted/10">
                        <button
                            type="button"
                            disabled={disabled}
                            className="flex w-full items-center justify-between border-b px-4 py-3 text-left hover:bg-muted/40 disabled:cursor-default"
                            onClick={() => toggleGroup(group)}
                        >
                            <span className="flex items-center gap-2 font-semibold">
                                <ShieldCheck className="size-4 text-primary" />
                                {group.group}
                            </span>
                            <span className="text-[11px] text-muted-foreground">
                                {selectedCount}/{group.items.length}
                            </span>
                        </button>
                        <div className="divide-y">
                            {group.items.map((permission) => {
                                const checked = selectedSet.has(permission.value);
                                return (
                                    <label
                                        key={permission.value}
                                        className="flex cursor-pointer gap-3 px-4 py-3 hover:bg-muted/30"
                                    >
                                        <Checkbox
                                            checked={checked}
                                            disabled={disabled}
                                            onCheckedChange={(value) =>
                                                toggle(
                                                    permission.value,
                                                    value === true,
                                                )
                                            }
                                        />
                                        <span className="min-w-0 flex-1">
                                            <span className="flex items-center gap-2 text-sm font-medium">
                                                {permission.name}
                                                {checked && (
                                                    <Check className="size-3 text-primary" />
                                                )}
                                            </span>
                                            <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                                                {permission.description}
                                            </span>
                                        </span>
                                    </label>
                                );
                            })}
                        </div>
                    </section>
                );
            })}
        </div>
    );
}
