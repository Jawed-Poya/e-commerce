import type { ReactNode } from "react";
import { Banknote, Box, Clock3, Layers3, MapPin, Phone, Truck, UserRound } from "lucide-react";
import { Link } from "react-router-dom";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WhatsAppLink } from "@/features/customers/whatsapp-link";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { useI18n } from "@/i18n/i18n-provider";
import { toFiniteNumber } from "@/lib/numbers";
import type { OrderDetails } from "../order-types";
import { OrderStatusBadge } from "./order-status-badge";

interface OrderPanelProps {
    order: OrderDetails;
    formatMoney: (amount: number, currency?: string) => string;
}

export function OrderSummaryCards({ order, formatMoney }: OrderPanelProps) {
    const { t } = useI18n();
    return (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard
                icon={<Clock3 />}
                label={t("orders.orderStatus")}
                value={<OrderStatusBadge value={order.status} />}
            />
            <SummaryCard
                icon={<Banknote />}
                label={t("orders.payment")}
                value={<OrderStatusBadge value={order.paymentStatus} />}
            />
            <SummaryCard
                icon={<Truck />}
                label={t("orders.fulfillment")}
                value={<OrderStatusBadge value={order.fulfillmentStatus} />}
            />
            <SummaryCard
                icon={<Box />}
                label={t("orders.total")}
                value={
                    <span className="text-base font-bold tabular-nums">
                        {formatMoney(order.total, order.currency)}
                    </span>
                }
            />
        </div>
    );
}

export function OrderCustomerAndShipping({ order }: Pick<OrderPanelProps, "order">) {
    const { t } = useI18n();
    const address = [
        order.shippingAddress.addressLine1,
        order.shippingAddress.addressLine2,
        order.shippingAddress.city,
        order.shippingAddress.state,
        order.shippingAddress.country,
        order.shippingAddress.postalCode,
    ]
        .filter(Boolean)
        .join(", ");

    return (
        <div className="grid gap-5 lg:grid-cols-3">
            <Card>
                <CardHeader>
                    <CardTitle>{t("orders.customerSection")}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    <Info icon={<UserRound />} label={t("orders.name")} value={order.customer.name} />
                    <Info icon={<Phone />} label={t("orders.phone")} value={order.customer.phone} />
                    <WhatsAppLink
                        url={order.customer.whatsAppUrl}
                        customerName={order.customer.name}
                        className="w-full"
                    />
                    <Info label={t("orders.email")} value={order.customer.email ?? "—"} />
                    <Info
                        label={t("orders.type")}
                        value={order.customer.customerTypeName ?? t("orders.defaultType")}
                    />
                    <Link className="inline-flex text-primary underline underline-offset-4" to={`/customers/${order.customer.id}`}>
                        {t("orders.openCustomer")}
                    </Link>
                </CardContent>
            </Card>
            <Card className="lg:col-span-2">
                <CardHeader>
                    <CardTitle>{t("orders.shippingAddress")}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    <Info
                        icon={<MapPin />}
                        label={t("orders.recipient")}
                        value={order.shippingAddress.recipientName}
                    />
                    <p className="leading-6">{address}</p>
                    <Info
                        icon={<Phone />}
                        label={t("orders.deliveryPhone")}
                        value={order.shippingAddress.phone}
                    />
                    {order.notes ? (
                        <div className="border-t pt-3">
                            <p className="font-medium">{t("orders.notes")}</p>
                            <p className="mt-1 text-muted-foreground">{order.notes}</p>
                        </div>
                    ) : null}
                </CardContent>
            </Card>
        </div>
    );
}

