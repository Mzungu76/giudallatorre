CSS='''
:root{--paper:#f4e3bd;--red:#e8362b;--mus:#ffc72c;--navy:#13224a;--teal:#14a3a1}
*{box-sizing:border-box;margin:0}
body{background:#0e1a3b;font-family:Nunito,system-ui,sans-serif;color:var(--navy);padding:24px}
h1{font:400 34px Anton,Impact,sans-serif;color:#fff;letter-spacing:.02em}
.sub{color:#cbd6f5;font-size:14px;margin:4px 0 26px;max-width:900px}
h2{font:400 26px Anton,Impact,sans-serif;color:var(--mus);margin:34px 0 4px;text-transform:uppercase}
.note{color:#cbd6f5;font-size:13px;margin-bottom:14px}
.row{display:flex;gap:26px;align-items:flex-start;flex-wrap:wrap}
.dev{display:flex;flex-direction:column;gap:6px;color:#9fb0e0;font-size:12px;font-weight:800}
.f{color:var(--navy);font-weight:800;position:relative;overflow:hidden;border:4px solid #000;border-radius:22px;box-shadow:0 10px 30px #000a}
.ph{width:300px;height:620px}.tb{width:480px;height:640px}.dk{width:800px;height:470px;border-radius:10px}
.sky{background:radial-gradient(ellipse at 50% 30%,#fff8 0,#fff0 55%),repeating-conic-gradient(from 3deg at 50% 30%,#4fb6e6 0 7.5deg,#8bd3f2 7.5deg 15deg)}
.pap{background:var(--paper)}
.col{display:flex;flex-direction:column;height:100%;padding:12px;gap:8px}
.grow{flex:1;min-height:0}
.bt{border:3px solid var(--navy);border-radius:14px;box-shadow:0 4px 0 var(--navy);background:linear-gradient(#ffe07a,var(--mus) 55%,#f2a900);font:400 17px Anton,Impact;text-transform:uppercase;text-align:center;padding:10px;color:var(--navy)}
.bt.red{background:linear-gradient(#ff8a6e,var(--red));color:#fff}.bt.pap{background:#fff7e0;font-size:13px;padding:7px}.bt.big{font-size:22px;padding:14px}
.pn{background:linear-gradient(#fffaf0,var(--paper));border:3px solid var(--navy);border-radius:14px;box-shadow:0 4px 0 var(--navy);padding:10px}
.pn h4{font:400 15px Anton,Impact;color:var(--red);text-transform:uppercase;margin-bottom:5px}
.logo{text-align:center;font:400 30px/.9 Anton,Impact;color:#fff;text-shadow:0 2px 0 var(--navy),0 4px 0 var(--navy),3px 6px 0 var(--red)}.logo b{display:block;font-size:52px;font-weight:400}.logo i{font-style:normal;color:var(--mus);font-size:24px;display:block}
.tower{width:110px;margin:0 auto;background:linear-gradient(90deg,#d9a85a,#e8c27c 50%,#b8863f);border:3px solid var(--navy);border-radius:10px 10px 0 0;height:100%;position:relative}
.tower:before{content:"";position:absolute;top:-14px;left:-8px;right:-8px;height:14px;background:repeating-linear-gradient(90deg,#d9a85a 0 14px,transparent 14px 22px);border:3px solid var(--navy);border-bottom:0}
.st{display:flex;gap:6px;justify-content:space-between}.st>div{flex:1;text-align:center}
.st i{font:400 14px Anton;font-style:normal;width:28px;height:28px;border-radius:50%;border:3px solid var(--navy);background:#fff;display:grid;place-items:center;margin:0 auto 2px}.st .c i{background:var(--mus)}.st .d i{background:var(--teal);color:#fff}.st span{font-size:10px;font-weight:800}
.pl{display:flex;align-items:center;gap:8px;background:#fff;border:3px solid var(--navy);border-radius:10px;padding:5px 8px;font:800 13px Nunito;box-shadow:0 2px 0 var(--navy)}
.pl em{font-style:normal;width:22px;height:22px;border-radius:50%;border:2px solid var(--navy);display:grid;place-items:center;font:400 12px Anton;color:#fff}.pl b{margin-left:auto;font:400 15px Anton}
.in{background:#fff;border:3px solid var(--navy);box-shadow:3px 3px 0 var(--navy);padding:9px;font:800 14px Nunito;color:#888}
.lb{font:400 15px 'Caveat Brush',cursive;margin-bottom:3px}
.chip{background:#fff;border:3px solid var(--navy);border-radius:99px;padding:3px 10px;font:800 11px Nunito}
.strip{background:var(--navy);color:var(--mus);font:400 13px Anton;letter-spacing:.14em;text-align:center;padding:7px;border-radius:8px}
.msg{background:#fffaf0;border:3px solid var(--navy);border-radius:12px;padding:8px 10px;font:800 12px/1.3 Nunito}.msg small{display:block;color:var(--red);font:400 10px Anton;letter-spacing:.1em}
.arena{background:#c9a063;border:3px solid var(--navy);border-radius:12px;display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:10px;height:100%}
.cd{border:4px solid #fff;border-radius:7px;box-shadow:2px 3px 0 var(--navy);display:grid;place-items:center;font:400 11px Anton;color:#fff}
.tag{position:absolute;top:6px;right:8px;background:#0008;color:#fff;font:800 10px Nunito;padding:2px 7px;border-radius:99px;z-index:3}
.ann{font:800 10px Nunito;color:#13224a;opacity:.7}
.pct{display:flex;flex-direction:column;gap:4px;font:800 10px Nunito}.pct div{background:#fff;border:2px dashed var(--navy);border-radius:6px;padding:2px 6px;display:flex;justify-content:space-between}
'''
def dev(c,label,inner): return f'<div class="dev">{label}<div class="f {c}">{inner}</div></div>'
def stepper(n):
    return '<div class="st">'+''.join(f'<div class="{"d" if i<n else "c" if i==n else ""}"><i>{"✓" if i<n else i+1}</i><span>{t}</span></div>' for i,t in enumerate(["Giocatori","Regole","Riepilogo"]))+'</div>'
