p='/home/user/giudallatorre/mockups/terrazza2d.html';s=open(p).read()
def rep(a,b):
    global s
    assert a in s,a[:80]; s=s.replace(a,b,1)
rep("const CX=186,CY=470;","""const CX=186,CY=470;
function merlonG(x,y,w,h){
  return `<g stroke="${NV}" stroke-width="3.2" stroke-linejoin="round"><polygon points="${x+1},${y} ${x+w-1},${y} ${x+w},${y-h} ${x},${y-h}" fill="#d9bd82"/><polygon points="${x+w-8},${y} ${x+w-1},${y} ${x+w},${y-h} ${x+w-8},${y-h}" fill="#b99a68" stroke="none"/><path d="M${x+1} ${y-h*.66}H${x+w-1}M${x+1} ${y-h*.33}H${x+w-1}M${x+w*.45} ${y-h}V${y-h*.66}M${x+w*.7} ${y-h*.66}V${y-h*.33}M${x+w*.3} ${y-h*.33}V${y}" stroke="${NV}" stroke-opacity=".3" stroke-width="2" fill="none"/><rect x="${x-3}" y="${y-h-9}" width="${w+6}" height="11" rx="3" fill="#f7ebc8"/><path d="M${x} ${y-h-5}h${w}" stroke="#fff" stroke-width="2.4" stroke-linecap="round" opacity=".8" fill="none"/></g>`}
function corbelG(x,y,w=22,h=20){
  return `<g stroke="${NV}" stroke-width="2.8" stroke-linejoin="round"><path d="M${x-w/2} ${y}H${x+w/2}L${x+w/2-2} ${y+h*.35}H${x+w/2-5}L${x+w/2-6} ${y+h*.7}H${x+w/2-9}L${x+w/2-10} ${y+h}H${x-w/2+10}L${x-w/2+9} ${y+h*.7}H${x-w/2+6}L${x-w/2+5} ${y+h*.35}H${x-w/2+2}Z" fill="#dcc48c"/><path d="M${x-w/2+4} ${y+3}h${w-8}" stroke="#fff" stroke-opacity=".7" stroke-width="2.2"/></g>`}""")
