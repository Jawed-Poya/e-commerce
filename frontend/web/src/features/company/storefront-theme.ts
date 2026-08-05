type Rgb = { r: number; g: number; b: number };
type Hsl = { h: number; s: number; l: number };

const FALLBACK_PRIMARY = "#0B1F3A";
const FALLBACK_SECONDARY = "#F97316";

function clamp(value: number, minimum = 0, maximum = 1) {
    return Math.min(maximum, Math.max(minimum, value));
}

function normalizeHex(value: string | null | undefined, fallback: string) {
    const input = value?.trim();
    if (!input) return fallback;

    const compact = input.startsWith("#") ? input.slice(1) : input;
    if (/^[0-9a-f]{3}$/i.test(compact)) {
        return `#${compact
            .split("")
            .map((character) => `${character}${character}`)
            .join("")}`.toLowerCase();
    }

    return /^[0-9a-f]{6}$/i.test(compact)
        ? `#${compact.toLowerCase()}`
        : fallback;
}

function hexToRgb(hex: string): Rgb {
    const value = normalizeHex(hex, FALLBACK_PRIMARY).slice(1);
    return {
        r: Number.parseInt(value.slice(0, 2), 16),
        g: Number.parseInt(value.slice(2, 4), 16),
        b: Number.parseInt(value.slice(4, 6), 16),
    };
}

function componentToHex(value: number) {
    return Math.round(clamp(value, 0, 255)).toString(16).padStart(2, "0");
}

function rgbToHex({ r, g, b }: Rgb) {
    return `#${componentToHex(r)}${componentToHex(g)}${componentToHex(b)}`;
}

function mix(first: string, second: string, firstWeight: number) {
    const a = hexToRgb(first);
    const b = hexToRgb(second);
    const weight = clamp(firstWeight);
    return rgbToHex({
        r: a.r * weight + b.r * (1 - weight),
        g: a.g * weight + b.g * (1 - weight),
        b: a.b * weight + b.b * (1 - weight),
    });
}

function rgbToHsl({ r, g, b }: Rgb): Hsl {
    const red = r / 255;
    const green = g / 255;
    const blue = b / 255;
    const maximum = Math.max(red, green, blue);
    const minimum = Math.min(red, green, blue);
    const lightness = (maximum + minimum) / 2;

    if (maximum === minimum) return { h: 0, s: 0, l: lightness };

    const difference = maximum - minimum;
    const saturation = lightness > 0.5
        ? difference / (2 - maximum - minimum)
        : difference / (maximum + minimum);
    let hue: number;

    if (maximum === red) hue = (green - blue) / difference + (green < blue ? 6 : 0);
    else if (maximum === green) hue = (blue - red) / difference + 2;
    else hue = (red - green) / difference + 4;

    return { h: hue / 6, s: saturation, l: lightness };
}

function hueToRgb(p: number, q: number, input: number) {
    let value = input;
    if (value < 0) value += 1;
    if (value > 1) value -= 1;
    if (value < 1 / 6) return p + (q - p) * 6 * value;
    if (value < 1 / 2) return q;
    if (value < 2 / 3) return p + (q - p) * (2 / 3 - value) * 6;
    return p;
}

function hslToRgb({ h, s, l }: Hsl): Rgb {
    if (s === 0) {
        const value = l * 255;
        return { r: value, g: value, b: value };
    }

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    return {
        r: hueToRgb(p, q, h + 1 / 3) * 255,
        g: hueToRgb(p, q, h) * 255,
        b: hueToRgb(p, q, h - 1 / 3) * 255,
    };
}

function withLightness(hex: string, minimum: number, maximum: number) {
    const hsl = rgbToHsl(hexToRgb(hex));
    return rgbToHex(hslToRgb({
        h: hsl.h,
        s: hsl.s < 0.08 ? hsl.s : clamp(hsl.s, 0.28, 0.9),
        l: clamp(hsl.l, minimum, maximum),
    }));
}