PL=[("Marco","#8e44c8",42),("Giulia","#f4c20d",38),("Luca","#3aa655",27),("Anna","#e5384b",21)]
def plist(score=True): return ''.join(f'<div class="pl"><em style="background:{c}">{i+1}</em>{n}{f"<b>{s}</b>" if score else ""}</div>' for i,(n,c,s) in enumerate(PL))
def logo(): return '<div class="logo"><i>GIÙ DALLA</i><b>TORRE!</b></div>'
# HOME
home_ph=f'<div class="sky col" style="padding:14px"><div style="text-align:center">{logo()}</div><div class="grow" style="overflow:hidden;padding-top:26px"><div class="tower"></div></div><div class="bt big">Crea partita</div><div class="bt red">Entra con un codice</div><div class="bt pap">Gioca da solo (con bot)</div><div style="display:flex;justify-content:space-between"><div class="bt pap">Come si gioca</div><div class="chip">⤴ ⬇</div></div></div>'
home_tb=f'<div class="sky col" style="padding:18px;gap:10px"><div style="text-align:center">{logo()}</div><div class="grow" style="overflow:hidden;padding-top:26px"><div class="tower" style="width:130px"></div></div><div class="bt big">Crea partita</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px"><div class="bt red">Entra con un codice</div><div class="bt pap" style="display:grid;place-items:center">Gioca da solo (con bot)</div></div><div style="display:flex;justify-content:space-between"><div class="bt pap">Come si gioca</div><div class="chip">⤴ ⬇</div></div></div>'
home_dk=f'<div class="sky" style="display:flex;height:100%;align-items:center;gap:30px;padding:0 50px"><div style="flex:1;height:100%;display:flex;flex-direction:column;overflow:hidden;padding-top:20px">{logo()}<div class="grow" style="padding-top:26px;overflow:hidden"><div class="tower"></div></div></div><div class="pn" style="width:300px;display:flex;flex-direction:column;gap:10px;padding:16px"><div class="bt big">Crea partita</div><div class="bt red">Entra con un codice</div><div class="bt pap">Gioca da solo (con bot)</div><div style="display:flex;justify-content:space-between"><div class="bt pap">Come si gioca</div><div class="chip">⤴ ⬇</div></div></div></div>'
# CONFIG
cfg_main=f'<div class="lb">Il tuo nickname</div><div class="in">Es. Marta</div><div class="lb" style="margin-top:10px">Giocatori virtuali (bot)</div><div style="display:flex;gap:6px"><div class="bt pap" style="flex:1">−</div><div class="bt pap" style="flex:2">Nessuno</div><div class="bt pap" style="flex:1">+</div></div>'
def cfg(c):
    nav='<div style="display:flex;gap:8px"><div class="bt pap" style="flex:.4">‹ Indietro</div><div class="bt" style="flex:1">Avanti ›</div></div>'
    head=f'<div class="chip" style="align-self:flex-start">‹ Indietro</div><div style="font:400 28px/.95 Anton;color:var(--red)">Crea la partita</div>{stepper(0)}'
    if c=='dk': return f'<div class="pap" style="height:100%;padding:24px 50px;display:flex;flex-direction:column;gap:12px"><div style="display:flex;justify-content:space-between;align-items:center"><div><div class="chip" style="display:inline-block">‹ Indietro</div><div style="font:400 32px Anton;color:var(--red);margin-top:6px">Crea la partita</div></div><div style="width:340px">{stepper(0)}</div></div><div style="display:grid;grid-template-columns:1fr 240px;gap:18px" class="grow"><div class="pn">{cfg_main}</div><div class="pn"><h4>Riepilogo</h4><div class="pct"><div>Tu<span>—</span></div><div>Bot<span>Nessuno</span></div><div>Modalità<span>Stesso tavolo</span></div><div>Il Megafono sa<span>No</span></div></div></div></div>{nav}</div>'
    return f'<div class="pap col" style="gap:10px">{head}<div class="pn grow">{cfg_main}</div>{nav}</div>'
