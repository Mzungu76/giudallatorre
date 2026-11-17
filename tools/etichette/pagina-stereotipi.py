#!/usr/bin/env python3
"""Genera la pagina di revisione (HTML autonomo) di ruoli, aspetto e luoghi comuni: il proprietario modifica e scarica `stereotipi-rivisti.json`,
poi `python3 tools/etichette/applica-stereotipi.py stereotipi-rivisti.json` lo applica ai file in content/etichette/.
Uso: python3 tools/etichette/pagina-stereotipi.py USCITA.html"""
import json, os, sys, base64, io
from PIL import Image
R = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
J = lambda p: json.load(open(f"{R}/{p}"))
cat, st, ru, asp, card = J("content/etichette/catalogo.json"), J("content/etichette/stereotipi.json"), J("content/etichette/ruoli.json"), J("content/etichette/aspetto.json"), J("content/etichette/personaggi.v2.json")["personaggi"]
ids = [c for c in card if c != "p14-i01" and os.path.exists(f"{R}/public/cards/{c}.webp")]
img = {}
for i in ids:
    im = Image.open(f"{R}/public/cards/{i}.webp").convert("RGB"); im.thumbnail((150, 225)); b = io.BytesIO(); im.save(b, "JPEG", quality=66); img[i] = "data:image/jpeg;base64," + base64.b64encode(b.getvalue()).decode()
data = {
  "tipi": [t["id"] for t in cat["tipi"]], "ruoli": [{"id": r["id"], "def": r["def"]} for r in ru["ruoli"]], "aspetti": [{"id": a["id"], "nome": a["nome"], "def": a["def"]} for a in asp["aspetti"]],
  "tipiRuolo": ["ambizioso", "festaiolo", "ribelle", "complottista"], "voci": st["voci"],
  "carte": [{"id": c, "tipi": card[c]["tipi"], "temi": card[c]["temi"], "ruoli": ru["carte"].get(c, []), "aspetto": asp["carte"].get(c, []), "img": img[c]} for c in ids],
}
html = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "pagina-stereotipi.html")).read().replace("__DATI__", json.dumps(data, ensure_ascii=False))
open(sys.argv[1], "w").write(html); print(len(html) // 1024, "KB;", len(data["voci"]), "voci;", len(ids), "carte")
