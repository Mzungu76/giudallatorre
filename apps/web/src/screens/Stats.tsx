import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { Stage, Btn, navigate } from "../ui.tsx";
import { t, ts } from "../lib/testi.ts";
import type { TestoKey } from "../lib/testi.ts";
import { loadDb, resetStats, summary } from "../lib/stats.ts";
import type { GameRec } from "../lib/stats.ts";
import GameIcon from "../components/GameIcon.tsx";
import { ICONS, MAX_LEVEL, TIER_COLORS, XP, levelFor, tierOf, xpFor, xpOf } from "../lib/livelli.ts";

const fmtDate = (ms: number) => new Date(ms).toLocaleDateString("it-IT", { day: "numeric", month: "short", year: "numeric" });
const pc = (x: number | null) => (x === null ? "–" : `${String(x).replace(".", ",")}%`);
const lvName = (n: number) => ts(`lv.${n}` as TestoKey);

function Tile({ id, icon, color, label, value, sub }: { id: string; icon: string; color: string; label: string; value: string | number; sub?: string }) {
  return (
    <div className="st-box" style={{ "--c": color } as CSSProperties} data-testid={`st-${id}`}>
      <i aria-hidden="true"><GameIcon name={icon} size={26} /></i>
      <div><b>{value}</b><span>{label}</span>{sub ? <small>{sub}</small> : null}</div>
    </div>
  );
}

/** Grafico a barre dei punti delle ultime partite (le più vecchie a sinistra); in oro le vittorie. */
function PointsChart({ games }: { games: GameRec[] }) {
  const list = games.slice(0, 12).reverse(), W = 330, H = 130, base = 112, top = 16, max = Math.max(10, ...list.map((g) => g.score)), bw = Math.min(22, (W - 20) / list.length - 6);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="st-chart" role="img" aria-label={ts("st.graf.punti")} data-testid="st-chart">
      {[0.25, 0.5, 0.75, 1].map((f) => <line key={f} x1="8" x2={W - 8} y1={base - (base - top) * f} y2={base - (base - top) * f} stroke="#13224a" strokeOpacity=".12" strokeWidth="1" />)}
      <line x1="8" x2={W - 8} y1={base} y2={base} stroke="#13224a" strokeWidth="2.5" strokeLinecap="round" />
      {list.map((g, i) => {
        const x = 14 + (i + 0.5) * ((W - 28) / list.length), h = Math.max(3, ((base - top) * g.score) / max);
        return (
          <g key={g.id}>
            <rect x={x - bw / 2} y={base - h} width={bw} height={h} rx="4" fill={g.won ? "#ffc72c" : "#14a3a1"} stroke="#13224a" strokeWidth="2" />
            <text x={x} y={base - h - 4} textAnchor="middle" fontSize="10" fontWeight="800" fill="#13224a">{g.score}</text>
          </g>
        );
      })}
    </svg>
  );
}

/** Anello con la percentuale (vittorie). */
function Ring({ value, color }: { value: number | null; color: string }) {
  const r = 30, c = 2 * Math.PI * r, v = value ?? 0;
  return (
    <svg viewBox="0 0 80 80" width="84" height="84" aria-hidden="true">
      <circle cx="40" cy="40" r={r} fill="none" stroke="#13224a" strokeOpacity=".15" strokeWidth="10" />
      <circle cx="40" cy="40" r={r} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round" strokeDasharray={`${(c * v) / 100} ${c}`} transform="rotate(-90 40 40)" />
      <text x="40" y="45" textAnchor="middle" fontSize="15" fontWeight="800" fill="#13224a">{pc(value)}</text>
    </svg>
  );
}

function Bar({ icon, label, value, color }: { icon: string; label: string; value: number | null; color: string }) {
  return (
    <div className="st-bar">
      <span><i aria-hidden="true"><GameIcon name={icon} size={20} /></i>{label}</span>
      <div><u style={{ width: `${value ?? 0}%`, background: color }} /></div>
      <b>{pc(value)}</b>
    </div>
  );
}

