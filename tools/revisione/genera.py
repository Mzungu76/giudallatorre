#!/usr/bin/env python3
"""Genera le pagine HTML di revisione in docs/revisione/ (frasi del Megafono, carte/ruoli/tag/luoghi comuni, testi delle statistiche finali).
Ogni pagina è un file solo, funziona offline (immagini incluse), salva le modifiche nel browser e le esporta in JSON.
Uso: python3 tools/revisione/genera.py"""
import base64, html, io, json, os, re
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
C = lambda *p: os.path.join(ROOT, 'content', *p)
J = lambda path: json.load(open(path, encoding='utf-8'))
OUT = os.path.join(ROOT, 'docs', 'revisione')
os.makedirs(OUT, exist_ok=True)
esc = html.escape

CSS = '''
:root{--navy:#13224a;--red:#e8362b;--mus:#ffc72c;--bg:#f2efe8}
*{box-sizing:border-box}body{margin:0;background:var(--bg);font:15px/1.4 system-ui,sans-serif;color:var(--navy)}
header{position:sticky;top:0;z-index:9;background:var(--navy);color:#fff;padding:8px 14px;display:flex;gap:10px;align-items:center;flex-wrap:wrap}
header h1{font-size:17px;margin:0;flex:1;min-width:180px}header span{font-size:13px;opacity:.85}
button{background:var(--mus);color:var(--navy);border:0;border-radius:8px;padding:7px 12px;font-weight:700;cursor:pointer}button.alt{background:#fff}
input.cerca{padding:6px 10px;border-radius:8px;border:0;min-width:160px}
main{max-width:1100px;margin:0 auto;padding:10px 14px 80px}
section{background:#fff;border:2px solid var(--navy);border-radius:12px;padding:8px 14px;margin:14px 0}
h2{margin:2px 0;font-size:18px}h2 small{opacity:.6;font-weight:400}.d{margin:2px 0 8px;font-size:13px;opacity:.78}
.r{border-top:1px dashed #13224a33;padding:7px 0;display:grid;gap:4px 10px;grid-template-columns:1fr}
.r.mod{background:#fff8f6;box-shadow:inset 3px 0 0 var(--red)}.r.nascosto{display:none}
.m{display:flex;gap:8px;flex-wrap:wrap;align-items:baseline;font-size:12px}code{background:#eef1f7;padding:1px 6px;border-radius:5px}.m b{color:var(--red)}.m i{opacity:.65}
textarea,input[type=text],select{width:100%;font:inherit;padding:5px 8px;border:2px solid #c9cfdd;border-radius:8px}textarea{resize:vertical}
label.l{font-size:11px;font-weight:700;opacity:.7;display:block;margin:2px 0 1px;text-transform:uppercase;letter-spacing:.04em}
.w{color:#b00020;font-size:12px;min-height:0}.note{background:#fff7d6;border:2px solid var(--mus);border-radius:10px;padding:8px 12px;font-size:13px;margin:10px 0}
.f2{display:grid;grid-template-columns:1fr 1fr;gap:6px 10px}.f3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px 10px}
.card{display:grid;grid-template-columns:76px 1fr;gap:10px;align-items:start}.card img{width:72px;border:2px solid var(--navy);border-radius:6px}
@media(max-width:640px){.f2,.f3{grid-template-columns:1fr}}
table{border-collapse:collapse;width:100%;font-size:13px}td,th{border-top:1px solid #13224a22;padding:3px 6px;text-align:left}
'''

