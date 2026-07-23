import { z } from "zod";

export const materialParameterSchema = z
  .string()
  .trim()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9_:.-]+$/);

export const categoryParameterSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[A-Za-z0-9_-]+$/);

export function validateMaterial(value: string): string | null {
  const parsed = materialParameterSchema.safeParse(value);
  return parsed.success ? parsed.data.toUpperCase() : null;
}

export function validateCategory(value: string): string | null {
  const parsed = categoryParameterSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
