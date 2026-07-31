import { useEffect } from "react";
import { useLocation } from "react-router-dom";

import { apiPost } from "../../shared/api/api-client";

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

    useEffect(() => {
        const timer = window.setTimeout(() => {
            void apiPost("/storefront/visits", {
                sessionId: sessionId(),
                path: `${location.pathname}${location.search}`,
                referrer: document.referrer || null,
                language: document.documentElement.lang || navigator.language,
                screenWidth: window.screen.width,
                screenHeight: window.screen.height,
            }).catch(() => {
                // Analytics must never interrupt shopping or navigation.
            });
        }, 800);
        return () => window.clearTimeout(timer);
    }, [location.pathname, location.search]);

    return null;
}
