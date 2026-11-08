// Service worker: apre offline solo i contenuti statici. Il gioco richiede Internet (nessuna partita offline).
const CACHE = "gdt-static-v4";
const SHELL = ["/", "/manifest.webmanifest", "/icons/icon-192.png"];
self.addEventListener("install", (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", (e) => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin || url.pathname.startsWith("/api/") || url.pathname.startsWith("/ws/") || url.pathname === "/testi.json" || url.pathname === "/testi.html") return; // API, WebSocket e testi: sempre rete (i testi li legge l'app all'apertura)
  if (req.mode === "navigate") { e.respondWith(fetch(req).catch(() => caches.match("/"))); return; }
  // asset statici: dalla cache, aggiornati in background (stale-while-revalidate)
  e.respondWith(caches.open(CACHE).then(async (c) => {
    const hit = await c.match(req);
    const net = fetch(req).then((r) => { if (r.ok) c.put(req, r.clone()); return r; }).catch(() => hit);
    return hit ?? net;
  }));
});