# Il motore comune: ogni campo modificabile è un .f con data-id (riga) e data-f (campo); l'esportazione contiene solo i campi cambiati.
JS = '''
const LS='gdt.rev.'+PAGINA, saved=(()=>{try{return JSON.parse(localStorage.getItem(LS)||'{}')}catch(e){return {}}})();
const campi=[...document.querySelectorAll('.f')];
function val(el){return el.type==='checkbox'?(el.checked?'1':''):el.value}
function setv(el,v){if(el.type==='checkbox')el.checked=v==='1';else el.value=v}
function tagWarn(el){ // controlla «tipo:peso, tipo:peso» contro il catalogo
  const kind=el.dataset.tags; if(!kind||typeof CAT==='undefined')return '';
  const ok=new Set(CAT[kind]),out=[];const parts=el.value.split(',').map(s=>s.trim()).filter(Boolean);
  for(const p of parts){const [t,w]=p.split(':').map(s=>s.trim());if(!ok.has(t))out.push('«'+t+'» non è nel catalogo');else if(w!==undefined&&!/^[123]$/.test(w))out.push('peso di «'+t+'» deve essere 1, 2 o 3');}
  const max=kind==='tipi'?3:6;if(parts.length>max)out.push('al massimo '+max+' '+kind);
  return out.join('; ');
}
function lista(el){const k=el.dataset.lista;if(!k||typeof LISTE==='undefined')return '';const ok=new Set(LISTE[k]);const bad=el.value.split(',').map(s=>s.trim()).filter(Boolean).filter(x=>!ok.has(x));return bad.length?'non valido: '+bad.join(', '):''}
function segn(s){return (s.match(/\\{[A-Za-z0-9_]+\\}/g)||[]).sort().join(',')}
function agg(){
  const mod={};let n=0;
  document.querySelectorAll('.r').forEach(r=>{let m=false;const w=[];
    r.querySelectorAll('.f').forEach(el=>{const v=val(el),o=el.dataset.o,ch=v!==o;if(ch){m=true;(mod[r.dataset.id]??={})[el.dataset.f]=v}
      if(el.dataset.tags){const x=tagWarn(el);if(x)w.push(x)}if(el.dataset.lista){const x=lista(el);if(x)w.push(x)}
      if(el.dataset.segn!==undefined&&segn(v)!==el.dataset.segn)w.push('le parole tra graffe devono restare ('+el.dataset.segn+')')});
    r.classList.toggle('mod',m);if(m)n++;const wl=r.querySelector('.w');if(wl)wl.textContent=w.join(' · ')});
  document.getElementById('cnt').textContent=n+' righe modificate';
  try{localStorage.setItem(LS,JSON.stringify(mod))}catch(e){}return mod;
}
document.querySelectorAll('.r').forEach(r=>{r.querySelectorAll('.f').forEach(el=>{const s=(saved[r.dataset.id]||{})[el.dataset.f];if(s!==undefined)setv(el,s);el.addEventListener('input',agg);el.addEventListener('change',agg)})});
const extra=()=>typeof ESTRA==='function'?ESTRA():{};
const json=()=>JSON.stringify(Object.assign({tipo:PAGINA,versione_base:VERSIONE,modifiche:agg()},extra()),null,1);
function scarica(){const b=new Blob([json()],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='revisione-'+PAGINA+'.json';a.click()}
function copia(){navigator.clipboard.writeText(json()).then(()=>alert('Copiato. Incollalo nella chat.'),()=>prompt('Copia da qui:',json()))}
function azzera(){if(confirm('Annullo tutte le modifiche?')){document.querySelectorAll('.f').forEach(el=>setv(el,el.dataset.o));agg();if(typeof AZZERA==='function')AZZERA()}}
document.getElementById('cerca').addEventListener('input',e=>{const q=e.target.value.trim().toLowerCase();document.querySelectorAll('.r').forEach(r=>r.classList.toggle('nascosto',!!q&&!(r.dataset.s||'').includes(q)))});
agg();
'''


