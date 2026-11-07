import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./styles/app.css";
import { loadCards } from "./lib/cards.ts";
import { installCharDiscs } from "./lib/characters.ts";

installCharDiscs();

loadCards().finally(() => createRoot(document.getElementById("root")!).render(<App />));

// PWA: service worker solo in produzione; si aggiorna in silenzio alla visita successiva.
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  addEventListener("load", () => { navigator.serviceWorker.register("/sw.js").catch(() => { /* offline-first facoltativo */ }); });
}
