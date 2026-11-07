"""Mockup della grafica definitiva (senza cornice da smartphone). Uso: python3 tools/build_mockup_v4.py -> mockups/v4/grafica-v4.html"""
import json, pathlib
R = pathlib.Path(__file__).resolve().parent.parent
A = json.load(open(R / "mockups/v4/assets.json")); T = json.load(open(R / "mockups/v4/terrace.json"))
CSS = r"""
:root{--navy:#13224a;--ink:#0c1736;--gold:#ffc72c;--gold2:#ffe27a;--red:#e8362b;--red2:#ff6a4d;--teal:#14a3a1;--paper:#fff3d6;--paper2:#f4e3bd;--sky1:#4fb6e6;--sky2:#8bd3f2;--pink:#ff7aa8;--ok:#2a9d57;
--disp:"Anton","Impact","Arial Narrow",sans-serif;--body:"Nunito","Segoe UI",system-ui,sans-serif;--hand:"Caveat Brush","Comic Sans MS",cursive}
*{box-sizing:border-box;margin:0;padding:0}
body{color-scheme:dark;background:#0d1530;color:var(--navy);font-family:var(--body);font-weight:700;padding:28px max(16px,env(safe-area-inset-left,0px)) 60px}
h1.t{font:400 44px/1 var(--disp);color:#fff;text-transform:uppercase;letter-spacing:.02em}
.lead{color:#b9c4e6;max-width:70ch;margin:10px 0 26px;font-weight:600;line-height:1.5}
.notes{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:14px;margin-bottom:34px}
.note{background:#17244a;border:2px solid #2a3b73;border-radius:14px;padding:14px;color:#dbe3ff;font-weight:600;line-height:1.45;font-size:14px}
.note b{display:block;font:400 18px var(--disp);color:var(--gold);text-transform:uppercase;margin-bottom:4px;letter-spacing:.04em}
.boards{display:flex;flex-wrap:wrap;gap:30px;align-items:flex-start}
.bd{display:flex;flex-direction:column;gap:10px}.bd>h3{font:400 17px var(--disp);color:var(--gold);text-transform:uppercase;letter-spacing:.06em}
.bd>p{color:#aab6dd;font-size:13px;max-width:390px;font-weight:600;line-height:1.4}
.scr{position:relative;width:390px;height:844px;overflow:hidden;background:var(--sky1);box-shadow:0 20px 60px #000a;border-radius:6px}
.scr *{position:absolute}
.scr .st{position:relative}
.scr .st *{position:static}
.scr .logo *,.desk .logo *{position:static}
.scr .st .abs,.desk .st .abs{position:absolute}
/* ---- fondale ---- */
.bg{inset:0;background:radial-gradient(ellipse at 50% 34%,#fff8 0,#fff0 55%),repeating-conic-gradient(from 3deg at 50% 34%,var(--sky1) 0 7.5deg,var(--sky2) 7.5deg 15deg)}
.bg.dusk{background:radial-gradient(ellipse at 50% 34%,#ffd27a66 0,#0000 55%),repeating-conic-gradient(from 3deg at 50% 34%,#27407f 0 7.5deg,#35539f 7.5deg 15deg)}
.dots{inset:0;background:radial-gradient(circle,#13224a22 1.6px,transparent 2px) 0 0/9px 9px;-webkit-mask-image:linear-gradient(transparent 55%,#000);mask-image:linear-gradient(transparent 55%,#000);pointer-events:none}
.vig{inset:0;background:radial-gradient(ellipse at 50% 45%,transparent 50%,#0b1a4a55 100%);pointer-events:none}
.cloud{width:120px;height:46px;background:#fff;border:4px solid var(--navy);border-radius:40px;box-shadow:0 4px 0 #13224a33}
.cloud::before,.cloud::after{position:absolute;content:"";background:#fff;border:4px solid var(--navy);border-radius:50%;border-bottom-color:transparent;border-right-color:transparent}
.cloud::before{width:54px;height:54px;left:12px;top:-30px;transform:rotate(20deg)}.cloud::after{width:42px;height:42px;left:58px;top:-22px;transform:rotate(30deg)}
.star{color:var(--gold);font-size:20px;text-shadow:2px 2px 0 var(--navy);animation:tw 2.4s ease-in-out infinite}
@keyframes tw{50%{transform:scale(1.25) rotate(12deg);opacity:.75}}
.conf{width:9px;height:14px;border:1.5px solid var(--navy);border-radius:2px}
/* ---- componenti ---- */
.pill{display:flex;align-items:center;gap:6px;height:34px;padding:0 12px 0 4px;background:#fff;border:3px solid var(--navy);border-radius:99px;box-shadow:0 3px 0 var(--navy);font:800 13px var(--body);color:var(--navy)}
.pill>*{position:static}
.coin{width:24px;height:24px;border-radius:50%;border:3px solid var(--navy);display:grid;place-items:center;font:400 11px var(--disp);color:#fff;box-shadow:inset 0 -3px 0 #0003,inset 0 2px 0 #fff6}
.ribbon{left:-14px;right:-14px;height:46px;background:linear-gradient(var(--navy),#0e1a3b);border-top:3px solid #3b4f95;border-bottom:3px solid #070d22;transform:rotate(-2deg);display:grid;place-items:center;box-shadow:0 8px 0 #0004;z-index:5}
.ribbon span{position:static;font:400 20px var(--disp);letter-spacing:.2em;color:var(--gold);text-transform:uppercase;text-shadow:0 2px 0 #000a}
.ribbon::before,.ribbon::after{position:absolute;content:"★";color:var(--gold);font-size:14px;top:14px}.ribbon::before{left:56px}.ribbon::after{right:56px}
.btn{left:16px;right:16px;height:64px;border:4px solid var(--navy);border-radius:18px;font:400 26px var(--disp);text-transform:uppercase;letter-spacing:.03em;display:grid;place-items:center;color:var(--navy);
 background:linear-gradient(var(--gold2),var(--gold) 55%,#f2a900);box-shadow:0 7px 0 var(--navy),0 12px 0 #0003,inset 0 3px 0 #fff9;overflow:hidden;z-index:30}
.btn::after{content:"";top:-40%;left:-30%;width:40%;height:180%;background:#fff6;transform:rotate(22deg)}
.btn.red{background:linear-gradient(#ff8a6e,var(--red) 55%,#c62a20);color:#fff;text-shadow:0 2px 0 #0006}
.btn.pap{background:linear-gradient(#fffaf0,var(--paper2));font-size:21px;height:54px}
.btn.dis{background:#c9c1ac;color:#8b8573;box-shadow:0 7px 0 #6b6552,inset 0 3px 0 #fff5}.btn.dis::after{display:none}
.btn.sm{height:50px;font-size:19px}
.panel{background:linear-gradient(#fffaf0,var(--paper));border:4px solid var(--navy);border-radius:18px;box-shadow:0 7px 0 var(--navy),0 14px 18px #0003;z-index:10}
.panel::before{content:"";position:absolute;inset:5px;border:2px dashed #13224a30;border-radius:12px;pointer-events:none}
.tag{background:var(--navy);color:var(--gold);font:400 12px/1 var(--disp);text-transform:uppercase;letter-spacing:.06em;padding:5px 9px 4px;border:2px solid #fff;border-radius:6px;box-shadow:2px 2px 0 var(--red)}
.cap{font:400 25px var(--hand);color:#fff;text-shadow:2px 2px 0 var(--navy);letter-spacing:.02em}
.logo{left:0;right:0;text-align:center;font-family:var(--disp);text-transform:uppercase;line-height:.84}
.ext{text-shadow:0 1px 0 var(--navy),0 2px 0 var(--navy),0 3px 0 var(--navy),0 4px 0 var(--navy),0 5px 0 var(--navy),0 6px 0 var(--navy),0 7px 0 var(--navy),0 8px 0 var(--navy),0 9px 0 var(--navy),0 12px 8px #0005}
.cdA{border-radius:9px;background:center/cover;border:4px solid #fff;box-shadow:2px 3px 0 rgba(19,34,74,.55)}
.cdA i{left:-8px;top:-8px;width:22px;height:22px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#ffe9a0,#e0a52c 70%);border:3px solid #6e4310;color:#4a2a06;font:400 12px/16px Anton;text-align:center;font-style:normal;box-shadow:0 2px 0 #0006}
.holo{inset:0;border-radius:6px;background:linear-gradient(115deg,transparent 30%,#ffffff88 42%,#ffe27a66 50%,#ff7aa855 58%,transparent 70%);mix-blend-mode:screen;pointer-events:none}
.layer{left:9px;top:0;width:372px;height:826px;transform-origin:0 0;transform:scale(1.048)}
.popin{position:absolute;inset:0}
.lk{height:70px;border:4px solid var(--navy);border-radius:14px;background:#fff;box-shadow:0 5px 0 var(--navy);font:400 21px var(--disp);text-transform:uppercase;display:grid;place-items:center;text-align:center;line-height:1}
.lk small{position:static;display:block;font:800 10.5px var(--body);text-transform:none;opacity:.7;margin-top:3px}
.lk.on{background:linear-gradient(var(--gold2),var(--gold));outline:4px solid #fff;box-shadow:0 5px 0 var(--navy),0 0 0 7px var(--gold)}
.rv{left:12px;right:12px;bottom:70px;padding:12px 14px;display:flex;flex-direction:column;gap:4px;z-index:40}
.rv *{position:static}
.rv .rt{font:400 28px/1 var(--disp);color:var(--red);text-transform:uppercase}
.rv .rs{font:800 14px/1.3 var(--body)}
.mini{width:30px;height:45px;border:3px solid #fff;border-radius:5px;box-shadow:2px 2px 0 var(--navy);background:center/cover;position:relative!important;display:block}
.row{left:14px;right:14px;height:60px;display:flex;align-items:center;gap:10px;padding:0 12px 0 8px;background:linear-gradient(#fffaf0,var(--paper));border:3px solid var(--navy);border-radius:14px;box-shadow:0 4px 0 var(--navy);z-index:10;overflow:hidden}
.row>*{position:static}
.row .bar{position:absolute;left:0;top:0;bottom:0;background:linear-gradient(90deg,#ffc72c66,#ffc72c11);z-index:-1}
.row .nm{flex:1;font:800 16px var(--body);line-height:1.1}.row .nm small{display:block;font:700 10.5px var(--body);opacity:.65}
.row .dl{font:400 18px var(--disp);color:var(--ok)}.row .tt{font:400 30px var(--disp);min-width:40px;text-align:right}
.rank{width:30px;height:30px;border-radius:50%;background:var(--navy);color:var(--gold);display:grid;place-items:center;font:400 16px var(--disp)!important;flex:none}
.pod{bottom:150px;width:104px;border:4px solid var(--navy);border-bottom:0;border-radius:14px 14px 0 0;color:#fff;text-align:center;box-shadow:inset 0 6px 0 #fff4}
.pod>*{position:static!important;display:block}
.desk{position:relative;width:1180px;height:700px;overflow:hidden;border-radius:6px;box-shadow:0 20px 60px #000a}
.desk *{position:absolute}.desk .st{position:relative}
.desk .st *{position:static}
.side{top:24px;bottom:24px;width:300px;display:flex;flex-direction:column;gap:12px;z-index:10}.side>*{position:static!important}
"""
def coin(c, t, s=24): return f'<i class="coin" style="background:{c};width:{s}px;height:{s}px">{t}</i>'
PL = [("#e5384b", "DA", "Dariaccio"), ("#2f7be0", "GI", "Bot Gino"), ("#f4c20d", "MA", "Bot Mara"), ("#3aa655", "PI", "Bot Pino"), ("#8e44c8", "LE", "Bot Lella")]
def sky(extra="", dusk=False, clouds=False):
    c = '' if not clouds else "".join(f'<div class="cloud" style="left:{x}px;top:{y}px;transform:scale({s})"></div>' for x, y, s in [(10, 130, .8), (250, 250, 1), (-20, 420, 1.1)])
    st = "".join(f'<div class="star" style="left:{x}px;top:{y}px;animation-delay:{d}s">★</div>' for x, y, d in [(40, 96, 0), (330, 120, -.7), (300, 380, -1.4), (60, 330, -2)])
    return f'<div class="bg {"dusk" if dusk else ""}"></div>{c}{st}<div class="dots"></div>{extra}'
