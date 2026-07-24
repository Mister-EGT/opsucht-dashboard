import { afterEach, describe, expect, it, vi } from "vitest";
import {
  floodgateUuidToXuid,
  isFloodgateUuid,
  minecraftAvatarUrl,
  normalizeMinecraftUuid,
} from "@/lib/minecraft-player";
import { resolveMinecraftPlayer } from "@/server/minecraft-player";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Minecraft-Spielerprofile", () => {
  it("normalisiert UUIDs mit und ohne Bindestriche", () => {
    expect(normalizeMinecraftUuid("90A741DCDC584046A88A2A5568B039D2"))
      .toBe("90a741dc-dc58-4046-a88a-2a5568b039d2");
    expect(normalizeMinecraftUuid("90a741dc-dc58-4046-a88a-2a5568b039d2"))
      .toBe("90a741dc-dc58-4046-a88a-2a5568b039d2");
  });

  it("weist ungültige Spielerkennungen zurück", () => {
    expect(normalizeMinecraftUuid("kein-spieler")).toBeNull();
    expect(minecraftAvatarUrl("kein-spieler")).toBeNull();
  });

  it("erkennt Floodgate-Spieler und leitet ihre XUID ab", () => {
    const uuid = "00000000-0000-0000-0009-01f0137caa09";
    expect(isFloodgateUuid(uuid)).toBe(true);
    expect(floodgateUuidToXuid(uuid)).toBe("2535405421111817");
  });

  it("erzeugt die Crafthead-Adresse aus der normalisierten UUID", () => {
    expect(minecraftAvatarUrl("90a741dc-dc58-4046-a88a-2a5568b039d2"))
      .toBe("https://crafthead.net/avatar/90a741dcdc584046a88a2a5568b039d2/64");
  });

  it("löst den Namen eines Java-Spielers über Crafthead auf", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ name: "TestSpieler" }));
    vi.stubGlobal("fetch", fetchMock);

    const profile = await resolveMinecraftPlayer("11111111-2222-3333-4444-555555555555");

    expect(profile).toMatchObject({
      name: "TestSpieler",
      platform: "java",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("crafthead.net/profile/");
  });

  it("löst Floodgate-Spieler über ihre GeyserMC-XUID auf", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ gamertag: "BedrockSpieler" }));
    vi.stubGlobal("fetch", fetchMock);

    const profile = await resolveMinecraftPlayer("00000000-0000-0000-0009-01f0137caa09");

    expect(profile).toMatchObject({
      name: ".BedrockSpieler",
      platform: "bedrock",
    });
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/xbox/gamertag/2535405421111817");
  });
});
