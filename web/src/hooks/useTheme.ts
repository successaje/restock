import { useCallback, useEffect, useState } from "react";

export type Theme = "light" | "dark";
const KEY = "restock-theme";

function current(): Theme {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(current);

  // Follow the OS until the user picks one.
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (localStorage.getItem(KEY)) return;
      apply(mq.matches ? "dark" : "light");
      setThemeState(current());
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const setTheme = useCallback((t: Theme) => {
    localStorage.setItem(KEY, t);
    apply(t);
    setThemeState(t);
  }, []);

  return { theme, setTheme, toggle: () => setTheme(theme === "dark" ? "light" : "dark") };
}

function apply(t: Theme) {
  const root = document.documentElement;
  // Suppress transitions for the one frame the palette swaps.
  root.classList.add("theme-switching");
  root.classList.toggle("dark", t === "dark");
  requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove("theme-switching")));
}
