import { apiGet, apiPost } from "../../shared/api/api-client";
import type {
    CheckoutConfiguration,
    CreateOrderRequest,
    OrderConfirmation,
} from "./checkout-types";

export function getCheckoutConfiguration() {
    return apiGet<CheckoutConfiguration>("/checkout/configuration");
}

export function createOrder(request: CreateOrderRequest) {
    return apiPost<OrderConfirmation>("/checkout/orders", request);
}
