import { useEffect, useState } from "react";
import base from "../../../../public/espansioni/catalogo.json";

/**
 * Le espansioni (mazzi tematici acquistabili). Il catalogo sta in `public/espansioni/catalogo.json` (con codice di versione, come i testi);
 * le carte di ogni mazzo in `public/espansioni/<id>/cNN.webp`. Vedi docs/ESPANSIONI.md.
 */
export interface Mazzo {
  id: string; nome: string; colore: string; prezzo: string; stato: "vendita" | "arrivo"; novita?: boolean; descrizione: string;
  personaggi: number; frasi: number; anteprima: number; scatola: [number, number, number]; esempio: string; cartella: string; carte: number; /** Nome e paese di ogni carta (testo alternativo per i lettori di schermo, non si vede nel gioco). */ nomi?: string[];
}
export interface Catalogo { versione: number; aggiornato: string; mazzi: Mazzo[] }

/** Finché il pagamento non è collegato, «Compralo» sblocca il mazzo solo su questo dispositivo (modalità prova). */
export const PAGAMENTI_ATTIVI = false;

const bundled = base as unknown as Catalogo;
const ok = (x: unknown): x is Catalogo => !!x && typeof x === "object" && Number.isInteger((x as Catalogo).versione) && Array.isArray((x as Catalogo).mazzi);

/** Catalogo aggiornato dal server; se manca la rete resta quello incluso nell'app. */
export async function caricaCatalogo(ms = 2500): Promise<Catalogo> {
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch("/espansioni/catalogo.json", { cache: "no-cache", signal: ctl.signal });
    const x: unknown = r.ok ? await r.json() : null;
    return ok(x) && x.versione >= bundled.versione ? x : bundled;
  } catch { return bundled; } finally { clearTimeout(timer); }
}

export const urlCarta = (m: Mazzo, n: number) => `${m.cartella}c${String(n).padStart(2, "0")}.webp`;
export const urlCarte = (m: Mazzo, ns: number[]) => ns.map((n) => urlCarta(m, n));

const LS = "gdt.espansioni";
interface Stato { tuoi: string[]; usa: string[] }
function leggi(): Stato {
  try { const x = JSON.parse(localStorage.getItem(LS) ?? "null") as Stato | null; if (x && Array.isArray(x.tuoi) && Array.isArray(x.usa)) return x; } catch { /* */ }
  return { tuoi: [], usa: [] };
}
function scrivi(s: Stato) { try { localStorage.setItem(LS, JSON.stringify(s)); } catch { /* memoria piena o non disponibile */ } }

/** Mazzi posseduti e mazzi da usare in partita, ricordati su questo dispositivo. */
export function useCollezione() {
  const [s, setS] = useState<Stato>(leggi);
  const upd = (f: (x: Stato) => Stato) => setS((x) => { const n = f(x); scrivi(n); return n; });
  return {
    tuoi: s.tuoi, haMazzo: (id: string) => s.tuoi.includes(id), usa: (id: string) => s.usa.includes(id),
    sblocca: (id: string) => upd((x) => ({ tuoi: x.tuoi.includes(id) ? x.tuoi : [...x.tuoi, id], usa: x.usa.includes(id) ? x.usa : [...x.usa, id] })),
    blocca: (id: string) => upd((x) => ({ tuoi: x.tuoi.filter((k) => k !== id), usa: x.usa.filter((k) => k !== id) })),
    commuta: (id: string) => upd((x) => ({ ...x, usa: x.usa.includes(id) ? x.usa.filter((k) => k !== id) : [...x.usa, id] })),
  };
}

export function useCatalogo(): Catalogo | null {
  const [c, setC] = useState<Catalogo | null>(null);
  useEffect(() => { let vivo = true; void caricaCatalogo().then((x) => { if (vivo) setC(x); }); return () => { vivo = false; }; }, []);
  return c;
}
