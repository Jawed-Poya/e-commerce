const configuredDownloadUrl = import.meta.env.VITE_MOBILE_APP_DOWNLOAD_URL?.trim();

// This public EAS project page remains a safe fallback until a release-specific
// APK URL or app-store URL is supplied at build time.
export const mobileAppDownloadUrl =
    configuredDownloadUrl ||
    "https://expo.dev/accounts/jawed-poya/projects/easycart-mobile";

export const mobileAppLinkIsExternal = /^https?:\/\//i.test(
    mobileAppDownloadUrl,
);
