/** Installazione come app (PWA) e condivisione del link. */
import { ts } from "./testi.ts";
interface BIPEvent extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> }
let deferred: BIPEvent | null = null;
const subs = new Set<() => void>();
const notify = () => subs.forEach((f) => f());
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferred = e as BIPEvent; notify(); });
  window.addEventListener("appinstalled", () => { deferred = null; notify(); });
}
export const subscribeInstall = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };
export const isStandalone = () => typeof window !== "undefined" && (window.matchMedia?.("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true);
export const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
export const canPromptInstall = () => deferred !== null;
/** Mostra la finestra di installazione del browser. Restituisce false se non disponibile (servono le istruzioni a mano). */
export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false;
  const e = deferred; deferred = null; notify();
  await e.prompt(); await e.userChoice.catch(() => null); return true;
}
/** Condivide il link dell'app: foglio di condivisione del telefono, altrimenti copia negli appunti. */
export async function shareApp(): Promise<"shared" | "copied" | "failed"> {
  const data = { title: ts("share.titolo"), text: ts("share.testo"), url: location.origin + "/" };
  try { if (navigator.share) { await navigator.share(data); return "shared"; } } catch (e) { if ((e as Error).name === "AbortError") return "failed"; }
  try { await navigator.clipboard.writeText(data.url); return "copied"; } catch { return "failed"; }
}
