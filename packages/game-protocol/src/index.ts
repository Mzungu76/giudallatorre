import { z } from "zod";
import type { GameEvent, PlayerView } from "@gdt/game-engine";

// ---------- costanti ----------
/** Alfabeto senza caratteri ambigui (niente I, L, O, 0, 1). */
export const ROOM_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const ROOM_CODE_LENGTH = 5;
export const MAX_MESSAGE_BYTES = 2048;
export const TIMER_CHOICES = [0, 30, 60, 90, 120] as const;

// ---------- validazione di base ----------
export const roomCodeSchema = z.string().transform((s) => s.trim().toUpperCase()).pipe(z.string().regex(new RegExp(`^[${ROOM_CODE_ALPHABET}]{${ROOM_CODE_LENGTH}}$`)));
export const nicknameSchema = z
  .string().max(64)
  .refine((s) => !/[\p{Cc}\p{Cf}\u2028\u2029]/u.test(s), "caratteri di controllo non ammessi")
  .transform((s) => s.normalize("NFKC").trim().replace(/\s+/g, " "))
  .pipe(z.string().min(1).max(16).regex(/^[\p{L}\p{N}][\p{L}\p{N} _.'-]*$/u, "caratteri non ammessi"));
export const tokenSchema = z.string().regex(/^[A-Za-z0-9_-]{22}$/);
export const playerIdSchema = z.string().regex(/^[0-9a-f]{16}$/);
export const modeSchema = z.enum(["table", "remote"]);
export const botLevelSchema = z.enum(["easy", "medium", "hard"]);
export const MAX_PHRASE_CHARS = 80;

// ---------- API HTTP ----------
export const createRoomBody = z.object({ nickname: nicknameSchema, mode: modeSchema.default("table"), megafonoSa: z.boolean().default(false), bots: z.object({ count: z.number().int().min(0).max(7), level: botLevelSchema.default("medium") }).strict().optional() }).strict();
export const joinRoomBody = z.object({ nickname: nicknameSchema }).strict();
export type CreateRoomBody = z.infer<typeof createRoomBody>;
export interface SessionResponse { code: string; playerId: string; token: string }
export interface RoomInfoResponse { exists: boolean; stage?: "LOBBY" | "PLAYING" | "FINISHED"; players?: number; full?: boolean; mode?: "table" | "remote" }

// ---------- messaggi client -> server ----------
const act = z.union([
  z.object({ type: z.literal("choosePhrase"), mode: z.literal("card"), index: z.number().int().min(0).max(9) }).strict(),
  z.object({ type: z.literal("choosePhrase"), mode: z.literal("free"), text: z.string().max(200).optional() }).strict(),
  z.object({ type: z.literal("playCard"), cardId: z.string().regex(/^p\d{2}-i\d{2}$|^c\d{1,4}$/).max(16) }).strict(),
  z.object({ type: z.literal("placeLui"), slot: z.string().regex(/^(zero|k[1-7]|pr|sp|in|im|di|ce)$/), position: z.number().int().min(1).max(8), to: z.number().int().min(1).max(8).optional() }).strict(),
  z.object({ type: z.literal("vote"), position: z.number().int().min(1).max(8) }).strict(),
  z.object({ type: z.literal("advance") }).strict(),
]);
export const clientMessageSchema = z.discriminatedUnion("t", [
  z.object({ t: z.literal("hello"), token: tokenSchema }).strict(),
  z.object({ t: z.literal("watch") }).strict(),
  z.object({ t: z.literal("ping") }).strict(),
  z.object({ t: z.literal("setOptions"), megafonoSa: z.boolean().optional(), gregge: z.boolean().optional(), propaganda: z.boolean().optional(), objectives: z.boolean().optional(), ageBand: z.union([z.literal(6), z.literal(10), z.literal(14), z.literal(18)]).optional(), confessions: z.boolean().optional(), display: z.boolean().optional(), mode: modeSchema.optional(), turnTimerSec: z.union([z.literal(0), z.literal(30), z.literal(60), z.literal(90), z.literal(120)]).optional() }).strict(),
  z.object({ t: z.literal("kick"), playerId: playerIdSchema }).strict(),
  z.object({ t: z.literal("addBot"), level: botLevelSchema.default("medium") }).strict(),
  z.object({ t: z.literal("removeBot"), playerId: playerIdSchema }).strict(),
  z.object({ t: z.literal("chat"), text: z.string().max(400) }).strict(),
  z.object({ t: z.literal("start") }).strict(),
  z.object({ t: z.literal("leave") }).strict(),
  z.object({ t: z.literal("act"), reqId: z.string().max(32).optional(), action: act }).strict(),
]);
export type ClientMessage = z.infer<typeof clientMessageSchema>;
export type ClientAction = Extract<ClientMessage, { t: "act" }>["action"];

// ---------- messaggi server -> client ----------
export type RoomStage = "LOBBY" | "PLAYING" | "FINISHED";
export interface RoomOptionsDto { megafonoSa: boolean; /** Variante «Il gregge» (in prova): lo 0 è l'Imbroglio! (annulla i voti sulla sua carta), la soglia premia anche chi la vota. */ gregge?: boolean; /** Variante PROPAGANDA (in prova) e, dentro, obiettivi contrapposti. PROPAGANDA e «Il gregge» si escludono. */ propaganda?: boolean; objectives?: boolean; /** Fascia d'età del gruppo: il mazzo contiene solo frasi con età ≤ questa. */ ageBand: 6 | 10 | 14 | 18; /** Carte «Ammetto che…» nel mazzo. */ confessions: boolean; mode: "table" | "remote"; turnTimerSec: number; /** Consente schermi condivisi di sola visione (nessun dato privato). */ display: boolean }
export interface RoomPlayerDto { id: string; nickname: string; isHost: boolean; connected: boolean; isBot?: boolean; level?: "easy" | "medium" | "hard" }
export interface ChatDto { id: number; from: string; name: string; text: string; ts: number }
export const MAX_CHAT_CHARS = 140;
export type ServerMessage =
  | { t: "room"; seq: number; code: string; stage: RoomStage; you: string; hostId: string; options: RoomOptionsDto; players: RoomPlayerDto[] }
  | { t: "view"; seq: number; view: PlayerView; events: GameEvent[]; deadline: number | null }
  | { t: "error"; code: string; message: string; reqId?: string }
  | { t: "chat"; msg: ChatDto }
  | { t: "chatlog"; msgs: ChatDto[] }
  | { t: "kicked" }
  | { t: "closed"; reason: string }
  | { t: "pong" };