def pagina(nome, titolo, intro, corpo, versione, extra_js='', extra_data=''):
    return f'''<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{esc(titolo)} · Giù dalla Torre</title><style>{CSS}</style></head><body>
<header><h1>{esc(titolo)}</h1><span id="cnt">0 righe modificate</span><input class="cerca" id="cerca" placeholder="Cerca…"><button onclick="scarica()">Scarica JSON</button><button class="alt" onclick="copia()">Copia JSON</button><button class="alt" onclick="azzera()">Annulla tutto</button></header>
<main><div class="note">{intro}<br><b>Come si usa:</b> modifica le caselle (le righe cambiate si colorano di rosso), usa «Cerca» per filtrare, poi «Scarica JSON» o «Copia JSON» e mandamelo. Le modifiche restano salvate in questo browser anche se chiudi la pagina. Nel JSON ci sono solo i campi cambiati.</div>
{corpo}</main><script>const PAGINA={json.dumps(nome)},VERSIONE={json.dumps(versione)};{extra_data}{JS}{extra_js}</script></body></html>'''


def riga(id_, s, contenuto, meta=''):
    return f'<div class="r" data-id="{esc(id_)}" data-s="{esc(s.lower())}">{meta}{contenuto}<div class="w"></div></div>'


def campo(id_, f, v, tipo='text', rows=2, extra='', opzioni=None, label=None):
    o = esc(str(v))
    lab = f'<label class="l">{esc(label)}</label>' if label else ''
    if opzioni is not None:
        ops = ''.join(f'<option value="{esc(x)}"{" selected" if x == v else ""}>{esc(x)}</option>' for x in opzioni)
        return f'<div>{lab}<select class="f" data-f="{f}" data-o="{o}">{ops}</select></div>'
    if tipo == 'area':
        return f'<div>{lab}<textarea class="f" data-f="{f}" data-o="{o}" rows="{rows}" {extra}>{o}</textarea></div>'
    if tipo == 'check':
        return f'<div>{lab}<input class="f" type="checkbox" data-f="{f}" data-o="{"1" if v else ""}" {"checked" if v else ""}></div>'
    return f'<div>{lab}<input class="f" type="text" data-f="{f}" data-o="{o}" value="{o}" {extra}></div>'


def pesi(d):
    return ', '.join(f'{k}:{v}' for k, v in d.items())


