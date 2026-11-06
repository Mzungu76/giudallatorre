"""Ricava dal regolamento (copia in docs/source-materials/originals) gli asset di scena:
 - tower.webp : torre ritagliata (immagine + smask), corona + fusto ripetuto + base, bordi ripuliti, upscale 1.5x
 - hands.webp : banda di mani alzate dalla copertina
Uso: python3 tools/build_scene_assets.py <dir_estratta_con_pdfimages> public/scene"""
import sys, numpy as np
from pathlib import Path
from PIL import Image, ImageFilter
from scipy import ndimage as ndi
ex, out = Path(sys.argv[1]), Path(sys.argv[2]); out.mkdir(parents=True, exist_ok=True)
im = Image.open(ex/"i-156.png").convert("RGB"); m = Image.open(ex/"i-157.png").convert("L")
t = im.copy(); t.putalpha(m); t = t.crop(m.point(lambda v: 255 if v > 20 else 0).getbbox())
W, H = t.size; top, per, N = 125, 130, 9
seg = t.crop((0, top, W, top+per)); rest = t.crop((0, top+per, W, H))
o = Image.new("RGBA", (W, top+per*N+rest.height)); y = 0
o.paste(t.crop((0, 0, W, top)), (0, 0)); y = top
for _ in range(N): o.paste(seg, (0, y)); y += per
o.paste(rest, (0, y))
a = np.asarray(o.getchannel("A")).astype(float); Hh, Ww = a.shape; xs = np.arange(Ww)[None, :]
for side in "rl":
    e = np.array([(np.where(a[r] > 128)[0].max() if side == "r" else np.where(a[r] > 128)[0].min()) if (a[r] > 128).any() else (Ww if side == "l" else 0) for r in range(Hh)], float)
    s = ndi.uniform_filter1d(ndi.median_filter(e, size=61), size=41)
    a = np.where(xs > s[:, None]+1.5, 0, a) if side == "r" else np.where(xs < s[:, None]-1.5, 0, a)
o.putalpha(Image.fromarray(a.astype("uint8")))
o = o.resize((int(o.width*1.5), int(o.height*1.5)), Image.LANCZOS).filter(ImageFilter.UnsharpMask(1.2, 60, 2))
o.save(out/"tower.webp", quality=95, method=6)
cov = Image.open(ex/"i-000.png").convert("RGB").crop((0, 655, 533, 800)); cov.save(out/"hands.webp", quality=93, method=6)
print(o.size, cov.size)

# ---- versione "pop" della torre: colori più spinti, contorno inchiostro, mezzatinta sul lato in ombra
from PIL import ImageEnhance
t = Image.open(out/"tower.webp").convert("RGBA")
rgb = ImageEnhance.Color(ImageEnhance.Contrast(t.convert("RGB")).enhance(1.12)).enhance(1.3)
A = np.asarray(t.getchannel("A")) > 128
H2, W2 = A.shape
yy, xx = np.mgrid[0:H2, 0:W2]
g = np.clip((xx/W2 - .52)/.42, 0, 1)                      # 0 a sinistra, 1 sul bordo destro
u = (xx*0.7071 + yy*0.7071) % 7.0 - 3.5; v = (xx*0.7071 - yy*0.7071) % 7.0 - 3.5
dots = (np.hypot(u, v) < 3.4*g**0.8) & A
arr = np.asarray(rgb).astype(float)
navy = np.array([19, 34, 74], float)
arr[dots] = arr[dots]*0.35 + navy*0.65
pad = 8
base = Image.new("RGBA", (W2+2*pad, H2+2*pad), (0, 0, 0, 0))
ring = ndi.binary_dilation(np.pad(A, pad), iterations=5)
ol = np.zeros(ring.shape+(4,), "uint8"); ol[ring] = (*navy.astype("uint8"), 255)
base = Image.alpha_composite(base, Image.fromarray(ol, "RGBA"))
fg = Image.fromarray(arr.astype("uint8"), "RGB").convert("RGBA"); fg.putalpha(t.getchannel("A"))
base.alpha_composite(fg, (pad, pad))
base.save(out/"tower_pop.webp", quality=94, method=6); print("tower_pop", base.size)
