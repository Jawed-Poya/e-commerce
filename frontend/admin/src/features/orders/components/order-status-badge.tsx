import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/i18n/i18n-provider";

const statusKeys = {
    Pending: "orders.pending",
    Confirmed: "orders.confirmed",
    Processing: "orders.processing",
    Delivered: "orders.delivered",
    Returned: "orders.returned",
    Cancelled: "orders.cancelled",
    Authorized: "orders.authorized",
    Paid: "orders.paid",
    PartiallyRefunded: "orders.partiallyRefunded",
    Refunded: "orders.refunded",
    Failed: "orders.failed",
    Unfulfilled: "orders.unfulfilled",
    PartiallyFulfilled: "orders.partiallyFulfilled",
    Fulfilled: "orders.fulfilled",
} as const;

export function OrderStatusBadge({ value }: { value: string }) {
    const { t, tr } = useI18n();
    const variant =
        value === "Paid" || value === "Delivered" || value === "Fulfilled"
            ? "default"
            : value === "Failed" || value === "Cancelled"
              ? "destructive"
              : value === "Pending"
                ? "secondary"
                : "outline";
    const key = statusKeys[value as keyof typeof statusKeys];

    return <Badge variant={variant}>{key ? t(key) : tr(value)}</Badge>;
}
