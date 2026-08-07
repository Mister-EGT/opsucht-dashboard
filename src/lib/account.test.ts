import { describe, expect, it } from "vitest";
import { authErrorMessage, displayNameSchema, passwordSchema, safeAccountRedirectPath } from "@/lib/account";

describe("Kontovalidierung", () => {
  it("normalisiert gültige Anzeigenamen", () => {
    expect(displayNameSchema.parse("  Morell  ")).toBe("Morell");
  });

  it("lehnt zu kurze Anzeigenamen ab", () => {
    expect(displayNameSchema.safeParse("M").success).toBe(false);
  });

  it("verlangt bei Passwörtern Buchstaben und Zahlen", () => {
    expect(passwordSchema.safeParse("nur-buchstaben").success).toBe(false);
    expect(passwordSchema.safeParse("sicheres-passwort-2026").success).toBe(true);
  });

  it("übersetzt bekannte Auth-Fehler ohne interne Details", () => {
    expect(authErrorMessage("Invalid login credentials")).toContain("nicht korrekt");
    expect(authErrorMessage("unexpected internal provider state")).not.toContain("provider");
  });

  it("erlaubt beim Auth-Callback ausschließlich lokale Redirects", () => {
    expect(safeAccountRedirectPath("/favorites?cloud=1")).toBe("/favorites?cloud=1");
    expect(safeAccountRedirectPath("https://example.com")).toBe("/account");
    expect(safeAccountRedirectPath("//example.com")).toBe("/account");
    expect(safeAccountRedirectPath("/\\example.com")).toBe("/account");
  });
});
