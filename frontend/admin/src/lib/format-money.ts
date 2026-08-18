import { toFiniteNumber } from "./numbers";

export function formatMoney(amount: unknown, currency: string) {
    const safeAmount = toFiniteNumber(amount);
    const safeCurrency = typeof currency === "string" && currency.trim() ? currency.trim() : "USD";
    try {
        return new Intl.NumberFormat(undefined, {
            style: "currency",
            currency: safeCurrency,
        }).format(safeAmount);
    } catch {
        return `${safeCurrency} ${safeAmount.toFixed(2)}`;
    }
}
