import { useEffect, useState } from "react";
import { Box, CheckCircle2, Truck, XCircle } from "lucide-react";

import { ConfirmActionDialog } from "@/components/confirm-action-dialog";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/i18n/i18n-provider";
import type { OrderDetails, OrderStatus, PaymentStatus } from "../order-types";

interface OrderActionsProps {
    order: OrderDetails;
    isUpdatingStatus: boolean;
    isUpdatingPayment: boolean;
    onStatusChange: (status: OrderStatus) => Promise<void>;
    onPaymentChange: (status: PaymentStatus, reference?: string) => Promise<void>;
}

export function OrderActions({
    order,
    isUpdatingStatus,
    isUpdatingPayment,
    onStatusChange,
    onPaymentChange,
}: OrderActionsProps) {
    const { t, tf } = useI18n();
    const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
    const [reference, setReference] = useState(
        order.payments[0]?.externalReference ?? "",
    );
    const payment = order.payments[0];
    const actions = getNextActions(order.status);

    useEffect(() => {
        setReference(payment?.externalReference ?? "");
    }, [order.id, payment?.externalReference]);

    const verifyPayment = async () => {
        if (!reference.trim()) return;
        await onPaymentChange("Paid", reference.trim());
        setPaymentDialogOpen(false);
    };

    return (
        <>
            <div className="flex flex-wrap gap-2">
                {actions.map((action) => {
                    const label = t(action.labelKey);
                    const statusLabel = t(action.statusKey);
                    return (
                        <ConfirmActionDialog
                            key={action.status}
                            trigger={
                                <Button
                                    variant={action.status === "Cancelled" ? "destructive" : "default"}
                                    disabled={isUpdatingStatus}
                                >
                                    {action.icon}
                                    {label}
                                </Button>
                            }
                            title={t("orders.confirmActionTitle")}
                            description={tf("orders.confirmActionDescription", {
                                orderNumber: order.orderNumber,
                                status: statusLabel,
                            })}
                            confirmLabel={t("orders.confirmAction")}
                            destructive={action.status === "Cancelled"}
                            pending={isUpdatingStatus}
                            onConfirm={() => onStatusChange(action.status)}
                        />
                    );
                })}

                {payment?.method === "BankTransfer" && order.paymentStatus !== "Paid" ? (
                    <Button
                        variant="outline"
                        disabled={isUpdatingPayment}
                        onClick={() => setPaymentDialogOpen(true)}
                    >
                        <CheckCircle2 />
                        {t("orders.verifyingPayment")}
                    </Button>
                ) : null}

                {order.paymentStatus === "Pending" ? (
                    <ConfirmActionDialog
                        trigger={
                            <Button variant="outline" disabled={isUpdatingPayment}>
                                <XCircle />
                                {t("orders.markPaymentFailed")}
                            </Button>
                        }
                        title={t("orders.markPaymentFailed")}
                        description={tf("orders.confirmActionDescription", {
                            orderNumber: order.orderNumber,
                            status: t("orders.failed"),
                        })}
                        confirmLabel={t("orders.confirmAction")}
                        destructive
                        pending={isUpdatingPayment}
                        onConfirm={() => onPaymentChange("Failed")}
                    />
                ) : null}
            </div>

            <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{t("orders.verifyPaymentTitle")}</DialogTitle>
                        <DialogDescription>
                            {t("orders.verifyPaymentDescription")}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2">
                        <Label htmlFor="bank-reference">{t("orders.bankReference")}</Label>
                        <Input
                            id="bank-reference"
                            value={reference}
                            onChange={(event) => setReference(event.target.value)}
                            placeholder={t("orders.referencePlaceholder")}
                            autoFocus
                        />
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setPaymentDialogOpen(false)}
                            disabled={isUpdatingPayment}
                        >
                            {t("form.cancel")}
                        </Button>
                        <Button
                            onClick={() => void verifyPayment()}
                            disabled={isUpdatingPayment || !reference.trim()}
                        >
                            <CheckCircle2 />
                            {t("orders.verify")}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

const actionConfiguration = {
    Confirmed: {
        status: "Confirmed",
        labelKey: "orders.confirmOrder",
        statusKey: "orders.confirmed",
        icon: <CheckCircle2 />,
    },
    Processing: {
        status: "Processing",
        labelKey: "orders.startProcessing",
        statusKey: "orders.processing",
        icon: <Box />,
    },
    Delivered: {
        status: "Delivered",
        labelKey: "orders.markDelivered",
        statusKey: "orders.delivered",
        icon: <Truck />,
    },
    Cancelled: {
        status: "Cancelled",
        labelKey: "orders.cancelOrder",
        statusKey: "orders.cancelled",
        icon: <XCircle />,
    },
} as const;

type OrderAction = (typeof actionConfiguration)[keyof typeof actionConfiguration];

function getNextActions(status: OrderStatus): OrderAction[] {
    if (status === "Pending")
        return [actionConfiguration.Confirmed, actionConfiguration.Cancelled];
    if (status === "Confirmed")
        return [actionConfiguration.Processing, actionConfiguration.Cancelled];
    if (status === "Processing")
        return [actionConfiguration.Delivered, actionConfiguration.Cancelled];
    return [];
}
