// Scena della torre: costruita dal prototipo approvato (mockups/wow/b4-caduta.html) e resa un modulo con API tipizzata.
// Il corpo è volutamente "grezzo" (nessun controllo dei tipi interno): l'interfaccia pubblica è quella di SceneApi.
// @ts-nocheck
import { cardFull } from "../lib/cards.ts";
import { profileShaft, profileBack, profileFront, profLayout } from "./draw.ts";


export interface ResultCue { fallPositions: number[]; seed: number }
export interface SceneOptions { cardIds: string[]; sound: () => boolean; reduced: boolean; }
export interface SceneApi {
  setSelected(pos: number | null): void;
  setLui(l: { pos: number; kind: "CADE" | "NON_CADE" | null } | null): void;
  showTokens(list: Token[]): void;
  play(cue: ResultCue, done: () => void): void;
  skip(): void;
  destroy(): void;
  itemsText(): string;
  fitScale(): number;
}
const TEMPLATE = `<div class="sky"></div><div class="skyg"></div><div class="skyh"></div><div class="sky2" id="sky2"></div><div class="far" id="far"></div><div class="world" id="world"></div><div class="lines" id="lines"></div><div class="aaah" id="aaah">AAAAAH!</div><div class="boing" id="boing"><span>BOING!</span></div><div class="ops" id="ops"><span>Spinto!</span></div><div class="flash" id="flash"></div>`;

