import { Search } from "lucide-react";

import { SimpleCombobox } from "@/components/simple-combobox";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/i18n/i18n-provider";
import type { OrderStatus, PaymentStatus } from "../order-types";

const orderStatuses: OrderStatus[] = [
    "Pending",
    "Confirmed",
    "Processing",
    "Delivered",
    "Cancelled",
];
const paymentStatuses: PaymentStatus[] = ["Pending", "Paid", "Failed", "Cancelled"];

const statusTranslationKeys = {
    Pending: "orders.pending",
    Confirmed: "orders.confirmed",
    Processing: "orders.processing",
    Delivered: "orders.delivered",
    Returned: "orders.returned",
    Cancelled: "orders.cancelled",
    Paid: "orders.paid",
    Failed: "orders.failed",
    Authorized: "orders.authorized",
    PartiallyRefunded: "orders.partiallyRefunded",
    Refunded: "orders.refunded",
} as const;

interface OrderFiltersProps {
    search: string;
    status: OrderStatus | "";
    paymentStatus: PaymentStatus | "";
    onSearchChange: (value: string) => void;
    onStatusChange: (value: OrderStatus | "") => void;
    onPaymentStatusChange: (value: PaymentStatus | "") => void;
}

export function OrderFilters({
    search,
    status,
    paymentStatus,
    onSearchChange,
    onStatusChange,
    onPaymentStatusChange,
}: OrderFiltersProps) {
    const { t } = useI18n();

    return (
        <Card>
            <CardContent className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_220px]">
                <div className="relative">
                    <Search className="pointer-events-none absolute start-2.5 top-2.5 size-4 text-muted-foreground" />
                    <Input
                        className="ps-8"
                        value={search}
                        onChange={(event) => onSearchChange(event.target.value)}
                        placeholder={t("orders.searchPlaceholder")}
                    />
                </div>
                <SimpleCombobox<OrderStatus | "">
                    value={status}
                    onValueChange={(value) => onStatusChange(value ?? "")}
                    options={[
                        { value: "", label: t("orders.allOrderStatuses") },
                        ...orderStatuses.map((value) => ({
                            value,
                            label: t(statusTranslationKeys[value]),
                        })),
                    ]}
                    placeholder={t("orders.allOrderStatuses")}
                />
                <SimpleCombobox<PaymentStatus | "">
                    value={paymentStatus}
                    onValueChange={(value) => onPaymentStatusChange(value ?? "")}
                    options={[
                        { value: "", label: t("orders.allPaymentStatuses") },
                        ...paymentStatuses.map((value) => ({
                            value,
                            label: t(statusTranslationKeys[value]),
                        })),
                    ]}
                    placeholder={t("orders.allPaymentStatuses")}
                />
            </CardContent>
        </Card>
    );
}
