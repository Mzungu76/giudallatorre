import { useEffect, useState } from "react";
import { Stage, Btn, navigate } from "../ui.tsx";
import { t, ts } from "../lib/testi.ts";
import { loadDb, resetStats, summary } from "../lib/stats.ts";

const fmtDate = (ms: number) => new Date(ms).toLocaleDateString("it-IT", { day: "numeric", month: "short", year: "numeric" });
const pc = (x: number | null) => (x === null ? "–" : `${String(x).replace(".", ",")}%`);

function Box({ label, value, sub, id }: { label: string; value: string | number; sub?: string; id: string }) {
  return <div className="st-box" data-testid={`st-${id}`}><b>{value}</b><span>{label}</span>{sub ? <small>{sub}</small> : null}</div>;
}

/** «Le mie statistiche»: numeri personali letti dall'archivio del dispositivo (IndexedDB). Niente passa dal server. */
export default function Stats() {
  const [s, setS] = useState<ReturnType<typeof summary> | null>(null), [ask, setAsk] = useState(false);
  useEffect(() => { void loadDb().then((db) => setS(summary(db))); }, []);
  const clear = async () => { if (!ask) { setAsk(true); return; } await resetStats(); setAsk(false); setS(summary(await loadDb())); };
  return (
    <Stage bg="paper" testId="stats">
      <div className="stats">
        <h2>{t("st.titolo")}</h2>
        <p className="st-nota">{t("st.nota")}</p>
        {s && s.games === 0 && s.minis === 0 && s.megaTurns === 0 && s.votes === 0 && <p className="st-vuoto" data-testid="st-vuoto">{t("st.vuoto")}</p>}
        {s && (
          <>
            <div className="st-grid">
              <Box id="partite" label={ts("st.partite")} value={s.games} />
              <Box id="vittorie" label={ts("st.vittorie")} value={s.wins} sub={pc(s.winRate)} />
              <Box id="podi" label={ts("st.podi")} value={s.podiums} />
              <Box id="punti" label={ts("st.punti")} value={s.points} />
              <Box id="media" label={ts("st.media")} value={s.avg === null ? "–" : String(s.avg).replace(".", ",")} />
              <Box id="record" label={ts("st.record")} value={s.best} />
              <Box id="voti" label={ts("st.voti")} value={s.votes} />
              <Box id="intuito" label={ts("st.intuito")} value={pc(s.voteRate)} />
              <Box id="cadute" label={ts("st.cadute")} value={s.cardFell} />
              <Box id="mega" label={ts("st.mega")} value={s.megaTurns} />
              <Box id="cade" label={ts("st.cade")} value={s.cade} sub={pc(s.cadeRate)} />
              <Box id="noncade" label={ts("st.noncade")} value={s.noncade} sub={pc(s.noncadeRate)} />
              <Box id="nulli" label={ts("st.nulli")} value={s.nulli} sub={pc(s.nulliRate)} />
              <Box id="annullati" label={ts("st.annullati")} value={s.caught} />
              <Box id="minis" label={ts("st.minis")} value={s.minis} />
              <Box id="miniok" label={ts("st.miniok")} value={pc(s.miniRate)} />
              <Box id="minifast" label={ts("st.minifast")} value={s.miniFast} />
            </div>
            {s.recent.length > 0 && (
              <>
                <h3>{t("st.recenti")}</h3>
                <ul className="st-list" data-testid="st-recenti">
                  {s.recent.map((g) => (
                    <li key={g.id} className={g.won ? "won" : ""}>
                      {ts("st.riga", { data: fmtDate(g.at), n: g.players, pos: g.rank, punti: g.score })}{g.won ? ` · ${ts("st.vinta")}` : ""}{g.bots ? ` · ${ts("st.bots")}` : ""}
                    </li>
                  ))}
                </ul>
              </>
            )}
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