# =========================================================== 1. FRASI DEL MEGAFONO
def frasi():
    fr = J(C('frasi-megafono.json')); v2 = J(C('etichette', 'frasi.v2.json'))['frasi']; ac = J(C('etichette', 'accuse.json'))['accuse']
    cat = J(C('etichette', 'catalogo.json')); conf = J(C('confessioni.json'))
    fam = sorted({f['famiglia'] for f in fr['frasi']}); eta = sorted({f['eta'] for f in fr['frasi']} | {c['eta'] for c in conf['confessioni']}); stato = sorted({f['stato'] for f in fr['frasi']} | {c['stato'] for c in conf['confessioni']})
    corpo = '<section><h2>Frasi del Megafono <small>(%d)</small></h2><p class="d">Ogni riga: il testo (senza «Oggi sale/salgono sulla torre»), i <b>tag</b> che usano i bot e le statistiche, e l\'<b>accusa</b> al plurale che compare nei luoghi comuni («Gli influencer + accusa»).</p>' % len(fr['frasi'])
    for f in fr['frasi']:
        t = v2.get(f['id'], {'tipi': {}, 'temi': {}})
        meta = f'<div class="m"><code>{f["id"]}</code><i>«Oggi {f["verbo"]} sulla torre …»</i></div>'
        c = (campo(f['id'], 'testo', f['testo'].rstrip('.'), 'area', 1, label='Testo (senza punto finale)')
             + '<div class="f2">' + campo(f['id'], 'tipi', pesi(t['tipi']), extra='data-tags="tipi"', label='Tipi (difetti/qualità) tipo:peso')
             + campo(f['id'], 'temi', pesi(t['temi']), extra='data-tags="temi"', label='Temi tema:peso') + '</div>'
             + campo(f['id'], 'accusa', ac.get(f['id'], ''), 'area', 1, label='Accusa al plurale («Gli influencer» + …)')
             + '<div class="f3">' + campo(f['id'], 'famiglia', f['famiglia'], opzioni=fam, label='Famiglia') + campo(f['id'], 'eta', f['eta'], opzioni=eta, label='Età') + campo(f['id'], 'stato', f['stato'], opzioni=stato, label='Stato') + '</div>')
        corpo += riga(f['id'], f['id'] + ' ' + f['testo'] + ' ' + pesi(t['tipi']) + ' ' + pesi(t['temi']) + ' ' + ac.get(f['id'], '') + ' ' + f['famiglia'], c, meta)
    corpo += '</section>'
    corpo += '<section><h2>Confessioni «Ammetto…» <small>(%d)</small></h2><p class="d"><b>Attenzione:</b> le confessioni non hanno tag né accusa. Per i bot e per i luoghi comuni di fine partita non producono nulla (restano solo nel Pregiudiziometro). Qui puoi correggere solo il testo, l\'età e lo stato.</p>' % len(conf['confessioni'])
    for cf in conf['confessioni']:
        meta = f'<div class="m"><code>{cf["id"]}</code></div>'
        c = campo(cf['id'], 'testo', cf['testo'], 'area', 2, label='Testo') + '<div class="f2">' + campo(cf['id'], 'eta', cf['eta'], opzioni=eta, label='Età') + campo(cf['id'], 'stato', cf['stato'], opzioni=stato, label='Stato') + '</div>'
        corpo += riga(cf['id'], cf['id'] + ' ' + cf['testo'], c, meta)
    corpo += '</section>'
    data = 'const CAT=' + json.dumps({'tipi': [t['id'] for t in cat['tipi']], 'temi': [t['id'] for t in cat['temi']]}) + ';'
    intro = f'Tutte le frasi del Megafono ({len(fr["frasi"])}) con i tag usati dai bot e le accuse delle statistiche, più le {len(conf["confessioni"])} confessioni. I tag si scrivono come <code>bugiardo:3, ipocrita:2</code> (peso 1 = marginale, 3 = centrale; massimo 3 tipi e 6 temi). I tipi e i temi validi sono nel catalogo (pagina «Carte, ruoli e tag»): se ne scrivi uno che non esiste compare un avviso.'
    open(os.path.join(OUT, 'frasi-megafono.html'), 'w', encoding='utf-8').write(pagina('frasi', 'Revisione frasi del Megafono', intro, corpo, fr.get('versione'), '', data))
    return len(fr['frasi']), len(conf['confessioni'])


# =========================================================== 2. CARTE, RUOLI, TAG, LUOGHI COMUNI
def miniatura(cid):
    p = os.path.join(ROOT, 'public', 'cards', cid + '.webp')
    if not os.path.exists(p):
        return ''
    im = Image.open(p).convert('RGB'); im.thumbnail((72, 108)); b = io.BytesIO(); im.save(b, 'WEBP', quality=62)
    return 'data:image/webp;base64,' + base64.b64encode(b.getvalue()).decode()


