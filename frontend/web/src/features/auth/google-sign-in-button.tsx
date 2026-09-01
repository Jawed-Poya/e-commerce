import { LoaderCircle } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useRef, useState } from "react";

import { apiGet } from "../../shared/api/api-client";
import { useI18n } from "../../i18n/i18n-provider";

const scriptId = "google-identity-services";
const scriptUrl = "https://accounts.google.com/gsi/client";
const maxButtonWidth = 400;
const minButtonWidth = 240;

export function GoogleSignInButton({
    onCredential,
    disabled,
}: {
    onCredential: (credential: string) => void;
    disabled?: boolean;
}) {
    const containerRef = useRef<HTMLDivElement>(null);
    const { resolvedTheme } = useTheme();
    const { t } = useI18n();
    const [clientId, setClientId] = useState("");
    const [configurationLoaded, setConfigurationLoaded] = useState(false);
    const [failure, setFailure] = useState<"configuration" | "script" | "origin" | null>(null);
    const [buttonRendered, setButtonRendered] = useState(false);
    const isLocalHost = /^(localhost|127\.0\.0\.1|\[::1\])$/i.test(window.location.hostname);
    const isSecureForGoogle = window.location.protocol === "https:" || isLocalHost;

    useEffect(() => {
        let active = true;

        if (!isSecureForGoogle) {
            setConfigurationLoaded(true);
            return () => {
                active = false;
            };
        }

        // Keep the backend as the single source of truth for Google OAuth.
        // The same client ID that renders the Google button is therefore also
        // the one used by the API to validate the returned ID token audience.
        void apiGet<{ enabled: boolean; clientId: string | null }>(
            "/auth/customer/google/config",
        )
            .then((configuration) => {
                if (!active) return;
                setClientId(
                    configuration.enabled
                        ? configuration.clientId?.trim() ?? ""
                        : "",
                );
            })
            .catch(() => {
                if (active) {
                    setClientId("");
                    setFailure("configuration");
                }
            })
            .finally(() => {
                if (active) setConfigurationLoaded(true);
            });

        return () => {
            active = false;
        };
    }, [isSecureForGoogle]);

    useEffect(() => {
        if (!clientId) return;

        let disposed = false;
        let resizeFrame = 0;
        let resizeObserver: ResizeObserver | undefined;
        let lastRenderedWidth = -1;
        let renderCheck = 0;
        let loadTimeout = 0;

        const render = (force = false) => {
            if (disposed || !containerRef.current || !window.google) return;

            const width = Math.min(
                maxButtonWidth,
                Math.max(
                    minButtonWidth,
                    Math.floor(containerRef.current.getBoundingClientRect().width),
                ),
            );

            if (
                !force &&
                width === lastRenderedWidth &&
                containerRef.current.childElementCount > 0
            ) {
                return;
            }

            lastRenderedWidth = width;
            containerRef.current.replaceChildren();
            try {
                window.google.accounts.id.initialize({
                    client_id: clientId,
                    callback: (response) => onCredential(response.credential),
                    auto_select: false,
                    cancel_on_tap_outside: true,
                });
                window.google.accounts.id.renderButton(containerRef.current, {
                    type: "standard",
                    theme: resolvedTheme === "dark" ? "filled_black" : "outline",
                    size: "large",
                    text: "continue_with",
                    shape: "pill",
                    width,
                    logo_alignment: "left",
                });
            } catch {
                setButtonRendered(false);
                setFailure("origin");
                return;
            }
            window.clearTimeout(renderCheck);
            renderCheck = window.setTimeout(() => {
                if (disposed) return;
                if (containerRef.current?.childElementCount) {
                    setButtonRendered(true);
                    setFailure(null);
                } else {
                    setButtonRendered(false);
                    setFailure("origin");
                }
            }, 500);
        };

        const observeSize = () => {
            if (!containerRef.current || typeof ResizeObserver === "undefined") {
                return;
            }

            resizeObserver = new ResizeObserver(() => {
                cancelAnimationFrame(resizeFrame);
                resizeFrame = requestAnimationFrame(() => render());
            });
            resizeObserver.observe(containerRef.current);
        };

        const handleLoad = () => {
            window.clearTimeout(loadTimeout);
            render(true);
            observeSize();
        };

        const handleError = () => {
            if (disposed) return;
            window.clearTimeout(loadTimeout);
            setFailure("script");
            setButtonRendered(false);
        };

        setButtonRendered(false);

        const existing = document.getElementById(
            scriptId,
        ) as HTMLScriptElement | null;
        let scriptElement = existing;

        if (window.google) {
            handleLoad();
        } else if (existing) {
            existing.addEventListener("load", handleLoad, { once: true });
            existing.addEventListener("error", handleError, { once: true });
            loadTimeout = window.setTimeout(handleError, 10_000);
        } else {
            scriptElement = document.createElement("script");
            scriptElement.id = scriptId;
            scriptElement.src = scriptUrl;
            scriptElement.async = true;
            scriptElement.defer = true;
            scriptElement.addEventListener("load", handleLoad, { once: true });
            scriptElement.addEventListener("error", handleError, { once: true });
            document.head.appendChild(scriptElement);
            loadTimeout = window.setTimeout(handleError, 10_000);
        }

        return () => {
            disposed = true;
            cancelAnimationFrame(resizeFrame);
            window.clearTimeout(renderCheck);
            window.clearTimeout(loadTimeout);
            resizeObserver?.disconnect();
            scriptElement?.removeEventListener("load", handleLoad);
            scriptElement?.removeEventListener("error", handleError);
        };
    }, [clientId, onCredential, resolvedTheme]);

    if (!isSecureForGoogle) {
        return <GoogleUnavailable message={t("google.insecureContext")} />;
    }

    if (!clientId) {
        return (
            <div className="mx-auto w-full max-w-[400px] space-y-2">
                <GoogleButtonShell
                    loading={!configurationLoaded}
                    disabled
                    title={
                        configurationLoaded
                            ? t(failure === "configuration" ? "google.configurationUnavailable" : "google.notConfigured")
                            : t("google.loading")
                    }
                />
                {configurationLoaded ? (
                    <p role="alert" className="text-center text-xs leading-5 text-destructive">
                        {t(failure === "configuration" ? "google.configurationUnavailable" : "google.notConfigured")}
                    </p>
                ) : null}
            </div>
        );
    }

    if (failure) {
        return <GoogleUnavailable message={t(failure === "origin" ? "google.originUnavailable" : "google.scriptUnavailable")} />;
    }

    return (
        <div
            className={[
                "relative mx-auto flex min-h-11 w-full max-w-[400px] items-center justify-center overflow-hidden rounded-full",
                "transition-[transform,box-shadow,opacity] duration-200",
                disabled
                    ? "pointer-events-none opacity-55"
                    : "hover:-translate-y-px hover:shadow-md focus-within:ring-2 focus-within:ring-primary/15",
            ].join(" ")}
            aria-busy={!buttonRendered}
        >
            {!buttonRendered ? (
                <div className="absolute inset-0 z-0">
                    <GoogleButtonShell loading />
                </div>
            ) : null}

            <div
                ref={containerRef}
                className="relative z-10 min-h-11 w-full [&>div]:!mx-auto [&>div]:!w-full [&_iframe]:!w-full"
            />
        </div>
    );
}

