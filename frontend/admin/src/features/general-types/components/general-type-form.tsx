import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { GeneralTypeSchema, type GeneralType } from "@/schemas/type.schema";
import { useGeneralTypes } from "../hooks/use-type";

import {
    Combobox,
    ComboboxContent,
    ComboboxEmpty,
    ComboboxInput,
    ComboboxItem,
    ComboboxList,
} from "@/components/ui/combobox";
import { useMemo } from "react";
import { useI18n } from "@/i18n/i18n-provider";
import { buildTree } from "@/lib/utils";
import { GENERAL_TYPE_GROUPS } from "../type-groups";

interface GeneralTypeFormProps {
    defaultValues?: Partial<GeneralType>;

    onSubmit: (data: GeneralType) => void;

    isLoading?: boolean;
}

export function GeneralTypeForm({
    defaultValues,
    onSubmit,
    isLoading,
}: GeneralTypeFormProps) {
    const { t } = useI18n();
    const {
        register,
        handleSubmit,
        setValue,
        watch,
        control,
        formState: { errors },
    } = useForm<GeneralType>({
        resolver: zodResolver(GeneralTypeSchema),

        defaultValues: {
            group: "ProductCategory",
            parentId: null,

            ...defaultValues,
        },
    });

    const selectedGroup = watch("group");

    const { data } = useGeneralTypes(selectedGroup);

    const allParents = useMemo(() => data?.data ?? [], [data]);
    const excludedIds = useMemo(() => {
        const result = new Set<number>();
        if (!defaultValues?.id) return result;
        result.add(defaultValues.id);
        const addChildren = (id: number) => allParents.filter(item => item.parentId === id).forEach(item => { if (item.id && !result.has(item.id)) { result.add(item.id); addChildren(item.id); } });
        addChildren(defaultValues.id);
        return result;
    }, [allParents, defaultValues?.id]);
    const parents = allParents.filter(item => !item.id || !excludedIds.has(item.id));

    const parentId = useWatch({
        control,
        name: "parentId",
    });

    const selectedParent = useMemo(() => {
        return parents?.find((x) => x.id === parentId) ?? null;
    }, [parents, parentId]);

    const treeParents = buildTree(parents);

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-6">
                <div className="space-y-2">
                    <Label>{t("types.group")}</Label>

                    <ToggleGroup
                        variant="outline"
                        value={[selectedGroup]}
                        onValueChange={(value) => {
                            if (value[0]) {
                                setValue("group", value[0], {
                                    shouldValidate: true,
                                });
                                setValue("parentId", null, { shouldValidate: true });
                            }
                        }}
                        className="flex flex-wrap"
                    >
                        {GENERAL_TYPE_GROUPS.map((item) => (
                            <ToggleGroupItem
                                key={item.value}
                                value={item.value}
                            >
                                {t(item.labelKey)}
                            </ToggleGroupItem>
                        ))}
                    </ToggleGroup>

                    {errors.group && (
                        <p className="text-sm text-destructive">
                            {errors.group.message}
                        </p>
                    )}
                </div>

                <div className="space-y-2">
                    <Label>{t("form.name")} *</Label>

                    <Input placeholder={t("form.name")} {...register("name")} />

                    {errors.name && (
                        <p className="text-sm text-destructive">
                            {errors.name.message}
                        </p>
                    )}
                </div>

                <div className="space-y-2">
                    <Label>{t("form.parent")}</Label>

                    <Combobox
                        items={parents}
                        value={selectedParent}
                        onValueChange={(value) => {
                            setValue("parentId", value?.id ?? null, {
                                shouldValidate: true,
                            });
                        }}
                        itemToStringLabel={(item) => item.name}
                    >
                        <ComboboxInput className="w-full" placeholder={t("types.noParent")} showClear />

                        <ComboboxContent>
                            <ComboboxEmpty>{t("form.noMatch")}</ComboboxEmpty>

                            <ComboboxList>
                                {treeParents.map((item: any) => (
                                    <TypeItem key={item.id} item={item} />
                                ))}
                            </ComboboxList>
                        </ComboboxContent>
                    </Combobox>
                </div>
            </div>

            <div className="flex justify-end border-t pt-4">
                <Button disabled={isLoading} type="submit">
                    {isLoading ? t("types.saving") : t("form.save")}
                </Button>
            </div>
        </form>
    );
}

type GeneralTypeTree = GeneralType & { children: GeneralTypeTree[] };

function TypeItem({
    item,
    level = 0,
}: {
    item: GeneralTypeTree;
    level?: number;
}) {
    return (
        <>
            <ComboboxItem value={item} className="flex">
                <span
                    style={{
                        paddingInlineStart: level * 16,
                    }}
                >
                    {level > 0 && "↳ "}
                    {item.name}
                </span>
            </ComboboxItem>

            {item.children.map((child) => (
                <TypeItem key={child.id} item={child} level={level + 1} />
            ))}
        </>
    );
}
