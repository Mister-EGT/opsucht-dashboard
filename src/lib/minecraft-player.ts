export type MinecraftPlatform = "java" | "bedrock";

export interface MinecraftPlayerProfile {
  uuid: string;
  name: string | null;
  avatarUrl: string;
  platform: MinecraftPlatform;
}

const compactUuidPattern = /^[0-9a-f]{32}$/i;
const floodgatePrefix = "00000000-0000-0000-";

export function normalizeMinecraftUuid(value: string): string | null {
  const compact = value.trim().replaceAll("-", "").toLowerCase();
  if (!compactUuidPattern.test(compact)) return null;
  return [
    compact.slice(0, 8),
    compact.slice(8, 12),
    compact.slice(12, 16),
    compact.slice(16, 20),
    compact.slice(20),
  ].join("-");
}

export function isFloodgateUuid(uuid: string): boolean {
  return uuid.startsWith(floodgatePrefix);
}

export function floodgateUuidToXuid(uuid: string): string | null {
  const normalized = normalizeMinecraftUuid(uuid);
  if (!normalized || !isFloodgateUuid(normalized)) return null;
  try {
    const xuidHex = normalized.slice(19).replaceAll("-", "");
    return BigInt(`0x${xuidHex}`).toString();
  } catch {
    return null;
  }
}

export function minecraftAvatarUrl(uuid: string): string | null {
  const normalized = normalizeMinecraftUuid(uuid);
  if (!normalized) return null;
  return `https://crafthead.net/avatar/${normalized.replaceAll("-", "")}/64`;
}
