/** Le Torri del giorno sono pronte con qualche giorno di anticipo ma si pubblicano alle 00:01 di Roma: prima di allora né l'elenco né il file del giorno si vedono. */
export const romeDay = (ms: number) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(new Date(ms));
export async function torreDelGiorno(request: Request, env: { ASSETS: { fetch: (r: Request) => Promise<Response> } }, path: string, now: number): Promise<Response> {
  const oggi = romeDay(now - 60_000), nome = path.slice("/oggi/".length), data = nome.match(/^(\d{4}-\d{2}-\d{2})\.json$/)?.[1];
  if (data && data > oggi) return new Response("not found", { status: 404, headers: { "cache-control": "no-store" } });
  const res = await env.ASSETS.fetch(request);
  if (nome === "indice.json" && res.ok) {
    const idx = await res.json() as { date: string[] };
    return new Response(JSON.stringify({ ...idx, date: idx.date.filter((d) => d <= oggi) }), { headers: { "content-type": "application/json", "cache-control": "no-store" } });
  }
  const out = new Response(res.body, res); out.headers.set("cache-control", data ? "public, max-age=3600" : "public, max-age=86400"); return out;
}

