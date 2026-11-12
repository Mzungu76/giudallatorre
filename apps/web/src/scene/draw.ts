// Disegno della terrazza (vista dall'alto) e della Torre di profilo, come stringhe HTML/SVG. Derivato dal mockup approvato.
// @ts-nocheck
import { tokenUrl } from "../lib/characters.ts";
let URLS: string[] = [];
export const setCardUrls = (u: string[]) => { URLS = u; };
const A = (_: string) => "";
const NV='#13224a',ST='#e3c98f',STL='#f3e2b4',STD='#b99a68';
/* superellisse: forma "quadrato arrotondato" come la torre del regolamento */
const sp=(cx,cy,rx,ry,n=4,k=72)=>{let d='';for(let i=0;i<k;i++){const a=i/k*Math.PI*2,c=Math.cos(a),s=Math.sin(a);const x=cx+rx*Math.sign(c)*Math.pow(Math.abs(c),2/n),y=cy+ry*Math.sign(s)*Math.pow(Math.abs(s),2/n);d+=(i?'L':'M')+x.toFixed(1)+' '+y.toFixed(1)}return d+'Z'};
const spPt=(cx,cy,rx,ry,a,n=4)=>{const c=Math.cos(a),s=Math.sin(a);return [cx+rx*Math.sign(c)*Math.pow(Math.abs(c),2/n),cy+ry*Math.sign(s)*Math.pow(Math.abs(s),2/n)]};
/* ---- gettoni ---- */
function voteTok(color,sz=30,mega=false,glow=false){const mp=`<g transform="translate(8 8) scale(.78) translate(-50 -50)"><path d="M38 56V44l16-9v30z" fill="${NV}"/><path d="M58 42q6 8 0 16" stroke="${NV}" stroke-width="4" fill="none" stroke-linecap="round"/><rect x="34" y="44" width="6" height="12" fill="${NV}"/></g>`;return `<svg width="${sz}" height="${sz}" viewBox="0 0 100 100" style="overflow:visible;filter:drop-shadow(2px 3px 0 #13224a)"><image href="${tokenUrl(color)}" x="1" y="1" width="98" height="98"/><circle cx="50" cy="50" r="48" fill="none" stroke="${NV}" stroke-width="4"/>${mega?`<circle cx="9" cy="9" r="23" fill="#fff" stroke="${NV}" stroke-width="4"/>${mp}<g class="${glow?'tbbadge':''}"><circle cx="91" cy="9" r="23" fill="#ffc72c" stroke="${NV}" stroke-width="4"/><text x="91" y="21" text-anchor="middle" font-family="Anton" font-size="34" fill="${NV}">=</text></g>`:''}</svg>`}
/* PROPAGANDA: gettone con icona; verde i positivi, rosso i negativi; nel bollo il segno */
const EFF={cade:['⬇','CADE'],noncade:['⬆','NON CADE'],nulli:['🚫','VOTI NULLI'],propaganda:['📣','PROPAGANDA'],spareggio:['⚖️','SPAREGGIO'],influenza:['✖️2','INFLUENZA'],imbroglio:['🚫','IMBROGLIO'],dirottamento:['↪️','DIROTTA'],censura:['✂️','CENSURA']};
function effTok(spec,sz){const [ic,nm]=EFF[spec.effect]||['?',''],base={cade:'#e8362b',noncade:'#3f8fd0',nulli:'#3b3f4a'}[spec.effect],col=base||(spec.positive?'#2fae5b':'#d6452f'),sg=base?(spec.pts?'+'+spec.pts:'0'):(spec.positive?'+':'−');
 return `<svg width="${sz}" height="${sz}" viewBox="0 0 100 100" style="filter:drop-shadow(2px 3px 0 #13224a)"><circle cx="50" cy="50" r="46" fill="${col}" stroke="${NV}" stroke-width="6"/><circle cx="50" cy="50" r="38" fill="none" stroke="#fff" stroke-width="2.4" stroke-dasharray="4 4" opacity=".8"/><circle cx="46" cy="44" r="21" fill="#fff" stroke="${NV}" stroke-width="3"/><text x="46" y="${ic.length>2?51:53}" text-anchor="middle" font-size="${ic.length>2?17:24}" font-family="Anton">${ic}</text><text x="46" y="80" text-anchor="middle" font-family="Anton" font-size="${nm.length>9?10.5:12}" letter-spacing=".6" fill="#fff" stroke="${NV}" stroke-width="2.2" paint-order="stroke">${nm}</text><circle cx="80" cy="22" r="15" fill="#ffc72c" stroke="${NV}" stroke-width="4"/><text x="80" y="31" text-anchor="middle" font-family="Anton" font-size="24" fill="${NV}">${sg}</text></svg>`}
