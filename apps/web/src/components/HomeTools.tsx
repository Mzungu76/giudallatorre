import { useEffect, useState } from "react";
import { canPromptInstall, isIOS, isStandalone, promptInstall, shareApp, subscribeInstall } from "../lib/install.ts";

/** Due icone in Home: condividi l'app e installa l'app. */
export default function HomeTools() {
  const [, force] = useState(0), [msg, setMsg] = useState<string | null>(null), [help, setHelp] = useState(false);
  useEffect(() => subscribeInstall(() => force((n) => n + 1)), []);
  const say = (t: string) => { setMsg(t); setTimeout(() => setMsg(null), 2200); };
  const share = async () => { const r = await shareApp(); if (r === "copied") say("Link copiato! Incollalo dove vuoi."); else if (r === "failed") say("Non riesco a condividere: copia il link dalla barra."); };
  const install = async () => { if (!(await promptInstall())) setHelp(true); };
  return (
    <>
      <div className="home-tools">
        <button onClick={share} aria-label="Condividi l'app" title="Condividi l'app" data-testid="share-app">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#13224a" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="M8.6 10.6l6.8-4M8.6 13.4l6.8 4" /></svg>
        </button>
        {!isStandalone() && (
          <button onClick={install} aria-label="Installa l'app" title="Installa l'app" data-testid="install-app" className={canPromptInstall() ? "ready" : ""}>
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#13224a" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12M7 10l5 5 5-5M5 20h14" /></svg>
          </button>
        )}
      </div>
      {msg && <div className="home-msg" role="status" data-testid="home-msg">{msg}</div>}
      {help && (
        <div className="zoom on" onClick={() => setHelp(false)} role="dialog" aria-label="Installa l'app" data-testid="install-help">
          <div className="sheet" style={{ position: "absolute" }}>
            <h3>Installa l'app</h3>
            {isIOS()
              ? <p className="hint" style={{ textAlign: "left", fontSize: 15 }}>Su iPhone/iPad: tocca il tasto <b>Condividi</b> (il quadrato con la freccia) in Safari, poi <b>Aggiungi alla schermata Home</b>.</p>
              : <p className="hint" style={{ textAlign: "left", fontSize: 15 }}>Apri il menu del browser (⋮ in alto a destra) e scegli <b>Installa app</b> oppure <b>Aggiungi a schermata Home</b>.</p>}
            <div className="hint" style={{ textAlign: "center", marginTop: 8 }}>tocca per chiudere</div>
          </div>
        </div>
      )}
    </>
  );
}
