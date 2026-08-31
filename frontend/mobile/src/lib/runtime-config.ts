import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

const manualConfigKey = "easycart-mobile-runtime-config-v1";
const remoteConfigCacheKey = "easycart-mobile-remote-config-cache-v1";
const remoteConfigUrl =
    process.env.EXPO_PUBLIC_RUNTIME_CONFIG_URL?.trim() ?? "";
const productionDefault = "https://ecommerce.awsaan.com/api";
const developmentDefault = Platform.select({
    android: "http://10.0.2.2:5188/api",
    default: "http://localhost:5188/api",
})!;
const bundledDefault = __DEV__ ? developmentDefault : productionDefault;

export type RuntimeConfigSource = "bundled" | "remote" | "manual";
export type RuntimeConfig = {
    apiUrl: string;
    assetUrl: string;
    source: RuntimeConfigSource;
};

type StoredRuntimeConfig = {
    apiUrl: string;
    assetUrl?: string;
};

const bundledConfig = createConfig(
    process.env.EXPO_PUBLIC_API_URL?.trim() || bundledDefault,
    process.env.EXPO_PUBLIC_ASSET_URL?.trim(),
    "bundled",
);

let currentConfig = bundledConfig;
let initializePromise: Promise<RuntimeConfig> | null = null;

export function getRuntimeConfig() {
    return currentConfig;
}

export function getApiBaseUrl() {
    return currentConfig.apiUrl;
}

export function getAssetBaseUrl() {
    return currentConfig.assetUrl;
}

export function getApiOrigin() {
    return currentConfig.apiUrl.replace(/\/api$/i, "");
}

export function initializeRuntimeConfig() {
    if (!initializePromise) initializePromise = loadRuntimeConfig();
    return initializePromise;
}

export async function saveManualRuntimeConfig(
    apiUrl: string,
    assetUrl?: string,
) {
    const config = createConfig(apiUrl, assetUrl, "manual");
    await AsyncStorage.setItem(
        manualConfigKey,
        JSON.stringify({
            apiUrl: config.apiUrl,
            assetUrl: config.assetUrl,
        } satisfies StoredRuntimeConfig),
    );
    currentConfig = config;
    return config;
}

export async function resetRuntimeConfig() {
    await AsyncStorage.removeItem(manualConfigKey);
    initializePromise = null;
    currentConfig = bundledConfig;
    return initializeRuntimeConfig();
}

export async function testRuntimeApi(apiUrl: string) {
    const normalized = normalizeApiUrl(apiUrl);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8_000);
    try {
        const response = await fetch(`${normalized}/company/public-profile`, {
            headers: { Accept: "application/json" },
            signal: controller.signal,
        });
        if (!response.ok)
            throw new Error(`The server returned HTTP ${response.status}.`);
        const payload = (await response.json()) as unknown;
        if (!payload || typeof payload !== "object")
            throw new Error("The server response is not valid EasyCart data.");
        return normalized;
    } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
            throw new Error("The server did not respond within 8 seconds.");
        }
        throw error instanceof Error
            ? error
            : new Error("The server could not be reached.");
    } finally {
        clearTimeout(timer);
    }
}

export function normalizeApiUrl(value: string) {
    const trimmed = value.trim().replace(/\/+$/, "");
    if (!trimmed) throw new Error("Enter the EasyCart server address.");

    let url: URL;
    try {
        url = new URL(trimmed);
    } catch {
        throw new Error(
            "Enter a complete address such as https://shop.example.com/api.",
        );
    }

    if (url.protocol !== "https:" && url.protocol !== "http:") {
        throw new Error("The server address must use HTTPS or HTTP.");
    }
    if (url.username || url.password || url.search || url.hash) {
        throw new Error(
            "The server address cannot contain credentials, a query, or a fragment.",
        );
    }

    const path = url.pathname.replace(/\/+$/, "");
    url.pathname = /\/api$/i.test(path)
        ? path
        : `${path}/api`.replace(/\/+/g, "/");
    return url.toString().replace(/\/+$/, "");
}

function createConfig(
    apiUrl: string,
    assetUrl: string | undefined,
    source: RuntimeConfigSource,
): RuntimeConfig {
    const normalizedApi = normalizeApiUrl(apiUrl);
    const normalizedAsset = assetUrl?.trim()
        ? normalizeOrigin(assetUrl)
        : normalizedApi.replace(/\/api$/i, "");
    return { apiUrl: normalizedApi, assetUrl: normalizedAsset, source };
}

function normalizeOrigin(value: string) {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" && url.protocol !== "http:") {
        throw new Error("The asset address must use HTTPS or HTTP.");
    }
    url.search = "";
    url.hash = "";
    return url.toString().replace(/\/+$/, "");
}

async function loadRuntimeConfig() {
    const manual = await readStoredConfig(manualConfigKey);
    if (manual) {
        currentConfig = createConfig(manual.apiUrl, manual.assetUrl, "manual");
        return currentConfig;
    }

    if (remoteConfigUrl) {
        const remote =
            (await fetchRemoteConfig().catch(() => null)) ??
            (await readStoredConfig(remoteConfigCacheKey));
        if (remote) {
            currentConfig = createConfig(
                remote.apiUrl,
                remote.assetUrl,
                "remote",
            );
            return currentConfig;
        }
    }

    currentConfig = bundledConfig;
    return currentConfig;
}

async function fetchRemoteConfig() {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5_000);
    try {
        const response = await fetch(remoteConfigUrl, {
            headers: {
                Accept: "application/json",
                "Cache-Control": "no-cache",
            },
            signal: controller.signal,
        });
        if (!response.ok)
            throw new Error(
                `Runtime configuration returned HTTP ${response.status}.`,
            );
        const payload = (await response.json()) as Partial<StoredRuntimeConfig>;
        if (typeof payload.apiUrl !== "string")
            throw new Error("Runtime configuration is missing apiUrl.");
        const validated = createConfig(
            payload.apiUrl,
            payload.assetUrl,
            "remote",
        );
        const stored = {
            apiUrl: validated.apiUrl,
            assetUrl: validated.assetUrl,
        } satisfies StoredRuntimeConfig;
        await AsyncStorage.setItem(
            remoteConfigCacheKey,
            JSON.stringify(stored),
        );
        return stored;
    } finally {
        clearTimeout(timer);
    }
}

async function readStoredConfig(key: string) {
    try {
        const value = await AsyncStorage.getItem(key);
        if (!value) return null;
        const parsed = JSON.parse(value) as Partial<StoredRuntimeConfig>;
        if (typeof parsed.apiUrl !== "string") return null;
        createConfig(parsed.apiUrl, parsed.assetUrl, "manual");
        return parsed as StoredRuntimeConfig;
    } catch {
        return null;
    }
}
