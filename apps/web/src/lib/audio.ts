// Impostazioni audio dell'utente (suoni accesi/spenti e volume della musica), salvate sul dispositivo e condivise da tutte le schermate.
import { useSyncExternalStore } from "react";
const K_SOUND = "gdt.sound", K_VOL = "gdt.volume", DEFAULT_VOLUME = 0.15;
function read(): { sound: boolean; volume: number } {
  try {
    const v = parseFloat(localStorage.getItem(K_VOL) ?? "");
    return { sound: localStorage.getItem(K_SOUND) !== "0", volume: Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : DEFAULT_VOLUME };
  } catch { return { sound: true, volume: DEFAULT_VOLUME }; }
}
let state = read();
const subs = new Set<() => void>();
function set(next: Partial<typeof state>) {
  state = { ...state, ...next };
  try { localStorage.setItem(K_SOUND, state.sound ? "1" : "0"); if (next.volume !== undefined) localStorage.setItem(K_VOL, String(state.volume)); } catch { /* */ }
  subs.forEach((f) => f());
}
const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };
export function useAudio() {
  const s = useSyncExternalStore(subscribe, () => state);
  return { sound: s.sound, volume: s.volume, setSound: (v: boolean) => set({ sound: v }), setVolume: (v: number) => set({ volume: v }) };
}
