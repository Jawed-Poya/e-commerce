import { apiGet } from "../../shared/api/api-client";
import type { OrderTracking } from "./order-types";

export function trackOrder(orderNumber: string, phone: string) {
    return apiGet<OrderTracking>("/checkout/track", {
        orderNumber,
        phone,
    });
}
