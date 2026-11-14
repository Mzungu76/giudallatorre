import { CHAR_COLORS, cardUrl, charBlurb, charName, tokenUrl } from "../lib/characters.ts";
import { t, ts } from "../lib/testi.ts";
import type { TestoKey } from "../lib/testi.ts";

/**
 * La scheda di un giocatore (si apre toccando il suo nome): la carta con il segnalino, la categoria (il personaggio) e due o tre righe
 * che lo descrivono; per i bot anche il carattere estratto per questa partita. Serve soprattutto con le frasi «confessioni»: capire chi è.
 */
export interface ProfileData { nickname: string; char: number; bot?: boolean; level?: "easy" | "medium" | "hard"; style?: string }
export default function BotProfile({ p, onClose }: { p: ProfileData; onClose: () => void }) {
  const col = CHAR_COLORS[p.char % 8]!, sk = (k: string) => `bot.stile.${p.style}.${k}` as TestoKey;
  return (
    <div className="bprof" role="dialog" aria-label={ts("bot.profilo.aria", { nome: p.nickname })} data-testid="bot-profile" onClick={onClose}>
      <div className="bprof-box" onClick={(e) => e.stopPropagation()}>
        <div className="bprof-card"><img src={cardUrl(col)} alt="" /><img className="bprof-tok" src={tokenUrl(col)} alt="" /></div>
        <div className="bprof-txt">
          <b className="bprof-name">{p.nickname}</b>
          <span className="bprof-cat">{charName(p.char % 8)}{p.bot && p.level ? <em> · {ts("room.bot", { lv: ts(`room.lv.${p.level}` as TestoKey) })}</em> : null}</span>
          <p>{charBlurb(p.char % 8)}.</p>
          {p.bot && p.style && <><p className="bprof-st"><b>{t(sk("nome"))}</b></p><p>{t(sk("d1"))}</p><p>{t(sk("d2"))}</p></>}
        </div>
        <button type="button" className="bt mus bprof-ok" onClick={onClose} data-testid="bot-profile-close">{t("bot.profilo.chiudi")}</button>
      </div>
    </div>
  );
}

/** La scheda di un giocatore della stanza, dal suo id. */
export const profileOf = (players: { id: string; nickname: string; char?: number; isBot?: boolean; level?: "easy" | "medium" | "hard"; style?: string }[], id: string): ProfileData | null => {
  const i = players.findIndex((p) => p.id === id), p = players[i]; if (!p) return null;
  return { nickname: p.nickname, char: (p.char ?? i) % 8, ...(p.isBot ? { bot: true, level: p.level ?? "medium", style: p.style } : {}) };
};
