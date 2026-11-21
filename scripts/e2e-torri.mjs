// Prova della API delle torri degli utenti su un Worker locale (npm run dev): node scripts/e2e-torri.mjs
const B = "http://127.0.0.1:8787", J = (p, b, m = "POST") => fetch(B + p, { method: m, headers: { "content-type": "application/json" }, body: b ? JSON.stringify(b) : undefined }).then(async (r) => ({ s: r.status, j: await r.json().catch(() => null), r }));
const dev = (n) => "dispositivo-" + n + "-aaaaaaaa";
const c = await J("/api/torri", { carte: ["p01-i01", "p01-i02", "p01-i03", "p01-i04"], frase: "chi si ubriacherebbe al matrimonio del cugino.", segnalino: { pos: 1, effetto: "cade" }, votoAutore: 3, durata: "24h" });
console.log("crea", c.s, c.j.id, c.j.eta); const { id, admin } = c.j;
console.log("bloccata", (await J("/api/torri", { carte: ["p01-i01", "p01-i02", "p01-i03"], frase: "ti ammazzo sul serio", segnalino: { pos: 1, effetto: "cade" }, votoAutore: 2, durata: "24h" })).j);
const v1 = await J(`/api/torri/${id}/view?d=${dev(1)}`, null, "GET"); console.log("vista", v1.s, v1.j.stato, v1.j.frase, "mioVoto", v1.j.mioVoto, JSON.stringify(v1.j).includes("votoAutore"));
console.log("vota", (await J(`/api/torri/${id}/vote`, { dev: dev(1), pos: 3 })).j, "ancora", (await J(`/api/torri/${id}/vote`, { dev: dev(1), pos: 2 })).s);
console.log("vota2", (await J(`/api/torri/${id}/vote`, { dev: dev(2), pos: 3 })).j, "nick", (await J(`/api/torri/${id}/nick`, { dev: dev(2), nick: "Giulia" })).j, "nick brutto", (await J(`/api/torri/${id}/nick`, { dev: dev(1), nick: "stronzo" })).j);
const a = await J(`/api/torri/${id}/view?a=${admin}`, null, "GET"); console.log("autore", a.j.autore, a.j.annullabile, a.j.numVoti, "autore vota?", (await J(`/api/torri/${id}/vote`, { dev: dev(9), admin, pos: 1 })).j);
console.log("og", (await J(`/api/torri/${id}/og`, { admin, img: "/9j/4AAQSkZJRg==" })).j, "og pubb", (await fetch(B + `/t/${id}/og.jpg`)).status);
const pag = await fetch(B + `/t/${id}`); const html = await pag.text(); console.log("pagina", pag.status, /og:title" content="Chi butteresti/.test(html), /og:image" content="[^"]*\/t\/\w+\/og\.jpg/.test(html), /riderebbe|ubriacherebbe/.test(html));
console.log("segnala", (await J(`/api/torri/${id}/report`, { dev: dev(5) })).j, "chiudi presto", (await J(`/api/torri/${id}/close`, { admin, motivo: "frase", conferma: "CHIUDI" })).j);
console.log("annulla", (await J(`/api/torri/${id}/cancel`, { admin })).j, (await J(`/api/torri/${id}/view`, null, "GET")).j.stato);
console.log("non esiste", (await J(`/api/torri/zzzzzzzz/view`, null, "GET")).s, "pagina ignota", (await fetch(B + "/t/zzzzzzzz")).status);