export function OrderItemsTable({ order, formatMoney }: OrderPanelProps) {
    const { t, tf } = useI18n();
    return (
        <Card className="overflow-hidden">
            <CardHeader>
                <CardTitle>{t("orders.items")}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>{t("orders.product")}</TableHead>
                                <TableHead>{t("orders.barcode")}</TableHead>
                                <TableHead>{t("orders.quantity")}</TableHead>
                                <TableHead>{t("orders.unitPrice")}</TableHead>
                                <TableHead>{t("orders.total")}</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {order.items.map((item) => (
                                <TableRow key={item.id}>
                                    <TableCell>
                                        <Link className="font-medium hover:text-primary" to={`/products/${item.productId}`}>
                                            {item.productName}
                                        </Link>
                                    </TableCell>
                                    <TableCell>{item.productBarcode ?? "—"}</TableCell>
                                    <TableCell>
                                        <span className="font-medium tabular-nums">{item.quantity}</span>
                                        {item.unitName ? (
                                            <span className="ms-1 text-xs text-muted-foreground">{item.unitName}</span>
                                        ) : null}
                                        {item.conversionFactor > 1 ? (
                                            <span className="block text-[10px] text-muted-foreground">
                                                {tf("orders.baseUnits", { factor: item.conversionFactor })}
                                            </span>
                                        ) : null}
                                    </TableCell>
                                    <TableCell>
                                        {formatMoney(item.unitPrice, item.currency)}
                                        {item.unitName ? (
                                            <span className="block text-[10px] text-muted-foreground">
                                                {tf("orders.perUnit", { unit: item.unitName })}
                                            </span>
                                        ) : null}
                                    </TableCell>
                                    <TableCell className="font-semibold tabular-nums">
                                        {formatMoney(item.total, item.currency)}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
}

export function OrderLotTraceability({ order }: Pick<OrderPanelProps, "order">) {
    const { locale, t } = useI18n();
    if (order.lotMovements.length === 0) return null;

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Layers3 className="size-4" />
                    {t("orders.lotTraceability")}
                </CardTitle>
                <p className="text-xs text-muted-foreground">{t("orders.lotTraceabilityHelp")}</p>
            </CardHeader>
            <CardContent>
                <div className="overflow-x-auto border">
                    <Table className="min-w-[880px]">
                        <TableHeader>
                            <TableRow>
                                <TableHead>{t("orders.date")}</TableHead>
                                <TableHead>{t("orders.product")}</TableHead>
                                <TableHead>{t("orders.lotBatch")}</TableHead>
                                <TableHead>{t("orders.warehouse")}</TableHead>
                                <TableHead>{t("orders.expiry")}</TableHead>
                                <TableHead>{t("orders.inventoryAction")}</TableHead>
                                <TableHead className="text-end">{t("orders.baseQuantity")}</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {order.lotMovements.map(movement => {
                                const amount = movement.quantityDelta !== 0
                                    ? movement.quantityDelta
                                    : movement.reservedDelta;
                                return (
                                    <TableRow key={movement.id}>
                                        <TableCell className="whitespace-nowrap text-xs">
                                            {new Date(movement.createdAt).toLocaleString(locale)}
                                        </TableCell>
                                        <TableCell className="font-medium">{movement.productName}</TableCell>
                                        <TableCell>
                                            {movement.lotNumber || `${t("orders.unnumberedLot")} #${movement.inventoryLotId ?? movement.id}`}
                                        </TableCell>
                                        <TableCell>{movement.warehouseName}</TableCell>
                                        <TableCell className="whitespace-nowrap">
                                            {movement.expiresAt
                                                ? new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" })
                                                    .format(new Date(`${movement.expiresAt}T00:00:00Z`))
                                                : "—"}
                                        </TableCell>
                                        <TableCell>{inventoryActionLabel(movement.type, t)}</TableCell>
                                        <TableCell className={amount < 0 ? "text-end font-semibold tabular-nums text-destructive" : "text-end font-semibold tabular-nums text-emerald-600 dark:text-emerald-400"}>
                                            {toFiniteNumber(amount) > 0 ? "+" : ""}{toFiniteNumber(amount).toLocaleString(locale, { maximumFractionDigits: 3 })}
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
}

export function OrderPaymentAndTotals({ order, formatMoney }: OrderPanelProps) {
    const { locale, t } = useI18n();
    const payment = order.payments[0];
    const paymentMethod =
        payment?.method === "CashOnDelivery"
            ? t("orders.cashOnDelivery")
            : t("orders.bankTransfer");

    return (
        <div className="grid gap-5 lg:grid-cols-2">
            <Card>
                <CardHeader>
                    <CardTitle>{t("orders.paymentRecord")}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    {payment ? (
                        <>
                            <Info label={t("orders.method")} value={paymentMethod} />
                            <Info
                                label={t("orders.status")}
                                value={<OrderStatusBadge value={payment.status} />}
                            />
                            <Info
                                label={t("orders.amount")}
                                value={formatMoney(payment.amount, payment.currency)}
                            />
                            <Info label={t("orders.reference")} value={payment.externalReference ?? "—"} />
                            <Info
                                label={t("orders.paidAt")}
                                value={payment.paidAt ? new Date(payment.paidAt).toLocaleString(locale) : "—"}
                            />
                            {payment.failureReason ? (
                                <Info label={t("orders.failureReason")} value={payment.failureReason} />
                            ) : null}
                        </>
                    ) : (
                        <p className="text-muted-foreground">{t("orders.noPayment")}</p>
                    )}
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle>{t("orders.orderTotals")}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    <MoneyLine label={t("orders.subtotal")} value={order.subtotal} order={order} formatMoney={formatMoney} />
                    <MoneyLine label={t("orders.discount")} value={-order.discountTotal} order={order} formatMoney={formatMoney} />
                    <MoneyLine label={t("orders.tax")} value={order.taxTotal} order={order} formatMoney={formatMoney} />
                    <MoneyLine label={t("orders.shipping")} value={order.shippingTotal} order={order} formatMoney={formatMoney} />
                    <div className="flex justify-between border-t pt-3 text-sm font-bold">
                        <span>{t("orders.total")}</span>
                        <span className="tabular-nums">{formatMoney(order.total, order.currency)}</span>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

export function OrderStatusHistory({ order }: Pick<OrderPanelProps, "order">) {
    const { locale, t } = useI18n();
    return (
        <Card>
            <CardHeader>
                <CardTitle>{t("orders.statusHistory")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {order.statusHistory.map((item, index) => (
                    <div key={item.id || index} className="flex gap-3">
                        <span className="mt-1 size-2 shrink-0 rounded-full bg-primary" />
                        <div>
                            <div className="flex flex-wrap items-center gap-2">
                                <OrderStatusBadge value={item.toStatus} />
                                <span className="text-muted-foreground">
                                    {new Date(item.createdAt).toLocaleString(locale)}
                                </span>
                            </div>
                            {item.note ? <p className="mt-1 text-muted-foreground">{item.note}</p> : null}
                        </div>
                    </div>
                ))}
            </CardContent>
        </Card>
    );
}

function inventoryActionLabel(type: OrderDetails["lotMovements"][number]["type"], t: ReturnType<typeof useI18n>["t"]) {
    if (type === "Reservation") return t("orders.inventoryReserved");
    if (type === "ReservationRelease") return t("orders.inventoryReleased");
    if (type === "Sale") return t("orders.inventorySold");
    return type;
}

function SummaryCard({ icon, label, value }: { icon: ReactNode; label: string; value: ReactNode }) {
    return (
        <Card>
            <CardContent className="flex items-center gap-3">
                <span className="grid size-9 shrink-0 place-items-center bg-primary/10 text-primary [&_svg]:size-4">
                    {icon}
                </span>
                <div className="min-w-0">
                    <p className="text-muted-foreground">{label}</p>
                    <div className="mt-1">{value}</div>
                </div>
            </CardContent>
        </Card>
    );
}

function Info({ icon, label, value }: { icon?: ReactNode; label: string; value: ReactNode }) {
    return (
        <div className="flex items-start gap-2">
            {icon ? <span className="mt-0.5 text-muted-foreground [&_svg]:size-4">{icon}</span> : null}
            <div className="min-w-0">
                <p className="text-muted-foreground">{label}</p>
                <div className="font-medium break-words">{value}</div>
            </div>
        </div>
    );
}

function MoneyLine({
    label,
    value,
    order,
    formatMoney,
}: {
    label: string;
    value: number;
    order: OrderDetails;
    formatMoney: OrderPanelProps["formatMoney"];
}) {
    return (
        <div className="flex justify-between gap-3">
            <span className="text-muted-foreground">{label}</span>
            <span className="tabular-nums">{formatMoney(value, order.currency)}</span>
        </div>
    );
}
