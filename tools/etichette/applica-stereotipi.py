#!/usr/bin/env python3
"""Applica il file scaricato dalla pagina (stereotipi-rivisti.json) a content/etichette/{stereotipi,ruoli,aspetto}.json. Poi lanciare `npm test` (test di perimetro)."""
import json, os, sys
R = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
d = json.load(open(sys.argv[1]))
cat = json.load(open(f"{R}/content/etichette/catalogo.json")); T = {t["id"] for t in cat["tipi"]}
ru = json.load(open(f"{R}/content/etichette/ruoli.json")); R_ = {r["id"] for r in ru["ruoli"]}
asp = json.load(open(f"{R}/content/etichette/aspetto.json")); A_ = {a["id"] for a in asp["aspetti"]}
TR = {"ambizioso", "festaiolo", "ribelle", "complottista"}
for v in d["voci"]:
    ok = (v["asse"] == "ruolo" and v["ruolo"] in R_) or (v["asse"] == "aspetto" and v["ruolo"] in A_) or (v["asse"] == "tipo" and v["ruolo"] in TR)
    assert ok and v["tratto"] in T and v["forza"] in (1, 2, 3), f"voce non valida: {v}"
for c, rs in d["ruoli"].items(): assert all(r in R_ for r in rs), (c, rs)
for c, rs in d["aspetto"].items(): assert all(r in A_ for r in rs), (c, rs)
st = json.load(open(f"{R}/content/etichette/stereotipi.json")); st["voci"] = d["voci"]; st["versione"] = st.get("versione", 1) + 1
ru["carte"] = {c: v for c, v in d["ruoli"].items() if v}; ru["carte"]["p14-i01"] = ru["carte"].get("p13-i01", [])
asp["carte"] = {c: v for c, v in d["aspetto"].items() if v}; asp["carte"]["p14-i01"] = asp["carte"].get("p13-i01", [])
for p, o in (("stereotipi", st), ("ruoli", ru), ("aspetto", asp)): json.dump(o, open(f"{R}/content/etichette/{p}.json", "w"), ensure_ascii=False, indent=1)
print(len(st["voci"]), "voci;", len(ru["carte"]), "carte con ruolo;", len(asp["carte"]), "carte con aspetto")