function luiTok(spec,sz=34,back=false){ if(back||!spec)return `<img src="/lui-coperto.png" width="${sz}" height="${sz}" alt="" style="display:block;filter:drop-shadow(2px 3px 0 #13224a)"/>`;
 if(spec.effect)return effTok(spec,sz);
 const col=spec.trap?'#3b3f4a':{k1:'#4fb3e8',k2:'#ff8a1f',k3:'#e8362b',zero:'#9b59d0'}[spec.slot]||'#ffc72c',big=spec.slot==='zero'?'0':spec.k+'+';
 return `<svg width="${sz}" height="${sz}" viewBox="0 0 100 100" style="filter:drop-shadow(2px 3px 0 #13224a)"><circle cx="50" cy="50" r="46" fill="${col}" stroke="${NV}" stroke-width="6"/><circle cx="50" cy="50" r="38" fill="none" stroke="#fff" stroke-width="2.4" stroke-dasharray="4 4" opacity=".8"/><text x="44" y="56" text-anchor="middle" font-family="Anton" font-size="${big.length>1?40:46}" fill="#fff" stroke="${NV}" stroke-width="3.4" paint-order="stroke">${big}</text><text x="44" y="73" text-anchor="middle" font-family="Anton" font-size="14" letter-spacing="1.5" fill="#fff" stroke="${NV}" stroke-width="2.4" paint-order="stroke">VOTI</text><circle cx="77" cy="76" r="20" fill="#ffc72c" stroke="${NV}" stroke-width="4"/><polygon points="77,60 79.4,65.6 85.5,66.1 80.9,70 82.3,76 77,72.8 71.7,76 73.1,70 68.5,66.1 74.6,65.6" fill="#fff" stroke="${NV}" stroke-width="1.6" stroke-linejoin="round"/><text x="77" y="88" text-anchor="middle" font-family="Anton" font-size="16" fill="${NV}">+${spec.pts}</text>${spec.herd?`<circle cx="20" cy="22" r="18" fill="#fff" stroke="${NV}" stroke-width="4"/><text x="20" y="30" text-anchor="middle" font-size="20">🗳</text>`:spec.trap?`<circle cx="20" cy="22" r="18" fill="#fff" stroke="${NV}" stroke-width="4"/><text x="20" y="29" text-anchor="middle" font-size="18">🚫</text>`:''}</svg>`}
/* ---- fusto e terrazza ---- */
const CX=186,CY=470;
function merlonG(x,y,w,h){
  return `<g stroke="${NV}" stroke-width="3.2" stroke-linejoin="round"><polygon points="${x+1},${y} ${x+w-1},${y} ${x+w},${y-h} ${x},${y-h}" fill="#d9bd82"/><polygon points="${x+w-8},${y} ${x+w-1},${y} ${x+w},${y-h} ${x+w-8},${y-h}" fill="#b99a68" stroke="none"/><path d="M${x+1} ${y-h*.66}H${x+w-1}M${x+1} ${y-h*.33}H${x+w-1}M${x+w*.45} ${y-h}V${y-h*.66}M${x+w*.7} ${y-h*.66}V${y-h*.33}M${x+w*.3} ${y-h*.33}V${y}" stroke="${NV}" stroke-opacity=".3" stroke-width="2" fill="none"/><rect x="${x-3}" y="${y-h-9}" width="${w+6}" height="11" rx="3" fill="#f7ebc8"/><path d="M${x} ${y-h-5}h${w}" stroke="#fff" stroke-width="2.4" stroke-linecap="round" opacity=".8" fill="none"/></g>`}
