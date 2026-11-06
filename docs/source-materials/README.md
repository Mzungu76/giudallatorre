# Materiali originali (non modificare)
`originals/` contiene i 4 file forniti, spostati qui senza alterarne il contenuto (verificato con `cmp`).

| File | Contenuto verificato |
|---|---|
| Giù dalla Torre! rev. 5.2l.pdf | Regolamento A4 9 pagine (Canva), versione **precedente** |
| Carte personaggi no testo 1-7.pdf / 8-14.pdf | 14 pagine A4, 125 immagini incorporate a **320×480 px** (~137 ppi sulla pagina; 3 a 267×400): risoluzione nativa bassa, non migliorabile senza ridisegnare. Estrazione diretta con `pdfimages` (nessun ricampionamento) tramite `tools/extract_cards.py` → `public/cards/*.webp` (qualità 92) + `manifest.json` |
| Carte_frasi.docx | 50 carte × 5 frasi, tabella riepilogativa dei 50 temi |

Problemi noti: vedi `docs/RULES_AMBIGUITIES.md` (B2, B3). Le immagini sono identificate da pagina+posizione; non esistono nomi nei PDF.

## Asset derivati (rigenerabili, non sostituiscono gli originali)
- `public/cutouts/*.webp` — personaggi scontornati (`tools/cutout_cards.py`, rembg `isnet-general-use` + pulizia alpha). ~100/124 pulite; **da rivedere/scartare** (scene, non personaggi, o maschera fallita): p03-i03, p04-i06, p06-i02, p08-i07, p08-i08, p08-i09, p08-i10, p14-i03, p14-i04 (usare la carta intera come fallback). Altre con elementi di scena (panchina, cane, poltrona) sono intenzionali.
- `public/scene/tower.webp`, `hands.webp` — torre ritagliata (immagine+smask del PDF) con fusto ripetuto, mani dalla copertina (`tools/build_scene_assets.py`). Materassi e paesaggio ridisegnati in SVG nello stile del regolamento.
