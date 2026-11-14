// Musica di sottofondo: un loop da file MP3 in public/audio/, con dissolvenza in entrata e in uscita.
// Il browser blocca l'audio finché l'utente non tocca la pagina: se parte troppo presto, riprova al primo tocco.
const VOL = 0.35, STEP_MS = 50, FADE_MS = 1200;
let el: HTMLAudioElement | null = null, key = "", timer = 0, wanted = false, armed = false;

function fadeTo(target: number, then?: () => void) {
  window.clearInterval(timer);
  if (!el) return;
  const a = el, from = a.volume, n = Math.max(1, Math.round(FADE_MS / STEP_MS));
  let i = 0;
  timer = window.setInterval(() => {
    i++; a.volume = Math.min(1, Math.max(0, from + (target - from) * (i / n)));
    if (i >= n) { window.clearInterval(timer); then?.(); }
  }, STEP_MS);
}
function retryOnTouch() {
  if (armed) return; armed = true;
  const go = () => { armed = false; window.removeEventListener("pointerdown", go); if (wanted && el) void el.play().catch(() => undefined); };
  window.addEventListener("pointerdown", go, { once: true });
}
export const music = {
  /** Fa suonare (o tace) il brano `file` (es. "musica-tema.mp3"). Chiamarla più volte con gli stessi valori non fa nulla. */
  play(file: string | null) {
    try {
      wanted = file !== null;
      if (file === null) { fadeTo(0, () => { el?.pause(); }); return; }
      if (!el || key !== file) {
        el?.pause();
        el = new Audio(`/audio/${file}`); el.loop = true; el.preload = "auto"; el.volume = 0; key = file;
      }
      void el.play().then(() => fadeTo(VOL)).catch(() => retryOnTouch());
      if (el.volume === 0 && !el.paused) fadeTo(VOL);
    } catch { /* audio non disponibile: l'app funziona lo stesso */ }
  },
};