def top(pl="Dariaccio", mega="Bot Lella", turn="Turno 3/10"):
    return (f'<div class="st" style="left:14px;right:14px;top:18px;display:flex;justify-content:space-between;z-index:20"><span class="pill">{coin("#e5384b","DA")}{pl}</span>'
            f'<span class="pill">📣 {mega}</span><span class="pill">{turn}</span></div>')
def ribbon(t): return f'<div class="ribbon" style="top:66px"><span>{t}</span></div>'
def icons(): return '<div class="pill" style="right:14px;top:73px;width:34px;padding:0;justify-content:center;z-index:25">🔊</div><div class="pill" style="right:54px;top:73px;width:34px;padding:0;justify-content:center;z-index:25">💬</div>'
def phrase(txt, ctx, pre="Oggi sale sulla torre…", top_=132):
    return (f'<div class="panel" style="left:14px;right:14px;top:{top_}px;padding:20px 14px 14px 60px;transform:rotate(-.8deg)">'
            f'<div class="st"><div class="abs" style="position:absolute;left:-12px;top:-16px;width:50px;height:50px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#ffe9a0,var(--gold));border:4px solid var(--navy);box-shadow:0 3px 0 var(--navy);display:grid;place-items:center;font-size:24px">📣</div>'
            f'<span class="tag abs" style="position:absolute;right:12px;top:-14px">{ctx}</span><div style="font:400 17px var(--hand);color:var(--red)">{pre}</div>'
            f'<div style="font:400 25px/1.05 var(--disp);text-transform:uppercase;margin-top:2px">{txt}</div></div></div>')
