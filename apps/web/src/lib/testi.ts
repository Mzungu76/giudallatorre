import { createElement, Fragment } from "react";
import type { ReactNode } from "react";
import base from "../../../../public/testi.json";

/**
 * I testi dell'app stanno in `public/testi.json` (vedi docs/TESTI.md): ogni testo ha una chiave, una sezione e un codice di versione.
 * All'apertura l'app confronta la versione del file online con quella che ha e, se è più nuova, aggiorna i testi al volo.
 */
export interface Testo { t: string; s: string; n?: string }
export interface TestiFile { versione: number; aggiornato: string; testi: Record<string, Testo> }
export type TestoKey = keyof typeof base.testi;

const LS = "gdt.testi";
const bundled = base as unknown as TestiFile;
const ok = (x: unknown): x is TestiFile => !!x && typeof x === "object" && Number.isInteger((x as TestiFile).versione) && typeof (x as TestiFile).testi === "object" && (x as TestiFile).testi !== null;
function cached(): TestiFile | null { try { const x = JSON.parse(localStorage.getItem(LS) ?? "null"); return ok(x) ? x : null; } catch { return null; } }
let cur: TestiFile = (() => { const c = cached(); return c && c.versione > bundled.versione ? c : bundled; })();

/** Codice progressivo dei testi in uso. */
export const versioneTesti = () => cur.versione;

/** Chiede al server il file dei testi; se la versione è più nuova la adotta e la ricorda. Mai oltre `ms`: l'app parte comunque. */
export async function aggiornaTesti(ms = 1200): Promise<boolean> {
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch("/testi.json", { cache: "no-cache", signal: ctl.signal });
    if (!r.ok) return false;
    const x: unknown = await r.json();
    if (!ok(x) || x.versione <= cur.versione) return false;
    cur = x; try { localStorage.setItem(LS, JSON.stringify(x)); } catch { /* memoria piena: vale per questa sessione */ }
    return true;
  } catch { return false; } finally { clearTimeout(timer); }
}

const raw = (key: string): string => cur.testi[key]?.t ?? bundled.testi[key]?.t ?? key;
const TOKEN = /(\*\*[^*]+\*\*|__[^_]+__|~[^~]+~|\{[A-Za-z0-9_]+\})/g;
export type Vars = Record<string, ReactNode>;

/**
 * Il testo di una chiave come elemento React. Segni ammessi nel testo: **grassetto**, __evidenziato__, ~corsivo~,
 * {variabile} (valorizzata da `vars`) e «\n» per andare a capo.
 */
export function t(key: TestoKey, vars?: Vars): ReactNode {
  const s = raw(key);
  if (!/[*_~{\n]/.test(s)) return s;
  const out: ReactNode[] = []; let n = 0;
  s.split("\n").forEach((line, li) => {
    if (li > 0) out.push(createElement("br", { key: `br${n++}` }));
    line.split(TOKEN).forEach((part) => {
      if (!part) return;
      if (part.startsWith("**")) out.push(createElement("b", { key: n++ }, part.slice(2, -2)));
      else if (part.startsWith("__")) out.push(createElement("u", { key: n++ }, part.slice(2, -2)));
      else if (part.startsWith("~")) out.push(createElement("em", { key: n++ }, part.slice(1, -1)));
      else if (part.startsWith("{") && vars && part.slice(1, -1) in vars) out.push(createElement(Fragment, { key: n++ }, vars[part.slice(1, -1)]));
      else out.push(part);
    });
  });
  return createElement(Fragment, null, ...out);
}

/** Il testo di una chiave come semplice stringa (senza segni di formato): per attributi, aria-label, nomi e simili. */
export function ts(key: TestoKey, vars?: Record<string, string | number>): string {
  return raw(key).replace(/\*\*([^*]+)\*\*|__([^_]+)__|~([^~]+)~/g, (_m, a, b, c) => a ?? b ?? c)
    .replace(/\{([A-Za-z0-9_]+)\}/g, (m, k) => (vars && k in vars ? String(vars[k]) : m));
}

/** Testo grezzo (senza togliere i segni): per i pochi punti in cui il testo contiene HTML, es. i cartelli della scena della caduta. */
export function rawTesto(key: TestoKey, vars?: Record<string, string | number>): string {
  let s = raw(key);
  if (vars) s = s.replace(/\{([A-Za-z0-9_]+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
  return s;
}
