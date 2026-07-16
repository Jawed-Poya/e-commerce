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
import { buildTree } from "@/lib/utils";

interface GeneralTypeFormProps {
    defaultValues?: Partial<GeneralType>;

    onSubmit: (data: GeneralType) => void;

    isLoading?: boolean;
}

const typeGroups = [
    {
        label: "Category",
        value: "ProductCategory",
    },
    {
        label: "Brand",
        value: "ProductBrand",
    },
    {
        label: "Unit",
        value: "ProductUnit",
    },
    {
        label: "Customer Type",
        value: "CustomerType",
    },
];

export function GeneralTypeForm({
    defaultValues,
    onSubmit,
    isLoading,
}: GeneralTypeFormProps) {
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

    const parents = data?.data;

    // const anchor = useComboboxAnchor();

    const parentId = useWatch({
        control,
        name: "parentId",
    });

    const selectedParent = useMemo(() => {
        return parents?.find((x) => x.id === parentId) ?? null;
    }, [parents, parentId]);

    const treeParents = buildTree(parents!);

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-6">
                <div className="space-y-2">
                    <Label>Type Group</Label>

                    <ToggleGroup
                        variant="outline"
                        value={[selectedGroup]}
                        onValueChange={(value) => {
                            if (value) {
                                setValue("group", value[0], {
                                    shouldValidate: true,
                                });
                            }
                        }}
                        className="flex flex-wrap"
                    >
                        {typeGroups.map((item) => (
                            <ToggleGroupItem
                                key={item.value}
                                value={item.value}
                            >
                                {item.label}
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
                    <Label>Name</Label>

                    <Input placeholder="Enter name" {...register("name")} />

                    {errors.name && (
                        <p className="text-sm text-destructive">
                            {errors.name.message}
                        </p>
                    )}
                </div>

                <div className="space-y-2">
                    <Label>Parent</Label>

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
                        <ComboboxInput placeholder="Select parent" />

                        <ComboboxContent>
                            <ComboboxEmpty>No parent found.</ComboboxEmpty>

                            <ComboboxList>
                                {treeParents.map((item: any) => (
                                    <TypeItem key={item.id} item={item} />
                                ))}
                            </ComboboxList>
                        </ComboboxContent>
                    </Combobox>
                </div>
            </div>

            <div className="flex justify-end">
                <Button disabled={isLoading} type="submit">
                    Save Type
                </Button>
            </div>
        </form>
    );
}

function TypeItem({
    item,
    level = 0,
}: {
    item: GeneralType & {
        children: GeneralType[];
    };
    level?: number;
}) {
    return (
        <>
            <ComboboxItem value={item} className="flex">
                <span
                    style={{
                        paddingLeft: level * 16,
                    }}
                >
                    {level > 0 && "└ "}
                    {item.name}
                </span>
            </ComboboxItem>

            {item.children.map((child) => (
                <TypeItem key={child.id} item={child} level={level + 1} />
            ))}
        </>
    );
}