export function createScene(root: HTMLElement, opts: SceneOptions): SceneApi {
  root.innerHTML = TEMPLATE;
  const NS = "http://www.w3.org/2000/svg";
  const $ = (id: string) => root.querySelector("#" + id) as HTMLElement;
  const W = $("world"), F = $("far");
  const add = (html: string, css: string, cls = "") => { const d = document.createElement("div"); d.className = cls; d.style.cssText = css; d.innerHTML = html; W.appendChild(d); return d; };
  const sm = (a: number, b: number, x: number) => { x = Math.min(1, Math.max(0, (x - a) / (b - a))); return x * x * (3 - 2 * x); };
  const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
  const N = opts.cardIds.length;
  let itemsText = "";
  let FALL = 0, used: string[] = [];

// ---- nuvole
const cloudSVG=(w)=>{const c='<circle cx="50" cy="52" r="28"/><circle cx="88" cy="38" r="34"/><circle cx="130" cy="48" r="30"/><circle cx="162" cy="58" r="22"/><rect x="24" y="52" width="160" height="28" rx="14"/>';return `<svg width="${w}" viewBox="0 0 210 100" overflow="visible"><g fill="#13224a" transform="translate(7 8)">${c}</g><g fill="#13224a" stroke="#13224a" stroke-width="7">${c}</g><g fill="#fff">${c}</g><path d="M30 76q80 12 150 0" stroke="#bfe9f5" stroke-width="9" fill="none" stroke-linecap="round"/></svg>`};
[[10,40,150],[230,150,120],[40,300,170],[210,470,130],[0,640,150],[230,820,170],[60,1010,130],[220,1200,150]].forEach(([x,y,w])=>{const c=document.createElement('div');c.style.cssText=`position:absolute;left:${x}px;top:${y}px`;c.innerHTML=cloudSVG(w);F.appendChild(c)});
// ---- paesaggio pop
const land=document.createElementNS(NS,'svg');land.setAttribute('viewBox','0 0 1400 700');land.style.cssText='position:absolute;left:-520px;top:1880px;width:1400px;height:700px;z-index:1';
land.innerHTML=`<defs><pattern id="ht" width="9" height="9" patternUnits="userSpaceOnUse"><circle cx="4.5" cy="4.5" r="2.4" fill="#13224a"/></pattern><linearGradient id="fade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff"/></linearGradient><mask id="mk"><rect width="1400" height="700" fill="url(#fade)"/></mask></defs>
<path d="M0 170Q220 60 470 150T930 130T1400 160V700H0Z" fill="#8fdcb0" stroke="#13224a" stroke-width="5"/><path d="M0 230Q260 150 560 215T1100 200T1400 225V700H0Z" fill="#2fb48f" stroke="#13224a" stroke-width="5"/><path d="M0 262Q300 236 700 258T1400 250V700H0Z" fill="#14a3a1" stroke="#13224a" stroke-width="5"/>
<rect y="262" width="1400" height="438" fill="url(#ht)" mask="url(#mk)" opacity=".55"/>
${Array.from({length:60},(_,i)=>`<path d="M${(i*23)%1400} ${320+(i*41)%340}l4 -13l4 13z" fill="#13224a" opacity=".6"/>`).join('')}`;
W.appendChild(land);
// ---- torre (regolamento, versione pop): i personaggi fanno capolino dietro i merli
const MT_=2034;const TX=61,TY=420,PAD=8/1.5,TWW=391/1.5,THH=2506/1.5;
W.insertAdjacentHTML('beforeend',profileShaft(TY,{height:2160-(TY+96),svgH:2300,windows:Array.from({length:7},(_,k)=>[k%2?198:70,TY+190+k*232,[]])}));W.insertAdjacentHTML('beforeend',profileBack(TY).replace('z-index:3','z-index:4'));W.insertAdjacentHTML('beforeend',profileFront(TY).replace('z-index:30','z-index:9'));

add('Torre del<br>Giudizio Spicciolo<small>vietato lanciare oggetti. Persone sì.</small>',`left:${TX+30}px;top:1010px;z-index:7;transform:rotate(-3deg)`,'gag');
add(`<svg width="64" height="56" viewBox="0 0 64 56"><path d="M8 36q4-22 26-20q16 2 18 16q-8 10-26 10z" fill="#9aa4b8" stroke="#13224a" stroke-width="3"/><circle cx="46" cy="20" r="9" fill="#9aa4b8" stroke="#13224a" stroke-width="3"/><path d="M54 21l9 3l-9 3z" fill="#ffc72c" stroke="#13224a" stroke-width="2"/><circle cx="48" cy="18" r="2" fill="#13224a"/><path d="M14 34q14-8 28 2" stroke="#13224a" stroke-width="3" fill="none"/><path d="M26 44v8M34 44v8" stroke="#13224a" stroke-width="3"/></svg>`,`left:${TX+176}px;top:1180px;z-index:7`);
add('«tra 200 m,<br>svolta a destra»',`left:${TX+80}px;top:1150px;z-index:7;transform:rotate(-4deg);font-size:12px`,'gag');
add('Ingresso<small>solo andata</small>',`left:${TX+78}px;top:1895px;z-index:7;transform:rotate(2deg);font-size:15px`,'gag');

  // ---- stato dell'interfaccia (selezione, segnalini, Lui!, risultato)
  let sel:number|null=null, cue:any=null, luiInfo:any=null, T0=0, raf=0, doneCb:any=null, firedEv:any={}, destroyed=false;
  let tokenEls:any[]=[];
  const lui=add('','left:150px;top:300px;z-index:13','lui');
  function buildTokens(list:any[]){tokenEls.forEach(k=>k.e.remove());tokenEls=[];const by:any={};list.forEach(t=>(by[t.pos]=by[t.pos]||[]).push(t));
    Object.keys(by).forEach(p=>by[p].forEach((t:any,i:number)=>{const c=CH[+p-1],a=by[p],tw=N>=7?24:28,gap=N>=7?14:18;
      const e=add(t.label,`width:${tw}px;height:${tw}px;font-size:${N>=7?12:14}px;left:${c.x-tw/2+(i-(a.length-1)/2)*gap}px;top:${c.feet-c.h-tw+2-(i%2)*7}px;background:${t.color};z-index:12`,'tk');
      e.title=t.name||'';tokenEls.push({e,pos:+p,i})}))}


  // ---- personaggi (per posizione 1..N)
  const CH:any[]=[], ch:any={};
  profLayout(N,TY).forEach((c:any)=>CH.push({n:c.i+1,x:c.x,feet:c.bottom,h:c.h,w:c.w,z:c.z>=20?7:5,rot:c.rot}));
  CH.forEach((c:any)=>{const d=document.createElement('div');d.className='cdA';d.dataset.pos=String(c.n);d.style.cssText=`width:${c.w}px;height:${c.h}px;left:${c.x-c.w/2}px;top:${c.feet-c.h}px;background-image:url(${cardFull(opts.cardIds[c.n-1]!)});z-index:${c.z};transform-origin:50% 100%;transform:rotate(${c.rot}deg)`;d.innerHTML=`<i>${c.n}</i>`;W.appendChild(d);ch[c.n]=d});

// ---- materassi: si piegano sotto il peso
const MX=70,MW=232;
function mkMat(color,w,h,id,x,y){
 const svg=document.createElementNS(NS,'svg');svg.setAttribute('width',w+14);svg.setAttribute('height',h+12);svg.setAttribute('viewBox',`0 0 ${w+14} ${h+12}`);svg.style.cssText=`left:${x}px;top:${y}px;z-index:9;overflow:visible`;
 const N=16;let polys='';for(let i=0;i<N;i++)polys+=`<polygon fill="${i%2?'#fff7e0':color}"/>`;
 svg.innerHTML=`<defs><clipPath id="cp${id}"><path/></clipPath></defs><path class="sh" fill="#13224a"/><g clip-path="url(#cp${id})">${polys}<path class="hl" fill="none" stroke="#fff" stroke-opacity=".28" stroke-width="12"/><rect class="bt" fill="#13224a" opacity=".2"/></g><path class="ol" fill="none" stroke="#13224a" stroke-width="4" stroke-linejoin="round"/><path class="pp" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="3" stroke-linecap="round"/><path class="stt" fill="none" stroke="#13224a" stroke-opacity=".5" stroke-width="2.5" stroke-dasharray="7 6"/>${[.18,.38,.62,.82].map(()=>'<circle r="3.4" fill="#13224a" class="bn"/>').join('')}`;
 W.appendChild(svg);
 const Q=s=>svg.querySelector(s),cp=svg.querySelector('clipPath path'),ps=[...svg.querySelectorAll('polygon')],bn=[...svg.querySelectorAll('.bn')];
 const r=14;
 return{svg,update(dip,spread){
  const L=3-spread,R=3+w+spread,T=3+Math.max(0,-dip)*0,B=3+h,cx=(L+R)/2,td=u=>T+4*dip*u*(1-u);
  const d=`M${L+r} ${B}H${R-r}Q${R} ${B} ${R} ${B-r}V${T+r}Q${R} ${T} ${R-r} ${T}Q${cx} ${T+2*dip} ${L+r} ${T}Q${L} ${T} ${L} ${T+r}V${B-r}Q${L} ${B} ${L+r} ${B}Z`;
  cp.setAttribute('d',d);Q('.ol').setAttribute('d',d);Q('.sh').setAttribute('d',d);Q('.sh').setAttribute('transform','translate(8 8)');
  const topY=x=>{const u=(R-r-x)/((R-r)-(L+r));return u<=0||u>=1?T:td(u)};
  const n=ps.length;for(let i=0;i<n;i++){const x0=L+(R-L)*i/n,x1=L+(R-L)*(i+1)/n;ps[i].setAttribute('points',`${x0},${topY(x0)} ${x1},${topY(x1)} ${x1},${B} ${x0},${B}`)}
  const my=B-10;Q('.bt').setAttribute('x',L);Q('.bt').setAttribute('y',my);Q('.bt').setAttribute('width',R-L);Q('.bt').setAttribute('height',12);
  Q('.hl').setAttribute('d',`M${L+16} ${T+9}Q${cx} ${T+9+2*dip} ${R-16} ${T+9}`);
  Q('.pp').setAttribute('d',`M${L+22} ${T+6}Q${cx} ${T+6+2*dip} ${R-22} ${T+6}`);
  Q('.stt').setAttribute('d',`M${L+14} ${T+h*.64}Q${cx} ${T+h*.64+dip} ${R-14} ${T+h*.64}`);
  [.18,.38,.62,.82].forEach((f,i)=>{const x=L+(R-L)*f,u=(R-x)/(R-L);bn[i].setAttribute('cx',x);bn[i].setAttribute('cy',T+h*.46+4*dip*.5*u*(1-u))});
 }}}
const mats=[mkMat('#e8362b',MW+14,40,'a',MX-7,2110),mkMat('#ffc72c',MW,40,'b',MX,2072),mkMat('#14a3a1',MW-14,40,'c',MX+7,2034)];
add('Assicurazione?<small>mai sentita</small>','left:236px;top:1966px;z-index:10;font-size:13px;transform:rotate(5deg)','gag');
// ---- folla: solo mani alzate (come in copertina), con oggetti buffi che cambiano a ogni caduta
const hs=document.createElementNS(NS,'svg');hs.setAttribute('viewBox','-520 2040 1400 560');hs.style.cssText='left:-520px;top:2040px;width:1400px;height:560px;z-index:12;pointer-events:none';W.appendChild(hs);
// mani del regolamento (immagine fornita dall'utente, ritaglio con tools/cutout_hands.py): 3 file a profondità diversa
const HW=1198,HH=616,CROP=250,HTIPS=[[375,240],[609,321],[774,338],[955,258],[1078,89],[1128,81]];
const HIMG='/scene/hands_cut.webp';
const tiles=[];
const defs=document.createElementNS(NS,'defs');defs.innerHTML='<filter id="dark0"><feComponentTransfer><feFuncR type="linear" slope=".78"/><feFuncG type="linear" slope=".78"/><feFuncB type="linear" slope=".8"/></feComponentTransfer></filter>';hs.appendChild(defs);
function mkTile(x0,top,sc,flip,full,dark,layer){
 const g=document.createElementNS(NS,'g');if(dark)g.setAttribute('filter','url(#dark0)');
 const vw=full?HW:HW-CROP,vx=full?0:CROP;
 const inner=document.createElementNS(NS,'svg');inner.setAttribute('width',vw);inner.setAttribute('height',HH);inner.setAttribute('viewBox',`${vx} 0 ${vw} ${HH}`);inner.setAttribute('overflow','hidden');
 const im=document.createElementNS(NS,'image');im.setAttribute('href',HIMG);im.setAttribute('width',HW);im.setAttribute('height',HH);inner.appendChild(im);
 const holder=document.createElementNS(NS,'g');holder.setAttribute('transform',flip?`translate(${x0+vw*sc} ${top}) scale(${-sc} ${sc})`:`translate(${x0} ${top}) scale(${sc} ${sc})`);holder.appendChild(inner);g.appendChild(holder);
 const og=document.createElementNS(NS,'g');g.appendChild(og);hs.appendChild(g);
 const tips=HTIPS.filter(([tx])=>tx>=vx).map(([tx,ty])=>({x:flip?x0+(vw-(tx-vx))*sc:x0+(tx-vx)*sc,y:top+ty*sc,sc}));
 const t={g,og,tips,cx:x0+vw*sc/2,base:top+HH*sc,ph:Math.random()*6,layer};tiles.push(t);return t}
[[-300,1],[-35,0],[230,1],[495,0]].forEach(([x,fl])=>mkTile(x,2178,.28,!!fl,false,true,0));
[[-150,0],[229,1],[608,0]].forEach(([x,fl])=>mkTile(x,2160,.4,!!fl,false,false,1));
mkTile(-60,2146,.6,false,true,false,2);
// pool di oggetti buffi (disegnati con base in (0,0), alti ~44)
const K='#13224a';
const OBJ={
 paperella:`<ellipse cx="0" cy="-12" rx="16" ry="11" fill="#ffd23c" stroke="${K}" stroke-width="3"/><circle cx="11" cy="-27" r="8.5" fill="#ffd23c" stroke="${K}" stroke-width="3"/><path d="M18 -27l9 3l-9 3z" fill="#f28a1e" stroke="${K}" stroke-width="2"/><circle cx="13" cy="-29" r="1.9" fill="${K}"/><path d="M-10 -14q8 -8 14 0" stroke="${K}" stroke-width="2.5" fill="none"/>`,
 pizza:`<path d="M-19 -40Q0 -50 19 -40L0 -2Z" fill="#ffc24a" stroke="${K}" stroke-width="3" stroke-linejoin="round"/><path d="M-19 -40Q0 -50 19 -40" stroke="#d9862b" stroke-width="7" fill="none"/><circle cx="-5" cy="-28" r="4.5" fill="#e8362b"/><circle cx="6" cy="-20" r="4" fill="#e8362b"/><circle cx="1" cy="-10" r="3" fill="#e8362b"/>`,
 ditone:`<rect x="-13" y="-24" width="26" height="24" rx="7" fill="#e8362b" stroke="${K}" stroke-width="3"/><rect x="-5" y="-50" width="10" height="30" rx="5" fill="#e8362b" stroke="${K}" stroke-width="3"/><text x="0" y="-8" text-anchor="middle" font-family="Anton" font-size="15" fill="#fff">1</text>`,
 banana:`<path d="M-15 -4Q-22 -32 9 -48Q-6 -24 13 -6Q-2 3 -15 -4Z" fill="#ffe14a" stroke="${K}" stroke-width="3" stroke-linejoin="round"/><path d="M9 -48l3 -4" stroke="#7a4a1a" stroke-width="4" stroke-linecap="round"/>`,
 popcorn:`<circle cx="-8" cy="-34" r="7" fill="#fff7e0" stroke="${K}" stroke-width="2.5"/><circle cx="3" cy="-38" r="8" fill="#fff7e0" stroke="${K}" stroke-width="2.5"/><circle cx="12" cy="-32" r="6.5" fill="#fff7e0" stroke="${K}" stroke-width="2.5"/><path d="M-15 -2L15 -2L19 -30L-19 -30Z" fill="#e8362b" stroke="${K}" stroke-width="3" stroke-linejoin="round"/><path d="M-7 -2L-9 -30M3 -2L3 -30M12 -2L14 -30" stroke="#fff" stroke-width="4"/>`,
 telefono:`<circle cx="0" cy="-48" r="14" fill="#fff" opacity=".85"/><path d="M0 -62v-8M-14 -56l-7 -5M14 -56l7 -5" stroke="#fff" stroke-width="3" stroke-linecap="round"/><rect x="-10" y="-38" width="20" height="38" rx="4" fill="${K}"/><rect x="-7" y="-34" width="14" height="28" rx="2" fill="#7fd6f0"/>`,
 baguette:`<g transform="rotate(14)"><rect x="-8" y="-56" width="16" height="56" rx="8" fill="#e8b25a" stroke="${K}" stroke-width="3"/><path d="M-4 -44l8 -4M-4 -32l8 -4M-4 -20l8 -4" stroke="#b9792a" stroke-width="3" stroke-linecap="round"/></g>`,
 padella:`<circle cx="0" cy="-32" r="17" fill="#2b2b36" stroke="${K}" stroke-width="3"/><circle cx="0" cy="-32" r="10" fill="#3a3a48"/><rect x="-3.5" y="-16" width="7" height="18" rx="3" fill="#a86a2b" stroke="${K}" stroke-width="2.5"/>`,
 sturalavandini:`<rect x="-2.5" y="-44" width="5" height="44" fill="#c68b5b" stroke="${K}" stroke-width="2.5"/><path d="M-15 -44Q0 -66 15 -44Z" fill="#e8362b" stroke="${K}" stroke-width="3" stroke-linejoin="round"/>`,
 trofeo:`<path d="M-13 -44H13Q13 -24 0 -22Q-13 -24 -13 -44Z" fill="#ffc72c" stroke="${K}" stroke-width="3" stroke-linejoin="round"/><path d="M-13 -40q-10 0 -8 9q2 5 9 5M13 -40q10 0 8 9q-2 5 -9 5" fill="none" stroke="${K}" stroke-width="3"/><rect x="-3" y="-22" width="6" height="14" fill="#ffc72c" stroke="${K}" stroke-width="2.5"/><rect x="-11" y="-8" width="22" height="8" rx="2" fill="#a86a2b" stroke="${K}" stroke-width="2.5"/>`,
 cactus:`<path d="M-9 -2L9 -2L12 -16L-12 -16Z" fill="#d9602a" stroke="${K}" stroke-width="3" stroke-linejoin="round"/><rect x="-7" y="-46" width="14" height="32" rx="7" fill="#3aa655" stroke="${K}" stroke-width="3"/><path d="M-7 -30h-6q-5 0 -5 -6v-6M7 -26h6q5 0 5 -6v-6" fill="none" stroke="${K}" stroke-width="9" stroke-linecap="round"/><path d="M-7 -30h-6q-5 0 -5 -6v-6M7 -26h6q5 0 5 -6v-6" fill="none" stroke="#3aa655" stroke-width="4" stroke-linecap="round"/>`,
 cartello10:`<rect x="-2" y="-34" width="4" height="34" fill="${K}"/><rect x="-23" y="-62" width="46" height="30" fill="#fff7e0" stroke="${K}" stroke-width="3"/><text x="0" y="-40" text-anchor="middle" font-family="Anton" font-size="24" fill="#e8362b">10</text>`,
 pomodoro:`<circle cx="0" cy="-15" r="14" fill="#e8362b" stroke="${K}" stroke-width="3"/><path d="M-8 -26l4 5l4 -6l4 6l4 -5l-8 -2z" fill="#3aa655" stroke="${K}" stroke-width="2"/>`,
 palloncino:`<path d="M0 0Q-6 -20 0 -34" stroke="${K}" stroke-width="2" fill="none"/><ellipse cx="0" cy="-52" rx="15" ry="19" fill="#ff7aa8" stroke="${K}" stroke-width="3"/><path d="M-4 -34l4 4l4 -4z" fill="#ff7aa8" stroke="${K}" stroke-width="2"/><path d="M-7 -60q2 -6 7 -7" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" opacity=".8"/>`
};
const NAMES={paperella:'paperella di gomma',pizza:'fetta di pizza',ditone:'dito di gommapiuma',banana:'banana',popcorn:'secchiello di popcorn',telefono:'telefono col flash',baguette:'baguette',padella:'padella',sturalavandini:'sturalavandini',trofeo:'trofeo',cactus:'cactus in vaso',cartello10:'cartello “10”',pomodoro:'pomodoro (maturo)',palloncino:'palloncino'};

function mulberry(a){return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
function placeObjects(seed){const r=mulberry(seed*7919+13);tiles.forEach(t=>t.og.innerHTML='');
 const keys=Object.keys(OBJ).sort(()=>r()-.5).slice(0,6);used=keys;
 const cand=[];tiles.filter(t=>t.layer>0).forEach(t=>t.tips.forEach(p=>{if(p.x>-30&&p.x<420&&!(p.x>50&&p.x<330&&p.y<2200))cand.push({t,p})}));
 cand.sort(()=>r()-.5);
 keys.forEach((k,j)=>{const c=cand[j];if(!c)return;const o=document.createElementNS(NS,'g');o.setAttribute('transform',`translate(${c.p.x} ${c.p.y+4}) scale(${.45+c.p.sc*1.4})`);o.innerHTML=OBJ[k];c.t.og.appendChild(o)});
 itemsText='Il pubblico ha portato: '+keys.map(k=>NAMES[k as keyof typeof NAMES]).join(', ')+'.'}

// ---- effetti spettacolari
const star4=(c)=>`<svg width="26" height="26" viewBox="-13 -13 26 26"><path d="M0 -12Q2 -2 12 0Q2 2 0 12Q-2 2 -12 0Q-2 -2 0 -12Z" fill="${c}" stroke="#13224a" stroke-width="1.6"/></svg>`;
[[40,120],[320,90],[60,380],[300,330],[180,200],[20,620],[330,560],[250,760],[90,900],[310,980],[150,1100],[50,1250]].forEach(([x,y],i)=>{const e=document.createElement('div');e.className='sp';e.style.cssText=`left:${x}px;top:${y}px;animation-delay:${-i*.37}s`;e.innerHTML=star4(i%3?'#fff':'#ffc72c');F.appendChild(e)});
const cone=add('',`left:0;top:${TY-330}px;width:190px;height:420px;z-index:4;pointer-events:none;mix-blend-mode:screen;background:linear-gradient(180deg,#fff7b8cc,#ffe27a55 55%,transparent);clip-path:polygon(40% 0,60% 0,100% 100%,0 100%)`);
const burst=add('',`left:${196-210}px;top:${MT_-230}px;width:420px;height:420px;z-index:31;pointer-events:none;opacity:0;background:repeating-conic-gradient(#ffc72c 0 9deg,#e8362b 9deg 18deg);-webkit-mask-image:radial-gradient(circle,transparent 8%,#000 28%,transparent 72%);mask-image:radial-gradient(circle,transparent 8%,#000 28%,transparent 72%);border-radius:50%`);
const rings=[0,1].map(i=>add(`<svg width="300" height="90" viewBox="-150 -45 300 90"><ellipse rx="140" ry="36" fill="none" stroke="#13224a" stroke-width="9"/><ellipse rx="140" ry="36" fill="none" stroke="#fff" stroke-width="4"/></svg>`,`left:${196-150}px;top:${MT_+2-45}px;z-index:31;pointer-events:none;opacity:0`));
const CONF=[];(function(){let sd=3;const r=()=>(sd=(sd*16807)%2147483647)/2147483647;const g=document.createElementNS(NS,'svg');g.setAttribute('viewBox','-520 1500 1400 900');g.style.cssText='left:-520px;top:1500px;width:1400px;height:900px;z-index:33;pointer-events:none;overflow:visible';W.appendChild(g);
 const cols=['#e8362b','#ffc72c','#14a3a1','#fff7e0','#ff7aa8','#13224a'];
 for(let i=0;i<80;i++){const e=document.createElementNS(NS,'rect');const w=7+r()*8,h=4+r()*7;e.setAttribute('width',w);e.setAttribute('height',h);e.setAttribute('fill',cols[i%6]);e.setAttribute('stroke','#13224a');e.setAttribute('stroke-width','1');e.setAttribute('opacity','0');g.appendChild(e);CONF.push({e,vx:-300+r()*600,vy:-760+r()*420,rs:(r()-.5)*900,w,h,dl:r()*.25})}})();
const back=x=>{x=Math.min(1,Math.max(0,x));const c=1.70158,c3=c+1;return 1+c3*Math.pow(x-1,3)+c*Math.pow(x-1,2)};
// ---- polvere e stelle
const puffs=[[30,2040],[96,2050],[300,2048],[230,2040],[160,2030]].map(([x,y])=>add('',`left:${x}px;top:${y}px;z-index:31`,'puff'));
const stars=add('<b>★</b><b>★</b><b>★</b>','width:70px;height:30px;z-index:32;opacity:0','stars');
const S0=N<=5?1.3:Math.max(1.16,1.3-0.045*(N-5)),CY0=TY+30-470/S0;
let FN=1,FNS:number[]=[1],fc=CH[0],f=ch[1];
const G=1000,Y0=TY-20,MT=2034,YI=MT-42,TF=Math.sqrt(2*(YI-Y0)/G),TS=0.65,TI=TS+TF;
const T_FALL=1.3,BNC=[[.55,170],[.34,70],[.2,24]];
const startY=()=>fc.feet-fc.h/2;
function cardState(t){
 if(t<0)return{x:fc.x,y:startY(),r:0,k:1};
 if(t<TS){const u=sm(0,TS,t);return{x:lerp(fc.x,196,u),y:lerp(startY(),Y0,u),r:-26*u,k:lerp(1,1.12,u)}}
 if(t<TI){const s=t-TS,p=s/TF;return{x:196+12*Math.sin(s*5),y:Y0+.5*G*s*s,r:-26-760*Math.pow(p,1.3),k:1.12-.12*p}}
 const d=t-TI;let y=YI,sx=1,sy=1;
 if(d<.14){const k=Math.sin(Math.PI*d/.14);sx=1+.25*k;sy=1-.28*k}
 let acc=0;for(const[du,h]of BNC){if(d>=acc&&d<acc+du){const u=(d-acc)/du;y=YI-h*4*u*(1-u);break}acc+=du}
 return{x:196-4*sm(0,1.5,d),y,r:-786+10*Math.sin(d*9)*Math.exp(-d*2.5),k:1,sx,sy}}
const TD=[TI,TI+.55,TI+.89,TI+1.09],AM=[30,15,8,3];
function dip(t){let d=0;TD.forEach((T0,k)=>{const u=(t-T0)/.34;if(u>0&&u<1)d+=AM[k]*Math.sin(Math.PI*u)*(1-.35*u)});return d+sm(TI+1.15,TI+1.6,t)*6}
function zoom(t){if(t<=.3)return S0;const a=lerp(S0,.72,sm(.3,1.6,t));if(t<TI-.7)return a;return lerp(.72,1.05,sm(TI-.7,TI+.35,t))}
function cam(t){const s=zoom(t),c=cardState(Math.max(t,0));let cy=CY0;if(t>0){const target=Math.max(CY0,Math.min(2600-826/s,c.y-340/s));cy=lerp(CY0,target,t>=TI?1:sm(.3,1.1,t))}return{s,cx:186-186/s,cy}}
let AC:any,master:any;const ac=()=>{if(!AC){AC=new (window.AudioContext||window.webkitAudioContext)();master=AC.createGain();master.gain.value=.5;master.connect(AC.destination)}return AC};
const on=()=>opts.sound();
function noise(d){const b=AC.createBuffer(1,AC.sampleRate*d,AC.sampleRate),a=b.getChannelData(0);for(let i=0;i<a.length;i++)a[i]=Math.random()*2-1;const s=AC.createBufferSource();s.buffer=b;return s}
const snd={wind(){if(!on())return;ac();const n=noise(TF+.2),fl=AC.createBiquadFilter(),g=AC.createGain();fl.type='bandpass';fl.frequency.setValueAtTime(300,AC.currentTime);fl.frequency.exponentialRampToValueAtTime(2400,AC.currentTime+TF);fl.Q.value=1.4;g.gain.setValueAtTime(.01,AC.currentTime);g.gain.linearRampToValueAtTime(.5,AC.currentTime+TF);g.gain.linearRampToValueAtTime(0,AC.currentTime+TF+.15);n.connect(fl).connect(g).connect(master);n.start()},
 thud(){if(!on())return;ac();const o=AC.createOscillator(),g=AC.createGain();o.frequency.setValueAtTime(140,AC.currentTime);o.frequency.exponentialRampToValueAtTime(40,AC.currentTime+.25);g.gain.setValueAtTime(.9,AC.currentTime);g.gain.exponentialRampToValueAtTime(.001,AC.currentTime+.3);o.connect(g).connect(master);o.start();o.stop(AC.currentTime+.32)},
 boing(a=1,f0=220){if(!on())return;ac();const o=AC.createOscillator(),g=AC.createGain(),l=AC.createOscillator(),lg=AC.createGain();o.type='triangle';o.frequency.setValueAtTime(f0,AC.currentTime);o.frequency.exponentialRampToValueAtTime(f0*2.6,AC.currentTime+.12);o.frequency.exponentialRampToValueAtTime(f0*.9,AC.currentTime+.5);l.frequency.value=22;lg.gain.value=30*a;l.connect(lg).connect(o.frequency);g.gain.setValueAtTime(.5*a,AC.currentTime);g.gain.exponentialRampToValueAtTime(.001,AC.currentTime+.5);o.connect(g).connect(master);o.start();l.start();o.stop(AC.currentTime+.55);l.stop(AC.currentTime+.55)},
 cheer(){if(!on())return;ac();const n=noise(1.4),fl=AC.createBiquadFilter(),g=AC.createGain();fl.type='bandpass';fl.frequency.value=1200;fl.Q.value=.6;g.gain.setValueAtTime(.001,AC.currentTime);g.gain.linearRampToValueAtTime(.35,AC.currentTime+.3);g.gain.linearRampToValueAtTime(0,AC.currentTime+1.4);n.connect(fl).connect(g).connect(master);n.start()}};

  const T_END=T_FALL+TI+2.4;
  function render(T:number){
   const t=T-T_FALL, playing=!!cue;
   tokenEls.forEach(k=>{const s=playing?back((T-(.3+k.i*.18+(k.pos-1)*.1))/.35):1;k.e.style.transform=`scale(${Math.max(0,s)})`;k.e.style.opacity=playing&&t>.3?String(1-sm(.3,.6,t)):'1'});
   if(luiInfo){const lc=CH[luiInfo.pos-1];lui.textContent=luiInfo.kind==='CADE'?'CADE LUI!':luiInfo.kind==='NON_CADE'?'NON CADE':'?';lui.classList.toggle('q',!luiInfo.kind);lui.style.left=(lc.x+22)+'px';lui.style.top=(lc.feet-lc.h-14)+'px';lui.style.transform=`rotate(8deg) scale(${playing?sm(1.2,1.5,T)*(1-sm(.1,.5,t)):1})`}else lui.style.transform='scale(0)';


 const sus=t<0?sm(.3,T_FALL,T):0;
 {const sc=sel?CH[sel-1]:null;cone.style.opacity=sc&&t<.3?String((.55+.45*Math.sin(T*3))):'0';if(sc)cone.style.left=(sc.x-95)+'px';}
 CH.forEach(c=>{const im=ch[c.n];im.classList.toggle('sel',c.n===sel&&t<.4);if(!FNS.includes(c.n)){}
  if(!FNS.includes(c.n))im.style.transform=`rotate(${c.rot+(c.n%2?-1:1)*sus*2.5}deg)`;im.style.transformOrigin='50% 100%'});
 const c=cardState(t),wob=t<0?Math.sin(T*28)*sus*3:0,h=fc.h,dp=dip(t);
 const hg=Math.max(0,YI-c.y);c.y+=dp*Math.max(0,Math.min(1,1-hg/22));
 const w=fc.w;
 if(t<TS*.3){f.style.zIndex=fc.z;f.style.left=(fc.x-w/2)+'px';f.style.top=(startY()-h/2)+'px';f.style.transformOrigin='50% 50%';f.style.transform=`rotate(${wob+(fc.rot||0)}deg)`}
 else{f.style.zIndex=30;f.style.left=(c.x-w/2)+'px';f.style.top=(c.y-h/2)+'px';f.style.transformOrigin='50% 50%';f.style.transform=`rotate(${c.r}deg) scale(${(c.sx||1)*c.k},${(c.sy||1)*c.k})`}
 FNS.slice(1).forEach((n,k)=>{const sfc=CH[n-1],sf=ch[n],keep=fc;fc=sfc;const tt=t-.07*(k+1),cc=cardState(Math.max(tt,-1));fc=keep;
  const dx=(k%2?1:-1)*(26+16*k)*sm(TS*.4,TI,tt),w2=sfc.w;
  if(tt<TS*.3){sf.style.zIndex=sfc.z;sf.style.left=(sfc.x-w2/2)+'px';sf.style.top=(sfc.feet-sfc.h/2-sfc.h/2)+'px';sf.style.transformOrigin='50% 50%';sf.style.transform=`rotate(${wob+(sfc.rot||0)}deg)`}
  else{sf.style.zIndex=30+k;sf.style.left=(cc.x+dx-w2/2)+'px';sf.style.top=(cc.y-sfc.h/2)+'px';sf.style.transformOrigin='50% 50%';sf.style.transform=`rotate(${cc.r}deg) scale(${(cc.sx||1)*cc.k},${(cc.sy||1)*cc.k})`}});
 const cm=cam(t),sh=t>TI?Math.sin((t-TI)*50)*Math.exp(-(t-TI)*7)*7:0;
 const dutch=-3*sm(.5,1.3,t)*(1-sm(TI-.3,TI+.4,t));const shk=0;
 W.style.transform=`translate(${sh+shk}px,${sh}px) translate(186px,413px) rotate(${dutch}deg) translate(-186px,-413px) scale(${cm.s}) translate(${-cm.cx}px,${-cm.cy}px)`;F.style.transform=`translateY(${-(cm.cy-CY0)*cm.s*.35}px)`;
 $('sky2').style.opacity=Math.min(1,Math.max(0,(cm.cy-CY0)/1500))*.75;
 mats.forEach((m,i)=>m.update(dp*[.25,.55,1][i],dp*[.08,.14,.22][i]));
  tiles.forEach(a=>{const j=t>TI+.1?Math.abs(Math.sin((t-TI)*9+a.ph))*(a.layer==2?20:a.layer==1?14:8)*Math.min(1,(t-TI)/.4)*(t>TI+2.6?0:1):Math.sin(T*1.6+a.ph)*(a.layer+1)*1.4;const wv=t>TI+.1?Math.sin((t-TI)*11+a.ph)*.05:Math.sin(T*1.3+a.ph)*.02;a.g.setAttribute('transform',`translate(0 ${-j}) rotate(${wv*57.3} ${a.cx} ${a.base})`)});
 puffs.forEach((p,i)=>{const d=t-TI-i*.02;p.style.opacity=d>0&&d<1?(1-d)*.9:0;p.style.transform=`scale(${.5+Math.max(0,d)*2.2}) translateY(${-Math.max(0,d)*30}px)`});
 stars.style.opacity=t>TI+1.1?1:0;stars.style.left=(c.x-30)+'px';stars.style.top=(c.y-90)+'px';
 const v=t>TS&&t<TI?(t-TS)/TF:0;$('lines').style.opacity=Math.min(1,v*2)*(t<TI?1:0);$('lines').style.backgroundPositionY=(t*1800%86)+'px';
 const sy=(c.y-cm.cy)*cm.s;
 const ca=$('aaah');ca.style.opacity=(t>.55&&t<TI-.05)?1:0;ca.style.left='34px';ca.style.top=(sy-110)+'px';ca.style.transform=`rotate(${-8+Math.sin(t*20)*3}deg) scale(${1+v*.5})`;
 const bo=$('boing'),d=t-TI;bo.style.opacity=(d>0&&d<1)?1:0;bo.style.top=(sy-215)+'px';bo.style.transform=`scale(${d>0?(.95-.15*sm(0,.2,d))*(1-sm(.6,1,d)):0}) rotate(-4deg)`;
 {const d2=t-TI;
  $('flash').style.opacity=d2>0&&d2<.2?.85*(1-d2/.2):0;
  burst.style.opacity=d2>0&&d2<.45?(1-d2/.45)*.95:0;burst.style.transform=`scale(${.25+Math.max(0,d2)*3.2}) rotate(${d2*60}deg)`;
  rings.forEach((rg,i)=>{const q=d2-.05-i*.18;rg.style.opacity=q>0&&q<.7?(1-q/.7)*.95:0;rg.style.transform=`scale(${.2+Math.max(0,q)*2.6})`});
  CONF.forEach(c=>{const q=d2-c.dl;if(q<0||q>2.6){c.e.setAttribute('opacity','0');return}const x=196+c.vx*q,y=MT_-30+c.vy*q+.5*800*q*q;c.e.setAttribute('opacity',String(1-sm(1.9,2.6,q)));c.e.setAttribute('transform',`translate(${x} ${y}) rotate(${c.rs*q})`)});
  const op=$('ops');op.style.opacity=(t>.12&&t<.8)?1:0;op.style.top=((c.y-cm.cy)*cm.s-120)+'px';op.style.left='62%';op.style.transform=`scale(${back((t-.12)/.2)*(1-sm(.6,.8,t))}) rotate(${Math.sin(t*30)*3}deg)`}
}
  const EVENTS:any[]=[[T_FALL+TS,()=>snd.wind()],[T_FALL+TI,()=>{snd.thud();snd.boing(1,200)}],[T_FALL+TI+.55,()=>snd.boing(.6,260)],[T_FALL+TI+.89,()=>snd.boing(.35,320)],[T_FALL+TI+1.0,()=>snd.cheer()]];
  fc=CH[0];f=ch[1];
  render(-1);
  const api:SceneApi={
    setSelected(pos){sel=pos;if(!cue)render(-1)},
    setLui(l){luiInfo=l;if(!cue)render(-1)},
    showTokens(list){buildTokens(list);if(!cue)render(-1)},
    play(c,done){cancelAnimationFrame(raf);cue=c;FNS=c.fallPositions.length?c.fallPositions:[1];FN=FNS[0]!;fc=CH[FN-1];f=ch[FN];sel=null;placeObjects(c.seed);doneCb=done;firedEv={};
      if(opts.reduced){render(T_END);cue.finished=true;done();return}
      T0=performance.now();try{ac()}catch{}
      const loop=(now:number)=>{if(destroyed)return;const T=(now-T0)/1000;render(Math.min(T,T_END));EVENTS.forEach((e,i)=>{if(!firedEv[i]&&T>=e[0]){firedEv[i]=1;e[1]()}});
        if(T<T_END)raf=requestAnimationFrame(loop);else{doneCb&&doneCb();doneCb=null}};
      raf=requestAnimationFrame(loop)},
    skip(){if(!cue)return;cancelAnimationFrame(raf);render(T_END);const d=doneCb;doneCb=null;d&&d()},
    destroy(){destroyed=true;cancelAnimationFrame(raf);root.innerHTML=''},
    itemsText:()=>itemsText,
    fitScale:()=>S0,
  };
  return api;
}
