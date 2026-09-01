type ErrorEnvelope = {
    response?: {
        data?: {
            message?: unknown;
            errors?: Record<string, unknown>;
        };
    };
};

const focusableSelector = [
    '[aria-invalid="true"]',
    'input:not([disabled])',
    'textarea:not([disabled])',
    'button:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
].join(",");

export function focusValidationElement(element: HTMLElement | null | undefined) {
    if (!element) return false;

    const focusTarget = element.matches(focusableSelector)
        ? element
        : element.querySelector<HTMLElement>(focusableSelector);
    element.scrollIntoView({ behavior: "smooth", block: "center" });
    window.setTimeout(() => focusTarget?.focus({ preventScroll: true }), 350);
    return true;
}

export function focusValidationField(
    root: ParentNode | null | undefined,
    field: string,
) {
    const escaped = typeof CSS !== "undefined" && CSS.escape
        ? CSS.escape(field)
        : field.replace(/[^a-zA-Z0-9_-]/g, "");
    return focusValidationElement(
        root?.querySelector<HTMLElement>(`[data-validation-field="${escaped}"]`),
    );
}

export function focusFirstInvalidSummary(root: ParentNode | null | undefined) {
    return focusValidationElement(
        root?.querySelector<HTMLElement>(
            '[data-validation-field] [aria-invalid="true"], [data-validation-field][aria-invalid="true"]',
        ),
    );
}

export function focusDocumentLine(
    root: ParentNode | null | undefined,
    index?: number,
) {
    const indexed = index == null
        ? null
        : root?.querySelector<HTMLElement>(`[data-document-line="${index}"]`);
    const line = indexed
        ?? root?.querySelector<HTMLElement>('[data-document-line-state="incomplete"]')
        ?? root?.querySelector<HTMLElement>('[data-document-line]');
    const preferred = line?.querySelector<HTMLElement>('[aria-invalid="true"]')
        ?? line?.querySelector<HTMLElement>('[data-document-field="product"]')
        ?? line;
    return focusValidationElement(preferred);
}

export function focusOperationApiError(
    root: ParentNode | null | undefined,
    error: unknown,
) {
    const data = (error as ErrorEnvelope)?.response?.data;
    const errorKey = data?.errors ? Object.keys(data.errors)[0] : undefined;
    const lineMatch = errorKey?.match(/(?:Items|Products)\[(\d+)]/i);
    if (lineMatch) return focusDocumentLine(root, Number(lineMatch[1]));

    const validationMessages = data?.errors
        ? Object.values(data.errors)
            .flatMap((value) => Array.isArray(value) ? value : [value])
            .filter((value): value is string => typeof value === "string")
            .join(" ")
        : "";
    const message = [
        errorKey,
        validationMessages,
        typeof data?.message === "string" ? data.message : "",
        error instanceof Error ? error.message : "",
    ].filter(Boolean).join(" ");
    if (/payment|paid|total|credit|debt/i.test(message)) {
        const payment = root?.querySelector<HTMLElement>(
            '[data-validation-field*="PaidAmount"], [data-validation-field*="Totals"]',
        );
        if (focusValidationElement(payment)) return true;
    }
    if (/secondary discount|discount 2/i.test(message)) {
        const secondary = root?.querySelector<HTMLElement>(
            '[data-validation-field*="SecondaryDiscount"]',
        );
        if (focusValidationElement(secondary)) return true;
    }
    if (/discount/i.test(message)) {
        const discount = root?.querySelector<HTMLElement>(
            '[data-validation-field*="Discount"]',
        );
        if (focusValidationElement(discount)) return true;
    }
    if (/tax/i.test(message)) {
        const tax = root?.querySelector<HTMLElement>('[data-validation-field*="Tax"]');
        if (focusValidationElement(tax)) return true;
    }
    if (/other cost/i.test(message)) {
        const otherCost = root?.querySelector<HTMLElement>(
            '[data-validation-field*="OtherCost"]',
        );
        if (focusValidationElement(otherCost)) return true;
    }
    if (/date/i.test(message)) {
        const date = root?.querySelector<HTMLElement>(
            '[data-validation-field$="Date"], [data-validation-field$="date"]',
        );
        if (focusValidationElement(date)) return true;
    }
    return focusDocumentLine(root);
}