def carte():
    pv = J(C('etichette', 'personaggi.v2.json'))['personaggi']; ru = J(C('etichette', 'ruoli.json')); asp = J(C('etichette', 'aspetto.json'))
    cat = J(C('etichette', 'catalogo.json')); st = J(C('etichette', 'stereotipi.json')); man = {m['id']: m for m in J(os.path.join(ROOT, 'public', 'cards', 'manifest.json'))}
    ids = sorted(set(pv) | set(ru['carte']) | set(asp['carte']))
    ruoli_id = [r['id'] for r in ru['ruoli']]; asp_id = [a['id'] for a in asp['aspetti']]
    corpo = '<section><h2>Carte personaggio <small>(%d)</small></h2><p class="d">Per ogni carta: i <b>tipi</b> e i <b>temi</b> (con peso) che usano i bot, i <b>ruoli</b> (mestiere o categoria: danno il luogo comune di fine partita) e gli <b>aspetti</b> (cosa si vede: cravatta, occhiali…).</p>' % len(ids)
    for cid in ids:
        t = pv.get(cid, {'tipi': {}, 'temi': {}}); ro = ru['carte'].get(cid, []); a = asp['carte'].get(cid, [])
        img = miniatura(cid)
        meta = f'<div class="m"><code>{cid}</code></div>'
        c = ((f'<div class="card"><img src="{img}" alt="">' if img else '<div class="card"><div></div>') + '<div>'
             + '<div class="f2">' + campo(cid, 'tipi', pesi(t['tipi']), extra='data-tags="tipi"', label='Tipi tipo:peso') + campo(cid, 'temi', pesi(t['temi']), extra='data-tags="temi"', label='Temi tema:peso') + '</div>'
             + '<div class="f2">' + campo(cid, 'ruoli', ', '.join(ro), extra='data-lista="ruoli"', label='Ruoli (separati da virgola)') + campo(cid, 'aspetti', ', '.join(a), extra='data-lista="aspetti"', label='Aspetti (separati da virgola)') + '</div></div></div>')
        corpo += riga(cid, cid + ' ' + pesi(t['tipi']) + ' ' + pesi(t['temi']) + ' ' + ' '.join(ro) + ' ' + ' '.join(a), c, meta)
    corpo += '</section>'
    corpo += '<section><h2>Ruoli <small>(%d)</small></h2><p class="d">I ruoli (mestieri e categorie). I «temi» collegano il ruolo ai temi delle frasi.</p>' % len(ru['ruoli'])
    for r in ru['ruoli']:
        c = '<div class="f2">' + campo('ruolo:' + r['id'], 'def', r['def'], label='Definizione') + campo('ruolo:' + r['id'], 'temi', ', '.join(r['temi']), extra='data-lista="temi"', label='Temi collegati') + '</div>'
        corpo += riga('ruolo:' + r['id'], r['id'] + ' ' + r['def'], c, f'<div class="m"><code>{r["id"]}</code></div>')
    corpo += '</section>'
    corpo += '<section><h2>Aspetti <small>(%d)</small></h2><p class="d">Cosa si vede sulla carta. «Nome» è come lo si dice nelle frasi («chi porta gli occhiali da sole»).</p>' % len(asp['aspetti'])
    for a in asp['aspetti']:
        c = '<div class="f2">' + campo('aspetto:' + a['id'], 'def', a['def'], label='Definizione') + campo('aspetto:' + a['id'], 'nome', a['nome'], label='Nome') + '</div>'
        corpo += riga('aspetto:' + a['id'], a['id'] + ' ' + a['def'] + ' ' + a['nome'], c, f'<div class="m"><code>{a["id"]}</code></div>')
    corpo += '</section>'
    corpo += '<section><h2>Catalogo: tipi <small>(%d)</small></h2><p class="d">Il vocabolario dei difetti e delle qualità. Se cambi una definizione, cambia il significato di quel tipo per tutte le carte e le frasi.</p>' % len(cat['tipi'])
    for t in cat['tipi']:
        corpo += riga('tipo:' + t['id'], t['id'] + ' ' + t['def'], campo('tipo:' + t['id'], 'def', t['def'], 'area', 1, label='Definizione'), f'<div class="m"><code>{t["id"]}</code></div>')
    corpo += '</section><section><h2>Catalogo: temi <small>(%d)</small></h2>' % len(cat['temi'])
    for t in cat['temi']:
        corpo += riga('tema:' + t['id'], t['id'] + ' ' + t['def'], campo('tema:' + t['id'], 'def', t['def'], 'area', 1, label='Definizione'), f'<div class="m"><code>{t["id"]}</code></div>')
    corpo += '</section>'
    corpo += '<section><h2>Luoghi comuni (tabella ruolo/aspetto → tratto) <small>(%d)</small></h2><p class="d">Quanto un ruolo o un aspetto fa pensare a un tratto. <b>Forza</b> da 1 a 3. «Elimina» toglie la riga. Per <b>aggiungere</b> una riga usa il modulo in fondo. Perimetro concordato: ruoli, mestieri, sottoculture, abbigliamento.</p>' % len(st['voci'])
    for i, v in enumerate(st['voci']):
        id_ = f'luogo:{v["asse"]}:{v["ruolo"]}:{v["tratto"]}'
        c = '<div class="f3">' + campo(id_, 'forza', str(v['forza']), opzioni=['1', '2', '3'], label=f'{v["asse"]}: {v["ruolo"]} → {v["tratto"]} · forza') + campo(id_, 'nota', v.get('nota', ''), label='Nota') + campo(id_, 'elimina', False, 'check', label='Elimina') + '</div>'
        corpo += riga(id_, f'{v["asse"]} {v["ruolo"]} {v["tratto"]} {v.get("nota", "")}', c)
    corpo += '''</section><section><h2>Aggiungi una riga alla tabella dei luoghi comuni</h2><div class="f3"><div><label class="l">Asse</label><select id="na"><option>ruolo</option><option>aspetto</option><option>tipo</option></select></div><div><label class="l">Ruolo / aspetto / tipo</label><input type="text" id="nr"></div><div><label class="l">Tratto</label><input type="text" id="nt"></div><div><label class="l">Forza</label><select id="nf"><option>1</option><option>2</option><option>3</option></select></div><div><label class="l">Nota</label><input type="text" id="nn"></div><div><label class="l">&nbsp;</label><button onclick="aggiungi()">Aggiungi</button></div></div><div id="agg"></div></section>'''
    extra_js = '''
const NUOVE=(()=>{try{return JSON.parse(localStorage.getItem(LS+'.nuove')||'[]')}catch(e){return []}})();
function mostra(){document.getElementById('agg').innerHTML=NUOVE.map((r,i)=>'<div>'+r.asse+': '+r.ruolo+' → '+r.tratto+' (forza '+r.forza+') '+(r.nota||'')+' <button class="alt" onclick="togli('+i+')">togli</button></div>').join('')}
function salva(){try{localStorage.setItem(LS+'.nuove',JSON.stringify(NUOVE))}catch(e){}mostra()}
function aggiungi(){const r={asse:na.value,ruolo:nr.value.trim(),tratto:nt.value.trim(),forza:+nf.value,nota:nn.value.trim()};if(!r.ruolo||!r.tratto){alert('Servono ruolo/aspetto e tratto');return}NUOVE.push(r);nr.value=nt.value=nn.value='';salva()}
function togli(i){NUOVE.splice(i,1);salva()}
function ESTRA(){return NUOVE.length?{luoghi_comuni_aggiunti:NUOVE}:{}}
function AZZERA(){NUOVE.length=0;salva()}
mostra();'''
    data = 'const CAT=' + json.dumps({'tipi': [t['id'] for t in cat['tipi']], 'temi': [t['id'] for t in cat['temi']]}) + ';const LISTE=' + json.dumps({'ruoli': ruoli_id, 'aspetti': asp_id, 'temi': [t['id'] for t in cat['temi']]}) + ';'
    intro = 'Le carte personaggio con i loro tag e ruoli, i ruoli, gli aspetti, il catalogo di tipi e temi e la tabella dei luoghi comuni: tutto ciò che i bot e le statistiche finali usano per «leggere» le carte. I tag si scrivono come <code>ipocrita:3, bugiardo:2</code>; ruoli e aspetti come elenco separato da virgole (devono esistere nelle liste qui sotto).'
    open(os.path.join(OUT, 'carte-ruoli-tag.html'), 'w', encoding='utf-8').write(pagina('carte', 'Revisione carte, ruoli e tag', intro, corpo, 1, extra_js, data))
    return len(ids), len(ru['ruoli']), len(asp['aspetti']), len(st['voci'])


