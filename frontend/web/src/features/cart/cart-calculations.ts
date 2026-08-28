export function roundCurrency(value: number) {
    return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculateCartSubtotal(
    items: readonly { price: number; quantity: number }[],
) {
    return roundCurrency(
        items.reduce((sum, item) => sum + item.price * item.quantity, 0),
    );
}
