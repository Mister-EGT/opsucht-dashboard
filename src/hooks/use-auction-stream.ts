"use client";

import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useEffect, useSyncExternalStore } from "react";
import { applyAuctionStreamChange, parseAuctionStreamChange } from "@/lib/auction-stream";
import { fetchApi } from "@/lib/api-client";
import type { Auction } from "@/lib/schemas";
import type { ApiEnvelope } from "@/lib/types";

const EVENTS = [
  "auction.created", "auction.bid_placed", "auction.instant_bought",
  "auction.sold", "auction.expired", "auction.cancelled", "auction.updated",
  "auction.removed", "stream.reset",
];

let source: EventSource | null = null;
let subscribers = 0;
let connected = false;
const statusListeners = new Set<() => void>();

function setConnected(value: boolean) {
  if (connected === value) return;
  connected = value;
  statusListeners.forEach((listener) => listener());
}

function subscribeStatus(listener: () => void) {
  statusListeners.add(listener);
  return () => { statusListeners.delete(listener); };
}

function getStatus() { return connected; }
function getServerStatus() { return false; }

function startStream(queryClient: QueryClient) {
  if (source) return;
  const stream = new EventSource("/api/opsucht/auctions/stream");
  source = stream;
  type Change = Exclude<ReturnType<typeof parseAuctionStreamChange>, { kind: "reset" } | null>;
  let syncing = false;
  let generation = 0;
  let pending: Change[] = [];

  const applyChange = (change: Change) => {
    if (change.kind === "remove") {
      queryClient.setQueriesData<ApiEnvelope<Auction[]>>(
        { queryKey: ["auctions"] },
        (previous) => applyAuctionStreamChange(previous, change),
      );
      return;
    }
    queryClient.setQueryData<ApiEnvelope<Auction[]>>(
      ["auctions", "all"],
      (previous) => applyAuctionStreamChange(previous, change),
    );
    // A parent category may include auctions from several child categories.
    void queryClient.invalidateQueries({
      predicate: (query) => query.queryKey[0] === "auctions" && query.queryKey[1] !== "all",
      refetchType: "active",
    });
  };

  const refreshActiveSnapshots = async () => {
    // A stream.reset means events were missed. Bypass the 30-second server cache
    // once; invalidating TanStack Query alone would return the old snapshot.
    await queryClient.cancelQueries({ queryKey: ["auctions"] });
    const active = queryClient.getQueryCache().findAll({ queryKey: ["auctions"], type: "active" });
    const results = await Promise.allSettled(active.map(async (query) => {
      const category = query.queryKey[1];
      if (typeof category !== "string") return;
      const params = new URLSearchParams({ refresh: "1" });
      if (category !== "all") params.set("category", category);
      const snapshot = await fetchApi<Auction[]>(`/api/opsucht/auctions?${params}`);
      queryClient.setQueryData(query.queryKey, snapshot);
    }));
    if (results.some((result) => result.status === "rejected")) {
      // Resume polling if a fresh snapshot could not be obtained.
      setConnected(false);
      await queryClient.invalidateQueries({ queryKey: ["auctions"] });
    }
  };

  const resynchronize = (discardPending = false) => {
    if (discardPending) pending = [];
    syncing = true;
    const version = ++generation;
    // Apply events arriving during the GET afterwards so an older snapshot
    // cannot overwrite a newer bid or restore an already removed auction.
    const request = discardPending
      ? refreshActiveSnapshots()
      : queryClient.invalidateQueries({ queryKey: ["auctions"] });
    void request.finally(() => {
      if (source !== stream || version !== generation) return;
      syncing = false;
      const changes = pending;
      pending = [];
      changes.forEach(applyChange);
    });
  };

  stream.onopen = () => {
    setConnected(true);
    resynchronize();
  };
  stream.onerror = () => {
    setConnected(false);
    // EventSource retries and forwards Last-Event-ID automatically.
    // While offline, useAuctions resumes its 30-second fallback.
  };
  for (const type of EVENTS) {
    stream.addEventListener(type, (event) => {
      if (!(event instanceof MessageEvent)) return;
      const change = parseAuctionStreamChange(type, event.data);
      if (!change) return;
      if (change.kind === "reset") {
        resynchronize(true);
        return;
      }
      if (syncing) pending.push(change);
      else applyChange(change);
    });
  }
}

export function useAuctionStream(enabled: boolean): boolean {
  const queryClient = useQueryClient();
  const isConnected = useSyncExternalStore(subscribeStatus, getStatus, getServerStatus);
  useEffect(() => {
    if (!enabled) return;
    subscribers += 1;
    startStream(queryClient);
    return () => {
      subscribers -= 1;
      if (subscribers === 0) {
        source?.close();
        source = null;
        setConnected(false);
      }
    };
  }, [enabled, queryClient]);
  return isConnected;
}
