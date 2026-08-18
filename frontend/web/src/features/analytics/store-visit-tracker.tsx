import { useEffect } from "react";
import { useLocation } from "react-router-dom";

import { apiPost } from "../../shared/api/api-client";
import { useAuth } from "../auth/auth-context";

const SessionKey = "pharmacy-store-visit-session";

function sessionId() {
    const existing = sessionStorage.getItem(SessionKey);
    if (existing) return existing;
    const created = crypto.randomUUID();
    sessionStorage.setItem(SessionKey, created);
    return created;
}

export function StoreVisitTracker() {
    const location = useLocation();
    const auth = useAuth();

    useEffect(() => {
        const payload = (activity: "pageview" | "heartbeat" | "leave") => ({
            sessionId: sessionId(),
            path: `${location.pathname}${location.search}`,
            activity,
            pageTitle: document.querySelector("main h1")?.textContent?.trim() || document.title || null,
            referrer: document.referrer || null,
            language: document.documentElement.lang || navigator.language,
            screenWidth: window.screen.width,
            screenHeight: window.screen.height,
        });
        const recordVisit = (activity: "pageview" | "heartbeat" = "heartbeat") => {
            if (document.visibilityState === "hidden" && activity === "heartbeat") return;
            void apiPost("/storefront/visits", {
                ...payload(activity),
            }).catch(() => {
                // Analytics must never interrupt shopping or navigation.
            });
        };
        const onResume = () => {
            if (document.visibilityState === "visible") recordVisit("heartbeat");
        };
        const onLeave = () => {
            void apiPost("/storefront/visits", payload("leave"), { keepalive: true }).catch(() => undefined);
        };
        const onVisibilityChange = () => {
            if (document.visibilityState === "hidden") onLeave();
            else onResume();
        };

        const timer = window.setTimeout(() => recordVisit("pageview"), 250);
        const heartbeat = window.setInterval(() => recordVisit("heartbeat"), 20_000);
        window.addEventListener("focus", onResume);
        window.addEventListener("online", onResume);
        document.addEventListener("visibilitychange", onVisibilityChange);
        window.addEventListener("pagehide", onLeave);
        return () => {
            window.clearTimeout(timer);
            window.clearInterval(heartbeat);
            window.removeEventListener("focus", onResume);
            window.removeEventListener("online", onResume);
            document.removeEventListener("visibilitychange", onVisibilityChange);
            window.removeEventListener("pagehide", onLeave);
        };
    }, [auth.user?.userId, location.pathname, location.search]);

    return null;
}
