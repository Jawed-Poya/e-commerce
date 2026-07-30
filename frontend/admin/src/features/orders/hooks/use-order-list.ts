import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { orderQueryKeys } from "../order-query-keys";
import { orderService } from "../order-service";
import type { OrderStatus, PaymentStatus } from "../order-types";

export function useOrderList() {
    const [search, setSearch] = useState("");
    const debouncedSearch = useDebouncedValue(search);
    const [status, setStatus] = useState<OrderStatus | "">("");
    const [paymentStatus, setPaymentStatus] = useState<PaymentStatus | "">("");
    const [page, setPage] = useState(1);

    const filters = useMemo(
        () => ({
            search: debouncedSearch.trim() || undefined,
            status,
            paymentStatus,
            page,
            pageSize: 20,
        }),
        [debouncedSearch, page, paymentStatus, status],
    );

    const query = useQuery({
        queryKey: orderQueryKeys.list(filters),
        queryFn: () => orderService.getOrders(filters),
        placeholderData: (previous) => previous,
    });

    const updateSearch = (value: string) => {
        setSearch(value);
        setPage(1);
    };
    const updateStatus = (value: OrderStatus | "") => {
        setStatus(value);
        setPage(1);
    };
    const updatePaymentStatus = (value: PaymentStatus | "") => {
        setPaymentStatus(value);
        setPage(1);
    };

    return {
        query,
        search,
        status,
        paymentStatus,
        page,
        setPage,
        updateSearch,
        updateStatus,
        updatePaymentStatus,
    };
}
