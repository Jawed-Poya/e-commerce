let defaultCurrency = "USD";
let defaultDecimals = 2;
let defaultLocale: string | undefined;

export function configureMoney(currency: string, decimals = 2, locale?: string) {
    defaultCurrency = currency || "USD";
    defaultDecimals = Math.max(0, Math.min(4, decimals));
    defaultLocale = locale;
}

export function formatMoney(amount: number, currency = defaultCurrency) {
    try {
        return new Intl.NumberFormat(defaultLocale, {
            style: "currency",
            currency,
            minimumFractionDigits: defaultDecimals,
            maximumFractionDigits: defaultDecimals,
        }).format(amount);
    } catch {
        return `${currency} ${amount.toFixed(defaultDecimals)}`;
    }
}
