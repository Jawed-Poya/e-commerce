export {};

declare global {
    interface Window {
        easyCartDesktop?: {
            getAdminToken(): string | null;
            setAdminToken(token: string): void;
            clearAdminToken(): void;
        };
    }
}
