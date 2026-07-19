import type { OrderConfirmation } from "../checkout/checkout-types";

const recentOrdersKey = "easycart-recent-orders";

export interface RecentOrder {
    orderNumber: string;
    phone: string;
    total: number;
    currency: string;
    status: string;
    createdAt: string;
}

export function saveRecentOrder(
    confirmation: OrderConfirmation,
    phone: string,
) {
    const next: RecentOrder = {
        orderNumber: confirmation.orderNumber,
        phone: phone.trim(),
        total: confirmation.total,
        currency: confirmation.currency,
        status: confirmation.status,
        createdAt: confirmation.createdAt,
    };

    const orders = readRecentOrders().filter(
        (order) => order.orderNumber !== next.orderNumber,
    );
    localStorage.setItem(
        recentOrdersKey,
        JSON.stringify([next, ...orders].slice(0, 10)),
    );
}

export function readRecentOrders(): RecentOrder[] {
    try {
        const value = JSON.parse(
            localStorage.getItem(recentOrdersKey) ?? "[]",
        ) as RecentOrder[];
        return Array.isArray(value) ? value : [];
    } catch {
        return [];
    }
}