function corbelG(x,y,w=22,h=20){
  return `<g stroke="${NV}" stroke-width="2.8" stroke-linejoin="round"><path d="M${x-w/2} ${y}H${x+w/2}L${x+w/2-2} ${y+h*.35}H${x+w/2-5}L${x+w/2-6} ${y+h*.7}H${x+w/2-9}L${x+w/2-10} ${y+h}H${x-w/2+10}L${x-w/2+9} ${y+h*.7}H${x-w/2+6}L${x-w/2+5} ${y+h*.35}H${x-w/2+2}Z" fill="#dcc48c"/><path d="M${x-w/2+4} ${y+3}h${w-8}" stroke="#fff" stroke-opacity=".7" stroke-width="2.2"/></g>`}
function shaft(top=640){ // fusto in mattoni con finestre, come la torre del regolamento
  let o=`<svg style="position:absolute;left:0;top:0;z-index:1" width="372" height="826" viewBox="0 0 372 826"><defs><pattern id="bk" width="40" height="24" patternUnits="userSpaceOnUse"><rect width="40" height="24" fill="${ST}"/><path d="M0 0h40M0 12h40M20 0v12M0 12v12" stroke="${NV}" stroke-opacity=".3" stroke-width="2"/></pattern><pattern id="ht" width="8" height="8" patternUnits="userSpaceOnUse"><circle cx="4" cy="4" r="2.1" fill="${NV}"/></pattern><linearGradient id="gr" x1="0" x2="1"><stop offset=".45" stop-color="#fff" stop-opacity="0"/><stop offset=".95" stop-color="#fff"/></linearGradient><mask id="mk"><rect width="372" height="826" fill="url(#gr)"/></mask></defs>`;
  o+=`<rect x="40" y="${top}" width="292" height="700" fill="url(#bk)" stroke="${NV}" stroke-width="5"/><rect x="40" y="${top}" width="292" height="700" fill="url(#ht)" mask="url(#mk)" opacity=".55"/>`;
  [[104,top+80],[232,top+80]].forEach(([x,y])=>o+=`<path d="M${x} ${y+64}V${y+16}a22 22 0 0144 0V${y+64}z" fill="#3b4a55" stroke="${NV}" stroke-width="4"/><path d="M${x-6} ${y+66}h56" stroke="${NV}" stroke-width="5"/>`);
  return o+'</svg>'}
