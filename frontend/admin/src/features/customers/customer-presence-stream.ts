import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { apiBaseUrl } from "@/api/axios";
import { useAdminAuth } from "@/features/auth/auth-context";
import { getAdminToken } from "@/features/auth/auth-storage";
import { customerQueryKeys } from "@/features/customers/customer-query-keys";

export type CustomerRealtimeStatus =
    | "connecting"
    | "live"
    | "reconnecting"
    | "polling";

interface CustomerPresenceEvent {
    customerId: number;
}

const streamUrl = `${apiBaseUrl}/customers/activity-stream`;

export function useCustomerPresenceStream(customerId?: number) {
    const auth = useAdminAuth();
    const queryClient = useQueryClient();
    const [status, setStatus] = useState<CustomerRealtimeStatus>("connecting");

    useEffect(() => {
        if (!auth.isAuthenticated) {
            setStatus("polling");
            return;
        }

        const controller = new AbortController();
        const pendingCustomerIds = new Set<number>();
        let disposed = false;
        let refreshTimer: number | undefined;

        const queueRefresh = (event: CustomerPresenceEvent) => {
            if (Number.isFinite(event.customerId))
                pendingCustomerIds.add(event.customerId);

            window.clearTimeout(refreshTimer);
            refreshTimer = window.setTimeout(() => {
                if (disposed) return;

                void queryClient.invalidateQueries({
                    queryKey: ["customers", "list"],
                });

                if (customerId && pendingCustomerIds.has(customerId)) {
                    void queryClient.invalidateQueries({
                        queryKey: customerQueryKeys.engagement(customerId),
                    });
                }

                pendingCustomerIds.clear();
            }, 350);
        };

        const connect = async () => {
            let retryDelay = 1_000;

            while (!disposed) {
                const token = getAdminToken();
                if (!token) {
                    setStatus("polling");
                    return;
                }

                setStatus(retryDelay === 1_000 ? "connecting" : "reconnecting");

                try {
                    const response = await fetch(streamUrl, {
                        headers: { Authorization: `Bearer ${token}` },
                        signal: controller.signal,
                    });
                    if (!response.ok || !response.body)
                        throw new Error("Customer activity stream unavailable.");

                    setStatus("live");
                    retryDelay = 1_000;
                    const reader = response.body
                        .pipeThrough(new TextDecoderStream())
                        .getReader();
                    let buffer = "";

                    while (!disposed) {
                        const { value, done } = await reader.read();
                        if (done) break;

                        buffer += value;
                        const events = buffer.split("\n\n");
                        buffer = events.pop() ?? "";

                        events.forEach((frame) => {
                            const data = frame
                                .split("\n")
                                .find((line) => line.startsWith("data: "))
                                ?.slice(6);
                            if (!data) return;

                            try {
                                queueRefresh(JSON.parse(data) as CustomerPresenceEvent);
                            } catch {
                                // Ignore a malformed frame without dropping the stream.
                            }
                        });
                    }
                } catch {
                    if (disposed || controller.signal.aborted) return;
                    setStatus("polling");
                    await new Promise((resolve) =>
                        window.setTimeout(resolve, retryDelay),
                    );
                    retryDelay = Math.min(retryDelay * 2, 30_000);
                }
            }
        };

        void connect();
        return () => {
            disposed = true;
            controller.abort();
            window.clearTimeout(refreshTimer);
        };
    }, [auth.isAuthenticated, auth.user?.userId, customerId, queryClient]);

    return status;
}
