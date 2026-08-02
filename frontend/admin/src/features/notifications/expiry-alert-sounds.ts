import type { ExpiryAlertSound } from "@/features/company/company-types";

export const expiryAlertSounds: ReadonlyArray<{
    value: ExpiryAlertSound;
    label: string;
    description: string;
    url: string;
}> = [
    {
        value: "critical-pulse",
        label: "Critical pulse",
        description: "Strong repeating pulse for urgent expiry risk.",
        url: `${import.meta.env.BASE_URL}sounds/expiry-critical-pulse.wav`,
    },
    {
        value: "urgent-alarm",
        label: "Urgent alarm",
        description: "Sharper alarm for high-attention work areas.",
        url: `${import.meta.env.BASE_URL}sounds/expiry-urgent-alarm.wav`,
    },
    {
        value: "warning-chime",
        label: "Warning chime",
        description: "Noticeable but less aggressive warning tone.",
        url: `${import.meta.env.BASE_URL}sounds/expiry-warning-chime.wav`,
    },
];

const audioCache = new Map<ExpiryAlertSound, HTMLAudioElement>();

export function getExpiryAlertSound(value: string | null | undefined) {
    return expiryAlertSounds.find((item) => item.value === value) ?? expiryAlertSounds[0];
}

export async function playExpiryAlertSound(
    value: string | null | undefined,
    volume = 0.9,
) {
    if (typeof window === "undefined") return;

    const sound = getExpiryAlertSound(value);
    const audio = getAudio(sound.value, sound.url);
    audio.pause();
    audio.currentTime = 0;
    audio.muted = false;
    audio.volume = Math.min(1, Math.max(0, volume));
    await audio.play();
}

export function armExpiryAlertSound(value: string | null | undefined) {
    if (typeof window === "undefined") return () => undefined;

    const sound = getExpiryAlertSound(value);
    let unlocked = false;
    const cleanup = () => {
        window.removeEventListener("pointerdown", unlock, true);
        window.removeEventListener("keydown", unlock, true);
    };
    const unlock = () => {
        if (unlocked) return;
        unlocked = true;
        cleanup();

        const audio = getAudio(sound.value, sound.url);
        const previousVolume = audio.volume;
        audio.muted = true;
        audio.volume = 0;
        void audio.play()
            .then(() => {
                audio.pause();
                audio.currentTime = 0;
                audio.muted = false;
                audio.volume = previousVolume || 0.9;
            })
            .catch(() => {
                audio.muted = false;
                audio.volume = previousVolume || 0.9;
            });
    };

    window.addEventListener("pointerdown", unlock, { capture: true });
    window.addEventListener("keydown", unlock, { capture: true });

    return cleanup;
}

function getAudio(value: ExpiryAlertSound, url: string) {
    const existing = audioCache.get(value);
    if (existing) return existing;

    const audio = new Audio(url);
    audio.preload = "auto";
    audioCache.set(value, audio);
    return audio;
}
