/** L'ultimo turno visto in una partita (carte sulla torre, frase, il mio voto, cosa è caduto): serve alla cartolina da condividere dalla classifica finale (a quel punto la torre è già vuota). Resta nella scheda (sessionStorage). */
export interface UltimoTurno { frase: string; carte: { pos: number; id: string }[]; voto: number; cadute: number[]; seg?: { pos: number; effetto: string }; pts: number }
const mem = new Map<string, UltimoTurno>(), key = (code: string) => `gdt.ultimo.${code}`;
export function salvaUltimo(code: string, u: UltimoTurno): void { mem.set(code, u); try { sessionStorage.setItem(key(code), JSON.stringify(u)); } catch { /* resta in memoria */ } }
export function leggiUltimo(code: string): UltimoTurno | null {
  const m = mem.get(code); if (m) return m;
  try { const x = JSON.parse(sessionStorage.getItem(key(code)) ?? "null") as UltimoTurno | null; return x && Array.isArray(x.carte) ? x : null; } catch { return null; }
}