# GAMEPLAY
def arena(): return '<div class="arena">'+''.join(f'<div class="cd" style="background:{c}">{i+1}</div>' for i,c in enumerate(["#e8842b","#3b8fd4","#3b8fd4","#e8842b"]))+'</div>'
def status(): return '<div style="display:flex;justify-content:space-between"><span class="chip">● Marco &nbsp;0 ②</span><span class="chip">Turno 1/8</span></div>'
ev='<div class="strip">📣 IL MEGAFONO SCOMMETTE</div>'
mg='<div class="msg"><small>CONFESSIONE</small>Il Megafono urla: «Oggi sale sulla torre chi ammette di aver passato un intero pomeriggio…»</div>'
ins='<div class="msg" style="background:var(--mus)">Tocca la carta su cui vuoi scommettere col gettone Lui!</div>'
game_ph=f'<div class="sky col"><div class="ann">Stato ≈8–10%</div>{status()}<div class="ann">Evento ≈6–8%</div>{ev}<div class="ann">Messaggio ≈14–18%</div>{mg}<div class="ann">Area di gioco ≈50–56%</div><div class="grow">{arena()}</div><div class="ann">Istruzione ≈10–12%</div>{ins}</div>'
game_tb=f'<div class="sky col" style="padding:14px">{status()}{ev}<div style="display:grid;grid-template-columns:1.3fr 1fr;gap:10px" class="grow"><div style="display:flex;flex-direction:column;gap:8px">{mg}<div class="grow">{arena()}</div></div><div class="pn"><h4>Giocatori</h4><div style="display:flex;flex-direction:column;gap:5px">{plist()}</div></div></div>{ins}</div>'
game_dk=f'<div class="sky" style="display:grid;grid-template-columns:210px 1fr 210px;gap:14px;padding:14px;height:100%"><div class="pn"><h4>Giocatori</h4><div style="display:flex;flex-direction:column;gap:5px">{plist()}</div><div class="chip" style="margin-top:8px;display:inline-block">Turno 1/8</div></div><div style="display:flex;flex-direction:column;gap:8px">{ev}{mg}<div class="grow">{arena()}</div>{ins}</div><div class="pn"><h4>Storico / Regole</h4><div class="pct"><div>Turno 0<span>—</span></div><div>Gettoni Lui!<span>0 · ②</span></div></div><div class="bt pap" style="margin-top:10px">Come si gioca</div></div></div>'
# RESULTS
def trophy(): return '<div style="text-align:center"><div style="font-size:34px">🏆</div><div style="font:400 24px Anton;color:var(--red)">Classifica finale</div></div>'
res_acts='<div style="display:flex;gap:8px"><div class="bt pap" style="flex:1">⌂ Home</div><div class="bt" style="flex:2">Nuova partita</div></div>'
res_ph=f'<div class="sky col"><div class="ann">Titolo / Esito ≈20–25%</div>{trophy()}<div class="ann">Classifica ≈50–55%</div><div class="grow" style="display:flex;flex-direction:column;gap:6px">{plist()}</div><div class="ann">Azioni finali ≈15–20%</div>{res_acts}</div>'
res_tb=f'<div class="sky col" style="padding:18px">{trophy()}<div class="grow" style="display:flex;flex-direction:column;gap:8px;padding:0 40px">{plist()}</div>{res_acts}</div>'
res_dk=f'<div class="sky" style="display:grid;grid-template-columns:1fr 300px;gap:20px;padding:20px;height:100%"><div style="display:flex;flex-direction:column;gap:12px">{trophy()}<div class="grow" style="display:flex;flex-direction:column;gap:8px">{plist()}</div></div><div class="pn" style="display:flex;flex-direction:column;gap:10px;justify-content:center"><h4>Cosa vuoi fare?</h4><div class="bt big">Nuova partita</div><div class="bt pap">⌂ Home</div></div></div>'
def sec(t,note,a,b,c): return f'<h2>{t}</h2><div class="note">{note}</div><div class="row">{dev("ph","Smartphone &lt;600 px",a)}{dev("tb","Tablet 600–840 px",b)}{dev("dk","PC &gt;840 px",c)}</div>'
html=f'<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width"><title>Mockup layout responsivo</title><link href="https://fonts.googleapis.com/css2?family=Anton&family=Caveat+Brush&family=Nunito:wght@700;800&display=swap" rel=stylesheet><style>{CSS}</style><h1>Giù dalla Torre – Mockup layout responsivo</h1><div class=sub>Proposta da approvare prima di toccare il codice. Stile invariato; cambia solo la disposizione. Le illustrazioni sono segnaposto.</div>'
html+=sec('1. Home','Logo → azione principale → secondarie → utility. Su PC illustrazione a sinistra, azioni in pannello a destra.',home_ph,home_tb,home_dk)
html+=sec('2. Configurazione','Stepper Giocatori / Regole / Riepilogo, Indietro/Avanti sempre visibili. Su PC riepilogo laterale.',cfg('ph'),cfg('tb'),cfg('dk'))
html+=sec('3. Gameplay','Fasce: stato, evento, messaggio, area di gioco, istruzione. Tablet: pannello giocatori a lato. PC: giocatori a sinistra, storico/regole a destra.',game_ph,game_tb,game_dk)
html+=sec('4. Risultati','Titolo, classifica, azioni finali. Su PC le azioni vanno in un pannello laterale.',res_ph,res_tb,res_dk)
open('index.html','w').write(html)
