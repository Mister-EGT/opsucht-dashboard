"use client";

import { Laptop, Moon, Sun } from "lucide-react";
import { useTheme, type ThemePreference } from "@/components/theme-provider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const themeOptions: Array<{ value: ThemePreference; label: string; icon: typeof Laptop }> = [
  { value: "system", label: "System", icon: Laptop },
  { value: "light", label: "Hell", icon: Sun },
  { value: "dark", label: "Dunkel", icon: Moon },
];

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  const activeTheme = themeOptions.find((option) => option.value === theme) ?? themeOptions[0]!;
  const Icon = activeTheme.icon;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<button type="button" className="theme-switcher" aria-label={`Farbschema: ${activeTheme.label}`} />}
      >
        <Icon aria-hidden="true" />
        <span>{activeTheme.label}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="theme-menu">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Farbschema</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={theme} onValueChange={(value) => setTheme(value as ThemePreference)}>
            {themeOptions.map((option) => {
              const OptionIcon = option.icon;
              return (
                <DropdownMenuRadioItem key={option.value} value={option.value}>
                  <OptionIcon aria-hidden="true" />
                  {option.label}
                </DropdownMenuRadioItem>
              );
            })}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
