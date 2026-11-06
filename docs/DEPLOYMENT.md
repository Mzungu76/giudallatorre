# PUBBLICAZIONE (costo zero)

Un solo Worker Cloudflare serve app statica, API e WebSocket; ogni stanza è un Durable Object con SQLite. **Non serve alcuna carta di credito e non si attiva alcun piano a pagamento.** Se le quote gratuite finiscono le richieste falliscono, senza addebiti.

## Cosa deve fare l'utente (io non ho accesso al tuo account Cloudflare)
1. **Account Cloudflare gratuito**: registrazione su dash.cloudflare.com con la sola email. Non aggiungere metodi di pagamento.
2. **Sottodominio workers.dev**: *Workers & Pages* → *Overview* → imposta il sottodominio dell'account (gratuito). L'app sarà su `https://giu-dalla-torre.<sottodominio>.workers.dev`.
3. **Token API**: *My Profile* → *API Tokens* → *Create Token* → modello **Edit Cloudflare Workers** → limita al tuo account. Copia il token (si vede una volta sola).
4. **Account ID**: nella pagina *Workers & Pages* (colonna destra).
5. **Segreti su GitHub**: repository → *Settings* → *Secrets and variables* → *Actions* → aggiungi `CLOUDFLARE_API_TOKEN` e `CLOUDFLARE_ACCOUNT_ID`. Non incollarli in chat né nel repository.
6. **Merge su `main`**: la PR (dopo la tua approvazione) fa partire CI (typecheck, test, prova end-to-end) e, se i segreti ci sono, il deploy.
7. **Verifica**: apri `https://giu-dalla-torre.<sottodominio>.workers.dev/api/health` → `{"ok":true}`.
8. **Facoltativo ma consigliato**: in *Notifications* attiva gli avvisi di utilizzo gratuiti.

## Locale
```bash
npm install
npm test            # unit test (motore, protocollo, stanza)
npm run e2e         # Worker reale in locale + WebSocket
npm run dev         # wrangler dev su http://localhost:8787
```
Ambienti: sviluppo = `wrangler dev` (stato in `.wrangler/`, ignorato da git); produzione = `wrangler deploy` dal CI su `main`.