def terrace(cards, lay=300): return f'<div class="layer" style="top:{lay-300}px"><div class="popin" style="inset:auto">{T["base"]}</div><div style="left:0;top:0">{T[cards]}</div></div>'

S = {}
# 1 HOME
tw = A["tower"]
S["home"] = ("1 · Home", "Logo tridimensionale, torre-eroe a tutta altezza con i personaggi che spuntano, pulsanti pieni con riflesso e profondità.",
 f'<div class="scr">{sky(clouds=True)}'
 f'<div class="logo" style="top:46px;font-size:62px;color:#fff;transform:rotate(-3deg)"><div class="ext" style="color:var(--gold)">Giù dalla</div><div class="ext" style="font-size:112px;margin-top:6px;text-shadow:0 1px 0 var(--navy),0 2px 0 var(--navy),0 3px 0 var(--navy),0 4px 0 var(--navy),0 5px 0 var(--navy),0 6px 0 var(--navy),0 7px 0 var(--navy),0 8px 0 var(--navy),0 9px 0 var(--navy),0 10px 0 var(--navy),0 11px 0 var(--navy),6px 14px 0 var(--red),0 18px 16px #0006">Torre!</div></div>'
 f'<div style="left:0;right:0;bottom:0;height:300px;background:linear-gradient(#8fdcb0,#2fb48f 40%,#14a3a1);border-top:5px solid var(--navy);border-radius:50% 50% 0 0/22px 22px 0 0"></div>'
 f'<img src="{tw}" style="left:70px;top:300px;width:250px;filter:drop-shadow(8px 10px 0 #0003);z-index:3">'
 + "".join(f'<img src="{c}" style="left:{x}px;top:{y}px;height:{h}px;z-index:2;filter:drop-shadow(3px 0 0 #fff) drop-shadow(-3px 0 0 #fff) drop-shadow(0 3px 0 #fff) drop-shadow(0 -3px 0 #fff) drop-shadow(5px 6px 0 #13224a)">' for c, x, y, h in zip(A["cut"], (62, 128, 214), (240, 218, 244), (126, 140, 126)))
 + '<div class="btn" style="bottom:196px">Crea partita</div><div class="btn red" style="bottom:116px">Entra con un codice</div><div class="btn pap sm" style="bottom:46px;left:16px;right:204px;font-size:16px">Gioca da solo</div><div class="btn pap sm" style="bottom:46px;left:204px;right:16px;font-size:16px">Come si gioca</div>'
 '<div class="vig"></div></div>')
