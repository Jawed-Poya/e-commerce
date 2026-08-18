import { useEffect, useRef, useState } from "react";

import { Button } from "../../shared/components/ui/button";
import { apiGet } from "../../shared/api/api-client";

const scriptId = "google-identity-services";
const scriptUrl = "https://accounts.google.com/gsi/client";

export function GoogleSignInButton({
    onCredential,
    disabled,
}: {
    onCredential: (credential: string) => void;
    disabled?: boolean;
}) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [clientId, setClientId] = useState("");
    const [configurationLoaded, setConfigurationLoaded] = useState(false);

    useEffect(() => {
        let active = true;

        // Keep the backend as the single source of truth for Google OAuth.
        // The same client ID that renders the Google button is therefore also
        // the one used by the API to validate the returned ID token audience.
        void apiGet<{ enabled: boolean; clientId: string | null }>("/auth/customer/google/config")
            .then((configuration) => {
                if (!active) return;
                setClientId(configuration.enabled ? configuration.clientId?.trim() ?? "" : "");
            })
            .catch(() => {
                if (active) setClientId("");
            })
            .finally(() => {
                if (active) setConfigurationLoaded(true);
            });

        return () => {
            active = false;
        };
    }, []);

    useEffect(() => {
        if (!clientId || disabled) return;

        const render = () => {
            if (!containerRef.current || !window.google) return;
            containerRef.current.replaceChildren();
            window.google.accounts.id.initialize({
                client_id: clientId,
                callback: (response) => onCredential(response.credential),
                auto_select: false,
                cancel_on_tap_outside: true,
            });
            window.google.accounts.id.renderButton(containerRef.current, {
                type: "standard",
                theme: "outline",
                size: "large",
                text: "continue_with",
                shape: "pill",
                width: Math.min(containerRef.current.clientWidth || 420, 420),
            });
        };

        const existing = document.getElementById(scriptId) as HTMLScriptElement | null;
        if (window.google) {
            render();
            return;
        }
        if (existing) {
            existing.addEventListener("load", render, { once: true });
            return () => existing.removeEventListener("load", render);
        }

        const script = document.createElement("script");
        script.id = scriptId;
        script.src = scriptUrl;
        script.async = true;
        script.defer = true;
        script.addEventListener("load", render, { once: true });
        document.head.appendChild(script);
        return () => script.removeEventListener("load", render);
    }, [clientId, disabled, onCredential]);

    if (!clientId) {
        return (
            <Button
                type="button"
                variant="outline"
                className="h-11 w-full rounded-full bg-background font-bold"
                disabled
                title={configurationLoaded ? "Google sign-in is not configured on the server" : "Loading Google sign-in"}
            >
                <span
                    aria-hidden="true"
                    className="grid size-6 place-items-center rounded-full bg-white text-base font-black text-[#4285F4] shadow-sm ring-1 ring-black/10"
                >
                    G
                </span>
                Continue with Google
            </Button>
        );
    }

    return <div ref={containerRef} className={disabled ? "pointer-events-none opacity-60" : "min-h-11 w-full"} />;
}
