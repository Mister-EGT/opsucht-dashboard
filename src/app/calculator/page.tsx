import type { Metadata } from "next";
import { ComparisonCalculator } from "@/features/calculator/comparison-calculator";

export const metadata: Metadata = {
  title: "Vergleichsrechner",
  description: "Mehrere OPSUCHT-Items mit echten Markt- und Händlerkursen vergleichen und als JSON oder CSV exportieren.",
};

export default function CalculatorPage() {
  return <ComparisonCalculator />;
}
