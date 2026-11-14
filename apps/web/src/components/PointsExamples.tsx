import type { ReactNode } from "react";
import type { LuiSpec } from "@gdt/game-engine";
import { CHAR_COLORS, tokenUrl } from "../lib/characters.ts";
import { luiTok } from "../scene/draw.ts";
import { Pt } from "./Pt.tsx";
import { t, ts } from "../lib/testi.ts";
import type { TestoKey } from "../lib/testi.ts";
import { MegaIcon } from "./MegaIcon.tsx";

/**
 * Esempi visivi dei punti: le carte sono quelle vere, con il numero sul bordo; i segnalini sono quelli dei giocatori.
 * Nessun riferimento tipo «carta n. 2»: si guarda l'immagine.
 */
const CARDS = ["p03-i08", "p02-i01", "p06-i05", "p08-i11"];
const cardImg = (i: number) => `/cards/${CARDS[i]}.webp`;
const WHO = [{ c: 0, mega: true }, { c: 1 }, { c: 2 }, { c: 3 }] as { c: number; mega?: boolean }[];
const nome = (p: number) => ts(`ex.nome.${p}` as TestoKey);
/** Chi ha votato cosa (indice carta 0..3) e di chi è la carta che cade. */
const VOTES = [1, 2, 1, 1];
const FALLEN = 1, OWNER = 1;

export const Tk = ({ i, s = 24 }: { i: number; s?: number }) => <i className="ex-tk" style={{ width: s, height: s, backgroundImage: `url(${tokenUrl(CHAR_COLORS[i]!)})` }} />;
/** Carta in miniatura con il numero sul bordo. */
export const Thumb = ({ i, n, w = 40, ring, dim }: { i: number; n?: number; w?: number; ring?: boolean; dim?: boolean }) => (
  <span className={`ex-th ${ring ? "ring" : ""} ${dim ? "dim" : ""}`} style={{ width: w, height: w * 1.5, backgroundImage: `url(${cardImg(i)})` }}>{n !== undefined && <i>{n}</i>}</span>
);
const Pill = ({ children, kind = "" }: { children: ReactNode; kind?: string }) => <span className={`ex-pill ${kind}`}>{children}</span>;

/** Le quattro carte sulla torre, i voti sotto ogni carta e lo stampo CADE sulla più votata. */
function Board({ small }: { small?: boolean }) {
  const w = small ? 58 : 66;
  return (
    <div className="ex-board" aria-label={ts("ex.board.aria")}>
      {CARDS.map((_, i) => {
        const votes = VOTES.map((v, p) => (v === i ? p : -1)).filter((p) => p >= 0);
        return (
          <div className="ex-col" key={i}>
            <div className="ex-cw">
              <Thumb i={i} n={i + 1} w={w} ring={i === FALLEN} dim={i !== FALLEN && votes.length === 0} />
              {i === FALLEN && <span className="ex-fall">{t("ex.cade")}</span>}
              {i === FALLEN && <span className="ex-own" title={ts("ex.own.tip")}><Tk i={OWNER} s={22} /></span>}
            </div>
            <div className="ex-votes">{votes.map((p) => <Tk key={p} i={WHO[p]!.c} s={22} />)}</div>
          </div>
        );
      })}
    </div>
  );
}

/** Una riga per giocatore: chi è, quale carta ha votato (immagine) e perché prende punti. */
function Line({ p, lui }: { p: number; lui?: boolean }) {
  const w = WHO[p]!, voted = VOTES[p]!, right = voted === FALLEN, own = p === OWNER;
  const total = (right ? 2 : 0) + (own ? 2 : 0) + (lui ? 7 : 0);
  return (
    <div className="ex-line">
      <span className="ex-who"><Tk i={w.c} s={26} /><b>{nome(p)}</b>{w.mega && <em title={ts("ex.mega.tip")}><MegaIcon s={16} /></em>}</span>
      <span className="ex-vote"><i>{t("ex.vota")}</i><Thumb i={voted} n={voted + 1} w={22} /></span>
      <span className="ex-why">
        {right && <Pill kind="ok">{t("ex.pill.giusto", { pt: <Pt n={2} /> })}</Pill>}
        {own && <Pill kind="ok">{t("ex.pill.caduta", { pt: <Pt n={2} /> })}</Pill>}
        {lui && <Pill kind="luik">{t("ex.pill.lui", { pt: <Pt n={7} /> })}</Pill>}
        {!right && !own && !lui && <Pill kind="no">{t("ex.pill.nessuno")}</Pill>}
      </span>
      <b className={`ex-tot ${total ? "up" : ""}`}><Pt n={total} plus={total > 0} /></b>
    </div>
  );
}

