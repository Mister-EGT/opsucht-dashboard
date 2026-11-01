/**
 * Liest eine Preiseingabe in deutscher oder englischer Schreibweise.
 * Gibt null zurück, wenn die Eingabe leer, negativ oder keine gültige Zahl ist.
 *
 * Regeln:
 * - Leerzeichen werden ignoriert.
 * - Stehen Komma und Punkt in der Eingabe, ist das zuletzt stehende Zeichen das Dezimalzeichen.
 * - Nur ein Komma gilt als Dezimalkomma.
 * - Nur Punkte in Dreiergruppen („1.000“, „1.000.000“) gelten als Tausendertrennzeichen.
 * - Jeder andere einzelne Punkt gilt als Dezimalpunkt („0.25“).
 */
export function parsePriceInput(value: string): number | null {
  const compact = value.replace(/[\s\u00a0]/g, "");
  if (compact === "") return null;

  const lastComma = compact.lastIndexOf(",");
  const lastDot = compact.lastIndexOf(".");
  let normalized: string;

  if (lastComma >= 0 && lastDot >= 0) {
    normalized = lastComma > lastDot
      ? compact.replaceAll(".", "").replace(",", ".")
      : compact.replaceAll(",", "");
  } else if (lastComma >= 0) {
    normalized = compact.replace(",", ".");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(compact)) {
    normalized = compact.replaceAll(".", "");
  } else {
    normalized = compact;
  }

  if (!/^\d+(\.\d+)?$/.test(normalized)) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}
