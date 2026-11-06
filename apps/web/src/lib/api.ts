export class ApiError extends Error { constructor(public code: string, public status: number, message?: string) { super(message ?? code); } }
export interface Session { code: string; playerId: string; token: string }
async function call<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try { res = await fetch(path, { ...init, headers: { "content-type": "application/json" } }); } catch { throw new ApiError("NETWORK", 0, "Connessione assente"); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError((data as { error?: string }).error ?? "ERROR", res.status, (data as { message?: string }).message);
  return data as T;
}
export const createRoom = (nickname: string, mode: "table" | "remote", megafonoSa: boolean) =>
  call<Session>("/api/rooms", { method: "POST", body: JSON.stringify({ nickname, mode, megafonoSa }) });
export const joinRoom = (code: string, nickname: string) =>
  call<Session>(`/api/rooms/${encodeURIComponent(code)}/join`, { method: "POST", body: JSON.stringify({ nickname }) });
export const roomInfo = (code: string) => call<{ exists: boolean; stage?: string; players?: number; full?: boolean; mode?: string }>(`/api/rooms/${encodeURIComponent(code)}/info`);

export const ERROR_TEXT: Record<string, string> = {
  NICKNAME_TAKEN: "Questo nickname c'è già nella stanza. Scegline un altro.",
  ROOM_FULL: "La stanza è piena (massimo 8 giocatori).",
  GAME_STARTED: "La partita è già iniziata: non si può più entrare.",
  INVALID_REQUEST: "Nickname non valido: 1–16 caratteri, solo lettere, numeri e spazi.",
  INVALID_CODE: "Il codice non è valido: sono 5 caratteri (senza I, L, O, 0, 1).",
  NOT_FOUND: "Non esiste nessuna stanza con questo codice.",
  RATE_LIMIT: "Troppi tentativi ravvicinati. Aspetta un minuto e riprova.",
  NETWORK: "Sei offline o il server non risponde. Controlla la connessione e riprova.",
  TRY_AGAIN: "Il server è occupato. Riprova tra qualche secondo.",
};
export const errText = (e: unknown) => (e instanceof ApiError ? ERROR_TEXT[e.code] ?? "Qualcosa è andato storto. Riprova." : "Qualcosa è andato storto. Riprova.");
