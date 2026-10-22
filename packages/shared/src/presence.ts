import type { PlayerSummary } from "./api.js";

export type PresenceStatus = "online" | "reconnecting" | "offline" | "unknown";
export interface PresenceSnapshot {
  type: "PRESENCE_UPDATED"; gameId: string;
  players: { playerId: string; status: "online" | "reconnecting" }[];
}
export function readPresence(value: unknown, gameId: string): PresenceSnapshot | null {
  if (!value || typeof value !== "object") return null;
  const data = value as PresenceSnapshot;
  if (data.type !== "PRESENCE_UPDATED" || data.gameId !== gameId || !Array.isArray(data.players) || data.players.length > 256) return null;
  const ids = new Set<string>();
  const players: PresenceSnapshot["players"] = [];
  for (const player of data.players) {
    if (!player || typeof player.playerId !== "string" || player.playerId.length > 64 || ids.has(player.playerId) || !["online", "reconnecting"].includes(player.status)) return null;
    ids.add(player.playerId); players.push({ playerId: player.playerId, status: player.status });
  }
  return { type: "PRESENCE_UPDATED", gameId, players };
}
export function playerPresence(player: Pick<PlayerSummary, "id" | "leftAt" | "removedByHost">, snapshot: PresenceSnapshot | null | undefined): { status: PresenceStatus | "left"; label: string } {
  if (player.leftAt) return { status: "left", label: player.removedByHost ? "Removed" : "Left" };
  const status = snapshot ? snapshot.players.find(p => p.playerId === player.id)?.status ?? "offline" : "unknown";
  return { status, label: { online: "Online", reconnecting: "Reconnecting", offline: "Offline", unknown: "Connection unknown" }[status] };
}
