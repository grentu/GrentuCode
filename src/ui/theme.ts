export interface Theme {
  name: string;
  primary: string;
  secondary: string;
  accent: string;
  text: string;
  muted: string;
  bg: string;
}

export const THEMES: Record<string, Theme> = {
  "neon-forest": {
    name: "Neon Forest",
    primary: "#00FF87",
    secondary: "#60EFFD",
    accent: "#FA709A",
    text: "#E0E0E0",
    muted: "#6B7280",
    bg: "#0D1117",
  },
  "sunset-terminal": {
    name: "Sunset Terminal",
    primary: "#FF8C42",
    secondary: "#FF3D7F",
    accent: "#FFD23F",
    text: "#F5F5F5",
    muted: "#8B7355",
    bg: "#1A0F0A",
  },
  "deep-space": {
    name: "Deep Space",
    primary: "#7C3AED",
    secondary: "#3B82F6",
    accent: "#22D3EE",
    text: "#E2E8F0",
    muted: "#475569",
    bg: "#0F0F1E",
  },
  "hacker-green": {
    name: "Hacker Green",
    primary: "#39FF14",
    secondary: "#00D9FF",
    accent: "#FF6B6B",
    text: "#C8FFC8",
    muted: "#4A7C4A",
    bg: "#0A0A0A",
  },
};

export const THEME_LIST = Object.keys(THEMES);

export const DEFAULT_THEME = "neon-forest";

export function getTheme(name: string): Theme {
  return THEMES[name] ?? THEMES[DEFAULT_THEME];
}