/** Esempio di un turno: la frase, le carte, i voti e chi prende cosa. */
export function ExampleTurn({ small }: { small?: boolean }) {
  return (
    <div className="ex" data-testid="example-turn">
      <div className="ex-phrase"><span>{t("ex.frase")}</span><b>{t("ex.frase.c")}</b></div>
      <Board small={small} />
      <div className="ex-lines">{[0, 1, 2, 3].map((p) => <Line key={p} p={p} lui={p === 0} />)}</div>
      <div className="ex-key">
        <span><Pill kind="ok"><Pt n={2} /></Pill> {t("ex.key.voto")}</span>
        <span><Pill kind="ok"><Pt n={2} /></Pill> {t("ex.key.caduta")}</span>
      </div>
    </div>
  );
}

const SPEC2: LuiSpec = { slot: "cade", k: 0, pts: 4, effect: "cade" };
/** Esempio del Lui!: il gettone sulla carta, chi la vota e cosa succede se i voti bastano o no. */
export function ExampleLui() {
  const arrows = [{ p: 2, on: true }, { p: 3, on: true }, { p: 1, on: false }];
  return (
    <div className="ex" data-testid="example-lui">
      <div className="ex-lh">
        <span className="ex-ltk" dangerouslySetInnerHTML={{ __html: luiTok(SPEC2, 56) }} />
        <div><b>{t("exl.titolo")}</b><p>{t("exl.testo")}</p></div>
      </div>
      <div className="ex-lboard">
        <div className="ex-lc"><Thumb i={FALLEN} n={FALLEN + 1} w={74} ring /><span className="ex-lbadge" dangerouslySetInnerHTML={{ __html: luiTok(SPEC2, 30) }} /></div>
        <div className="ex-vs">
          <span className="ex-vh">{t("exl.altri")}</span>
          {arrows.map(({ p, on }) => (
            <div key={p} className={`ex-vr ${on ? "y" : ""}`}><Tk i={WHO[p]!.c} s={24} /><b>{nome(p)}</b><span className="ar">→</span><Thumb i={VOTES[p]!} n={VOTES[p]! + 1} w={22} dim={!on} />{on && <i className="ck">✓</i>}</div>
          ))}
        </div>
      </div>
      <div className="ex-res ok"><b>{t("exl.ok.t")}</b><span>{t("exl.ok.x", { pt: <Pt n={4} /> })}</span></div>
      <div className="ex-res ko"><b>{t("exl.ko.t")}</b><span>{t("exl.ko.x", { pt: <Pt n={0} plus={false} /> })}</span></div>
    </div>
  );
}

/** Legenda breve dei due punti da +2, con immagini. */
export function PointsKey() {
  return (
    <div className="ex-pk">
      <div className="ex-pkr"><Pill kind="ok"><Pt n={2} /></Pill><span className="ex-pkv"><Tk i={0} s={22} /><i>→</i><Thumb i={FALLEN} w={26} ring /><em>{t("pk.cade")}</em></span><div><b>{t("pk.giusto.t")}</b><p>{t("pk.giusto.x")}</p></div></div>
      <div className="ex-pkr"><Pill kind="ok"><Pt n={2} /></Pill><span className="ex-pkv"><Thumb i={FALLEN} w={26} ring /><em>{t("pk.cade")}</em><i>←</i><Tk i={1} s={22} /></span><div><b>{t("pk.caduta.t")}</b><p>{t("pk.caduta.x")}</p></div></div>
      <div className="ex-pkr"><Pill kind="luik"><Pt n="+2 / +4" /></Pill><span className="ex-pkv" dangerouslySetInnerHTML={{ __html: luiTok(SPEC2, 30) }} /><div><b>{t("pk.lui.t")}</b><p>{t("pk.lui.x")}</p></div></div>
    </div>
  );
}
