let defaultCurrency = "USD";
let defaultDecimals = 2;
let defaultLocale: string | undefined;

export function configureMoney(currency: string, decimals = 2, locale?: string) {
    defaultCurrency = currency || "USD";
    defaultDecimals = Math.max(0, Math.min(4, decimals));
    defaultLocale = locale;
}

export function toFiniteNumber(value: unknown, fallback = 0) {
    const number = typeof value === "number"
        ? value
        : typeof value === "string" && value.trim()
            ? Number(value)
            : Number.NaN;
    return Number.isFinite(number) ? number : fallback;
}

export function formatDecimal(value: unknown, fractionDigits = 1) {
    const digits = Math.max(0, Math.min(6, Math.trunc(toFiniteNumber(fractionDigits, 1))));
    return toFiniteNumber(value).toFixed(digits);
}

export function formatMoney(amount: unknown, currency = defaultCurrency) {
    const safeAmount = toFiniteNumber(amount);
    try {
        return new Intl.NumberFormat(defaultLocale, {
            style: "currency",
            currency,
            minimumFractionDigits: defaultDecimals,
            maximumFractionDigits: defaultDecimals,
        }).format(safeAmount);
    } catch {
        return `${currency} ${safeAmount.toFixed(defaultDecimals)}`;
    }
}
