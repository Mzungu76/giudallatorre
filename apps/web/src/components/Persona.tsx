import { createContext, useCallback, useContext, useState } from "react";
import type { ReactNode } from "react";
import BotProfile, { profileOf } from "./BotProfile.tsx";
import type { ProfileData } from "./BotProfile.tsx";

/**
 * La «persona» di un giocatore (chi è: carta, categoria, tre righe): si apre toccando il suo nome o il suo segnalino, ovunque compaiano.
 * Qui il contenitore (una sola scheda per tutta la stanza) e `Who`, che rende toccabile ogni nome/segnalino. Non è il «carattere» di gioco dei bot, che resta interno.
 */
type Open = ((id: string) => void) | null;
const Ctx = createContext<Open>(null);
export const usePersona = () => useContext(Ctx);

export function PersonaProvider({ players, children }: { players: Parameters<typeof profileOf>[0]; children: ReactNode }) {
  const [prof, setProf] = useState<ProfileData | null>(null);
  const open = useCallback((id: string) => { const p = profileOf(players, id); if (p) setProf(p); }, [players]);
  return <Ctx.Provider value={open}>{children}{prof && <BotProfile p={prof} onClose={() => setProf(null)} />}</Ctx.Provider>;
}

/** Rende toccabile (apre la persona di `id`) tutto ciò che contiene: un nome, un segnalino, una faccia. Fuori dal contenitore (schermo condiviso) non fa nulla. */
export function Who({ id, children, className = "" }: { id?: string; children: ReactNode; className?: string }) {
  const open = usePersona();
  if (!open || !id) return <span className={className}>{children}</span>;
  return <span className={`pers ${className}`} role="button" tabIndex={0} onClick={(e) => { e.stopPropagation(); open(id); }} onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); open(id); } }}>{children}</span>;
}
