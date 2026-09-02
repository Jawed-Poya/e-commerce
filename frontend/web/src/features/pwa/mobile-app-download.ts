const configuredDownloadUrl = import.meta.env.VITE_MOBILE_APP_DOWNLOAD_URL?.trim();

// Keep a bundled, installable APK as the default. Deployments can still override
// this with an app-store URL or another direct release URL at build time.
export const mobileAppDownloadUrl =
    configuredDownloadUrl || "/downloads/easycart-mobile.apk";

export const mobileAppLinkIsExternal = /^https?:\/\//i.test(
    mobileAppDownloadUrl,
);
