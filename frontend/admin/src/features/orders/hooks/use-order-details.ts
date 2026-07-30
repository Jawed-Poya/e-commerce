import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { useI18n } from "@/i18n/i18n-provider";
import { getApiErrorMessage } from "@/lib/api-error";
import { orderQueryKeys } from "../order-query-keys";
import { orderService } from "../order-service";
import type { OrderStatus, PaymentStatus } from "../order-types";

export function useOrderDetails(id: number) {
    const queryClient = useQueryClient();
    const { t } = useI18n();
    const enabled = Number.isFinite(id) && id > 0;

    const query = useQuery({
        queryKey: orderQueryKeys.detail(id),
        queryFn: () => orderService.getOrder(id),
        enabled,
    });

    const refreshOrderCaches = async () => {
        await queryClient.invalidateQueries({ queryKey: orderQueryKeys.lists() });
    };

    const statusMutation = useMutation({
        mutationFn: ({ status, note }: { status: OrderStatus; note?: string }) =>
            orderService.updateStatus(id, status, note),
        onSuccess: async (data) => {
            queryClient.setQueryData(orderQueryKeys.detail(id), data);
            await refreshOrderCaches();
            toast.success(t("orders.statusUpdated"));
        },
        onError: (error) =>
            toast.error(getApiErrorMessage(error, t("orders.operationFailed"))),
    });

    const paymentMutation = useMutation({
        mutationFn: ({
            status,
            reference,
            failureReason,
        }: {
            status: PaymentStatus;
            reference?: string;
            failureReason?: string;
        }) => orderService.updatePayment(id, status, reference, failureReason),
        onSuccess: async (data) => {
            queryClient.setQueryData(orderQueryKeys.detail(id), data);
            await refreshOrderCaches();
            toast.success(t("orders.paymentUpdated"));
        },
        onError: (error) =>
            toast.error(getApiErrorMessage(error, t("orders.operationFailed"))),
    });

    return { query, statusMutation, paymentMutation };
}
