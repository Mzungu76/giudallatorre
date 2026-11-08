import type { ReactNode } from "react";
import type { LuiSpec } from "@gdt/game-engine";
import { CHAR_COLORS, tokenUrl } from "../lib/characters.ts";
import { luiTok } from "../scene/draw.ts";
import { Pt } from "./Pt.tsx";

/**
 * Esempi visivi dei punti: le carte sono quelle vere, con il numero sul bordo; i segnalini sono quelli dei giocatori.
 * Nessun riferimento tipo «carta n. 2»: si guarda l'immagine.
 */
const CARDS = ["p03-i08", "p02-i01", "p06-i05", "p08-i11"];
const cardImg = (i: number) => `/cards/${CARDS[i]}.webp`;
const WHO = [{ name: "Anna", c: 0, mega: true }, { name: "Bea", c: 1 }, { name: "Carlo", c: 2 }, { name: "Dario", c: 3 }] as { name: string; c: number; mega?: boolean }[];
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
    <div className="ex-board" aria-label="Quattro carte sulla torre con i voti ricevuti">
      {CARDS.map((_, i) => {
        const votes = VOTES.map((v, p) => (v === i ? p : -1)).filter((p) => p >= 0);
        return (
          <div className="ex-col" key={i}>
            <div className="ex-cw">
              <Thumb i={i} n={i + 1} w={w} ring={i === FALLEN} dim={i !== FALLEN && votes.length === 0} />
              {i === FALLEN && <span className="ex-fall">CADE</span>}
              {i === FALLEN && <span className="ex-own" title="Chi ha giocato questa carta"><Tk i={OWNER} s={22} /></span>}
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
      <span className="ex-who"><Tk i={w.c} s={26} /><b>{w.name}</b>{w.mega && <em title="Megafono">📣</em>}</span>
      <span className="ex-vote"><i>vota</i><Thumb i={voted} n={voted + 1} w={22} /></span>
      <span className="ex-why">
        {right && <Pill kind="ok">✓ Voto giusto <Pt n={2} /></Pill>}
        {own && <Pill kind="ok">✓ La sua carta è caduta <Pt n={2} /></Pill>}
        {lui && <Pill kind="luik">✓ Lui! azzeccato <Pt n={7} /></Pill>}
        {!right && !own && !lui && <Pill kind="no">Nessun punto</Pill>}
      </span>
      <b className={`ex-tot ${total ? "up" : ""}`}><Pt n={total} plus={total > 0} /></b>
    </div>
  );
}

/** Esempio di un turno: la frase, le carte, i voti e chi prende cosa. */
export function ExampleTurn({ small }: { small?: boolean }) {
  return (
    <div className="ex" data-testid="example-turn">
      <div className="ex-phrase"><span>Oggi salgono sulla torre…</span><b>i più ipocriti</b></div>
      <Board small={small} />
      <div className="ex-lines">{[0, 1, 2, 3].map((p) => <Line key={p} p={p} lui={p === 0} />)}</div>
      <div className="ex-key">
        <span><Pill kind="ok"><Pt n={2} /></Pill> hai votato la carta che cade</span>
        <span><Pill kind="ok"><Pt n={2} /></Pill> la carta che cade l’hai giocata tu</span>
      </div>
    </div>
  );
}

const SPEC2: LuiSpec = { slot: "k2", k: 2, pts: 7 };
/** Esempio del Lui!: il gettone sulla carta, chi la vota e cosa succede se i voti bastano o no. */
export function ExampleLui() {
  const arrows = [{ p: 2, on: true }, { p: 3, on: true }, { p: 1, on: false }];
  return (
    <div className="ex" data-testid="example-lui">
      <div className="ex-lh">
        <span className="ex-ltk" dangerouslySetInnerHTML={{ __html: luiTok(SPEC2, 56) }} />
        <div><b>«Almeno 2 voti»</b><p>Anna ha messo questo gettone sulla carta col bordo giallo.</p></div>
      </div>
      <div className="ex-lboard">
        <div className="ex-lc"><Thumb i={FALLEN} n={FALLEN + 1} w={74} ring /><span className="ex-lbadge" dangerouslySetInnerHTML={{ __html: luiTok(SPEC2, 30) }} /></div>
        <div className="ex-vs">
          <span className="ex-vh">Gli altri votano</span>
          {arrows.map(({ p, on }) => (
            <div key={p} className={`ex-vr ${on ? "y" : ""}`}><Tk i={WHO[p]!.c} s={24} /><b>{WHO[p]!.name}</b><span className="ar">→</span><Thumb i={VOTES[p]!} n={VOTES[p]! + 1} w={22} dim={!on} />{on && <i className="ck">✓</i>}</div>
          ))}
        </div>
      </div>
      <div className="ex-res ok"><b>Due voti sulla sua carta: azzeccato!</b><span>Anna prende <Pt n={7} /></span></div>
      <div className="ex-res ko"><b>Se ne avesse presi solo uno: mancato</b><span><Pt n={0} plus={false} /> Non perde nulla, ma il gettone è usato.</span></div>
      <p className="ex-foot">Contano solo i voti degli altri, non il tuo. Ogni partita ha 2 gettoni, uguali per tutti, e ognuno si usa una volta sola.</p>
    </div>
  );
}

/** Legenda breve dei due punti da +2, con immagini. */
export function PointsKey() {
  return (
    <div className="ex-pk">
      <div className="ex-pkr"><Pill kind="ok"><Pt n={2} /></Pill><span className="ex-pkv"><Tk i={0} s={22} /><i>→</i><Thumb i={FALLEN} w={26} ring /><em>cade</em></span><div><b>Voto giusto</b><p>Hai votato la carta che cade.</p></div></div>
      <div className="ex-pkr"><Pill kind="ok"><Pt n={2} /></Pill><span className="ex-pkv"><Thumb i={FALLEN} w={26} ring /><em>cade</em><i>←</i><Tk i={1} s={22} /></span><div><b>Carta caduta</b><p>La carta che cade l’hai giocata tu.</p></div></div>
      <div className="ex-pkr"><Pill kind="luik"><Pt n="+5…16" /></Pill><span className="ex-pkv" dangerouslySetInnerHTML={{ __html: luiTok(SPEC2, 30) }} /><div><b>Lui! azzeccato</b><p>Solo per il Megafono: la carta del gettone prende abbastanza voti.</p></div></div>
    </div>
  );
}
