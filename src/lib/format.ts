import { formatDistanceToNowStrict, isValid, parseISO } from "date-fns";
import { de } from "date-fns/locale";

const numberFormatter = new Intl.NumberFormat("de-DE", {
  maximumFractionDigits: 2,
});

const compactFormatter = new Intl.NumberFormat("de-DE", {
  notation: "compact",
  compactDisplay: "short",
  maximumFractionDigits: 1,
});

const exactPriceFormatter = new Intl.NumberFormat("de-DE", {
  maximumFractionDigits: 8,
});

const fractionalPriceFormatter = new Intl.NumberFormat("de-DE", {
  maximumFractionDigits: 4,
});

const percentFormatter = new Intl.NumberFormat("de-DE", {
  style: "percent",
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const dateTimeFormatter = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "medium",
  timeStyle: "medium",
  timeZone: "Europe/Berlin",
});

const shortDateTimeFormatter = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Berlin",
});

export function formatNumber(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "Nicht verfügbar";
  return new Intl.NumberFormat("de-DE", { maximumFractionDigits: digits }).format(value);
}

export function formatEconomyValue(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "Nicht verfügbar";
  const absolute = Math.abs(value);
  if (absolute >= 1_000_000) return compactFormatter.format(value);
  return numberFormatter.format(value);
}

export function formatPrice(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "Nicht verfügbar";
  const absolute = Math.abs(value);
  const formatted = absolute > 0 && absolute < 0.01
    ? exactPriceFormatter.format(value)
    : absolute < 1
      ? fractionalPriceFormatter.format(value)
      : formatEconomyValue(value);
  return `${formatted} $`;
}

export function formatExactPrice(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "Nicht verfügbar";
  return `${exactPriceFormatter.format(value)} $`;
}

export function formatExactValue(value: number | null | undefined): string {
  return formatNumber(value, 8);
}

export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "Nicht verfügbar";
  return percentFormatter.format(value);
}

export function formatPercentNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "Nicht verfügbar";
  return `${formatNumber(value, 1)} %`;
}

export function formatSignedPercentNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "Nicht verfügbar";
  return `${value > 0 ? "+" : ""}${formatPercentNumber(value)}`;
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "Nicht verfügbar";
  const date = typeof value === "string" ? parseOpsuchtDate(value) : value;
  if (!isValid(date)) return "Nicht verfügbar";
  return dateTimeFormatter.format(date);
}

export function formatShortDateTime(value: string | Date): string {
  const date = typeof value === "string" ? parseOpsuchtDate(value) : value;
  return isValid(date) ? shortDateTimeFormatter.format(date) : "Nicht verfügbar";
}

export function formatRelativeTime(value: string | Date | null | undefined): string {
  if (!value) return "Nicht verfügbar";
  const date = typeof value === "string" ? parseOpsuchtDate(value) : value;
  if (!isValid(date)) return "Nicht verfügbar";
  return formatDistanceToNowStrict(date, { addSuffix: true, locale: de });
}

export function parseOpsuchtDate(value: string): Date {
  if (/(?:Z|[+-]\d{2}:?\d{2})$/i.test(value)) return parseISO(value);
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?$/);
  if (!match) return new Date(Number.NaN);
  const [, year, month, day, hour, minute, second, fraction = "0"] = match;
  const naiveUtc = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
    Number(fraction.padEnd(3, "0").slice(0, 3)),
  );
  const offset = timeZoneOffsetMilliseconds(new Date(naiveUtc), "Europe/Berlin");
  const firstPass = new Date(naiveUtc - offset);
  const correctedOffset = timeZoneOffsetMilliseconds(firstPass, "Europe/Berlin");
  return new Date(naiveUtc - correctedOffset);
}

function timeZoneOffsetMilliseconds(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const representedAsUtc = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute),
    Number(values.second),
  );
  return representedAsUtc - date.getTime();
}

export function formatDuration(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || !Number.isFinite(ms)) return "Nicht verfügbar";
  if (ms < 1_000) return `${Math.max(0, Math.round(ms))} ms`;
  const seconds = Math.floor(ms / 1_000);
  if (seconds < 60) return `${seconds} s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} Min.`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours} Std. ${remainingMinutes} Min.`;
}

export function formatMaterialName(material: string): string {
  const cleaned = material
    .replace(/^minecraft:/i, "")
    .split("[")[0]
    ?.replace(/_/g, " ")
    .trim()
    .toLocaleLowerCase("de-DE");

  if (!cleaned) return material;
  return cleaned.replace(/(^|\s)\p{L}/gu, (character) => character.toLocaleUpperCase("de-DE"));
}

export function formatOrderSide(side: string): string {
  if (side.toUpperCase() === "BUY") return "Kaufauftrag";
  if (side.toUpperCase() === "SELL") return "Verkaufsauftrag";
  return side;
}