# 2 LOBBY
def seat(i, p, tag=""): return f'<div class="row" style="top:{300+i*66}px">{coin(p[0],p[1],38)}<span class="nm">{p[2]}<small>{tag}</small></span></div>'
S["lobby"] = ("2 · Lobby", "Il codice diventa un biglietto d'ingresso con strappo; i giocatori siedono su «sedili» con avatar a medaglia; posti vuoti tratteggiati.",
 f'<div class="scr">{sky()}<div class="pill" style="left:14px;top:18px">Lobby</div><div class="pill" style="right:14px;top:18px">5/8 giocatori</div>'
 f'<div class="panel" style="left:16px;right:16px;top:70px;height:190px;border-radius:22px"><div class="st">'
 f'<div class="abs" style="position:absolute;left:18px;top:18px;width:132px;height:132px;background:#fff;border:4px solid var(--navy);border-radius:10px;background-image:repeating-linear-gradient(90deg,var(--navy) 0 6px,transparent 6px 12px),repeating-linear-gradient(0deg,var(--navy) 0 6px,transparent 6px 12px);background-blend-mode:multiply;opacity:.9"></div>'
 f'<div class="abs" style="position:absolute;left:170px;top:18px;font:400 17px var(--hand);color:var(--red)">il codice della stanza</div><div class="abs" style="position:absolute;left:166px;top:44px;font:400 50px/1 var(--disp);color:var(--red);text-shadow:3px 3px 0 var(--navy);letter-spacing:.04em">WU52R</div>'
 f'<div class="abs" style="position:absolute;left:170px;bottom:14px;font:800 13px var(--body);text-decoration:underline">Condividi il link ↗</div></div>'
 f'<div style="left:-12px;top:84px;width:24px;height:24px;border-radius:50%;background:var(--sky1);border:4px solid var(--navy);clip-path:inset(0 0 0 50%)"></div><div style="right:-12px;top:84px;width:24px;height:24px;border-radius:50%;background:var(--sky1);border:4px solid var(--navy);clip-path:inset(0 50% 0 0)"></div></div>'
 + "".join(seat(i, p, ("HOST" if i == 0 else "BOT · difficile" if i else "")) for i, p in enumerate(PL[:4]))
 + f'<div class="row" style="top:{300+4*66}px;background:transparent;border-style:dashed;box-shadow:none;opacity:.8"><span class="nm" style="color:#fff;text-shadow:1px 1px 0 var(--navy)">+ Chiama un amico col codice…</span></div>'
 f'<div class="btn" style="bottom:48px">Avvia partita</div><div class="vig"></div></div>')
