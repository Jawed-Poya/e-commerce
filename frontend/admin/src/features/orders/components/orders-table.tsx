import { Eye } from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { useCompany } from "@/features/company/company-context";
import { WhatsAppLink } from "@/features/customers/whatsapp-link";
import { useI18n } from "@/i18n/i18n-provider";
import type { OrderListItem } from "../order-types";
import { OrderStatusBadge } from "./order-status-badge";

interface OrdersTableProps {
    orders: OrderListItem[];
    isLoading: boolean;
    isError: boolean;
}

export function OrdersTable({ orders, isLoading, isError }: OrdersTableProps) {
    const { locale, t } = useI18n();
    const { formatMoney } = useCompany();

    return (
        <Card className="overflow-hidden">
            <CardContent className="p-0">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>{t("orders.order")}</TableHead>
                                <TableHead>{t("orders.customer")}</TableHead>
                                <TableHead>{t("orders.payment")}</TableHead>
                                <TableHead>{t("orders.status")}</TableHead>
                                <TableHead>{t("orders.items")}</TableHead>
                                <TableHead>{t("orders.total")}</TableHead>
                                <TableHead>{t("orders.date")}</TableHead>
                                <TableHead />
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={8} className="h-28 text-center text-muted-foreground">
                                        {t("orders.loading")}
                                    </TableCell>
                                </TableRow>
                            ) : null}
                            {isError ? (
                                <TableRow>
                                    <TableCell colSpan={8} className="h-28 text-center text-destructive">
                                        {t("orders.loadFailed")}
                                    </TableCell>
                                </TableRow>
                            ) : null}
                            {!isLoading && !isError
                                ? orders.map((order) => (
                                      <TableRow key={order.id}>
                                          <TableCell>
                                              <div className="font-semibold">{order.orderNumber}</div>
                                              <div className="text-muted-foreground">#{order.id}</div>
                                          </TableCell>
                                          <TableCell>
                                              <div>{order.customerName}</div>
                                              <div className="text-muted-foreground">{order.customerPhone}</div>
                                          </TableCell>
                                          <TableCell>
                                              <OrderStatusBadge value={order.paymentStatus} />
                                              <div className="mt-1 text-muted-foreground">
                                                  {order.paymentMethod === "CashOnDelivery"
                                                      ? t("orders.cashOnDelivery")
                                                      : t("orders.bankTransfer")}
                                              </div>
                                          </TableCell>
                                          <TableCell>
                                              <OrderStatusBadge value={order.status} />
                                          </TableCell>
                                          <TableCell>{order.itemCount}</TableCell>
                                          <TableCell className="font-semibold tabular-nums">
                                              {formatMoney(order.total, order.currency)}
                                          </TableCell>
                                          <TableCell className="whitespace-nowrap">
                                              {new Date(order.createdAt).toLocaleString(locale)}
                                          </TableCell>
                                          <TableCell>
                                              <div className="flex justify-end gap-2">
                                                  <WhatsAppLink
                                                      url={order.whatsAppUrl}
                                                      customerName={order.customerName}
                                                      compact
                                                  />
                                                  <Button variant="outline" size="sm" render={<Link to={`/orders/${order.id}`} />}>
                                                      <Eye />
                                                      {t("orders.view")}
                                                  </Button>
                                              </div>
                                          </TableCell>
                                      </TableRow>
                                  ))
                                : null}
                            {!isLoading && !isError && orders.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={8} className="h-28 text-center text-muted-foreground">
                                        {t("orders.empty")}
                                    </TableCell>
                                </TableRow>
                            ) : null}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
}
