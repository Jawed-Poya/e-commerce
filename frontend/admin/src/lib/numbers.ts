/**
 * Converts API/form values into a finite number. JSON contracts normally
 * contain numbers, but older deployments and imported data can still return
 * null, numeric strings, NaN, or infinity. UI calculations should never leak
 * those values to customers or crash while formatting them.
 */
export function toFiniteNumber(value: unknown, fallback = 0) {
    const number = typeof value === "number"
        ? value
        : typeof value === "string" && value.trim()
            ? Number(value)
            : Number.NaN;

    return Number.isFinite(number) ? number : fallback;
}

export function formatDecimal(value: unknown, fractionDigits = 2) {
    const digits = Math.max(0, Math.min(6, Math.trunc(toFiniteNumber(fractionDigits, 2))));
    return toFiniteNumber(value).toFixed(digits);
}

export function formatPercent(value: unknown, fractionDigits = 1) {
    return `${formatDecimal(value, fractionDigits)}%`;
}
