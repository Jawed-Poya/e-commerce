import { Platform } from 'react-native';

type Rgb = { r: number; g: number; b: number };
type Hsl = { h: number; s: number; l: number };

export type AppPalette = {
  primary: string;
  primaryForeground: string;
  primaryDark: string;
  primarySoft: string;
  amber: string;
  amberForeground: string;
  amberSoft: string;
  background: string;
  card: string;
  text: string;
  muted: string;
  border: string;
  input: string;
  success: string;
  successSoft: string;
  danger: string;
  dangerSoft: string;
  darkSurface: string;
  brandHighlight: string;
  white: string;
  black: string;
};

export const fallbackStorefrontPrimary = '#0B1F3A';
export const fallbackStorefrontSecondary = '#F97316';

/** Matches the primary/secondary color derivation used by the web storefront. */
export function createStorefrontPalette(
  primaryValue: string | null | undefined,
  secondaryValue: string | null | undefined,
  dark: boolean,
): AppPalette {
  const primary = normalizeHex(primaryValue, fallbackStorefrontPrimary);
  const secondary = normalizeHex(secondaryValue, fallbackStorefrontSecondary);
  const darkPrimary = withLightness(primary, 0.56, 0.7);
  const darkSecondary = withLightness(secondary, 0.55, 0.72);

  if (dark) {
    return {
      primary: darkPrimary,
      primaryForeground: readableText(darkPrimary),
      primaryDark: mix(primary, '#07100e', 0.31),
      primarySoft: mix(primary, '#101a17', 0.25),
      amber: darkSecondary,
      amberForeground: readableText(darkSecondary),
      amberSoft: mix(secondary, '#17140d', 0.22),
      background: mix(primary, '#030806', 0.085),
      text: mix(primary, '#f2f8f6', 0.055),
      card: mix(primary, '#09110f', 0.135),
      muted: mix(primary, '#a4b1ad', 0.12),
      border: mix(primary, '#293330', 0.13),
      input: mix(primary, '#38423f', 0.15),
      success: '#4FD1A1',
      successSoft: mix('#16815D', '#07110f', 0.28),
      danger: '#FF7468',
      dangerSoft: mix('#D92D20', '#120908', 0.24),
      darkSurface: mix(primary, '#020605', 0.2),
      brandHighlight: withLightness(primary, 0.72, 0.84),
      white: '#FFFFFF',
      black: '#030A08',
    };
  }

  return {
    primary,
    primaryForeground: readableText(primary),
    primaryDark: mix(primary, '#07110f', 0.35),
    primarySoft: mix(primary, '#ffffff', 0.1),
    amber: secondary,
    amberForeground: readableText(secondary),
    amberSoft: mix(secondary, '#ffffff', 0.12),
    background: mix(primary, '#ffffff', 0.035),
    text: mix(primary, '#0f172a', 0.12),
    card: mix(primary, '#ffffff', 0.012),
    muted: mix(primary, '#64706d', 0.16),
    border: mix(primary, '#dce3e1', 0.12),
    input: mix(primary, '#f2f5f4', 0.065),
    success: '#16815D',
    successSoft: '#E9F8F1',
    danger: '#D92D20',
    dangerSoft: '#FEF0EE',
    darkSurface: mix(primary, '#020706', 0.22),
    brandHighlight: withLightness(primary, 0.7, 0.82),
    white: '#FFFFFF',
    black: '#071713',
  };
}

export const lightPalette = createStorefrontPalette(
  fallbackStorefrontPrimary,
  fallbackStorefrontSecondary,
  false,
);
export const darkPalette = createStorefrontPalette(
  fallbackStorefrontPrimary,
  fallbackStorefrontSecondary,
  true,
);

function clamp(value: number, minimum = 0, maximum = 1) {
  return Math.min(maximum, Math.max(minimum, value));
}

function normalizeHex(value: string | null | undefined, fallback: string) {
  const input = value?.trim();
  if (!input) return fallback;
  const compact = input.startsWith('#') ? input.slice(1) : input;
  if (/^[0-9a-f]{3}$/i.test(compact)) {
    return `#${compact.split('').map((character) => `${character}${character}`).join('')}`.toLowerCase();
  }
  return /^[0-9a-f]{6}$/i.test(compact) ? `#${compact.toLowerCase()}` : fallback;
}

function hexToRgb(hex: string): Rgb {
  const value = normalizeHex(hex, fallbackStorefrontPrimary).slice(1);
  return {
    r: Number.parseInt(value.slice(0, 2), 16),
    g: Number.parseInt(value.slice(2, 4), 16),
    b: Number.parseInt(value.slice(4, 6), 16),
  };
}

function componentToHex(value: number) {
  return Math.round(clamp(value, 0, 255)).toString(16).padStart(2, '0');
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
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function readableText(background: string) {
  const backgroundLuminance = relativeLuminance(background);
  const lightContrast = 1.05 / (backgroundLuminance + 0.05);
  const dark = '#111827';
  const darkContrast = (backgroundLuminance + 0.05) / (relativeLuminance(dark) + 0.05);
  return lightContrast >= darkContrast ? '#ffffff' : dark;
}

// Shared shape language: compact controls, 14px form fields, and the same
// 18px bordered surface used by product cards throughout the application.
export const radii = { sm: 10, md: 14, lg: 18, xl: 24, pill: 999 } as const;
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, section: 32 } as const;

// Core surfaces are defined by color and a precise border, not elevation.
// True overlays (dialogs, badges and floating controls) can opt into their
// own restrained elevation where hierarchy requires it.
export const shadow = {} as const;
export const compactShadow = {} as const;

export const tabBarHeight = Platform.OS === 'ios' ? 82 : 70;

let formattingLocale = 'en-US';

export function setFormattingLocale(locale: string) {
  formattingLocale = locale;
}

export function formatMoney(value: number, currency = 'AFN') {
  try {
    return new Intl.NumberFormat(formattingLocale, { style: 'currency', currency, maximumFractionDigits: 2 }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency}`;
  }
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat(formattingLocale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}
