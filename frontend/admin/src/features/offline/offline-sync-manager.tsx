import { useEffect } from "react";
import { toast } from "sonner";

import { syncPendingMutations } from "./offline-queue";

export function OfflineSyncManager() {
    useEffect(() => {
        let active = true;
        const synchronize = async () => {
            const result = await syncPendingMutations();
            if (active && result.synced > 0) {
                toast.success(
                    `${result.synced} offline operation${result.synced === 1 ? "" : "s"} synchronized.`,
                );
            }
        };

        window.addEventListener("online", synchronize);
        void synchronize();
        return () => {
            active = false;
            window.removeEventListener("online", synchronize);
        };
    }, []);

    return null;
}
