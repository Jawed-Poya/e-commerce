import { useCallback, useEffect, useState } from "react";
import { CloudUpload, LoaderCircle, Trash2, Wifi, WifiOff } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useI18n } from "@/i18n/i18n-provider";
import {
    discardPendingMutation,
    getPendingMutations,
    subscribeToOfflineQueue,
    syncPendingMutations,
    type PendingMutation,
} from "./offline-queue";

export function OfflineStatus() {
    const { t, tf, tr } = useI18n();
    const [online, setOnline] = useState(() => navigator.onLine);
    const [pending, setPending] = useState<PendingMutation[]>([]);
    const [syncing, setSyncing] = useState(false);

    const refresh = useCallback(async () => {
        setPending(await getPendingMutations());
    }, []);

    useEffect(() => {
        const updateConnection = () => setOnline(navigator.onLine);
        window.addEventListener("online", updateConnection);
        window.addEventListener("offline", updateConnection);
        const unsubscribe = subscribeToOfflineQueue(() => void refresh());
        void refresh();
        return () => {
            window.removeEventListener("online", updateConnection);
            window.removeEventListener("offline", updateConnection);
            unsubscribe();
        };
    }, [refresh]);

    const synchronize = async () => {
        setSyncing(true);
        try {
            const result = await syncPendingMutations();
            await refresh();
            if (result.synced > 0) {
                toast.success(result.synced === 1 ? t("offline.syncedOne") : tf("offline.synced", { count: result.synced }));
            } else if (result.remaining === 0) {
                toast.success(t("offline.everythingSynced"));
            }
        } finally {
            setSyncing(false);
        }
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger
                render={
                    <Button
                        variant="ghost"
                        size="icon-sm"
                        className="relative"
                        aria-label={t("offline.title")}
                    />
                }
            >
                {online ? <Wifi className="size-4" /> : <WifiOff className="size-4 text-amber-600" />}
                {pending.length > 0 ? (
                    <span className="absolute -end-1 -top-1 grid min-w-4 place-items-center rounded-full bg-primary px-1 text-[9px] font-bold leading-4 text-primary-foreground">
                        {pending.length > 99 ? "99+" : pending.length}
                    </span>
                ) : null}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 rounded-xl p-1">
                <DropdownMenuLabel className="px-3 py-3">
                    <div className="flex items-start gap-3">
                        <div className={`grid size-9 place-items-center rounded-lg ${online ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600"}`}>
                            {online ? <Wifi className="size-4" /> : <WifiOff className="size-4" />}
                        </div>
                        <div>
                            <p className="font-semibold text-foreground">
                                {online ? t("offline.connected") : t("offline.working")}
                            </p>
                            <p className="mt-1 text-[11px] leading-4">
                                {online
                                    ? t("offline.connectedDescription")
                                    : t("offline.workingDescription")}
                            </p>
                        </div>
                    </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {pending.length === 0 ? (
                    <DropdownMenuLabel className="px-3 py-5 text-center">
                        {t("offline.empty")}
                    </DropdownMenuLabel>
                ) : (
                    <div className="max-h-56 overflow-y-auto py-1">
                        {pending.slice(0, 8).map((item) => (
                            <DropdownMenuLabel key={item.id} className="px-3 py-2.5">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="truncate font-medium text-foreground">{tr(item.label)}</p>
                                        <p className="mt-0.5 text-[10px]">{new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.createdAt))}</p>
                                        {item.lastError ? <p className="mt-1 line-clamp-2 text-[10px] text-destructive">{tr(item.lastError)}</p> : null}
                                    </div>
                                    <div className="flex shrink-0 items-center gap-1">
                                        <span className="rounded-full bg-muted px-2 py-1 text-[10px] text-muted-foreground">
                                            {item.attempts ? tf("offline.retryCount", { count: item.attempts }) : t("offline.waiting")}
                                        </span>
                                        <Button
                                            type="button"
                                            size="icon-sm"
                                            variant="ghost"
                                            className="size-7 text-muted-foreground hover:text-destructive"
                                            aria-label={tr("Discard pending operation")}
                                            onClick={() => void discardPendingMutation(item.id)}
                                        >
                                            <Trash2 className="size-3.5" />
                                        </Button>
                                    </div>
                                </div>
                            </DropdownMenuLabel>
                        ))}
                    </div>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                    disabled={!online || syncing || pending.length === 0}
                    onClick={() => void synchronize()}
                    className="m-1 justify-center rounded-lg bg-primary text-primary-foreground focus:bg-primary/90 focus:text-primary-foreground"
                >
                    {syncing ? <LoaderCircle className="animate-spin" /> : <CloudUpload />}
                    {syncing ? t("offline.syncing") : t("offline.syncNow")}
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