# =========================================================== 3. TESTI DELLE STATISTICHE FINALI
PREFISSI = ('rp.', 'sc.', 'sp.', 'dt.', 'mv.', 'lc.', 'rot.', 'sm.', 'share.', 'fin.', 'aw.', 'tc.')


def statistiche():
    T = J(os.path.join(ROOT, 'public', 'testi.json')); testi = T['testi']
    gruppi = {}
    for k, v in testi.items():
        if k.startswith(PREFISSI):
            gruppi.setdefault(v['s'], []).append(k)
    corpo = ''
    for s in sorted(gruppi):
        chiavi = gruppi[s]
        corpo += f'<section><h2>{esc(s)} <small>({len(chiavi)})</small></h2>'
        for k in chiavi:
            v = testi[k]; n = v.get('n', '')
            meta = f'<div class="m"><code>{esc(k)}</code>' + (f'<i>{esc(n)}</i>' if n else '') + '</div>'
            sg = ','.join(sorted(re.findall(r'\{[A-Za-z0-9_]+\}', v['t'])))
            corpo += riga(k, k + ' ' + v['t'], campo(k, 'testo', v['t'], 'area', 2, extra=f'data-segn="{esc(sg)}"'), meta)
        corpo += '</section>'
    n = sum(len(x) for x in gruppi.values())
    intro = f'Tutti i testi che compaiono a fine partita ({n}): premio della serata, scalata, riepilogo (titoli, battute della classifica, badge, quadrante, luogo comune, umani contro bot), foglio «Come l\'abbiamo finalmente capito», moviola, copertina, condivisione. <b>Non toccare le parole tra graffe</b> ({{nome}}, {{pct}}…): le riempie il gioco (se le cambi compare un avviso). Le righe con più varianti (es. <code>rp.q.primo.0…3</code>) sono scelte a caso ma in modo stabile per persona/partita. Le <b>accuse</b> delle frasi sono nella pagina delle frasi del Megafono; le frasi del Megafono stesse e i tag nelle altre due pagine.'
    open(os.path.join(OUT, 'statistiche-finali.html'), 'w', encoding='utf-8').write(pagina('testi', 'Revisione testi delle statistiche finali', intro, corpo, T['versione']))
    return n


