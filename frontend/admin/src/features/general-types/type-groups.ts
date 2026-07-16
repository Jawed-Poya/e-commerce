export const GENERAL_TYPE_GROUPS = [
    { value: "ProductCategory", labelKey: "types.category" },
    { value: "ProductBrand", labelKey: "types.brand" },
    { value: "ProductUnit", labelKey: "types.unit" },
    { value: "CustomerType", labelKey: "types.customerType" },
] as const;

export function getGroupLabelKey(group: string) {
    return GENERAL_TYPE_GROUPS.find(item => item.value === group)?.labelKey ?? "types.unknownGroup";
}
