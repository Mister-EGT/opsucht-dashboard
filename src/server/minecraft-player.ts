import {
  floodgateUuidToXuid,
  isFloodgateUuid,
  minecraftAvatarUrl,
  normalizeMinecraftUuid,
  type MinecraftPlayerProfile,
} from "@/lib/minecraft-player";

const requestTimeoutMs = 5_000;
const resolvedCacheTtlMs = 12 * 60 * 60_000;
const unresolvedCacheTtlMs = 10 * 60_000;
const maxCacheEntries = 512;

interface PlayerCacheEntry {
  profile: MinecraftPlayerProfile;
  expiresAt: number;
}

type GlobalPlayerState = typeof globalThis & {
  __minecraftPlayerCache?: Map<string, PlayerCacheEntry>;
  __minecraftPlayerInflight?: Map<string, Promise<MinecraftPlayerProfile>>;
};

const globalState = globalThis as GlobalPlayerState;
const playerCache = (globalState.__minecraftPlayerCache ??= new Map());
const playerInflight = (globalState.__minecraftPlayerInflight ??= new Map());

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function nestedString(value: unknown, path: string[]): string | null {
  let current: unknown = value;
  for (const key of path) {
    if (!isRecord(current)) return null;
    current = current[key];
  }
  return typeof current === "string" && current.trim() ? current.trim() : null;
}

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "OPSUCHT-Economy-Dashboard/1.0 (+community-dashboard)",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(requestTimeoutMs),
  });
  if (!response.ok) throw new Error(`Spielerprofil nicht verfügbar: HTTP ${response.status}`);
  return response.json();
}

async function tryProvider(url: string, readName: (payload: unknown) => string | null): Promise<string | null> {
  try {
    return readName(await fetchJson(url));
  } catch {
    return null;
  }
}

async function resolveJavaName(uuid: string): Promise<string | null> {
  const compact = uuid.replaceAll("-", "");
  return (
    await tryProvider(`https://crafthead.net/profile/${compact}`, (payload) => nestedString(payload, ["name"]))
    ?? await tryProvider(`https://playerdb.co/api/player/minecraft/${uuid}`, (payload) => nestedString(payload, ["data", "player", "username"]))
    ?? await tryProvider(`https://api.ashcon.app/mojang/v2/user/${uuid}`, (payload) => nestedString(payload, ["username"]))
    ?? await tryProvider(`https://api.minetools.eu/uuid/${compact}`, (payload) => {
      if (nestedString(payload, ["status"]) === "ERR") return null;
      return nestedString(payload, ["name"]);
    })
  );
}

async function resolveBedrockName(uuid: string): Promise<string | null> {
  const xuid = floodgateUuidToXuid(uuid);
  if (!xuid) return null;
  const gamertag = await tryProvider(
    `https://api.geysermc.org/v2/xbox/gamertag/${xuid}`,
    (payload) => nestedString(payload, ["gamertag"]),
  );
  return gamertag ? `.${gamertag}` : null;
}

function writeCache(uuid: string, profile: MinecraftPlayerProfile): void {
  playerCache.delete(uuid);
  playerCache.set(uuid, {
    profile,
    expiresAt: Date.now() + (profile.name ? resolvedCacheTtlMs : unresolvedCacheTtlMs),
  });
  while (playerCache.size > maxCacheEntries) {
    const oldest = playerCache.keys().next().value;
    if (oldest === undefined) break;
    playerCache.delete(oldest);
  }
}

export async function resolveMinecraftPlayer(value: string): Promise<MinecraftPlayerProfile> {
  const uuid = normalizeMinecraftUuid(value);
  if (!uuid) throw new TypeError("Ungültige Minecraft-UUID");

  const cached = playerCache.get(uuid);
  if (cached && cached.expiresAt > Date.now()) return cached.profile;
  if (cached) playerCache.delete(uuid);

  const pending = playerInflight.get(uuid);
  if (pending) return pending;

  const request = (async () => {
    const platform = isFloodgateUuid(uuid) ? "bedrock" : "java";
    const name = platform === "bedrock"
      ? await resolveBedrockName(uuid)
      : await resolveJavaName(uuid);
    const profile: MinecraftPlayerProfile = {
      uuid,
      name,
      platform,
      avatarUrl: minecraftAvatarUrl(uuid)!,
    };
    writeCache(uuid, profile);
    return profile;
  })().finally(() => {
    playerInflight.delete(uuid);
  });

  playerInflight.set(uuid, request);
  return request;
}