function terraceBase(){
  const Ar={rx:182,ry:164,cy:468},H={rx:158,ry:122,cy:466},Fl={cy:490};
  let o=`<svg style="position:absolute;left:0;top:0;z-index:2" width="372" height="826" viewBox="0 0 372 826"><defs><pattern id="bk3" width="34" height="20" patternUnits="userSpaceOnUse"><rect width="34" height="20" fill="${STD}"/><path d="M0 0h34M0 10h34M17 0v10M0 10v10" stroke="${NV}" stroke-opacity=".3" stroke-width="2"/></pattern><pattern id="ht2" width="8" height="8" patternUnits="userSpaceOnUse"><circle cx="4" cy="4" r="2.1" fill="${NV}"/></pattern><linearGradient id="gr2" x1="0" x2="1"><stop offset=".5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff"/></linearGradient><mask id="mk2"><rect width="372" height="826" fill="url(#gr2)"/></mask><clipPath id="clipH"><path d="${sp(CX,H.cy,H.rx,H.ry)}"/></clipPath></defs>`;
  // fascia dei beccatelli sotto il bordo (come il regolamento)
  o+=`<path d="${sp(CX,Ar.cy+22,Ar.rx,Ar.ry)}" fill="url(#bk3)" stroke="${NV}" stroke-width="5"/>`;
  for(let i=0;i<30;i++){const a=Math.PI*.02+i/30*Math.PI*.96,[x,y]=spPt(CX,Ar.cy+22,Ar.rx-5,Ar.ry-5,a);o+=`<path d="M${x-17} ${y+2}q17 -4 34 0v10q-17 12 -34 0z" fill="#8e7348" opacity=".55"/>`+corbelG(x,y-2,17,17)}
  // piano del bordo (spesso)
  o+=`<path d="${sp(CX,Ar.cy,Ar.rx,Ar.ry)}" fill="${STL}" stroke="${NV}" stroke-width="5"/><path d="${sp(CX,Ar.cy,Ar.rx,Ar.ry)}" fill="url(#ht2)" mask="url(#mk2)" opacity=".4"/>`;
  // apertura: parete interna (visibile sul lato opposto) + pavimento
  o+=`<path d="${sp(CX,H.cy,H.rx,H.ry)}" fill="${STD}" stroke="${NV}" stroke-width="5"/>`;
  o+=`<g clip-path="url(#clipH)"><path d="${sp(CX,Fl.cy,H.rx-4,H.ry+4)}" fill="#efdcab"/><path d="${sp(CX,Fl.cy,H.rx-4,H.ry+4)}" fill="none" stroke="${NV}" stroke-width="3" opacity=".55"/>`;
  for(let i=1;i<6;i++)o+=`<path d="M${CX-158+i*52.7} 360V620" stroke="${NV}" stroke-opacity=".16" stroke-width="2.4"/>`;
  [410,460,520,570].forEach(y=>o+=`<path d="M20 ${y}H352" stroke="${NV}" stroke-opacity=".16" stroke-width="2.4"/>`);
  o+=`</g>`;
  // giunti radiali del bordo e ombra interna contro la parete
  for(let i=0;i<44;i++){const a=i/44*Math.PI*2,[x1,y1]=spPt(CX,Ar.cy,Ar.rx-3,Ar.ry-3,a),[x2,y2]=spPt(CX,H.cy,H.rx+3,H.ry+3,a);o+=`<path d="M${x1.toFixed(1)} ${y1.toFixed(1)}L${x2.toFixed(1)} ${y2.toFixed(1)}" stroke="${NV}" stroke-opacity=".22" stroke-width="2"/>`}
  o+=`<defs><linearGradient id="sh" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${NV}" stop-opacity=".5"/><stop offset=".35" stop-color="${NV}" stop-opacity="0"/></linearGradient></defs><path d="${sp(CX,H.cy,H.rx,H.ry)}" fill="url(#sh)" clip-path="url(#clipH)"/>`;
  [[90,420],[270,436],[130,540],[240,552],[196,380],[60,500]].forEach(([x,y],i)=>o+=`<g clip-path="url(#clipH)"><ellipse cx="${x}" cy="${y}" rx="${3+i%3}" ry="${2+i%2}" fill="${NV}" opacity=".25"/><path d="M${x+8} ${y+3}l6 -3l5 2" stroke="${NV}" stroke-opacity=".3" stroke-width="1.8" fill="none"/></g>`);
  // erbetta tra le lastre
  [[112,584],[300,452],[70,470]].forEach(([x,y])=>o+=`<g clip-path="url(#clipH)" stroke="#3aa655" stroke-width="2.6" stroke-linecap="round"><path d="M${x} ${y}l-3 -9M${x} ${y}l1 -11M${x} ${y}l5 -8"/></g>`);
  // merli su tutto il perimetro (bordo), dal fondo al fronte
  const N=26,mid={rx:(Ar.rx+H.rx)/2,ry:(Ar.ry+H.ry)/2,cy:(Ar.cy+H.cy)/2};const ms=[];
  for(let i=0;i<N;i++){const a=i/N*Math.PI*2+0.06,[x,y]=spPt(CX,mid.cy,mid.rx,mid.ry,a);ms.push({x,y,a})}
  ms.sort((p,q)=>p.y-q.y).forEach(({x,y,a})=>{o+=merlonG(x-14,y,28,26)});
  return o+'</svg>'}
/* ---- carta su piedini neri, con ombre ---- */
function cardFace(i,w,h,state,lui){ // state: 'up' | 'down' | numero flip 0..1
  const back=`background:linear-gradient(135deg,#14a3a1 0 50%,#0e7d7c 50%);`;
  const face=`background-image:url(${URLS[i]});`;
  return `<div class="cdA" style="left:0;top:0;width:${w}px;height:${h}px;${state==='down'?back:face}${lui?'border-color:#ffc72c;box-shadow:0 0 0 3px #13224a,0 0 18px 6px #ffc72c;':''}"><i>${i+1}</i>${state==='down'?`<span style="position:absolute;inset:0;display:grid;place-items:center;font:400 ${w*.5}px Anton;color:#fff;opacity:.9">?</span>`:''}</div>`}
