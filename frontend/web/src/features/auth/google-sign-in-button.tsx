import { useEffect, useRef } from "react";

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
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim();

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

    if (!clientId) return null;
    return <div ref={containerRef} className={disabled ? "pointer-events-none opacity-60" : "min-h-11 w-full"} />;
}
