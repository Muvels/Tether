import { create } from "zustand";

export type AppView = "workspace" | "settings";
export type ThemePreference = "system" | "light" | "dark";

const THEME_STORAGE_KEY = "pdf-canvas-linker:theme";

function readStoredTheme(): ThemePreference {
  if (typeof window === "undefined") return "system";
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === "light" || stored === "dark" || stored === "system") {
    return stored;
  }
  return "system";
}

function applyTheme(theme: ThemePreference) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const isDark =
    theme === "dark" ||
    (theme === "system" &&
      window.matchMedia?.("(prefers-color-scheme: dark)").matches);
  root.classList.toggle("dark", isDark);
}

interface UiState {
  view: AppView;
  theme: ThemePreference;

  openSettings: () => void;
  closeSettings: () => void;
  setTheme: (theme: ThemePreference) => void;
}

export const useUiStore = create<UiState>((set) => {
  const initialTheme = readStoredTheme();
  applyTheme(initialTheme);

  if (typeof window !== "undefined" && window.matchMedia) {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", () => {
      const current = useUiStore.getState().theme;
      if (current === "system") applyTheme("system");
    });
  }

  return {
    view: "workspace",
    theme: initialTheme,

    openSettings: () => set({ view: "settings" }),
    closeSettings: () => set({ view: "workspace" }),
    setTheme: (theme) => {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(THEME_STORAGE_KEY, theme);
      }
      applyTheme(theme);
      set({ theme });
    },
  };
});
