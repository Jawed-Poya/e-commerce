import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { useAdminAuth } from "@/features/auth/auth-context";
import { useI18n } from "@/i18n/i18n-provider";

const referenceWarmDelayMs = 20_000;

export function OfflineSyncManager() {
    const queryClient = useQueryClient();
    const { user } = useAdminAuth();
    const { t, tf } = useI18n();

    useEffect(() => {
        let active = true;
        let warmTimer: number | null = null;
        let idleCallback: number | null = null;

        const synchronize = async () => {
            if (!user) return;
            const { syncPendingMutations } = await import("./offline-queue");
            if (!active) return;
            const result = await syncPendingMutations();
            if (!active || result.synced <= 0) return;

            await queryClient.invalidateQueries({ queryKey: ["operations"] });
            toast.success(
                result.synced === 1
                    ? t("offline.syncedOne")
                    : tf("offline.synced", { count: result.synced }),
            );
        };

        const warmReferences = async () => {
            if (!active || !user || !navigator.onLine || document.visibilityState !== "visible") return;
            const { warmOfflineOperationReferences } = await import("@/features/operations/operations-service");
            if (active) await warmOfflineOperationReferences();
        };

        const scheduleReferenceWarmup = () => {
            if (warmTimer !== null) window.clearTimeout(warmTimer);
            if (idleCallback !== null && "cancelIdleCallback" in window) window.cancelIdleCallback(idleCallback);
            warmTimer = window.setTimeout(() => {
                warmTimer = null;
                if ("requestIdleCallback" in window) {
                    idleCallback = window.requestIdleCallback(() => {
                        idleCallback = null;
                        void warmReferences();
                    }, { timeout: 10_000 });
                    return;
                }
                void warmReferences();
            }, referenceWarmDelayMs);
        };

        const handleOnline = () => {
            void synchronize();
            scheduleReferenceWarmup();
        };
        const handleVisibility = () => {
            if (document.visibilityState === "visible") scheduleReferenceWarmup();
        };

        window.addEventListener("online", handleOnline);
        document.addEventListener("visibilitychange", handleVisibility);
        void synchronize();
        scheduleReferenceWarmup();
        return () => {
            active = false;
            if (warmTimer !== null) window.clearTimeout(warmTimer);
            if (idleCallback !== null && "cancelIdleCallback" in window) window.cancelIdleCallback(idleCallback);
            window.removeEventListener("online", handleOnline);
            document.removeEventListener("visibilitychange", handleVisibility);
        };
    }, [queryClient, t, tf, user]);

    return null;
}