# 3 MEGAFONO
opts = [("Di notte", "ha parlato nel sonno e ha confessato tutto alla moglie, compreso il peccato che non ha commesso.", 1), ("Da genitori", "ha promesso a Gesù Bambino un regalo e ha regalato una pacca sulla spalla.", 0), ("Tra meteo e vestiti", "ha messo la giacca a vento al contrario e ha camminato all’indietro per coerenza.", 0), ("Sul divano", "ha fatto la maratona di serie e ha dato la colpa all’abbonamento.", 0)]
S["proclaim"] = ("3 · Il Megafono sceglie", "Le proposte sono «bigliettini» con il contesto in evidenza; quella scelta si illumina e si solleva. Il titolo ha un megafono-sticker.",
 f'<div class="scr">{sky(dusk=False)}{top("Dariaccio","Dariaccio")}{ribbon("Sei il Megafono")}{icons()}'
 f'<div class="logo" style="top:128px;font-size:38px;color:#fff;transform:rotate(-2deg);left:16px;text-align:left"><div class="cap" style="font-size:22px">Sei il Megafono!</div><div class="ext">Cosa urli alla folla?</div></div>'
 + "".join(f'<div class="panel" style="left:16px;right:16px;top:{262+i*116}px;height:108px;padding:12px 14px;{"transform:translateY(-4px) scale(1.02);outline:5px solid var(--gold);box-shadow:0 0 0 9px #ffc72c88,0 8px 0 var(--navy),0 18px 30px #0004;background:linear-gradient(#fffef2,#ffe9a8)" if s else ""}"><div class="st"><span class="tag">{c}</span><div style="font:800 14px/1.28 var(--body);margin-top:6px"><b style="color:var(--red)">Oggi sale sulla torre chi</b> {t}</div></div></div>' for i, (c, t, s) in enumerate(opts))
 + '<div class="btn pap sm" style="bottom:48px;left:16px;right:216px;font-size:15px">Dico la mia</div><div class="btn red" style="bottom:48px;left:184px;right:16px;font-size:23px">📣 Proclama!</div><div class="vig"></div></div>')
# 4 MANO
fan = ""
for i, (u, rot, x, y) in enumerate(zip(A["cards"], (-14, -7, 0, 7, 14), (4, 66, 128, 190, 252), (596, 570, 552, 570, 596))):
    sel = i == 2
    fan += f'<div class="cdA" style="left:{x}px;top:{y-(40 if sel else 0)}px;width:120px;height:180px;background-image:url({u});transform:rotate({rot}deg);z-index:{10+i+(20 if sel else 0)};{"border-color:var(--gold);box-shadow:0 0 0 3px var(--navy),0 0 26px 8px #ffc72c,6px 10px 0 #13224a" if sel else ""}"><i>{i+1}</i>{"<div class=holo></div>" if sel else ""}</div>'
