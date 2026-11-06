import type { ClientMessage, ServerMessage } from "@gdt/game-protocol";

export type SocketStatus = "connecting" | "open" | "reconnecting" | "closed" | "kicked" | "invalid";
export interface SocketOptions { code: string; token?: string; watch?: boolean; onMessage: (m: ServerMessage) => void; onStatus: (s: SocketStatus) => void }
const FATAL: Record<number, SocketStatus> = { 4001: "invalid", 4003: "kicked", 4004: "closed" };

/** WebSocket con riconnessione automatica (backoff), ping gratuito ogni 25 s e autenticazione con token. */
export class RoomSocket {
  private ws: WebSocket | null = null; private attempt = 0; private stopped = false; private timer = 0; private pingTimer = 0;
  constructor(private o: SocketOptions) {}
  start() { this.stopped = false; this.open(); window.addEventListener("online", this.onOnline); document.addEventListener("visibilitychange", this.onVisible); }
  stop() { this.stopped = true; clearTimeout(this.timer); clearInterval(this.pingTimer); window.removeEventListener("online", this.onOnline); document.removeEventListener("visibilitychange", this.onVisible); this.ws?.close(); this.ws = null; }
  send(m: ClientMessage) { if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(m)); }
  private onOnline = () => { if (!this.stopped && this.ws?.readyState !== WebSocket.OPEN) { clearTimeout(this.timer); this.open(); } };
  private onVisible = () => { if (!document.hidden) this.onOnline(); };
  private open() {
    this.o.onStatus(this.attempt === 0 ? "connecting" : "reconnecting");
    const proto = location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket(`${proto}://${location.host}/ws/${this.o.code}`); this.ws = ws;
    ws.onopen = () => {
      this.attempt = 0; ws.send(JSON.stringify(this.o.watch ? { t: "watch" } : { t: "hello", token: this.o.token }));
      this.o.onStatus("open"); clearInterval(this.pingTimer);
      this.pingTimer = window.setInterval(() => { if (ws.readyState === WebSocket.OPEN) ws.send('{"t":"ping"}'); }, 25_000);
    };
    ws.onmessage = (e) => { try { const m = JSON.parse(String(e.data)) as ServerMessage; if (m.t === "pong") return; if (m.t === "kicked") this.o.onStatus("kicked"); this.o.onMessage(m); } catch { /* messaggio non valido: ignorato */ } };
    ws.onclose = (e) => {
      clearInterval(this.pingTimer);
      if (this.stopped || this.ws !== ws) return;
      const fatal = FATAL[e.code]; if (fatal) { this.o.onStatus(fatal); this.stopped = true; return; }
      if (e.code === 4002) { this.o.onStatus("closed"); this.stopped = true; return; } // aperta altrove
      this.attempt++; this.o.onStatus("reconnecting");
      this.timer = window.setTimeout(() => this.open(), Math.min(8000, 400 * 2 ** Math.min(this.attempt, 5)) + Math.random() * 300);
    };
  }
}