function GoogleUnavailable({ message }: { message: string }) {
    return (
        <div className="mx-auto w-full max-w-[400px] space-y-2">
            <GoogleButtonShell disabled title={message} />
            <p role="alert" className="text-center text-xs leading-5 text-destructive">
                {message}
            </p>
        </div>
    );
}

function GoogleButtonShell({
    loading = false,
    disabled = false,
    title,
}: {
    loading?: boolean;
    disabled?: boolean;
    title?: string;
}) {
    return (
        <div
            title={title}
            aria-disabled={disabled}
            className={[
                "flex h-11 w-full items-center justify-center gap-3 rounded-full border px-4 text-sm font-bold",
                "border-border/90 bg-background text-foreground shadow-sm",
                "dark:border-white/[0.11] dark:bg-[#131314] dark:text-[#e8eaed]",
                disabled ? "cursor-not-allowed opacity-70" : "",
            ].join(" ")}
        >
            {loading ? (
                <LoaderCircle className="size-4 animate-spin text-muted-foreground" />
            ) : (
                <GoogleMark />
            )}
            <span>{loading ? "Loading Google sign-in…" : "Continue with Google"}</span>
        </div>
    );
}

function GoogleMark() {
    return (
        <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="size-[18px] shrink-0"
        >
            <path
                fill="#4285F4"
                d="M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.92h5.38a4.6 4.6 0 0 1-2 3.02v2.54h3.24c1.9-1.75 2.98-4.32 2.98-7.41Z"
            />
            <path
                fill="#34A853"
                d="M12 22c2.7 0 4.97-.9 6.62-2.36l-3.24-2.54c-.9.6-2.05.96-3.38.96-2.61 0-4.82-1.76-5.61-4.13H3.04v2.62A10 10 0 0 0 12 22Z"
            />
            <path
                fill="#FBBC05"
                d="M6.39 13.93A6.02 6.02 0 0 1 6.07 12c0-.67.12-1.32.32-1.93V7.45H3.04A10 10 0 0 0 2 12c0 1.61.39 3.14 1.04 4.55l3.35-2.62Z"
            />
            <path
                fill="#EA4335"
                d="M12 5.94c1.47 0 2.78.5 3.82 1.49l2.87-2.87A9.61 9.61 0 0 0 12 2a10 10 0 0 0-8.96 5.45l3.35 2.62C7.18 7.7 9.39 5.94 12 5.94Z"
            />
        </svg>
    );
}
