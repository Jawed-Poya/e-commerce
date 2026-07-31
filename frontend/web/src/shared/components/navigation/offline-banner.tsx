import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

import { useI18n } from "../../../i18n/i18n-provider";

export function OfflineBanner() {
  const { t } = useI18n();
  const [online, setOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  if (online) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-[240] flex justify-center px-4">
      <div className="flex max-w-xl items-center gap-2 rounded-full border border-amber-500/30 bg-background/95 px-4 py-2 text-xs font-medium shadow-lg shadow-black/10 backdrop-blur">
        <WifiOff className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
        <span>{t("pwa.offlineDescription")}</span>
      </div>
    </div>
  );
}