S["hand"] = ("4 · Scegli la carta", "La mano a ventaglio con carte più grandi; la scelta si alza, ha bordo oro luminoso e riflesso olografico. Un suggerimento breve al posto del muro di testo.",
 f'<div class="scr">{sky()}{top()}{ribbon("Scegli la carta")}{icons()}{phrase("Chi ha messo la giacca a vento al contrario e ha camminato all’indietro per coerenza.","Tra meteo e vestiti")}'
 f'<div class="panel" style="left:30px;right:30px;top:316px;padding:9px 12px;text-align:center;font:800 13px/1.3 var(--body);border-radius:14px"><div class="st">Scegli il personaggio che <b style="color:var(--red)">farebbe questa cosa</b>. Resta segreta!</div></div>{fan}'
 '<div class="btn" style="bottom:48px">Gioca questa carta</div><div class="vig"></div></div>')
# 5 VOTO
S["vote"] = ("5 · Si vota", "La terrazza resta il cuore del gioco, con fondale più profondo. Il Lui! è un gettone sopra la sua carta bordata d'oro. L'avviso sul gregge è un cartello rosso, non testo corrente.",
 f'<div class="scr">{sky()}{top()}{ribbon("Vota in segreto")}{icons()}<div class="pill" style="left:14px;top:73px;width:34px;padding:0;justify-content:center;background:var(--gold)">?</div>{phrase("Quelli che hanno messo cinque sveglie e le hanno spente tutte senza rimorsi.","Di notte","Oggi salgono sulla torre…")}'
 f'{terrace("vote",300)}'
 '<div class="panel" style="left:14px;right:14px;bottom:128px;padding:11px 14px;font:800 13px/1.35 var(--body);z-index:40;border-radius:14px"><div class="st">Il Lui! del Megafono <b style="color:#b9830a">(bordo giallo)</b> è sul n. 2. Vota chi farebbe di più questa cosa.<div style="margin-top:6px;padding:6px 9px;background:var(--red);color:#fff;border-radius:8px;border:2px solid var(--navy)">⚠ Evita il voto del Megafono! Se cade la carta che ha votato lui, i punti del voto sono solo suoi.</div></div></div>'
 '<div class="btn dis" style="bottom:40px">Scegli chi cade</div><div class="vig"></div></div>')
# 6 SPOGLIO
S["reveal"] = ("6 · Lo spoglio", "Fondale scuro con riflettore sulla carta; un pannello fisso spiega ogni passo; il tabellone con miniature e pallini colorati mostra i voti che crescono. Avanti ›/Salta sempre a portata di pollice.",
 f'<div class="scr">{sky(dusk=True)}{top()}{ribbon("Giù dalla torre")}{icons()}{phrase("Quelli che hanno messo cinque sveglie e le hanno spente tutte senza rimorsi.","Di notte")}'
 f'{terrace("reveal",300)}<div class="vig" style="background:radial-gradient(ellipse at 50% 42%,transparent 25%,#050a22cc 85%)"></div>'
 f'<div class="panel rv"><div class="st"><div style="display:flex;gap:10px"><span class="mini" style="background-image:url({A["cards"][2]})"></span><div><div style="font:800 11px var(--body);opacity:.65;text-transform:uppercase;letter-spacing:.08em">Voto 3 di 5</div><div style="font:400 22px/1.1 var(--disp);text-transform:uppercase;display:flex;gap:6px;align-items:center">{coin("#f4c20d","MA",18)} Bot Mara ha votato il n. 3</div></div></div>'
 f'<div style="display:flex;gap:6px;justify-content:center;margin-top:8px;padding-top:8px;border-top:2px dashed #13224a44">'
 + "".join(f'<div style="display:flex;flex-direction:column;align-items:center;gap:2px;width:44px;{"" if k==2 else "opacity:.7"}"><span class="mini" style="background-image:url({u});{"border-color:var(--gold);box-shadow:0 0 0 2px var(--navy),0 0 10px 3px var(--gold)" if k==2 else ""}"></span><b style="font:400 18px var(--disp)">{[1,0,2,1,0][k]}</b></div>' for k, u in enumerate(A["cards"]))
 + '</div></div></div><div class="btn pap sm" style="left:14px;right:auto;width:96px;bottom:14px;height:40px;font-size:14px">Salta</div><div class="btn sm" style="left:auto;right:14px;width:130px;bottom:14px;height:40px;font-size:16px">Avanti ›</div></div>')