function standCard(i,x,feet,w,rot,z,o={}){const h=Math.round(w*1.5);
  const flip=o.flip!==undefined;const sx=flip?Math.max(.05,Math.abs(Math.cos(o.flip*Math.PI))):1,st=flip?(o.flip<.5?'down':'up'):(o.state||'up');
  return `<div style="position:absolute;left:${x-4}px;top:${feet-10}px;width:${w+30}px;height:30px;z-index:${z}">
     <svg width="${w+30}" height="30" viewBox="0 0 ${w+30} 30" overflow="visible"><polygon points="6,12 ${w+2},12 ${w+30},2 32,2" fill="#13224a" opacity=".2"/><ellipse cx="${w/2+8}" cy="16" rx="${w*.52}" ry="9" fill="#13224a" opacity=".38"/></svg></div>
   <div style="position:absolute;left:${x}px;top:${feet-h-6}px;width:${w}px;height:${h+10}px;transform:rotate(${rot}deg);transform-origin:50% 100%;z-index:${z+1}">
    <div style="position:absolute;left:0;top:0;width:${w}px;height:${h}px;transform:scaleX(${sx});transform-origin:50% 50%">${cardFace(i,w,h,st,o.lui)}</div>${o.lui?`<div class="luitag" style="position:absolute;left:50%;top:-30px;transform:translateX(-50%);z-index:6">${luiTok(o.lui.spec,46,o.lui.back)}</div>`:''}
    <div style="position:absolute;left:${(w-Math.max(18,w*.3))/2}px;top:${h-5}px;width:${Math.max(18,w*.3)}px;height:13px;background:#13224a;border-radius:3px 3px 5px 5px;box-shadow:inset 0 3px 0 #3b4a6e,inset 0 -2px 0 #0a1230"></div>
   </div>`}
const jit=(k)=>[(Math.sin(k*12.9898)*43758.5453)%1,(Math.sin(k*78.233)*12345.678)%1,(Math.sin(k*39.346)*9871.123)%1].map(v=>v-Math.floor(v)-.5);
function cardsLayout(n,opt={}){
  const back=(n<=5?[0,1]:[0,1,2,3]).filter(i=>i<n),front=(n<=5?[2,3,4]:[4,5,6,7]).filter(i=>i<n);
  const wB=n<=5?88:68,wF=n<=5?100:76,spB=n<=5?100:62,spF=n<=5?102:66,yB=n<=5?466:458,yF=n<=5?566:566;
  let o='';const pos={};
  const put=(list,feet,w,sp,zb)=>{const m=(list.length-1)/2;list.forEach((i,k)=>{const [jx,jy,jr]=jit(i+1),x=CX+(k-m)*sp-w/2+jx*8,f=feet+jy*6,rot=jr*6;pos[i]={x,f,w,h:Math.round(w*1.5)};
     if(opt.show&&!opt.show.includes(i))return;const sc=standCard(i,x,f,w,rot,zb+k*2,{state:opt.down?'down':'up',flip:(opt.flip&&opt.flip[i]!==undefined)?opt.flip[i]:undefined,lui:opt.luiList?(()=>{const m=opt.luiList.find(x=>x.pos===i+1);return m?{spec:m.spec||null,back:!m.spec}:undefined})():(opt.lui===i+1)?{spec:opt.luiSpec||null,back:!!opt.luiBack}:undefined});o+=(opt.pop&&opt.pop===i+1)?`<div class="popin" style="position:absolute;inset:0">${sc}</div>`:sc})};
  put(back,yB,wB,spB,10);put(front,yF,wF,spF,30);
  // gettoni DIRETTAMENTE sulla carta (colore giocatore); il Megafono ha il simbolo del megafono
  (opt.votes||[]).forEach((v,idx,all)=>{const p=pos[v.p-1];if(!p)return;const same=all.filter(q=>q.p===v.p),j=same.indexOf(v),cnt=same.length;const tx=p.x+p.w/2-14+((j%2)?9:-9)*(cnt>1?1:0),ty=p.f-p.h*.55-Math.floor(j/2)*14+((j%2)?10:0);
     const sz=v.mega?44:28,off=(sz-28)/2;o+=`<div class="${idx===opt.lastVote?'tokdrop':''}${v.glow?' tbg':''}" style="position:absolute;left:${tx-off}px;top:${ty-off}px;z-index:${v.mega?72:70};transform:rotate(${(j-1)*9}deg)">${voteTok(v.c,sz,v.mega,!!v.glow)}</div>`});
  if(opt.posOut)Object.assign(opt.posOut,pos);
  return o}
