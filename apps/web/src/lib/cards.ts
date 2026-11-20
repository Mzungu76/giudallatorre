import { useEffect, useState } from "react";

interface Manifest { id: string; file?: string; duplicate_of?: string }
let ready: Promise<void> | null = null;
const files = new Map<string, string>();
const needsReview = new Set<string>();

export function loadCards(): Promise<void> {
  ready ??= (async () => {
    const [m, r] = await Promise.all([
      fetch("/cards/manifest.json").then((x) => x.json() as Promise<Manifest[]>),
      fetch("/cutouts/review-needed.json").then((x) => x.json() as Promise<{ da_scontornare_a_mano: string[] }>).catch(() => ({ da_scontornare_a_mano: [] })),
    ]);
    const byId = new Map(m.map((c) => [c.id, c]));
    for (const c of m) files.set(c.id, c.file ?? byId.get(c.duplicate_of ?? "")?.file ?? `${c.id}.webp`);
    for (const id of r.da_scontornare_a_mano) needsReview.add(id);
  })();
  return ready;
}
/** Carte delle espansioni: `<mazzo>-cNN` → `/espansioni/<mazzo>/cNN.webp` (carta intera, senza ritaglio). */
const EXP = /^([a-z0-9]{2,12})-c(\d{2})$/;
const expSrc = (id: string): string | null => { const m = EXP.exec(id); return m ? `/espansioni/${m[1]}/c${m[2]}.webp` : null; };
/** Immagine di una carta: ritaglio (personaggio sagomato) se affidabile, altrimenti la carta intera. */
export function cardImage(id: string): { cut: boolean; src: string } {
  const e = expSrc(id); if (e) return { cut: false, src: e };
  const f = files.get(id) ?? `${id}.webp`, base = f.replace(/\.webp$/, "");
  return needsReview.has(base) || needsReview.has(id) ? { cut: false, src: `/cards/${f}` } : { cut: true, src: `/cutouts/${f}` };
}
export const cardFull = (id: string) => expSrc(id) ?? `/cards/${files.get(id) ?? id + ".webp"}`;
export function useCards() { const [ok, setOk] = useState(files.size > 0); useEffect(() => { loadCards().then(() => setOk(true)); }, []); return ok; }