# 7 CLASSIFICA
rows = [("#2f7be0", "GI", "Bot Gino", "voto giusto + Lui! cade", "+6", 21, 1), ("#e5384b", "DA", "Dariaccio", "carta giocata", "+2", 17, 2), ("#f4c20d", "MA", "Bot Mara", "voto giusto", "+2", 14, 3), ("#3aa655", "PI", "Bot Pino", "gregge: niente +2", "0", 12, 4), ("#8e44c8", "LE", "Bot Lella", "—", "−1", 9, 5)]
S["score"] = ("7 · Classifica del turno", "Righe-medaglia con barra di avanzamento, punti del turno colorati, totale grande che si somma; leader con corona. Il fondale della caduta resta visibile sopra.",
 f'<div class="scr"><div class="bg dusk"></div><div class="dots"></div>{top()}{ribbon("Classifica del turno")}'
 f'<div style="left:0;right:0;top:128px;text-align:center;font:400 26px var(--disp);color:#fff;text-shadow:2px 3px 0 var(--navy);letter-spacing:.03em">Cade il n. 2!</div>'
 + "".join(f'<div class="row" style="top:{176+i*74}px;height:66px"><div class="bar" style="width:{t*4}px;position:absolute"></div><span class="rank">{"👑" if i==0 else r}</span>{coin(c,s,36)}<span class="nm">{n}<small>{w}</small></span><span class="dl" style="{"color:var(--red)" if d.startswith("−") else "color:#13224a55" if d=="0" else ""}">{d}</span><span class="tt">{t}</span></div>' for i, (c, s, n, w, d, t, r) in enumerate(rows))
 + '<div class="btn" style="bottom:48px">Prossimo turno</div><div class="vig"></div></div>')
# 8 FINALE
def pod(x, h, c, n, s, crown=False): return f'<div class="pod" style="left:{x}px;height:{h}px;background:linear-gradient(180deg,{c},#0003)"><div style="font-size:30px;margin-top:-34px;text-shadow:none">{"👑" if crown else ""}</div>{coin("#fff",n[:2].upper(),46).replace("color:#fff","color:#13224a")}<b style="font:400 17px var(--disp);margin-top:6px;text-shadow:0 2px 0 #0006">{n}</b><b style="font:400 34px var(--disp);text-shadow:0 3px 0 #0006">{s}</b></div>'
S["final"] = ("8 · Podio finale", "Podio a gradini con coriandoli, titolo extrusion, classifica completa sotto e due azioni chiare. Vincitore con corona e riflettore.",
 f'<div class="scr">{sky()}<div style="left:-40px;right:-40px;top:20px;height:360px;background:radial-gradient(ellipse at 50% 40%,#fff9,transparent 65%)"></div>'
 f'<div class="logo" style="top:56px;font-size:34px;color:#fff;transform:rotate(-2deg)"><div class="cap" style="font-size:28px">Ha vinto…</div><div class="ext" style="font-size:84px;margin-top:4px;line-height:.82">Gran<br>Megafono!</div></div>'
 + "".join(f'<div class="conf" style="left:{x}px;top:{y}px;background:{c};transform:rotate({r}deg)"></div>' for x, y, c, r in [(30,140,"#e8362b",20),(330,170,"#ffc72c",60),(60,300,"#14a3a1",110),(310,320,"#ff7aa8",30),(180,120,"#fff",80),(120,230,"#ffc72c",10),(260,250,"#e8362b",140)])
 + pod(24, 210, "#e8362b", "Dariaccio", 21, True) + pod(138, 160, "#14a3a1", "Bot Gino", 19) + pod(252, 124, "#a47c2f", "Bot Mara", 14)
 + '<div style="left:0;right:0;bottom:0;height:150px;background:linear-gradient(#2fb48f,#14a3a1);border-top:5px solid var(--navy);z-index:2"></div>'
 + '<div class="row" style="bottom:116px;top:auto;height:38px;z-index:5;left:50px;right:50px;font-size:14px"><span class="rank" style="width:22px;height:22px;font-size:12px!important">4</span><span class="nm" style="font-size:14px">Bot Pino</span><span class="tt" style="font-size:20px">12</span></div>'
 + '<div class="btn pap sm" style="bottom:36px;left:16px;right:204px;z-index:6">Esci</div><div class="btn sm" style="bottom:36px;left:204px;right:16px;z-index:6">Nuova partita</div></div>')