const terrace=(n,opt={})=>shaft()+terraceBase()+cardsLayout(n,opt);
export function terraceBaseHtml(): string { return shaft() + terraceBase(); }
export function terraceCardsHtml(urls: string[], n: number, opt: any = {}): string { URLS = urls; return cardsLayout(n, opt); }
export function terracePos(n: number): Record<number, { x: number; f: number; w: number; h: number }> { const pos: any = {}; cardsLayout(n, { posOut: pos }); return pos; }
export { voteTok, luiTok };

export const MEGA_ICON = "";
/* ---- torre di PROFILO: fusto, finestre della scala, fascia di beccatelli, parapetto con merli ---- */
function profShaft(top,opts={}){ // top = y della sommita' dei merli anteriori
  const y0=top+96;let o=`<svg style="position:absolute;left:0;top:0;z-index:2" width="372" height="${opts.svgH||1700}" viewBox="0 0 372 ${opts.svgH||1700}"><defs><pattern id="bkp" width="40" height="24" patternUnits="userSpaceOnUse"><rect width="40" height="24" fill="${ST}"/><path d="M0 0h40M0 12h40M20 0v12M0 12v12" stroke="${NV}" stroke-opacity=".3" stroke-width="2"/></pattern><pattern id="htp" width="8" height="8" patternUnits="userSpaceOnUse"><circle cx="4" cy="4" r="2.1" fill="${NV}"/></pattern><linearGradient id="grp" x1="0" x2="1"><stop offset=".5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff"/></linearGradient><mask id="mkp"><rect width="372" height="1400" fill="url(#grp)"/></mask></defs>`;
  o+=`<rect x="54" y="${y0}" width="264" height="${opts.height||1400}" fill="url(#bkp)" stroke="${NV}" stroke-width="5"/><rect x="54" y="${y0}" width="264" height="${opts.height||1400}" fill="url(#htp)" mask="url(#mkp)" opacity=".5"/>`;
  (opts.windows||[]).forEach(([wx,wy,cards],wi)=>{const id='wc'+Math.round(wx)+'_'+Math.round(wy)+'_'+wi,W=92,H=138,path=`M${wx} ${wy+H}V${wy+46}a46 46 0 0 1 ${W} 0V${wy+H}z`;
    o+=`<defs><clipPath id="${id}"><path d="${path}"/></clipPath></defs><path d="${path}" fill="#1d2740" stroke="${NV}" stroke-width="5"/><g clip-path="url(#${id})"><path d="M${wx} ${wy+H-6}L${wx+W} ${wy+H-58}M${wx} ${wy+H-32}L${wx+W} ${wy+H-84}M${wx} ${wy+H-58}L${wx+W} ${wy+H-110}M${wx} ${wy+H-84}L${wx+W} ${wy+H-136}" stroke="#3b4a6e" stroke-width="5"/>`;
    (cards||[]).forEach(([cx,cy,r])=>{const cw=78,ch=117;o+=`<g transform="translate(${wx+cx} ${wy+cy}) rotate(${r} ${cw/2} ${ch/2})"><rect width="${cw}" height="${ch}" rx="7" fill="#14a3a1" stroke="#fff" stroke-width="5"/><path d="M0 ${ch}L${cw} 0V${ch}z" fill="#0e7d7c"/><text x="${cw/2}" y="${ch/2+14}" text-anchor="middle" font-family="Anton" font-size="40" fill="#fff">?</text></g>`});
    o+=`</g><path d="${path}" fill="none" stroke="${NV}" stroke-width="5"/><path d="M${wx-8} ${wy+H+2}h${W+16}" stroke="${NV}" stroke-width="7"/><path d="M${wx-4} ${wy+H-2}h${W+8}" stroke="#f7ebc8" stroke-width="3"/>`});
  return o+'</svg>'}
