import { ts } from "./testi.ts";
import type { TestoKey } from "./testi.ts";
export class ApiError extends Error { constructor(public code: string, public status: number, message?: string) { super(message ?? code); } }
export interface Session { code: string; playerId: string; token: string }
async function call<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try { res = await fetch(path, { ...init, headers: { "content-type": "application/json" } }); } catch { throw new ApiError("NETWORK", 0, "Connessione assente"); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError((data as { error?: string }).error ?? (res.status >= 500 ? "SERVER" : "ERROR"), res.status, (data as { message?: string }).message);
  return data as T;
}
export type BotLevel = "easy" | "medium" | "hard";
export const createRoom = (nickname: string, mode: "table" | "remote", megafonoSa: boolean, bots?: { count: number; level: BotLevel }, extra?: { debug?: boolean; char?: number; ageBand?: 6 | 10 | 14 | 18; turnTimerSec?: 0 | 30 | 60 | 90 | 120 }) =>
  call<Session>("/api/rooms", { method: "POST", body: JSON.stringify({ nickname, mode, megafonoSa, ...(extra ?? {}), ...(bots && bots.count > 0 ? { bots } : {}) }) });
export const joinRoom = (code: string, nickname: string, char?: number) =>
  call<Session>(`/api/rooms/${encodeURIComponent(code)}/join`, { method: "POST", body: JSON.stringify({ nickname, ...(char !== undefined ? { char } : {}) }) });
export const roomInfo = (code: string) => call<{ exists: boolean; stage?: string; players?: number; full?: boolean; mode?: string; taken?: number[] }>(`/api/rooms/${encodeURIComponent(code)}/info`);

const API_CODES = ["NICKNAME_TAKEN", "ROOM_FULL", "GAME_STARTED", "INVALID_REQUEST", "INVALID_CODE", "NOT_FOUND", "RATE_LIMIT", "NETWORK", "TRY_AGAIN", "QUOTA", "SERVER"];
/** Testo dell'errore per il giocatore: i messaggi stanno in public/testi.json (err.CODICE). */
export const errText = (e: unknown) => (e instanceof ApiError && API_CODES.includes(e.code) ? ts(`err.${e.code}` as TestoKey) : ts("err.altro"));
