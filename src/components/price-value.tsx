import { formatExactPrice, formatPrice } from "@/lib/format";

export function PriceValue({ value }: { value: number | null | undefined }) {
  const formatted = formatPrice(value);
  const exact = formatExactPrice(value);

  return <span title={formatted === exact ? undefined : `Exakter Preis: ${exact}`}>{formatted}</span>;
}
