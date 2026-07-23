"use client";

import { Laptop, Moon, Sun } from "lucide-react";
import { useTheme, type ThemePreference } from "@/components/theme-provider";

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  const Icon = theme === "dark" ? Moon : theme === "light" ? Sun : Laptop;
  return (
    <label className="theme-switcher" title="Farbschema auswählen">
      <Icon size={16} aria-hidden="true" />
      <span className="sr-only">Farbschema</span>
      <select value={theme} onChange={(event) => setTheme(event.target.value as ThemePreference)} aria-label="Farbschema">
        <option value="system">System</option>
        <option value="light">Hell</option>
        <option value="dark">Dunkel</option>
      </select>
    </label>
  );
}
