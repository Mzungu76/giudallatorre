import type { Session } from "./api.ts";
const KEY = "gdt.sessions";
type Store = Record<string, Session & { nickname: string }>;
function read(): Store { try { return JSON.parse(localStorage.getItem(KEY) ?? "{}") as Store; } catch { return {}; } }
export const saveSession = (s: Session, nickname: string) => { try { const st = read(); st[s.code] = { ...s, nickname }; localStorage.setItem(KEY, JSON.stringify(st)); } catch { /* storage non disponibile */ } };
export const loadSession = (code: string) => read()[code] ?? null;
export const forgetSession = (code: string) => { try { const st = read(); delete st[code]; localStorage.setItem(KEY, JSON.stringify(st)); } catch { /* */ } };
export const lastNickname = () => { try { return localStorage.getItem("gdt.nick") ?? ""; } catch { return ""; } };
export const rememberNickname = (n: string) => { try { localStorage.setItem("gdt.nick", n); } catch { /* */ } };