/** «Le mie statistiche»: livello, grafici e numeri personali, letti dall'archivio del dispositivo. Niente passa dal server. */
export default function Stats() {
  const [data, setData] = useState<{ s: ReturnType<typeof summary>; xp: number } | null>(null), [ask, setAsk] = useState(false);
  const load = async () => { const db = await loadDb(); setData({ s: summary(db), xp: xpOf(db.totals) }); };
  useEffect(() => { void load(); }, []);
  const clear = async () => { if (!ask) { setAsk(true); return; } await resetStats(); setAsk(false); await load(); };
  const s = data?.s, L = data ? levelFor(data.xp) : null, tc = L ? TIER_COLORS[tierOf(L.level)]! : TIER_COLORS[0];
  const empty = !!s && s.games === 0 && s.minis === 0 && s.megaTurns === 0 && s.votes === 0;
  return (
    <Stage bg="paper" testId="stats">
      <div className="stats">
        <h2>{t("st.titolo")}</h2>
        {s && L && (
          <section className="st-hero" style={{ "--tc": tc } as CSSProperties} data-testid="st-livello">
            <div className="st-badge" aria-hidden="true"><span><GameIcon name={ICONS[L.level - 1]!} size={56} /></span></div>
            <div className="st-hero-t">
              <small>{ts("st.livello", { n: L.level })}</small>
              <b>{lvName(L.level)}</b>
              <div className="st-xpbar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(L.progress * 100)}><u style={{ width: `${Math.round(L.progress * 100)}%` }} /></div>
              <em>{ts("st.xp", { xp: L.xp })}{L.to !== null ? ` · ${ts("st.xpprox", { xp: L.toNext, titolo: lvName(L.level + 1) })}` : ` · ${ts("st.massimo")}`}</em>
            </div>
          </section>
        )}
        {empty && <p className="st-vuoto" data-testid="st-vuoto">{t("st.vuoto")}</p>}
        {s && (
          <>
            <div className="st-grid">
              <Tile id="partite" icon="gioco" color="#5b7cfa" label={ts("st.partite")} value={s.games} />
              <Tile id="vittorie" icon="coppa" color="#ffc72c" label={ts("st.vittorie")} value={s.wins} sub={pc(s.winRate)} />
              <Tile id="podi" icon="medaglia" color="#ff9f45" label={ts("st.podi")} value={s.podiums} />
              <Tile id="punti" icon="stella" color="#e8505b" label={ts("st.punti")} value={s.points} />
              <Tile id="media" icon="crescita" color="#14a3a1" label={ts("st.media")} value={s.avg === null ? "–" : String(s.avg).replace(".", ",")} />
              <Tile id="record" icon="razzo" color="#8e6bd8" label={ts("st.record")} value={s.best} />
              <Tile id="voti" icon="urna" color="#5b7cfa" label={ts("st.voti")} value={s.votes} />
              <Tile id="intuito" icon="bersaglio" color="#e8505b" label={ts("st.intuito")} value={pc(s.voteRate)} />
              <Tile id="cadute" icon="caduta" color="#ff9f45" label={ts("st.cadute")} value={s.cardFell} />
              <Tile id="mega" icon="megafono" color="#ffc72c" label={ts("st.mega")} value={s.megaTurns} />
              <Tile id="annullati" icon="divieto" color="#8e6bd8" label={ts("st.annullati")} value={s.caught} />
              <Tile id="minis" icon="ciak" color="#14a3a1" label={ts("st.minis")} value={s.minis} />
              <Tile id="minifast" icon="fulmine" color="#e8505b" label={ts("st.minifast")} value={s.miniFast} />
              <Tile id="cade" icon="freccia" color="#5b7cfa" label={ts("st.cade")} value={s.cade} sub={pc(s.cadeRate)} />
              <Tile id="noncade" icon="scudo" color="#14a3a1" label={ts("st.noncade")} value={s.noncade} sub={pc(s.noncadeRate)} />
              <Tile id="nulli" icon="mano" color="#ff9f45" label={ts("st.nulli")} value={s.nulli} sub={pc(s.nulliRate)} />
            </div>

            <section className="st-card" data-testid="st-grafici">
              <h3>{t("st.graf.punti")}</h3>
              {s.recent.length ? <><PointsChart games={s.recent} /><p className="st-nota">{ts("st.graf.nota", { n: Math.min(12, s.recent.length) })}</p></> : <p className="st-nota">{t("st.graf.vuoto")}</p>}
              <div className="st-ringrow"><Ring value={s.winRate} color="#ffc72c" /><div><b>{ts("st.vittorie")}</b><span>{s.wins} / {s.games} {ts("st.partite").toLowerCase()}</span></div></div>
            </section>

            <section className="st-card">
              <h3>{t("st.perc")}</h3>
              <Bar icon="bersaglio" label={ts("st.intuito")} value={s.voteRate} color="#e8505b" />
              <Bar icon="freccia" label={ts("st.cade")} value={s.cadeRate} color="#5b7cfa" />
              <Bar icon="scudo" label={ts("st.noncade")} value={s.noncadeRate} color="#14a3a1" />
              <Bar icon="mano" label={ts("st.nulli")} value={s.nulliRate} color="#ff9f45" />
              <Bar icon="ciak" label={ts("st.miniok")} value={s.miniRate} color="#8e6bd8" />
            </section>

            {s.recent.length > 0 && (
              <section className="st-card">
                <h3>{t("st.recenti")}</h3>
                <ul className="st-list" data-testid="st-recenti">
                  {s.recent.slice(0, 8).map((g) => (
                    <li key={g.id} className={g.won ? "won" : ""}><i aria-hidden="true"><GameIcon name={g.rank === 1 ? "coppa" : g.rank === 2 ? "argento" : g.rank === 3 ? "bronzo" : "gioco"} size={24} /></i>
                      <span>{ts("st.riga", { data: fmtDate(g.at), n: g.players, pos: g.rank, punti: g.score })}{g.bots ? ` · ${ts("st.bots")}` : ""}</span></li>
                  ))}
                </ul>
              </section>
            )}

            <section className="st-card" data-testid="st-livelli">
              <h3>{t("st.livelli")}</h3>
              <div className="lv-grid">
                {Array.from({ length: MAX_LEVEL }, (_, i) => i + 1).map((n) => {
                  const done = L ? n <= L.level : false, here = L?.level === n;
                  return (
                    <div key={n} className={`lv${done ? " on" : ""}${here ? " here" : ""}`} style={{ "--tc": TIER_COLORS[tierOf(n)] } as CSSProperties} data-testid={`lv-${n}`}>
                      <i aria-hidden="true"><GameIcon name={ICONS[n - 1]!} size={34} /></i>
                      <b>{n}</b><span>{lvName(n)}</span><small>{here ? ts("st.sei") : ts("st.richiede", { xp: xpFor(n) })}</small>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="st-card">
              <h3>{t("st.come")}</h3>
              <ul className="st-xp">
                <li>{ts("st.xp.partita", { xp: XP.game })}</li><li>{ts("st.xp.podio", { xp: XP.podium })}</li><li>{ts("st.xp.vittoria", { xp: XP.win })}</li>
                <li>{ts("st.xp.punti", { xp: XP.point })}</li><li>{ts("st.xp.voto", { xp: XP.vote })}</li><li>{ts("st.xp.intuito", { xp: XP.voteHit })}</li>
                <li>{ts("st.xp.mega", { xp: XP.mega })}</li><li>{ts("st.xp.segn", { xp: XP.tokenHit })}</li><li>{ts("st.xp.mini", { xp: XP.mini })}</li>
                <li>{ts("st.xp.minigiusto", { xp: XP.miniHit })}</li><li>{ts("st.xp.minifast", { xp: XP.miniFast })}</li>
              </ul>
            </section>
            <p className="st-since">{ts("st.since", { data: fmtDate(s.since) })}</p>
          </>
        )}
        <div className="st-btns">
          <Btn kind="pap" onClick={() => navigate("/")} testId="st-indietro">{t("st.indietro")}</Btn>
          <Btn kind="red" onClick={clear} testId="st-cancella">{ask ? t("st.conferma") : t("st.cancella")}</Btn>
        </div>
      </div>
    </Stage>
  );
}
