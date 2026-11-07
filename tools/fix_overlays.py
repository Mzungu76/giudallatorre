"""Ricompone le carte che nel PDF sono fatte di DUE immagini sovrapposte (base + livello con maschera di trasparenza).
L'estrazione diretta (tools/extract_cards.py) ignorava la maschera: i livelli finivano nel mazzo come "carte" nere.
Qui il livello viene composto sulla carta base (stessa risoluzione nativa) e rimosso dal mazzo (manifest: "overlay_of").
Uso: python3 tools/fix_overlays.py   (richiede pdfimages e pdfplumber)"""
import json, subprocess, tempfile, pathlib
import pdfplumber
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "docs/source-materials/originals"
PDFS = (("Carte personaggi no testo 1-7.pdf", 0), ("Carte personaggi no testo 8-14.pdf", 7))
manifest = json.loads((ROOT / "public/cards/manifest.json").read_text())
byid = {m["id"]: m for m in manifest}
pairs = []
with tempfile.TemporaryDirectory() as tmp:
    for pdf, off in PDFS:
        path = SRC / pdf
        listing = subprocess.run(["pdfimages", "-list", str(path)], capture_output=True, text=True, check=True).stdout.splitlines()[2:]
        rows = [l.split() for l in listing]
        with pdfplumber.open(path) as d:
            for pi, pg in enumerate(d.pages, 1):
                ims = pg.images
                cen = [((i["x0"] + i["x1"]) / 2, (i["top"] + i["bottom"]) / 2) for i in ims]
                prow = [r for r in rows if int(r[0]) == pi]
                imgs = [r for r in prow if r[2] == "image"]
                for k in range(len(ims)):
                    for j in range(k):
                        if abs(cen[k][0] - cen[j][0]) < 20 and abs(cen[k][1] - cen[j][1]) < 20:
                            pairs.append((pdf, pi, off, k, j, ims[k], ims[j], imgs[k], imgs[j], prow))
        for pdf2, pi, off, k, j, ok, bj, rk, rj, prow in [p for p in pairs if p[0] == pdf]:
            out = pathlib.Path(tmp) / f"{pi}-{off}"
            out.mkdir(exist_ok=True)
            subprocess.run(["pdfimages", "-png", "-f", str(pi), "-l", str(pi), str(path), str(out / "i")], check=True)
            n = {int(r[1]): r for r in prow}
            num_o, num_b = int(rk[1]), int(rj[1])
            first = min(int(r[1]) for r in prow)
            fo = lambda num: out / f"i-{num - first:03d}.png"
            base = Image.open(fo(num_b)).convert("RGBA")
            ov = Image.open(fo(num_o)).convert("RGBA")
            if (num_o + 1) in n and n[num_o + 1][2] == "smask":
                ov.putalpha(Image.open(fo(num_o + 1)).convert("L"))
            sx = base.width / (bj["x1"] - bj["x0"])
            dx, dy = round((ok["x0"] - bj["x0"]) * sx), round((ok["top"] - bj["top"]) * sx)
            canvas = base.copy(); canvas.alpha_composite(ov, (0, 0)) if (dx, dy) == (0, 0) else None
            if (dx, dy) != (0, 0):
                layer = Image.new("RGBA", base.size, (0, 0, 0, 0)); layer.paste(ov, (dx, dy)); canvas.alpha_composite(layer)
            bid, oid = f"p{pi + off:02d}-i{j + 1:02d}", f"p{pi + off:02d}-i{k + 1:02d}"
            f = byid[bid].get("file") or f"{bid}.webp"
            canvas.convert("RGB").save(ROOT / "public/cards" / f, "WEBP", quality=92)
            byid[oid]["overlay_of"] = bid
            print("composta", oid, "su", bid, "offset px", dx, dy)
manifest = [m for m in manifest]  # i livelli restano nel manifest con "overlay_of" ma NON entrano nel mazzo
(ROOT / "public/cards/manifest.json").write_text(json.dumps(manifest, indent=1, ensure_ascii=False))
