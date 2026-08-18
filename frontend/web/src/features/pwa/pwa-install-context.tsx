import {
    createContext,
    useContext,
    useEffect,
    useMemo,
    useState,
    type ReactNode,
} from "react";

export type InstallPromptEvent = Event & {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type PwaInstallValue = {
    canInstall: boolean;
    installed: boolean;
    isIos: boolean;
    install: () => Promise<boolean>;
};

const PwaInstallContext = createContext<PwaInstallValue | null>(null);

function isStandalone() {
    return (
        window.matchMedia("(display-mode: standalone)").matches ||
        Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
    );
}

export function PwaInstallProvider({ children }: { children: ReactNode }) {
    const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
    const [installed, setInstalled] = useState(isStandalone);

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

    const value = useMemo<PwaInstallValue>(
        () => ({
            canInstall: prompt != null,
            installed,
            isIos: /iphone|ipad|ipod/i.test(navigator.userAgent),
            install: async () => {
                if (!prompt) return false;
                await prompt.prompt();
                const choice = await prompt.userChoice;
                if (choice.outcome === "accepted") setPrompt(null);
                return choice.outcome === "accepted";
            },
        }),
        [installed, prompt],
    );

    return (
        <PwaInstallContext.Provider value={value}>
            {children}
        </PwaInstallContext.Provider>
    );
}

export function usePwaInstall() {
    const value = useContext(PwaInstallContext);
    if (!value) {
        throw new Error("usePwaInstall must be used inside PwaInstallProvider");
    }
    return value;
}
