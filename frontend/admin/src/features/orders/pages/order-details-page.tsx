import { ArrowLeft } from "lucide-react";
import { Link, useParams } from "react-router-dom";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCompany } from "@/features/company/company-context";
import { ReceiptActions } from "@/features/company/receipt-actions";
import { useI18n } from "@/i18n/i18n-provider";
import { OrderActions } from "../components/order-actions";
import {
    OrderCustomerAndShipping,
    OrderItemsTable,
    OrderPaymentAndTotals,
    OrderStatusHistory,
    OrderSummaryCards,
} from "../components/order-details-panels";
import { useOrderDetails } from "../hooks/use-order-details";
import type { OrderStatus, PaymentStatus } from "../order-types";

export default function OrderDetailsPage() {
    const id = Number(useParams().id);
    const { locale, t, tf } = useI18n();
    const { formatMoney } = useCompany();
    const { query, statusMutation, paymentMutation } = useOrderDetails(id);

    if (query.isLoading) {
        return <div className="p-10 text-center text-muted-foreground">{t("orders.loadingOrder")}</div>;
    }
    if (!query.data) {
        return <div className="p-10 text-center text-destructive">{t("orders.notFound")}</div>;
    }

    const order = query.data;
    const changeStatus = async (status: OrderStatus) => {
        await statusMutation.mutateAsync({ status });
    };
    const changePayment = async (status: PaymentStatus, reference?: string) => {
        await paymentMutation.mutateAsync({ status, reference });
    };

    return (
        <div className="space-y-5">
            <PageHeader
                title={order.orderNumber}
                description={tf("orders.createdAt", {
                    date: new Date(order.createdAt).toLocaleString(locale),
                })}
                actions={
                    <>
                        <ReceiptActions source="orders" id={order.id} />
                        <Button variant="outline" render={<Link to="/orders" />}>
                            <ArrowLeft />
                            {t("orders.back")}
                        </Button>
                    </>
                }
            />

            <OrderSummaryCards order={order} formatMoney={formatMoney} />

            <Card>
                <CardHeader>
                    <CardTitle>{t("orders.actions")}</CardTitle>
                </CardHeader>
                <CardContent>
                    <OrderActions
                        order={order}
                        isUpdatingStatus={statusMutation.isPending}
                        isUpdatingPayment={paymentMutation.isPending}
                        onStatusChange={changeStatus}
                        onPaymentChange={changePayment}
                    />
                </CardContent>
            </Card>

            <OrderCustomerAndShipping order={order} />
            <OrderItemsTable order={order} formatMoney={formatMoney} />
            <OrderPaymentAndTotals order={order} formatMoney={formatMoney} />
            <OrderStatusHistory order={order} />
        </div>
    );
}
