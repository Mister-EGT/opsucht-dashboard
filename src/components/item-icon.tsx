import Image from "next/image";
import { Box } from "lucide-react";

export function ItemIcon({ src, name, size = 40 }: { src?: string | null; name: string; size?: number }) {
  if (!src) {
    return (
      <span className="item-icon item-icon-fallback" style={{ width: size, height: size }} aria-hidden="true">
        <Box size={Math.max(16, size * 0.5)} />
      </span>
    );
  }
  return (
    <span className="item-icon" style={{ width: size, height: size }}>
      <Image src={src} alt="" width={size} height={size} unoptimized />
      <span className="sr-only">Icon für {name}</span>
    </span>
  );
}
