interface EasyCartDesktopBridge {
    readonly isDesktop: true;
    readonly platform: string;
    getAdminToken(): string | null;
    setAdminToken(token: string): void;
    clearAdminToken(): void;
}

interface Window {
    readonly easyCartDesktop?: EasyCartDesktopBridge;
}