a=s.index("  for(let i=0;i<28;i++){const a=Math.PI*.04");b=s.index("  // piano del bordo (spesso)")
s=s[:a]+"""  for(let i=0;i<30;i++){const a=Math.PI*.02+i/30*Math.PI*.96,[x,y]=spPt(CX,Ar.cy+22,Ar.rx-5,Ar.ry-5,a);o+=`<path d="M${x-17} ${y+2}q17 -4 34 0v10q-17 12 -34 0z" fill="#8e7348" opacity=".55"/>`+corbelG(x,y-2,17,17)}
"""+s[b:]
a=s.index("ms.sort((p,q)=>p.y-q.y)");b=s.index("return o+'</svg>'}",a)
s=s[:a]+"ms.sort((p,q)=>p.y-q.y).forEach(({x,y,a})=>{o+=merlonG(x-14,y,28,26)});\n  "+s[b:]
a=s.index("function profBack(top)");b=s.index("function profCards")
s=s[:a]+r'''function profBack(top){let o=`<svg style="position:absolute;left:0;top:0;z-index:3" width="372" height="826" viewBox="0 0 372 826"><rect x="48" y="${top+4}" width="276" height="26" fill="#cdb078" stroke="${NV}" stroke-width="4"/>`;
  for(let i=0;i<6;i++)o+=merlonG(54+i*46,top+8,26,22).replace(/#d9bd82/g,'#c8aa70');
  return o+'</svg>'}
function profFront(top){let o=`<svg style="position:absolute;left:0;top:0;z-index:30" width="372" height="826" viewBox="0 0 372 826"><defs><pattern id="bkf" width="34" height="20" patternUnits="userSpaceOnUse"><rect width="34" height="20" fill="${STL}"/><path d="M0 0h34M0 10h34M17 0v10M0 10v10" stroke="${NV}" stroke-opacity=".25" stroke-width="2"/></pattern></defs>`;
  o+=`<rect x="38" y="${top+28}" width="296" height="46" fill="url(#bkf)" stroke="${NV}" stroke-width="5"/>`;
  for(let i=0;i<7;i++)o+=merlonG(42+i*43,top+30,30,30);
  o+=`<rect x="32" y="${top+74}" width="308" height="14" fill="${STD}" stroke="${NV}" stroke-width="5"/>`;
  for(let i=0;i<14;i++)o+=`<path d="M${42+i*21.6-10} ${top+90}q10 -6 20 0v10q-10 10 -20 0z" fill="#8e7348" opacity=".55"/>`+corbelG(42+i*21.6,top+86,18,24);
  return o+'</svg>'}
'''+s[b:]
a=s.index("  (opts.windows||[]).forEach");b=s.index("  return o+'</svg>'}",a)
s=s[:a]+r'''  (opts.windows||[]).forEach(([wx,wy,cards],wi)=>{const id='wc'+Math.round(wx)+'_'+Math.round(wy)+'_'+wi,W=104,H=156,path=`M${wx} ${wy+H}V${wy+52}a52 52 0 0 1 ${W} 0V${wy+H}z`;
    o+=`<defs><clipPath id="${id}"><path d="${path}"/></clipPath></defs><path d="${path}" fill="#1d2740" stroke="${NV}" stroke-width="5"/><g clip-path="url(#${id})"><path d="M${wx} ${wy+H-6}L${wx+W} ${wy+H-62}M${wx} ${wy+H-34}L${wx+W} ${wy+H-90}M${wx} ${wy+H-62}L${wx+W} ${wy+H-118}M${wx} ${wy+H-90}L${wx+W} ${wy+H-146}" stroke="#3b4a6e" stroke-width="5"/>`;
    (cards||[]).forEach(([cx,cy,r])=>{const cw=78,ch=117;o+=`<g transform="translate(${wx+cx} ${wy+cy}) rotate(${r} ${cw/2} ${ch/2})"><rect width="${cw}" height="${ch}" rx="7" fill="#14a3a1" stroke="#fff" stroke-width="5"/><path d="M0 ${ch}L${cw} 0V${ch}z" fill="#0e7d7c"/><text x="${cw/2}" y="${ch/2+14}" text-anchor="middle" font-family="Anton" font-size="40" fill="#fff">?</text></g>`});
    o+=`</g><path d="${path}" fill="none" stroke="${NV}" stroke-width="5"/><path d="M${wx-8} ${wy+H+2}h${W+16}" stroke="${NV}" stroke-width="7"/><path d="M${wx-4} ${wy+H-2}h${W+8}" stroke="#f7ebc8" stroke-width="3"/>`});
'''+s[b:]
a=s.index("b3('1 · Il portone'");b=s.index("  b3('5 · Arrivano in cima'")
new=r'''b3('1 · Il portone','Le carte coperte (grandi come quelle della terrazza) entrano in fila dal portone alla base; le finestre sopra sono grandi e ancora vuote. La camera inizia a salire.',`<div class="s">${skyBg}${chips(1)}<div class="strip">★ LE CARTE SALGONO ★</div>${profShaft(-180,{windows:[[70,230,[]],[198,70,[]]]})}<div style="position:absolute;left:0;right:0;bottom:0;height:150px;background:#14a3a1;border-top:4px solid #13224a;z-index:4"></div><div style="position:absolute;left:120px;top:590px;width:132px;height:170px;background:#1d2740;border:5px solid #13224a;border-radius:66px 66px 0 0;z-index:5"></div>${cback(30,690,-14,1,52)}${cback(64,716,10,1,52)}${cback(98,732,-6,1,52)}${cloud(-20,380,120)}${cloud(260,430,100)}${FR}</div>`),
  b3('2 · Prima finestra: la carta passa e sale','Dentro la Torre le carte sono nascoste: si vedono solo quando passano davanti alla finestra, ritagliate dai suoi bordi. Qui una carta attraversa la scala diagonale e un’altra la segue.',`<div class="s">${skyBg}${chips(1)}<div class="strip">★ LE CARTE SALGONO ★</div>${profShaft(-300,{windows:[[70,470,[[-34,80,-24],[22,-20,-20]]],[198,250,[]],[70,30,[]]]})}${streak(60,640,50)}${cloud(250,640,110)}${cloud(-30,300,120)}${FR}</div>`),
  b3('3 · Seconda finestra: ora dall’altra parte','Lo zigzag: la carta riemerge nella finestra a destra e prosegue; il tornante la fa ripartire verso sinistra. Le due carte si vedono solo a tratti.',`<div class="s">${skyBg}${chips(1)}<div class="strip">★ LE CARTE SALGONO ★</div>${profShaft(-420,{windows:[[70,540,[]],[198,320,[[8,40,16],[40,-60,16]]],[70,100,[]]]})}${streak(262,420,50)}${cloud(-30,200,120)}${cloud(250,680,110)}${FR}</div>`),
  b3('4 · Ultimo tornante e fascia dei beccatelli','In alto si intravedono i beccatelli e il parapetto: sopra c’è la terrazza. All’ultima finestra le carte si accalcano prima di uscire.',`<div class="s">${skyBg}${chips(1)}<div class="strip">★ LE CARTE SALGONO ★</div>${profShaft(60,{windows:[[198,300,[[0,10,12],[-6,70,8]]],[70,520,[]]]})}${profBack(60)}${profFront(60)}${streak(214,420,40)}${cloud(-20,640,120)}${FR}</div>`),
'''
s=s[:a]+new+s[b:]
a=s.index("S.spoglio=");b=s.index("/* ---- dal voto alla caduta")
new=r'''const who=(txt,x,y)=>`<div style="position:absolute;left:${x}px;top:${y}px;z-index:93;background:#fff7e0;color:#13224a;border:3px solid #13224a;box-shadow:3px 3px 0 #13224a;padding:3px 9px;font:800 12.5px Nunito;transform:rotate(-2deg)">${txt}</div>`;
S.spoglio={t:'3 · Lo spoglio dei voti: la suspense (circa 5 secondi)',n:'Il fondale si scurisce e parte il rullo. Ogni voto compare direttamente sulla carta votata, uno alla volta (nell’ordine di tavolo, dopo il Megafono): il gettone “atterra” con un rimbalzo, in alto compare il nome (“Omar ha votato… il 3!”) e sopra la carta più votata il contatore cresce. Prima dell’ultimo voto c’è uno stacco di mezzo secondo con il rullo che si interrompe, poi l’ultimo gettone, poi il Lui! del Megafono si gira e il timbro annuncia la carta che cade. Con un pareggio compare “Pareggio! Decide il Megafono”. Saltabile con un tocco.',
 tl:`<div class="tl">${[['Buio + rullo 0,6 s',6,'#79d3ee'],['Voti sulle carte 2,2 s (≈0,3 s l’uno)',22,'#ffc72c'],['Stacco “manca un voto” 0,8 s',8,'#ff9d93'],['Ultimo voto + Lui! 1 s',10,'#ffc72c'],['Timbro 0,7 s',7,'#9be28f'],['Caduta',20,'#e8362b']].map(([t,w,c])=>`<div style="flex:${w};background:${c}">${t}</div>`).join('')}</div>`,
 beats:[b3('1 · Si fa buio, parte il rullo','Titolo “Lo spoglio!”. Nessun gettone sulle carte: i voti sono ancora segreti.',frame(terrace(8,{lui:3,luiBack:true})+dark+`<div class="cap2" style="top:130px;font-size:34px">Lo spoglio!</div>`+q,'LO SPOGLIO',1,'')),
  b3('2 · Un voto alla volta','Il gettone cade sulla carta e compare chi ha votato. Il contatore cresce a ogni voto.',frame(terrace(8,{lui:3,luiBack:true,votes:V8.slice(0,4)})+dark+counter('3',150,330)+who('Omar ha votato… il 3!',92,170)+q,'LO SPOGLIO',1,`<div class="cap2" style="top:118px;font-size:26px">Voto n. 4 di 8</div>`)),
  b3('3 · Manca un voto…','Il rullo si ferma. Il gettone con il megafono è già sulla carta n. 1; la carta n. 3 è in testa.',frame(terrace(8,{lui:3,luiBack:true,votes:V8.slice(0,6)})+dark+counter('4',150,330)+who('Sara ha votato… il 2! Manca Tommi…',40,170)+q,'LO SPOGLIO',1,`<div class="cap2" style="top:118px;font-size:30px">Manca un voto…</div>`)),
  b3('4 · L’ultimo gettone','Tommi vota il 3: la carta vince con 5 voti. (In caso di pareggio compare “Pareggio! Decide il Megafono”.)',frame(terrace(8,{lui:3,luiBack:true,votes:[...V8,{p:3,c:PLN[7][1]}]})+dark+counter('5',150,330)+who('Tommi ha votato… il 3!',86,170)+q,'LO SPOGLIO',1,`<div class="cap2" style="top:118px;font-size:28px">Ultimo voto!</div>`)),
  b3('5 · Il Lui! e il timbro','Il Lui! del Megafono si gira: “CADE LUI!” sul n. 3, azzeccato. Timbro “Cade il n. 3!”, suono di tamburi e lampo.',frame(terrace(8,{lui:3,luiKind:'CADE',votes:[...V8,{p:3,c:PLN[7][1]}]})+dark+`<div style="position:absolute;left:36px;right:36px;top:150px;z-index:95;text-align:center;color:#e8362b;border:5px solid #e8362b;padding:8px;font:400 44px/.95 Anton;transform:rotate(-6deg);background:#f4e3bdf2;box-shadow:5px 5px 0 #13224a;text-transform:uppercase">Cade il n. 3!<div style="font:400 17px Anton;letter-spacing:.12em;margin-top:5px">5 voti su 8 · lui lo sapeva!</div></div>`+q,'LO SPOGLIO',1,''))]};
'''
s=s[:a]+new+s[b:]
s=s.replace("(v2)</h1>","(v3)</h1>")
open(p,'w').write(s)
