interface GoogleCredentialResponse {
    credential: string;
}

interface GoogleAccountsId {
    initialize(options: {
        client_id: string;
        callback: (response: GoogleCredentialResponse) => void;
        auto_select?: boolean;
        cancel_on_tap_outside?: boolean;
    }): void;
    renderButton(
        element: HTMLElement,
        options: {
            type?: "standard" | "icon";
            theme?: "outline" | "filled_blue" | "filled_black";
            size?: "large" | "medium" | "small";
            text?: "signin_with" | "signup_with" | "continue_with" | "signin";
            shape?: "rectangular" | "pill" | "circle" | "square";
            width?: number;
        },
    ): void;
}

interface Window {
    google?: { accounts: { id: GoogleAccountsId } };
}
