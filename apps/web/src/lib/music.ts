// Musica di sottofondo: un loop da file MP3 in public/audio/, con dissolvenza in entrata e in uscita.
// Il browser blocca l'audio finché l'utente non tocca la pagina: se parte troppo presto, riprova al primo tocco.
let el: HTMLAudioElement | null = null, key = "", timer = 0, duckTimer = 0, wanted = false, armed = false, base = 0.15;

function fadeTo(target: number, ms = 1200, then?: () => void) {
  window.clearInterval(timer);
  if (!el) return;
  const a = el, from = a.volume, n = Math.max(1, Math.round(ms / 50));
  let i = 0;
  timer = window.setInterval(() => {
    i++; a.volume = Math.min(1, Math.max(0, from + (target - from) * (i / n)));
    if (i >= n) { window.clearInterval(timer); then?.(); }
  }, 50);
}
// Finché la musica non suona davvero, ogni tocco/tasto dell'utente riprova a farla partire (e il listener resta attivo se fallisce).
const EVENTS = ["pointerup", "touchend", "click", "keydown"] as const;
function retryOnTouch() {
  if (armed) return; armed = true;
  const go = () => {
    if (!wanted || !el) return;
    void el.play().then(() => { fadeTo(base); armed = false; EVENTS.forEach((e) => document.removeEventListener(e, go, true)); }).catch(() => undefined);
  };
  EVENTS.forEach((e) => document.addEventListener(e, go, true));
}
export const music = {
  /** Fa suonare (o tace) il brano `file` (es. "musica-tema.mp3"). Chiamarla più volte con gli stessi valori non fa nulla. */
  play(file: string | null) {
    try {
      wanted = file !== null;
      if (file === null) { fadeTo(0, 800, () => { if (!wanted) el?.pause(); }); return; }
      if (!el || key !== file) {
        el?.pause();
        el = new Audio(`/audio/${file}`); el.loop = true; el.preload = "auto"; el.volume = 0; key = file;
      }
      retryOnTouch(); // rete di sicurezza: se il browser blocca o ritarda l'avvio, il primo tocco la fa partire
      void el.play().then(() => { if (wanted) fadeTo(base); }).catch(() => undefined);
    } catch { /* audio non disponibile: l'app funziona lo stesso */ }
  },
  /** Volume della musica (0–1), scelto dall'utente. */
  level(v: number) { base = v; if (wanted && el && !el.paused) fadeTo(base, 800); },
  /** Abbassa un attimo la musica mentre suona un effetto importante, poi la riporta su. */
  duck(ms: number) {
    if (!wanted || !el || el.paused) return;
    window.clearTimeout(duckTimer);
    fadeTo(base * 0.3, 150);
    duckTimer = window.setTimeout(() => fadeTo(base, 700), ms);
  },
};