function relativeLuminance(hex: string) {
    const channels = Object.values(hexToRgb(hex)).map((value) => {
        const channel = value / 255;
        return channel <= 0.03928
            ? channel / 12.92
            : ((channel + 0.055) / 1.055) ** 2.4;
    });
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function readableText(background: string) {
    const backgroundLuminance = relativeLuminance(background);
    const lightContrast = 1.05 / (backgroundLuminance + 0.05);
    const dark = "#111827";
    const darkContrast =
        (backgroundLuminance + 0.05) / (relativeLuminance(dark) + 0.05);
    return lightContrast >= darkContrast ? "#ffffff" : dark;
}

function rgba(hex: string, alpha: number) {
    const { r, g, b } = hexToRgb(hex);
    return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${clamp(alpha)})`;
}

export function createStorefrontTheme(
    primaryValue: string | null | undefined,
    secondaryValue: string | null | undefined,
) {
    const primary = normalizeHex(primaryValue, FALLBACK_PRIMARY);
    const secondary = normalizeHex(secondaryValue, FALLBACK_SECONDARY);
    const darkPrimary = withLightness(primary, 0.56, 0.7);
    const darkSecondary = withLightness(secondary, 0.55, 0.72);

    return {
        "--theme-primary-light": primary,
        "--theme-primary-foreground-light": readableText(primary),
        "--theme-secondary-light": mix(primary, "#ffffff", 0.1),
        "--theme-secondary-foreground-light": mix(primary, "#111827", 0.62),
        "--theme-background-light": mix(primary, "#ffffff", 0.035),
        "--theme-foreground-light": mix(primary, "#0f172a", 0.12),
        "--theme-card-light": mix(primary, "#ffffff", 0.012),
        "--theme-muted-light": mix(primary, "#f2f5f4", 0.065),
        "--theme-muted-foreground-light": mix(primary, "#64706d", 0.16),
        "--theme-accent-light": mix(secondary, "#ffffff", 0.12),
        "--theme-accent-foreground-light": mix(secondary, "#3a2a0a", 0.56),
        "--theme-border-light": mix(primary, "#dce3e1", 0.12),
        "--theme-input-light": mix(primary, "#d2dbd8", 0.13),
        "--theme-ring-light": withLightness(primary, 0.38, 0.58),
        "--theme-brand-secondary-light": secondary,
        "--theme-brand-surface-light": mix(primary, "#07110f", 0.35),
        "--theme-brand-surface-strong-light": mix(primary, "#020706", 0.22),
        "--theme-brand-highlight-light": withLightness(primary, 0.7, 0.82),
        "--theme-page-glow-light": rgba(primary, 0.075),

        "--theme-primary-dark": darkPrimary,
        "--theme-primary-foreground-dark": readableText(darkPrimary),
        "--theme-secondary-dark": mix(primary, "#101a17", 0.25),
        "--theme-secondary-foreground-dark": mix(primary, "#edf7f4", 0.08),
        "--theme-background-dark": mix(primary, "#030806", 0.085),
        "--theme-foreground-dark": mix(primary, "#f2f8f6", 0.055),
        "--theme-card-dark": mix(primary, "#09110f", 0.135),
        "--theme-muted-dark": mix(primary, "#0c1513", 0.18),
        "--theme-muted-foreground-dark": mix(primary, "#a4b1ad", 0.12),
        "--theme-accent-dark": mix(secondary, "#17140d", 0.22),
        "--theme-accent-foreground-dark": mix(darkSecondary, "#fff8e8", 0.14),
        "--theme-border-dark": mix(primary, "#293330", 0.13),
        "--theme-input-dark": mix(primary, "#38423f", 0.15),
        "--theme-ring-dark": darkPrimary,
        "--theme-brand-secondary-dark": darkSecondary,
        "--theme-brand-surface-dark": mix(primary, "#07100e", 0.31),
        "--theme-brand-surface-strong-dark": mix(primary, "#020605", 0.2),
        "--theme-brand-highlight-dark": withLightness(primary, 0.72, 0.84),
        "--theme-page-glow-dark": rgba(darkPrimary, 0.11),
    } as const;
}

export function applyStorefrontTheme(
    root: HTMLElement,
    primary: string | null | undefined,
    secondary: string | null | undefined,
) {
    const theme = createStorefrontTheme(primary, secondary);
    Object.entries(theme).forEach(([property, value]) => {
        root.style.setProperty(property, value);
    });

    const themeColor = document.querySelector<HTMLMetaElement>(
        'meta[name="theme-color"]',
    );
    themeColor?.setAttribute(
        "content",
        theme["--theme-brand-surface-strong-light"],
    );
}
