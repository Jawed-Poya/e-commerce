import { RefreshCw } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/i18n-provider";
import { OrderFilters } from "../components/order-filters";
import { OrdersTable } from "../components/orders-table";
import { useOrderList } from "../hooks/use-order-list";

export default function OrdersPage() {
    const { t, tf } = useI18n();
    const controller = useOrderList();
    const data = controller.query.data;

    return (
        <div className="space-y-5">
            <PageHeader
                title={t("orders.title")}
                description={t("orders.description")}
                actions={
                    <Button
                        variant="outline"
                        onClick={() => controller.query.refetch()}
                        disabled={controller.query.isFetching}
                    >
                        <RefreshCw className={controller.query.isFetching ? "animate-spin" : ""} />
                        {t("orders.refresh")}
                    </Button>
                }
            />

            <OrderFilters
                search={controller.search}
                status={controller.status}
                paymentStatus={controller.paymentStatus}
                onSearchChange={controller.updateSearch}
                onStatusChange={controller.updateStatus}
                onPaymentStatusChange={controller.updatePaymentStatus}
            />

            <OrdersTable
                orders={data?.items ?? []}
                isLoading={controller.query.isLoading}
                isError={controller.query.isError}
            />

            {data && data.totalPages > 1 ? (
                <div className="flex flex-col gap-3 text-xs sm:flex-row sm:items-center sm:justify-between">
                    <span>
                        {tf("orders.pageSummary", {
                            page: data.page,
                            pages: data.totalPages,
                            count: data.totalCount,
                        })}
                    </span>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            disabled={!data.hasPreviousPage}
                            onClick={() => controller.setPage((page) => page - 1)}
                        >
                            {t("orders.previous")}
                        </Button>
                        <Button
                            variant="outline"
                            disabled={!data.hasNextPage}
                            onClick={() => controller.setPage((page) => page + 1)}
                        >
                            {t("orders.next")}
                        </Button>
                    </div>
                </div>
            ) : null}
        </div>
    );
}
