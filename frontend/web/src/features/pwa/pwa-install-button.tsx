import * as Dialog from "@radix-ui/react-dialog";
import { Download, Share, Smartphone, X } from "lucide-react";
import { useState } from "react";

import { useI18n } from "../../i18n/i18n-provider";
import { Button } from "../../shared/components/ui/button";
import {
    mobileAppDownloadUrl,
    mobileAppLinkIsExternal,
} from "./mobile-app-download";
import { usePwaInstall } from "./pwa-install-context";

export function PwaInstallButton({ compact = false }: { compact?: boolean }) {
    const { t } = useI18n();
    const { canInstall, installed, install, isIos } = usePwaInstall();
    const [instructionsOpen, setInstructionsOpen] = useState(false);

    if (installed) return null;

    const startInstall = async () => {
        if (canInstall) {
            await install();
        } else {
            setInstructionsOpen(true);
        }
    };

    return (
        <>
            {compact ? (
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="rounded-xl text-muted-foreground hover:bg-primary/10 hover:text-primary"
                    onClick={() => void startInstall()}
                    aria-label={t("pwa.install")}
                    title={t("pwa.install")}
                >
                    <Download className="size-5" />
                </Button>
            ) : (
                <Button
                    type="button"
                    variant="outline"
                    className="w-full rounded-xl"
                    onClick={() => void startInstall()}
                >
                    <Download className="size-4" /> {t("pwa.install")}
                </Button>
            )}

            <Dialog.Root
                open={instructionsOpen}
                onOpenChange={setInstructionsOpen}
            >
                <Dialog.Portal>
                    <Dialog.Overlay className="fixed inset-0 z-[70] bg-slate-950/60 backdrop-blur-sm" />
                    <Dialog.Content className="fixed left-1/2 top-1/2 z-[71] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border bg-background p-5 shadow-2xl outline-none">
                        <div className="flex items-start justify-between gap-4">
                            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                                <Smartphone className="size-5" />
                            </span>
                            <Dialog.Close asChild>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="ms-auto size-9 rounded-xl"
                                    aria-label={t("common.close")}
                                >
                                    <X className="size-4" />
                                </Button>
                            </Dialog.Close>
                        </div>
                        <Dialog.Title className="mt-4 text-xl font-black">
                            {t("pwa.installTitle")}
                        </Dialog.Title>
                        <Dialog.Description className="mt-2 text-sm leading-6 text-muted-foreground">
                            {isIos
                                ? t("pwa.iosInstructions")
                                : t("pwa.browserInstructions")}
                        </Dialog.Description>
                        {isIos ? (
                            <div className="mt-4 flex items-center gap-3 rounded-xl bg-muted/50 p-3 text-sm font-bold">
                                <Share className="size-5 text-primary" />
                                {t("pwa.iosShareHint")}
                            </div>
                        ) : null}
                    </Dialog.Content>
                </Dialog.Portal>
            </Dialog.Root>
        </>
    );
}

export function MobileAppDownloadBanner() {
    const { t } = useI18n();
    const [dismissed, setDismissed] = useState(
        () => sessionStorage.getItem("mobile-app-banner-dismissed") === "true",
    );

    if (dismissed) return null;

    const dismiss = () => {
        sessionStorage.setItem("mobile-app-banner-dismissed", "true");
        setDismissed(true);
    };

    return (
        <aside
            role="status"
            className="fixed inset-x-3 bottom-20 z-30 mx-auto flex max-w-lg items-center gap-3 rounded-2xl border bg-background/95 p-3 shadow-2xl backdrop-blur-xl md:bottom-5"
        >
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                <Smartphone className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
                <p className="text-sm font-black">{t("mobileApp.downloadTitle")}</p>
                <p className="truncate text-xs text-muted-foreground">
                    {t("mobileApp.downloadDescription")}
                </p>
            </div>
            <Button
                asChild
                size="sm"
                className="rounded-xl"
            >
                <a
                    href={mobileAppDownloadUrl}
                    target={mobileAppLinkIsExternal ? "_blank" : undefined}
                    rel={mobileAppLinkIsExternal ? "noreferrer" : undefined}
                >
                    <Download className="size-4" />
                    {t("mobileApp.download")}
                </a>
            </Button>
            <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 shrink-0 rounded-lg"
                onClick={dismiss}
                aria-label={t("common.close")}
            >
                <X className="size-4" />
            </Button>
        </aside>
    );
}
