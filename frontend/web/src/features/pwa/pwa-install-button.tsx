import { Download, Smartphone } from "lucide-react";
import { useEffect, useState } from "react";

import { useI18n } from "../../i18n/i18n-provider";
import { Button } from "../../shared/components/ui/button";

type InstallPromptEvent = Event & {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function PwaInstallButton({ compact = false }: { compact?: boolean }) {
    const { t } = useI18n();
    const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
    const [installed, setInstalled] = useState(
        window.matchMedia("(display-mode: standalone)").matches,
    );

    useEffect(() => {
        const beforeInstall = (event: Event) => {
            event.preventDefault();
            setPrompt(event as InstallPromptEvent);
        };
        const appInstalled = () => {
            setInstalled(true);
            setPrompt(null);
        };
        window.addEventListener("beforeinstallprompt", beforeInstall);
        window.addEventListener("appinstalled", appInstalled);
        return () => {
            window.removeEventListener("beforeinstallprompt", beforeInstall);
            window.removeEventListener("appinstalled", appInstalled);
        };
    }, []);

    if (installed || !prompt) return null;

    const install = async () => {
        await prompt.prompt();
        const choice = await prompt.userChoice;
        if (choice.outcome === "accepted") setPrompt(null);
    };

    return compact ? (
        <Button
            variant="ghost"
            size="icon"
            className="rounded-xl text-muted-foreground hover:bg-primary/10 hover:text-primary"
            onClick={() => void install()}
            aria-label={t("pwa.install")}
        >
            <Download className="size-5" />
        </Button>
    ) : (
        <Button variant="outline" className="w-full rounded-xl" onClick={() => void install()}>
            <Smartphone className="size-4" /> {t("pwa.install")}
        </Button>
    );
}