function profBack(top){let o=`<svg style="position:absolute;left:0;top:0;z-index:3" width="372" height="826" viewBox="0 0 372 826"><rect x="48" y="${top+4}" width="276" height="26" fill="#cdb078" stroke="${NV}" stroke-width="4"/>`;
  for(let i=0;i<6;i++)o+=merlonG(54+i*46,top+8,26,22).replace(/#d9bd82/g,'#c8aa70');
  return o+'</svg>'}
function profFront(top){let o=`<svg style="position:absolute;left:0;top:0;z-index:30" width="372" height="826" viewBox="0 0 372 826"><defs><pattern id="bkf" width="34" height="20" patternUnits="userSpaceOnUse"><rect width="34" height="20" fill="${STL}"/><path d="M0 0h34M0 10h34M17 0v10M0 10v10" stroke="${NV}" stroke-opacity=".25" stroke-width="2"/></pattern></defs>`;
  o+=`<rect x="38" y="${top+28}" width="296" height="46" fill="url(#bkf)" stroke="${NV}" stroke-width="5"/>`;
  for(let i=0;i<7;i++)o+=merlonG(42+i*43,top+30,30,30);
  o+=`<rect x="32" y="${top+74}" width="308" height="14" fill="${STD}" stroke="${NV}" stroke-width="5"/>`;
  for(let i=0;i<14;i++)o+=`<path d="M${42+i*21.6-10} ${top+90}q10 -6 20 0v10q-10 10 -20 0z" fill="#8e7348" opacity=".55"/>`+corbelG(42+i*21.6,top+86,18,24);
  return o+'</svg>'}
export function profLayout(n: number, top: number) { // carte dietro il parapetto: 2 file (dietro più in alto)
  const nb = n <= 5 ? Math.floor(n / 2) : Math.ceil(n / 2), res: any[] = [];
  const put = (list: number[], bottom: number, w: number, sp: number, z: number, dx = 0) => { const m = (list.length - 1) / 2; list.forEach((i, k) => { res.push({ i, x: 186 + dx + (k - m) * sp + Math.sin(i * 7.3) * 5, bottom: bottom + Math.sin(i * 3.1) * 3, w, h: Math.round(w * 1.5), rot: Math.sin(i * 5.7) * 3, z: z + k }); }); };
  const back = Array.from({ length: nb }, (_, i) => i), front = Array.from({ length: n - nb }, (_, i) => nb + i);
  const big = n <= 5;
  put(back, top + 2, big ? 76 : 64, big ? 96 : 56, 8, big ? -30 : -14); put(front, top + 34, big ? 88 : 74, big ? 100 : 62, 20, big ? 24 : 10);
  return res;
}
function profCards(top, n = 8) { let o = ''; profLayout(n, top).forEach(c => { o += `<div style="position:absolute;width:${c.w}px;height:${c.h}px;left:${c.x - c.w / 2}px;top:${c.bottom - c.h}px;transform:rotate(${c.rot}deg);transform-origin:50% 100%;z-index:${c.z}"><div class="cdA" style="left:0;top:0;width:${c.w}px;height:${c.h}px;background-image:url(${URLS[c.i]})"><i>${c.i + 1}</i></div></div>`; }); return o; }
export function terraceHtml(urls: string[], n: number, opt: any = {}): string { URLS = urls; return terrace(n, opt); }
export function profileBack(top: number): string { return profBack(top); }
export function profileFront(top: number): string { return profFront(top); }
export function profileShaft(top: number, opts: any = {}): string { return profShaft(top, opts); }
export function profileCards(urls: string[], top: number): string { URLS = urls; return profCards(top, urls.length); }