# 9 DESKTOP
dk = (f'<div class="desk"><div class="bg dusk" style="inset:0"></div><div class="dots"></div>'
 f'<div class="side" style="left:26px"><div class="logo" style="position:static;text-align:left;font-size:34px;color:#fff;transform:rotate(-3deg)"><div class="ext" style="color:var(--gold)">Giù dalla</div><div class="ext" style="font-size:66px;margin-top:2px">Torre!</div></div>'
 f'<div class="panel" style="position:relative!important;padding:14px;border-radius:18px"><div class="st"><div style="font:400 15px var(--hand);color:var(--red)">entra con il codice</div><div style="font:400 54px/1 var(--disp);color:var(--red);text-shadow:3px 3px 0 var(--navy)">WU52R</div><div style="font:800 12.5px var(--body);opacity:.75">oppure inquadra il QR dal telefono</div></div></div>'
 f'<div class="panel" style="position:relative!important;padding:12px;font:800 13px/1.4 var(--body);border-radius:14px;flex:1"><div class="st"><b style="font:400 17px var(--disp);text-transform:uppercase;color:var(--red)">Chat</b><div style="margin-top:6px"><b>Gino:</b> la tua suocera è già salita 😂</div><div style="margin-top:4px"><b>Mara:</b> 🐑🐑🐑</div></div></div></div>'
 f'<div style="left:350px;top:0;width:480px;height:700px;overflow:hidden"><div style="left:0;top:0;width:390px;height:844px;transform:scale(.83);transform-origin:0 0;left:36px"><div class="scr" style="box-shadow:none;background:transparent">{ribbon("Vota in segreto")}{phrase("Quelli che hanno messo cinque sveglie e le hanno spente tutte senza rimorsi.","Di notte","Oggi salgono sulla torre…")}{terrace("vote",300)}</div></div></div>'
 f'<div class="side" style="right:26px">'
 + '<div class="panel" style="position:relative!important;padding:12px 12px 6px;border-radius:18px"><div class="st"><b style="font:400 19px var(--disp);text-transform:uppercase;color:var(--red)">Giocatori</b>' + "".join(f'<div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-top:2px dashed #13224a30">{coin(c,s,30)}<span style="flex:1;font:800 14px var(--body)">{n}{" 📣" if n=="Bot Lella" else ""}</span><b style="font:400 24px var(--disp)">{t}</b></div>' for c, s, n, w, d, t, r in rows) + '</div></div></div></div>')
BODY = '<h1 class="t">Grafica definitiva · mockup</h1><p class="lead">Senza la cornice da smartphone: a tutto schermo, con un fondale più profondo e componenti con volume (pulsanti pieni, pannelli a fumetto, medaglie, nastri). Stile pop del gioco invariato, personaggi e terrazza invariati. Su desktop il gioco si apre in una plancia con laterali.</p>'
BODY += '<div class="notes">' + "".join(f'<div class="note"><b>{h}</b>{t}</div>' for h, t in [("Niente cornice", "Via il bordo-telefono e gli angoli arrotondati da tutte le pagine: la scena arriva ai bordi dello schermo e rispetta le aree di sicurezza dei telefoni."), ("Profondità", "Fondale a raggi con vignetta, nuvole a contorno, mezzatinta in basso, stelle che brillano. Gli elementi hanno ombre a gradino e riflessi."), ("Componenti", "Pulsanti 3D con riflesso, pannelli carta con tratteggio, nastro del titolo piegato, monete-avatar dei giocatori, targhette dei contesti."), ("Leggibilità", "Un solo suggerimento breve per schermata; lo spoglio ha pannello fisso e tabellone dei voti; l'avviso gregge è un cartello rosso."), ("Desktop", "Plancia a tre colonne: logo e codice a sinistra, partita al centro, giocatori e punti a destra, chat sempre visibile.")])+'</div>'
BODY += '<div class="boards">' + "".join(f'<div class="bd"><h3>{t}</h3><p>{d}</p>{h}</div>' for t, d, h in S.values()) + f'<div class="bd"><h3>9 · Desktop / tablet</h3><p>Su schermi larghi la partita sta al centro con laterali informativi; sotto i 900 px resta la versione a colonna singola.</p>{dk}</div></div>'
HEAD = '<title>Grafica definitiva</title><meta name="claude:viewport-fit-sides" content="cover"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Anton&family=Caveat+Brush&family=Nunito:wght@600;700;800&display=swap">'
open(R / "mockups/v4/grafica-v4.html", "w").write(HEAD + "<style>" + CSS + "</style>" + BODY)
print(len(HEAD + CSS + BODY) // 1024, "KB")
