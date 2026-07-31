import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { useI18n } from "@/i18n/i18n-provider";
import { syncPendingMutations } from "./offline-queue";

export function OfflineSyncManager() {
    const queryClient = useQueryClient();
    const { t, tf } = useI18n();

    useEffect(() => {
        let active = true;
        const synchronize = async () => {
            const result = await syncPendingMutations();
            if (!active || result.synced <= 0) return;

            await queryClient.invalidateQueries({ queryKey: ["operations"] });
            toast.success(
                result.synced === 1
                    ? t("offline.syncedOne")
                    : tf("offline.synced", { count: result.synced }),
            );
        };

        window.addEventListener("online", synchronize);
        void synchronize();
        return () => {
            active = false;
            window.removeEventListener("online", synchronize);
        };
    }, [queryClient, t, tf]);

    return null;
}
