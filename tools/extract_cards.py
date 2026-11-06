"""Estrae le illustrazioni delle carte Personaggio dai PDF originali (senza ricampionare).
Uso: python3 -I tools/extract_cards.py <dir_pdf> <out_dir> <tmp_dir>
Output: public/cards/pNN-iNN.webp (qualità 92) + manifest.json
"""
import sys, subprocess, json, hashlib, re
from pathlib import Path
from PIL import Image
pdfdir, out, tmp = map(Path, sys.argv[1:4])
out.mkdir(parents=True, exist_ok=True); tmp.mkdir(parents=True, exist_ok=True)
manifest, seen = [], {}
for pdf, first in (("Carte personaggi no testo 1-7.pdf", 1), ("Carte personaggi no testo 8-14.pdf", 8)):
    lst = subprocess.run(["pdfimages", "-list", str(pdfdir/pdf)], capture_output=True, text=True).stdout.splitlines()[2:]
    rows = [l.split() for l in lst]
    d = tmp/pdf.replace(" ", "_"); d.mkdir(exist_ok=True)
    subprocess.run(["pdfimages", "-png", str(pdfdir/pdf), str(d/"i")], check=True)
    per_page = {}
    for r in rows:
        if r[2] != "image": continue
        page = first - 1 + int(r[0]); n = per_page.get(page, 0) + 1; per_page[page] = n
        src = d/f"i-{int(r[1]):03d}.png"
        im = Image.open(src).convert("RGB")
        h = hashlib.md5(im.tobytes()).hexdigest()
        cid = f"p{page:02d}-i{n:02d}"
        entry = {"id": cid, "page_in_set": page, "source_pdf": pdf, "size": im.size, "has_smask": False}
        if h in seen:
            entry["duplicate_of"] = seen[h]; manifest.append(entry); continue
        seen[h] = cid
        im.save(out/f"{cid}.webp", quality=92, method=6)
        entry["file"] = f"{cid}.webp"; manifest.append(entry)
json.dump(manifest, open(out/"manifest.json", "w"), indent=1, ensure_ascii=False)
print(len(manifest), "immagini;", sum("file" in m for m in manifest), "uniche esatte")