def indice(nf, nc, nr):
    p = f'''<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Revisione · Giù dalla Torre</title><style>{CSS}</style></head><body>
<header><h1>Revisione contenuti · Giù dalla Torre</h1></header><main>
<div class="note">Tre pagine, ognuna un file solo che funziona offline. Si modifica, si scarica il JSON con le sole modifiche e me lo si manda: lo applico io ai file del gioco, alzo le versioni e rilancio i controlli.</div>
<section><h2><a href="frasi-megafono.html">1 · Frasi del Megafono</a></h2><p class="d">{nf[0]} frasi con tag (tipi e temi) e accusa, più {nf[1]} confessioni. Serve ai bot (come leggono le frasi) e ai luoghi comuni di fine partita.</p></section>
<section><h2><a href="carte-ruoli-tag.html">2 · Carte, ruoli e tag</a></h2><p class="d">{nc[0]} carte (tag, ruoli, aspetti), {nc[1]} ruoli, {nc[2]} aspetti, catalogo di tipi e temi e {nc[3]} righe della tabella dei luoghi comuni.</p></section>
<section><h2><a href="statistiche-finali.html">3 · Testi delle statistiche finali</a></h2><p class="d">{nr} testi: premio della serata, classifica con battute, badge, quadrante, luogo comune, foglio dei dettagli, moviola, copertina, condivisione.</p></section>
</main></body></html>'''
    open(os.path.join(OUT, 'index.html'), 'w', encoding='utf-8').write(p)


if __name__ == '__main__':
    nf = frasi(); nc = carte(); nr = statistiche(); indice(nf, nc, nr)
    print('frasi', nf, '| carte/ruoli/aspetti/luoghi', nc, '| testi', nr)
    for f in sorted(os.listdir(OUT)):
        print(f, round(os.path.getsize(os.path.join(OUT, f)) / 1024), 'KB')
