import type { ReactNode } from "react";
import { Eye, PackageCheck, Phone, ReceiptText } from "lucide-react";
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
        <Card className="min-w-0 overflow-hidden">
            <CardContent className="p-0">
                <div className="grid gap-3 p-3 sm:grid-cols-2 xl:hidden">
                    {isLoading ? (
                        <OrderListMessage>{t("orders.loading")}</OrderListMessage>
                    ) : null}
                    {isError ? (
                        <OrderListMessage destructive>{t("orders.loadFailed")}</OrderListMessage>
                    ) : null}
                    {!isLoading && !isError && orders.length === 0 ? (
                        <OrderListMessage>{t("orders.empty")}</OrderListMessage>
                    ) : null}
                    {!isLoading && !isError
                        ? orders.map((order) => (
                              <article
                                  key={order.id}
                                  className="min-w-0 rounded-xl border bg-background p-4 shadow-xs"
                              >
                                  <div className="flex items-start justify-between gap-3">
                                      <div className="min-w-0">
                                          <p className="truncate font-semibold">
                                              {order.orderNumber}
                                          </p>
                                          <p className="mt-0.5 text-[11px] text-muted-foreground">
                                              #{order.id}
                                          </p>
                                      </div>
                                      <OrderStatusBadge value={order.status} />
                                  </div>

                                  <div className="mt-3 space-y-1.5 border-y py-3 text-xs text-muted-foreground">
                                      <div className="flex min-w-0 items-center gap-2">
                                          <ReceiptText className="size-3.5 shrink-0" />
                                          <span className="truncate font-medium text-foreground">
                                              {order.customerName}
                                          </span>
                                      </div>
                                      <a
                                          href={`tel:${order.customerPhone}`}
                                          className="flex min-w-0 items-center gap-2 hover:text-primary"
                                      >
                                          <Phone className="size-3.5 shrink-0" />
                                          <span className="truncate">{order.customerPhone}</span>
                                      </a>
                                  </div>

                                  <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                                      <OrderMetric
                                          label={t("orders.total")}
                                          value={formatMoney(order.total, order.currency)}
                                          strong
                                      />
                                      <OrderMetric
                                          label={t("orders.items")}
                                          value={String(order.itemCount)}
                                      />
                                  </div>

                                  <div className="mt-3 flex flex-wrap items-center gap-2">
                                      <OrderStatusBadge value={order.paymentStatus} />
                                      <span className="text-[11px] text-muted-foreground">
                                          {order.paymentMethod === "CashOnDelivery"
                                              ? t("orders.cashOnDelivery")
                                              : t("orders.bankTransfer")}
                                      </span>
                                  </div>

                                  <div className="mt-3 flex items-end justify-between gap-3 border-t pt-3">
                                      <div className="min-w-0 text-[11px] text-muted-foreground">
                                          <PackageCheck className="me-1 inline size-3.5" />
                                          {new Date(order.createdAt).toLocaleString(locale)}
                                      </div>
                                      <div className="flex shrink-0 gap-2">
                                          <WhatsAppLink
                                              url={order.whatsAppUrl}
                                              customerName={order.customerName}
                                              compact
                                          />
                                          <Button
                                              variant="outline"
                                              size="sm"
                                              render={<Link to={`/orders/${order.id}`} />}
                                          >
                                              <Eye />
                                              {t("orders.view")}
                                          </Button>
                                      </div>
                                  </div>
                              </article>
                          ))
                        : null}
                </div>

                <div className="hidden xl:block">
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
                                    <TableCell
                                        colSpan={8}
                                        className="h-28 text-center text-muted-foreground"
                                    >
                                        {t("orders.loading")}
                                    </TableCell>
                                </TableRow>
                            ) : null}
                            {isError ? (
                                <TableRow>
                                    <TableCell
                                        colSpan={8}
                                        className="h-28 text-center text-destructive"
                                    >
                                        {t("orders.loadFailed")}
                                    </TableCell>
                                </TableRow>
                            ) : null}
                            {!isLoading && !isError
                                ? orders.map((order) => (
                                      <TableRow key={order.id}>
                                          <TableCell>
                                              <div className="font-semibold">
                                                  {order.orderNumber}
                                              </div>
                                              <div className="text-muted-foreground">
                                                  #{order.id}
                                              </div>
                                          </TableCell>
                                          <TableCell>
                                              <div>{order.customerName}</div>
                                              <div className="text-muted-foreground">
                                                  {order.customerPhone}
                                              </div>
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
                                                  <Button
                                                      variant="outline"
                                                      size="sm"
                                                      render={<Link to={`/orders/${order.id}`} />}
                                                  >
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
                                    <TableCell
                                        colSpan={8}
                                        className="h-28 text-center text-muted-foreground"
                                    >
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

function OrderMetric({
    label,
    value,
    strong = false,
}: {
    label: string;
    value: string;
    strong?: boolean;
}) {
    return (
        <div className="min-w-0 rounded-lg bg-muted/45 p-2.5">
            <p className="truncate text-[10px] text-muted-foreground">{label}</p>
            <p className={strong ? "mt-1 truncate font-bold tabular-nums" : "mt-1 truncate font-medium tabular-nums"}>
                {value}
            </p>
        </div>
    );
}

function OrderListMessage({
    children,
    destructive = false,
}: {
    children: ReactNode;
    destructive?: boolean;
}) {
    return (
        <div
            className={`grid min-h-32 place-items-center rounded-xl border p-4 text-center text-sm sm:col-span-2 ${
                destructive ? "text-destructive" : "text-muted-foreground"
            }`}
        >
            {children}
        </div>
    );
}
