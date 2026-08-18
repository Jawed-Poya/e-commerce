const clampPercentage = (value: number) => Math.min(100, Math.max(0, value));

export function roundCurrency(value: number) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculateLineNet(
    quantity: number,
    unitAmount: number,
    discountPercent: number,
) {
    const gross = quantity * unitAmount;
    return roundCurrency(
        gross * (1 - clampPercentage(discountPercent) / 100),
    );
}

export function calculateStackedDiscountNet(
    amount: number,
    firstPercent: number,
    secondPercent: number,
) {
    return roundCurrency(
        amount *
            (1 - clampPercentage(firstPercent) / 100) *
            (1 - clampPercentage(secondPercent) / 100),
    );
}
