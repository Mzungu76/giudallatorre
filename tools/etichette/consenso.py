#!/usr/bin/env python3
"""Unisce la passata A con le etichette vecchie e segnala i dubbi.
Uso: python3 tools/etichette/consenso.py   -> scrive content/etichette/frasi.v2.json e revisione.json
Regole di segnalazione (ogni dubbio finisce nella pagina di revisione):
  vuota        : nessun tipo e nessun tema
  tipo-diverso : le etichette vecchie hanno un tipo (vocabolario comune) che la passata A non ha
  tema-diverso : idem per i temi
  solo-tema    : nessun tipo umano (il bot non può riconoscere chi è colpito)
"""
import json, re, sys, os
R = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
cat = json.load(open(f"{R}/content/etichette/catalogo.json"))
T = {t["id"] for t in cat["tipi"]}; M = {t["id"] for t in cat["temi"]}
fr = {p["id"]: p["testo"] for p in json.load(open(f"{R}/content/frasi-megafono.json"))["frasi"]}
old = json.load(open(f"{R}/content/tags-frasi.json"))
def parse(x): m = re.match(r"([a-z]+)(\d)$", x); return (m.group(1), int(m.group(2))) if m else (x, 2)
out = {}; rev = []
for l in open(f"{R}/content/etichette/passate/frasi.A.txt"):
    l = l.strip()
    if not l: continue
    i, t, m = l.split("|")
    tipi = dict(parse(x) for x in t.split()); temi = dict(parse(x) for x in m.split())
    o = old.get("Oggi sale sulla torre " + fr[i]) or old.get("Oggi salgono sulla torre " + fr[i]) or {"tipo": [], "temi": []}
    ot = [x for x in o["tipo"] if x in T]; om = [x for x in o["temi"] if x in M]
    flags = []
    if not tipi and not temi: flags.append("vuota")
    elif not tipi: flags.append("solo-tema")
    if ot and not (set(ot) & set(tipi)): flags.append("tipo-diverso")
    if om and not (set(om) & set(temi)): flags.append("tema-diverso")
    out[i] = {"tipi": tipi, "temi": temi}
    if flags: rev.append({"id": i, "testo": fr[i], "tipi": tipi, "temi": temi, "vecchie": {"tipo": o["tipo"], "temi": o["temi"]}, "motivi": flags, "priorita": len(flags) + (1 if "vuota" in flags else 0)})
json.dump({"versione": 1, "frasi": out}, open(f"{R}/content/etichette/frasi.v2.json", "w"), ensure_ascii=False, separators=(",", ":"))
rev.sort(key=lambda r: -r["priorita"])
json.dump({"versione": 1, "frasi": rev}, open(f"{R}/content/etichette/revisione.frasi.json", "w"), ensure_ascii=False, indent=1)
from collections import Counter
print(len(out), "frasi;", len(rev), "da rivedere;", Counter(f for r in rev for f in r["motivi"]))
print("tipi usati:", len({k for v in out.values() for k in v["tipi"]}), "/", len(T), " temi usati:", len({k for v in out.values() for k in v["temi"]}), "/", len(M))

# ---- carte ----
oldc = json.load(open(f"{R}/content/tags-personaggi.json"))
cards = {}; crev = []
for l in open(f"{R}/content/etichette/passate/carte.A.txt"):
    l = l.strip()
    if not l: continue
    i, t, m = l.split("|")
    tipi = dict(parse(x) for x in t.split()); temi = dict(parse(x) for x in m.split())
    o = oldc.get(i, {"tipo": [], "temi": []})
    ot = [x for x in o["tipo"] if x in T]; om = [x for x in o["temi"] if x in M]
    flags = []
    if not tipi: flags.append("vuota")
    if ot and not (set(ot) & set(tipi)): flags.append("tipo-diverso")
    if om and not (set(om) & set(temi)): flags.append("tema-diverso")
    cards[i] = {"tipi": tipi, "temi": temi}
    if flags: crev.append({"id": i, "tipi": tipi, "temi": temi, "vecchie": o, "motivi": flags, "priorita": len(flags)})
if "p13-i01" in cards: cards["p14-i01"] = cards["p13-i01"]  # duplicato (manifest: duplicate_of)
crev.sort(key=lambda r: -r["priorita"])
json.dump({"versione": 1, "personaggi": cards}, open(f"{R}/content/etichette/personaggi.v2.json", "w"), ensure_ascii=False, separators=(",", ":"))
json.dump({"versione": 1, "personaggi": crev}, open(f"{R}/content/etichette/revisione.personaggi.json", "w"), ensure_ascii=False, indent=1)
print(len(cards), "carte;", len(crev), "da rivedere")
# copertura incrociata: tipi/temi usati su un solo lato
ft = {k for v in out.values() for k in v["tipi"]}; ct = {k for v in cards.values() for k in v["tipi"]}
fm = {k for v in out.values() for k in v["temi"]}; cm = {k for v in cards.values() for k in v["temi"]}
print("tipi solo frasi:", sorted(ft - ct), "| solo carte:", sorted(ct - ft))
print("temi solo frasi:", sorted(fm - cm), "| solo carte:", sorted(cm - fm))
