/* =====================================================================
 * Powermind solar sizing calculator — live panel
 * Data (PC = postcode → sun+climate, SB = NatHERS star bands) is injected
 * as window.PC / window.SB by calculator.astro at build time.
 * ===================================================================== */
var PC = window.PC || {}, SB = window.SB || {};

/* ================= engine (solar_engine.js v3 + NatHERS + latitude + surplus-fill) ================= */
var HK=1.6,CK=3.5,HB=18,CB=24;
var CORE=[0.020,0.018,0.017,0.017,0.019,0.028,0.045,0.055,0.050,0.043,0.040,0.039,0.038,0.037,0.038,0.043,0.052,0.068,0.078,0.075,0.062,0.048,0.035,0.026];
var HEAT=[0.35,0.28,0.25,0.25,0.35,0.65,1,1,0.70,0.40,0.30,0.25,0.22,0.22,0.28,0.40,0.62,0.90,1,1,0.90,0.70,0.50,0.40];
var COOL=[0,0,0,0,0,0,0,0.10,0.20,0.30,0.45,0.60,0.80,0.95,1,1,0.95,0.85,0.90,0.80,0.60,0.40,0.20,0.08];
function blk(hrs){var a=new Array(24).fill(0);hrs.forEach(function(h){a[h]=1});return a;}
var HW_N=blk([4,5,6]),HW_D=blk([10,11,12,13]),EV_N=blk([21,22,23,0,1]),EV_D=blk([10,11,12,13,14,15]),PO_N=blk([22,23,0,1]),PO_D=blk([10,11,12,13,14,15]);
var HEAT_D=blk([10,11,12,13,14]),COOL_D=blk([10,11,12,13,14]),PRE=0.45; // pre-condition on surplus at midday
function norm(a){var s=a.reduce(function(x,y){return x+y},0)||1;return a.map(function(v){return v/s})}
function scl(sh,k){var n=norm(sh);return n.map(function(w){return w*k})}
function addI(d,s){for(var h=0;h<24;h++)d[h]+=s[h];return d}
function solarShape(se,lat){var decl=(se==='summer'?-23.4:23.4)*Math.PI/180,sr,ss;
  if(lat==null){sr=se==='summer'?5.5:7;ss=se==='summer'?19.5:17;}
  else{var l=lat*Math.PI/180,x=Math.max(-1,Math.min(1,-Math.tan(l)*Math.tan(decl))),Hh=Math.acos(x)*12/Math.PI;sr=12-Hh;ss=12+Hh;}
  var r=[];for(var h=0;h<24;h++){var t=h+0.5,x2=(t-sr)/(ss-sr);r.push(x2>0&&x2<1?Math.sin(Math.PI*x2):0)}return norm(r)}
function seasonTemp(sun,se){if(se==='summer')return sun.tjan;if(se==='winter')return sun.tjul;if(sun.tjan==null||sun.tjul==null)return null;return (sun.tjan+sun.tjul)/2}
function climate(T,hs,eff){var e=eff==null?1:eff,ht=T==null?0:Math.max(0,HB-T),co=T==null?0:Math.max(0,T-CB);return{heating:ht*HK*hs*e,cooling:co*CK*hs*e}}
function seasonComp(b,sun,se,hs,k,eff){var cl=climate(seasonTemp(sun,se),hs,eff);return{core:b.core*k,hotwater:b.hotwater*k,ev:b.ev*k,carHome:b.carHome,pool:b.pool*(se==='summer'?1:0.5)*k,heating:(se==='summer'?0:cl.heating)*k,cooling:(se==='winter'?cl.cooling*0.4:cl.cooling)*k}}
function compDaily(c){return c.core+c.hotwater+c.ev+c.pool+c.heating+c.cooling}
function computeDay(o){var se=o.season,used=o.mode==='used',c=o.comp;var gd=o.sunDaily*o.systemKW,gen=scl(solarShape(se,o.lat),gd);
  var base=new Array(24).fill(0);addI(base,scl(CORE,c.core));var load;
  if(!used){ load=base;
    if(c.hotwater>0)addI(load,scl(HW_N,c.hotwater));
    if(c.pool>0)addI(load,scl(PO_N,c.pool));
    if(c.ev>0)addI(load,scl(EV_N,c.ev));
    if(c.heating>0)addI(load,scl(HEAT,c.heating));
    if(c.cooling>0)addI(load,scl(COOL,c.cooling));
  } else {
    // fixed loads stay at natural times: full core, EV's away-share, and the un-shifted comfort
    var evShift=(c.ev||0)*c.carHome, evNight=(c.ev||0)-evShift;
    if(evNight>0)addI(base,scl(EV_N,evNight));
    var heatShift=0,coolShift=0;
    if(c.heating>0){heatShift=c.heating*PRE;addI(base,scl(HEAT,c.heating-heatShift));}
    if(c.cooling>0){coolShift=c.cooling*PRE;addI(base,scl(COOL,c.cooling-coolShift));}
    // the flexible pool (hot water, day-EV, pool, pre-conditioning) FILLS the daytime surplus, no further
    var poolTot=(c.hotwater||0)+evShift+(c.pool||0)+heatShift+coolShift;
    load=base.slice();
    var sur=[],tot=0;for(var h=0;h<24;h++){sur[h]=Math.max(0,gen[h]-base[h]);tot+=sur[h];}
    var frac=tot>0?Math.min(1,poolTot/tot):0,placed=0;
    for(var h=0;h<24;h++){var add=sur[h]*frac;load[h]+=add;placed+=add;}
    var left=poolTot-placed; // whatever the sun couldn't cover runs overnight
    if(left>0.01){var on=scl(EV_N,left);for(var h=0;h<24;h++)load[h]+=on[h];}
  }
  var su=[],ex=[],gr=[],tg=0,tu=0,te=0,tgr=0,tl=0;
  for(var h=0;h<24;h++){var s=gen[h],l=load[h],u=Math.min(s,l),e=Math.max(0,s-l),g=Math.max(0,l-s);su.push(u);ex.push(e);gr.push(g);tg+=s;tl+=l;tu+=u;te+=e;tgr+=g}
  return{gen:gen,load:load,solarUsed:su,exportKWh:ex,gridKWh:gr,totals:{generated:tg,load:tl,selfUsed:tu,exported:te,fromGrid:tgr,selfConsumption:tg?tu/tg:0}}}
function runEngine(inp){var L=inp.loads||{};
  var base={core:inp.coreDaily,hotwater:L.hotwater==='resistive'?8:(L.hotwater==='heatpump'?3.5:0),ev:L.ev?10:0,carHome:L.carHome==null?0.5:L.carHome,pool:L.pool?4.5:0};
  var hs=base.core/8,eff=inp.effRatio==null?1:inp.effRatio,sun=inp.sun,hasH=!!L.heating,hasC=!!L.cooling;
  function adj(se){var c=seasonComp(base,sun,se,hs,1,eff);if(!hasH)c.heating=0;if(!hasC)c.cooling=0;return c}
  var k=1;if(inp.bill&&inp.bill.daily>0){var cS=adj(inp.bill.season),m=compDaily(cS);if(m>0)k=inp.bill.daily/m}
  function sc(se){var c=seasonComp(base,sun,se,hs,k,eff);if(!hasH)c.heating=0;if(!hasC)c.cooling=0;return c}
  function day(se,mo){return computeDay({sunDaily:sun[se],systemKW:inp.systemKW,comp:sc(se),season:se,mode:mo,lat:inp.lat})}
  var s=sc('summer'),w=sc('winter');
  return{summerDaily:Math.round(compDaily(s)),winterDaily:Math.round(compDaily(w)),
    summer:{exported:day('summer','exported'),used:day('summer','used')},winter:{exported:day('winter','exported'),used:day('winter','used')}}}

/* ================= lookups ================= */
function rec(pc){return PC[pc]}
function sunOf(pc){var d=PC[pc];return d?{annual:d[1],summer:d[2],winter:d[3],tjan:d[4],tjul:d[5]}:null}
function effRatio(zone,star){var b=SB[zone];if(!b)return 1;var t=b['3.5']||b['3.0'];var v=b[String(star)]||b[star.toFixed(1)];return (t&&v)?v/t:1}

/* ================= state ================= */
var st={pc:'2600',core:10,star:3.5,hw:'heatpump',kw:6.6,season:'summer',mode:'exported',daytype:'average',
  loads:{heating:true,cooling:true,ev:true,pool:false},carHome:0.5,bill:false,billv:null,billseason:'spring'};
var STAR_LABEL={'2':'Older / draughty (~2★)','3.5':'Typical (~3.5★)','6':'Newer / insulated (~6★)','8':'High-performance (~8★)'};

/* ================= chart ================= */
var W=820,H=340,ML=40,MR=16,MT=18,MB=30,PW=W-ML-MR,PH=H-MT-MB;
function xF(h){return ML+(h/24)*PW}function yF(v,m){return MT+PH-(v/m)*PH}
function fx(k,n){return ML+(k/(n-1))*PW}
function band(top,bot,m){var n=top.length,p='';for(var k=0;k<n;k++)p+=(k?'L':'M')+fx(k,n).toFixed(1)+' '+yF(top[k],m).toFixed(1);for(var k=n-1;k>=0;k--)p+='L'+fx(k,n).toFixed(1)+' '+yF(bot[k],m).toFixed(1);return p+'Z'}
function line(v,m){var n=v.length,p='';for(var k=0;k<n;k++)p+=(k?'L':'M')+fx(k,n).toFixed(1)+' '+yF(v[k],m).toFixed(1);return p}
function draw(){
  var sun=sunOf(st.pc); if(!sun){document.getElementById('headline').innerHTML='<span style="color:#e0736a">We don’t have that postcode yet — try a nearby one.</span>';return;}
  var zone=rec(st.pc)[6], eff=effRatio(zone,st.star);
  // clear day: panels make ~1.5x an average winter day, ~1.25x an average summer day (from real spread)
  var clearF=st.season==='winter'?1.5:1.25, gmul=(st.daytype==='clear')?clearF:1;
  var genSun={annual:sun.annual,summer:sun.summer*gmul,winter:sun.winter*gmul,tjan:sun.tjan,tjul:sun.tjul};
  var inp={sun:genSun,systemKW:st.kw,coreDaily:st.core,effRatio:eff,lat:rec(st.pc)[7],
    loads:{hotwater:st.hw,heating:st.loads.heating,cooling:st.loads.cooling,ev:st.loads.ev,carHome:st.carHome,pool:st.loads.pool},
    bill:(st.bill&&st.billv>0)?{daily:st.billv,season:st.billseason}:null};
  var r=runEngine(inp);
  // annual figures (always on the AVERAGE, not the clear day)
  var annualGen=Math.round(sun.annual*st.kw);
  var annualUse=Math.round((r.summerDaily+r.winterDaily)/2*365);
  var canon=r[st.season].exported, cur=r[st.season][st.mode];   // made/used are mode-independent; self-use is not
  document.getElementById('statrow').innerHTML=
    '<div class="statcard"><div class="k">This system generates</div><div class="v amb">'+annualGen.toLocaleString()+'</div><div class="s">kWh / year (average)</div></div>'+
    '<div class="statcard"><div class="k">Your home uses</div><div class="v ink">'+annualUse.toLocaleString()+'</div><div class="s">kWh / year</div></div>'+
    '<div class="statcard"><div class="k">'+(st.daytype==='clear'?'A clear':'An average')+' '+st.season+' day</div><div class="v amb">'+Math.round(canon.totals.generated)+' <span style="font-size:13px;color:var(--muted);font-weight:600">kWh solar</span></div><div class="s">your home uses '+Math.round(canon.totals.load)+' kWh</div></div>'+
    '<div class="statcard"><div class="k">Solar you use · '+(st.mode==='used'?'surplus used':'as-is')+'</div><div class="v grn">'+(st.mode==='used'?'up to ':'')+Math.round(cur.totals.selfConsumption*100)+'%</div><div class="s">of the solar you make'+(st.mode==='used'?' · best case':'')+'</div></div>';
  // the kicker: the $ value of using your surplus (as-is -> used) = the Powermind benefit
  var sEx=r.summer.exported.totals,sUs=r.summer.used.totals,wEx=r.winter.exported.totals,wUs=r.winter.used.totals;
  var annGenD=(sEx.generated+wEx.generated)/2*365;
  var annSelfEx=(sEx.selfUsed+wEx.selfUsed)/2*365, annSelfUs=(sUs.selfUsed+wUs.selfUsed)/2*365;
  var save=Math.max(0,Math.round((annSelfUs-annSelfEx)*0.25/10)*10);   // ~25c/kWh net (buy ~30c, feed-in ~5c)
  var pEx=annGenD?Math.round(annSelfEx/annGenD*100):0, pUs=annGenD?Math.round(annSelfUs/annGenD*100):0;
  var kick=document.getElementById('kicker');
  if(st.mode==='used'){ kick.style.display='block';
    kick.innerHTML='<div class="kmain">Over a year, using your surplus could save about <b>$'+save.toLocaleString()+'</b> — and lift the solar you use from <b>'+pEx+'%</b> toward <b>'+pUs+'%</b>.</div>'+
      '<div class="ksub">A yearly figure: it soaks a big summer surplus and all of your smaller winter one. That everyday coordination is the job <a href="/app">Powermind</a> does for you — no timers, no thinking. <span class="kfoot">Estimate at typical rates (buy ~30c, feed-in ~5c/kWh); your tariff moves it.</span></div>';
  } else kick.style.display='none';

  // hero: the size, front and centre — the user slides it and decides; we don't prescribe
  document.getElementById('kwBig').textContent=(+st.kw.toFixed(2));
  document.getElementById('panelBig').textContent=Math.round(st.kw/0.44);
  document.getElementById('heroNote').innerHTML='Slide the size and watch your generation and self-use move — there’s no single right answer, so land on what suits your roof, budget and how much you’d use. Your home uses about <b style="color:var(--ink)">'+annualUse.toLocaleString()+'</b> kWh a year. <a href="#overview">Read the full overview ↓</a>';
  var day=r[st.season][st.mode], asis=r[st.season].exported, sm=r[st.season].used;
  // fine-sample so the export<->import handover lands exactly where gen crosses load
  var wrap=function(a){return a.concat([a[0]])};
  var GEN=wrap(day.gen),LOAD=wrap(day.load),R=8,N=24*R;
  function ip(a,x){var lo=Math.floor(x),hi=Math.min(lo+1,24),f=x-lo;return a[lo]*(1-f)+a[hi]*f;}
  var su=[],load=[],gen=[],topG=[],topE=[],zero=[];
  for(var s=0;s<=N;s++){var x=s*24/N,g=ip(GEN,x),l=ip(LOAD,x),u=Math.min(g,l);
    gen.push(g);load.push(l);su.push(u);topG.push(u+Math.max(0,l-g));topE.push(u+Math.max(0,g-l));zero.push(0);}
  var ymax=1;for(var h=0;h<24;h++)ymax=Math.max(ymax,day.gen[h],day.load[h]);ymax=Math.ceil(ymax*1.15);
  var s='';
  for(var g=0;g<=ymax;g+=(ymax>8?2:1)){var y=yF(g,ymax);
    s+='<line x1="'+ML+'" y1="'+y.toFixed(1)+'" x2="'+(W-MR)+'" y2="'+y.toFixed(1)+'" stroke="#1e2530" stroke-width="1"/>';
    s+='<text x="'+(ML-7)+'" y="'+(y+3.5).toFixed(1)+'" text-anchor="end" font-size="10" fill="rgba(255,255,255,.32)">'+g+'</text>';}
  s+='<text x="'+(ML-28)+'" y="'+(MT+PH/2)+'" font-size="10" fill="rgba(255,255,255,.32)" transform="rotate(-90 '+(ML-28)+' '+(MT+PH/2)+')" text-anchor="middle">kW</text>';
  [[0,'12am'],[6,'6am'],[12,'noon'],[18,'6pm'],[24,'12am']].forEach(function(t){var a=t[0]===0?'start':(t[0]===24?'end':'middle');
    s+='<text x="'+xF(t[0])+'" y="'+(H-10)+'" text-anchor="'+a+'" font-size="10.5" fill="rgba(255,255,255,.32)">'+t[1]+'</text>';});
  s+='<defs><pattern id="hatch" width="6" height="6" patternTransform="rotate(45)" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill="rgba(239,159,39,.10)"/><line x1="0" y1="0" x2="0" y2="6" stroke="#EF9F27" stroke-width="2" opacity="0.55"/></pattern></defs>';
  s+='<path d="'+band(topE,su,ymax)+'" fill="url(#hatch)"/>';
  s+='<path d="'+band(topG,su,ymax)+'" fill="#378ADD" opacity="0.62"/>';
  s+='<path d="'+band(su,zero,ymax)+'" fill="#EF9F27" opacity="0.92"/>';
  s+='<path d="'+line(gen,ymax)+'" fill="none" stroke="#FAC775" stroke-width="1.3" stroke-dasharray="4 3" opacity="0.55"/>';
  s+='<path d="'+line(load,ymax)+'" fill="none" stroke="#f0ede6" stroke-width="2.4" stroke-linejoin="round"/>';
  document.getElementById('chart').innerHTML=s;

  var scA=Math.round(asis.totals.selfConsumption*100),scS=Math.round(sm.totals.selfConsumption*100);
  var genD=Math.round(asis.totals.generated),useD=Math.round(asis.totals.load);  // mode-independent, no flicker
  var place=(rec(st.pc)[0]||'').split(',')[0];
  document.getElementById('htitle').textContent=(st.daytype==='clear'?'A clear ':'An average ')+st.season+' day'+(place?' in '+place:'');
  var hl;
  if(st.season==='summer'){
    hl='You’d make about <b>'+genD+' kWh</b> and use <b>'+useD+'</b> that day. With the EV and hot water running at night you’d use only <span class="amb">'+scA+'%</span> of your own solar — the rest is surplus you export for cents, then buy back after dark. Point that surplus at your big loads and it climbs to as much as <span class="grn">'+scS+'%</span>.';
  } else {
    hl='In winter the sun barely covers you: about <b>'+genD+' kWh</b> made against <b>'+useD+'</b> used. On a day like this, timing your loads could use up to <span class="grn">'+scS+'%</span> of your (small) winter solar — but there’s not much of it, so you still lean on the grid. Winter solar simply isn’t enough for a whole home; staying grid-connected does the heavy lifting while Powermind makes the most of the little sun there is.';
  }
  document.getElementById('headline').innerHTML=hl;
  var un=document.getElementById('usednote');
  if(st.mode==='used'){var soak=Math.round((1-cur.totals.exported/Math.max(0.01,cur.totals.generated))*100);
    un.style.display='block';
    un.innerHTML='Shown on a day where your big loads can soak the surplus — hot water, EV'+(st.loads.heating?' and pre-heating':(st.loads.cooling?' and pre-cooling':''))+' timed to the sun can capture up to <b>'+soak+'%</b> of your solar on a day like this. Timing all of that by hand is fiddly — coordinating it for you automatically is what <a href="/app" style="color:var(--amber-lt);font-weight:700">Powermind</a> is built to do. On a bright day the surplus can outrun even your loads; catching that too — and orchestrating a battery, in a future version — is exactly the job it’s made for.'+
      '<span class="research"><b>Backed by Australian field research:</b> UNSW’s <a href="https://arena.gov.au/assets/2023/07/demand-flexibility-portfolio-retrospective-analysis-report.pdf" target="_blank" rel="noopener">SolarShift</a> trial (18,000 SA homes) shifted close to half of household hot water from night into the sun at full comfort — only 0.3% opted out; ANU’s Battery Storage &amp; Grid Integration program measured home self-consumption rising <b>34% → 58%</b> under coordinated control.</span>';
  } else un.style.display='none';
  document.getElementById('tag').textContent='postcode '+st.pc+' · '+(rec(st.pc)[0]||'');

  // inverter insert — reactive, keyed off the array size only (133% CEC oversize rule; ~5kW/phase export)
  var _iv=[3,5,6,8.2,10,13.3],_need=st.kw/1.33,_inv=_iv[_iv.length-1];
  for(var _i=0;_i<_iv.length;_i++){if(_iv[_i]>=_need-0.001){_inv=_iv[_i];break;}}
  var _fk=function(v){return (Math.round(v*10)/10).toString().replace(/\.0$/,'');};
  var _three=_inv>5,
      _sent='This sizes your panels, not your inverter — a <span class="ikw">'+_fk(st.kw)+' kW</span> system typically runs a <span class="ikw">~'+_fk(_inv)+' kW</span> one'+
        (_three?', above the 5 kW single-phase cap, so you’d likely need <span class="ikw">three-phase power</span>.'
               :'. Most homes can export about 5 kW, so a system this size already sits near the cap.');
  var _is=document.getElementById('invSent');if(_is)_is.innerHTML=_sent;
}

/* ================= wiring ================= */
var pcIn=document.getElementById('pc'),pcHint=document.getElementById('pcHint');
pcIn.addEventListener('input',function(){var v=this.value.replace(/\D/g,'').slice(0,4);this.value=v;
  if(v.length===4&&sunOf(v)){st.pc=v;this.classList.remove('bad');pcHint.textContent=rec(v)[0]+' · NatHERS zone '+rec(v)[6];draw();}
  else if(v.length===4){this.classList.add('bad');pcHint.textContent='Not found — try a nearby postcode';}});
document.getElementById('people').addEventListener('click',function(e){var b=e.target.closest('button');if(!b)return;st.core=parseFloat(b.dataset.d);[].forEach.call(this.children,function(c){c.classList.toggle('on',c===b)});draw();});
var effHints={'2':'Older / draughty home (~2 star) — heats and cools hard.','3.5':'Typical existing home (~3.5 star). Most Australian homes sit here.','6':'Newer / well-insulated home (~6 star).','8':'High-performance home (~8 star) — needs very little heating or cooling.'};
document.getElementById('eff').addEventListener('click',function(e){var b=e.target.closest('button');if(!b)return;st.star=parseFloat(b.dataset.star);[].forEach.call(this.children,function(c){c.classList.toggle('on',c===b)});document.getElementById('effHint').textContent=effHints[b.dataset.star];draw();});
document.getElementById('hw').addEventListener('change',function(){st.hw=this.value;draw();});
document.getElementById('kw').addEventListener('input',function(){st.kw=parseFloat(this.value);document.getElementById('kwHint').textContent=(+st.kw.toFixed(2))+' kW · ≈ '+Math.round(st.kw/0.44)+' panels (440 W)';draw();});
document.getElementById('seasonSeg').addEventListener('click',function(e){var b=e.target.closest('button');if(!b)return;st.season=b.dataset.s;[].forEach.call(this.children,function(c){c.classList.toggle('on',c===b)});draw();});
document.getElementById('daySeg').addEventListener('click',function(e){var b=e.target.closest('button');if(!b)return;st.daytype=b.dataset.t;[].forEach.call(this.children,function(c){c.classList.toggle('on',c===b)});draw();});
document.getElementById('surSeg').addEventListener('click',function(e){var b=e.target.closest('button');if(!b)return;st.mode=b.dataset.m;[].forEach.call(this.children,function(c){c.classList.toggle('on',c===b)});draw();});
[].forEach.call(document.querySelectorAll('#solarcalc .chips .chip'),function(c){c.onclick=function(){var l=c.dataset.l;st.loads[l]=!st.loads[l];c.classList.toggle('on',st.loads[l]);if(l==='ev')document.getElementById('evwrap').classList.toggle('show',st.loads.ev);draw();}});
document.getElementById('carhome').addEventListener('click',function(e){var b=e.target.closest('button');if(!b)return;st.carHome=parseFloat(b.dataset.c);[].forEach.call(this.children,function(c){c.classList.toggle('on',c===b)});draw();});
document.getElementById('billToggle').onclick=function(){st.bill=!st.bill;this.classList.toggle('on',st.bill);document.getElementById('billwrap').style.display=st.bill?'flex':'none';draw();};
document.getElementById('billv').addEventListener('input',function(){st.billv=parseFloat(this.value)||null;draw();});
document.getElementById('billseason').addEventListener('click',function(e){var b=e.target.closest('button');if(!b)return;st.billseason=b.dataset.s;[].forEach.call(this.children,function(c){c.classList.toggle('on',c===b)});draw();});
document.getElementById('footTog').onclick=function(){var f=document.getElementById('footFull');f.classList.toggle('show');this.textContent=f.classList.contains('show')?'Less ▴':'More ▾';};
document.getElementById('swExp').style.backgroundImage='repeating-linear-gradient(45deg,rgba(239,159,39,.18) 0 3px,#EF9F27 3px 5px)';
document.getElementById('invWhy').onclick=function(){document.getElementById('invExp').classList.toggle('open');};
draw();  // starts at a neutral 6.6 kW (the common Australian size) — a starting point, not a recommendation

/* =====================================================================
 * SOLAR REPORT (PDF) — recomputes from the same engine as the panel.
 * Reflects the size the user LANDED ON (not a recommendation) plus the
 * self-use / surplus story that is the Powermind benefit.
 * ===================================================================== */
// Newsletter opt-in destination. MUST be the custom domain, not the .ghost.io host —
// /members/api/send-magic-link/ 301s on the-molonglo.ghost.io and a redirect drops the
// POST body, so signups would fail silently. Verified 2026-08-14.
var GHOST_URL = 'https://news.powermind.com.au';

function reportData(){
  var sun=sunOf(st.pc)||sunOf('2600');
  var r0=rec(st.pc)||rec('2600');
  var zone=r0[6], eff=effRatio(zone,st.star), lat=r0[7];
  var inp={sun:{annual:sun.annual,summer:sun.summer,winter:sun.winter,tjan:sun.tjan,tjul:sun.tjul},
    systemKW:st.kw,coreDaily:st.core,effRatio:eff,lat:lat,
    loads:{hotwater:st.hw,heating:st.loads.heating,cooling:st.loads.cooling,ev:st.loads.ev,carHome:st.carHome,pool:st.loads.pool},
    bill:(st.bill&&st.billv>0)?{daily:st.billv,season:st.billseason}:null};
  var r=runEngine(inp);
  var annualGen=Math.round(sun.annual*st.kw);
  var annualUse=Math.round((r.summerDaily+r.winterDaily)/2*365);
  var sEx=r.summer.exported.totals,sUs=r.summer.used.totals,wEx=r.winter.exported.totals,wUs=r.winter.used.totals;
  var annGenD=(sEx.generated+wEx.generated)/2*365;
  var annSelfEx=(sEx.selfUsed+wEx.selfUsed)/2*365, annSelfUs=(sUs.selfUsed+wUs.selfUsed)/2*365;
  var save=Math.max(0,Math.round((annSelfUs-annSelfEx)*0.25/10)*10);
  var pEx=annGenD?Math.round(annSelfEx/annGenD*100):0, pUs=annGenD?Math.round(annSelfUs/annGenD*100):0;
  var exported=Math.max(0,Math.round(annualGen*(1-(annGenD?annSelfEx/annGenD:0))));
  var hwMap={heatpump:'Heat pump',resistive:'Electric (tank)',gas:'Gas',solar:'Solar hot water'};
  var loads=[]; if(st.loads.heating)loads.push('reverse-cycle heating'); if(st.loads.cooling)loads.push('aircon'); if(st.loads.ev)loads.push('EV'); if(st.loads.pool)loads.push('pool');
  var ppl={5:'1',7:'2',8.5:'3',10:'4',12:'5+'}[st.core]||'4';
  var starShort={'2':'2-star','3.5':'3.5-star','6':'6-star','8':'8-star'}[String(st.star)]||'3.5-star';
  return {
    date: new Date().toLocaleDateString('en-AU', {day:'numeric', month:'long', year:'numeric'}),
    postcode: st.pc, place: (r0[0]||'').replace(/^[^,]*,\s*/,'') || (r0[0]||''), placeFull: r0[0]||'', zone: zone,
    household: ppl + ' people · ' + starShort,
    hotWater: hwMap[st.hw]||'—',
    adding: loads.length ? loads.join(' · ') : 'None',
    kw: (+st.kw.toFixed(2)) + ' kW', panels: '~ ' + Math.round(st.kw/0.44) + ' panels',
    annualGen: annualGen.toLocaleString() + ' kWh', annualUse: annualUse.toLocaleString() + ' kWh',
    seasonal: Math.round(sEx.generated) + ' / ' + Math.round(wEx.generated) + ' kWh',
    selfPct: pEx + '%', selfPctUsed: pUs + '%',
    save: '$' + save.toLocaleString(),
    exportedKwh: exported.toLocaleString()
  };
}

function loadJsPDF(cb){
  if (window.jspdf && window.jspdf.jsPDF) return cb();
  var s = document.createElement('script');
  s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
  s.onload = cb;
  s.onerror = function(){ alert('Could not load the PDF tool. Please check your connection and try again.'); };
  document.head.appendChild(s);
}
function loadLogo(cb){
  var img = new Image();
  img.onload = function(){ cb(img); };
  img.onerror = function(){ cb(null); };
  img.src = '/android-chrome-192x192.png';
}

function generatePDF(d, logo){
  var jsPDF = window.jspdf.jsPDF;
  var doc = new jsPDF({unit:'pt', format:'a4'});
  var W = 595.28, H = 841.89, M = 44, CW = W - M*2;
  var ink=[15,18,22], muted=[92,100,112], faint=[150,158,170], line=[224,228,235],
      amberd=[150,90,10], green=[29,110,80], navy=[19,35,58];
  var y;
  doc.setFillColor(239,159,39); doc.rect(0,0,W,5,'F');
  if (logo){ try{ doc.addImage(logo,'PNG',M,26,26,26); }catch(e){} }
  doc.setFont('helvetica','bold'); doc.setFontSize(15); doc.setTextColor(15,18,22);
  doc.text('Powermind', M+34, 44);
  doc.setFontSize(9); doc.setTextColor(150,90,10);
  doc.text('SOLAR SIZING REPORT', W-M, 38, {align:'right'});
  doc.setFont('helvetica','normal'); doc.setTextColor(92,100,112);
  doc.text('Prepared ' + d.date, W-M, 51, {align:'right'});
  doc.setDrawColor(224,228,235); doc.setLineWidth(1); doc.line(M,64,W-M,64);

  y = 92;
  doc.setFont('helvetica','bold'); doc.setFontSize(22); doc.setTextColor(15,18,22);
  doc.text('Your solar sizing report', M, y); y += 18;
  doc.setFont('helvetica','normal'); doc.setFontSize(10.5); doc.setTextColor(92,100,112);
  var lede = doc.splitTextToSize('The size you’ve landed on, and what it would do on a real day for your postcode — built from Bureau of Meteorology sun and temperature data and your own loads. Not a recommendation or a quote: a grounded reference point to weigh up and to compare any installer’s against.', CW);
  doc.text(lede, M, y); y += lede.length*13 + 12;

  function label(t){ doc.setFont('helvetica','bold'); doc.setFontSize(8.5); doc.setTextColor(150,158,170); doc.text(t.toUpperCase(), M, y); y += 13; }

  label('Your home');
  var items = [['Location','Postcode '+d.postcode],['NatHERS zone','Zone '+d.zone],['Household',d.household],['Hot water',d.hotWater]];
  var colW = CW/4, rowH = 40, gy = y;
  doc.setDrawColor(224,228,235); doc.setLineWidth(1);
  doc.roundedRect(M, gy, CW, rowH, 8, 8);
  for (var vln=1;vln<4;vln++) doc.line(M+colW*vln, gy, M+colW*vln, gy+rowH);
  for (var i=0;i<4;i++){
    var cx = M + i*colW + 12;
    doc.setFont('helvetica','bold'); doc.setFontSize(7.5); doc.setTextColor(150,158,170);
    doc.text(items[i][0].toUpperCase(), cx, gy+16);
    doc.setFont('helvetica','bold'); doc.setFontSize(10); doc.setTextColor(15,18,22);
    doc.text(doc.splitTextToSize(items[i][1], colW-16)[0], cx, gy+30);
  }
  y = gy + rowH + 12;
  doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(92,100,112);
  doc.text(doc.splitTextToSize('Big loads sized in: ' + d.adding, CW)[0], M, y+2);
  y += 18;

  label('The size you’re weighing up');
  var hy = y, hH = 46;
  doc.setFillColor(15,18,22); doc.roundedRect(M, hy, CW, hH, 8, 8, 'F');
  doc.setFont('helvetica','bold'); doc.setFontSize(21); doc.setTextColor(239,159,39);
  doc.text(d.kw, M+18, hy+30);
  doc.setFont('helvetica','bold'); doc.setFontSize(12); doc.setTextColor(255,255,255);
  doc.text(d.panels, W-M-14, hy+26, {align:'right'});
  doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(160,168,180);
  doc.text('440 W panels', W-M-14, hy+38, {align:'right'});
  y = hy + hH;
  var stats = [['Your annual use',d.annualUse,'',ink],['This system generates',d.annualGen,' / year',green],['Summer / winter day',d.seasonal,'',ink]];
  var sW = CW/3, sH = 42;
  doc.setDrawColor(224,228,235); doc.rect(M, y, CW, sH);
  for (var j=1;j<3;j++) doc.line(M+sW*j, y, M+sW*j, y+sH);
  for (var k=0;k<3;k++){
    var sx = M + sW*k + 12;
    doc.setFont('helvetica','bold'); doc.setFontSize(7.5); doc.setTextColor(150,158,170);
    doc.text(stats[k][0].toUpperCase(), sx, y+16);
    doc.setFont('helvetica','bold'); doc.setFontSize(12.5); doc.setTextColor(stats[k][3][0],stats[k][3][1],stats[k][3][2]);
    doc.text(stats[k][1], sx, y+32);
    if (stats[k][2]){ var vw = doc.getTextWidth(stats[k][1]); doc.setFont('helvetica','normal'); doc.setFontSize(8.5); doc.setTextColor(92,100,112); doc.text(stats[k][2], sx+vw+8, y+32); }
  }
  y += sH + 16;

  // The Powermind story: self-use as-is vs surplus used, and the yearly $ value
  doc.setFont('helvetica','normal'); doc.setFontSize(9.5);
  var gtxt = doc.splitTextToSize('As-is, you’d use about '+d.selfPct+' of the solar you make; the rest exports for cents. Point your big loads at the sun and that lifts toward '+d.selfPctUsed+' — worth roughly '+d.save+' a year at typical rates. Coordinating it automatically is what Powermind does.', CW-30);
  var gH = 20 + gtxt.length*12 + 12;
  doc.setFillColor(240,249,245); doc.roundedRect(M, y, CW, gH, 8, 8, 'F');
  doc.setFillColor(29,110,80); doc.rect(M, y, 3, gH, 'F');
  doc.setFont('helvetica','bold'); doc.setFontSize(9.5); doc.setTextColor(29,110,80);
  doc.text('USING YOUR SURPLUS — THE POWERMIND BENEFIT', M+16, y+16);
  doc.setFont('helvetica','normal'); doc.setFontSize(9.5); doc.setTextColor(38,48,43);
  doc.text(gtxt, M+16, y+29);
  y += gH + 16;

  label('What to raise with your installer'); y += 8;
  var qs = [
    ['Meter the house while they’re here.', 'Ask them to fit energy monitoring during the install, so you can see what your home and big appliances actually use — not just what the panels make. Doing it now saves a call-out later.'],
    ['Know your panel angles — and why they were chosen.', 'Which way your panels face and their tilt isn’t a detail — it sets how much you generate and when (east = morning, west = afternoon, north = most over a year). A tight roof sometimes forces a compromise, and that can be fine — but it should be a deliberate choice matched to how you use power, not just “wherever they fit.” Ask why yours are laid out that way, and get it in writing. It’s also the kind of thing that pays off later: with your angles on record, you (or a smart tool) can track and forecast your solar over time, and time your big loads to when the power’s actually there.'],
    ['Pick the inverter as carefully as the panels.', 'The inverter is the brain of the system — it decides whether you can see your data, add a battery or EV later, and run big loads on your solar, or whether you’re stuck with just the brand’s app. Ask whether it speaks an open standard — SunSpec Modbus, or a local API — so you’re not boxed in.'],
    ['Set it up for what you’ll add later.', 'Most people add a battery, more panels, or an EV charger within a few years. Ask for a battery-ready inverter, room to add more panels, and a spare slot at the switchboard for a charger. Building that in now is cheap — retrofitting it later means paying twice.'],
    ['The accredited installer on the roof.', 'Will the accredited (SAA) installer be on site for the whole job, not just the final sign-off? Your rebate and the quality both depend on it.'],
    ['Exact models, proof, and both warranties.', 'Get the exact panel and inverter model (not just “premium”), proof they’re well reviewed, and both warranties — the one on the product, and the one on its output over the years.'],
    ['Compare like-for-like, after all rebates.', 'Get the price per kW once every rebate’s applied — that’s the only way two quotes compare fairly, since installers show rebates differently. But only compare quotes for similar-quality gear: a cheaper price per kW means nothing if it’s lesser panels, a sealed inverter, or a rushed install.']
  ];
  var cgap = 22, colW2 = (CW - cgap)/2, tw = colW2 - 18;
  function drawItem(x, top, it){
    doc.setDrawColor(19,35,58); doc.setLineWidth(1); doc.roundedRect(x, top-8, 10, 10, 2, 2);
    doc.setFont('helvetica','bold'); doc.setFontSize(9.5); doc.setTextColor(15,18,22);
    var lead = doc.splitTextToSize(it[0], tw); doc.text(lead, x+18, top);
    var yy = top + lead.length*12;
    doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(60,66,75);
    var body = doc.splitTextToSize(it[1], tw); doc.text(body, x+18, yy+2);
    return yy + body.length*11.5 + 14;
  }
  var rX = M + colW2 + cgap, yL = y, yR = y;
  for (var qi=0; qi<qs.length; qi++){
    if (qi % 2 === 0){ yL = drawItem(M, yL, qs[qi]); } else { yR = drawItem(rX, yR, qs[qi]); }
  }
  doc.setDrawColor(224,228,235); doc.line(M, H-72, W-M, H-72);
  doc.setFont('helvetica','normal'); doc.setFontSize(7.5); doc.setTextColor(150,158,170);
  var disc = doc.splitTextToSize('Method & disclaimer. Solar generation is estimated from Bureau of Meteorology gridded solar data for the postcode; heating and cooling from BoM Jan/July temperatures scaled to the home’s efficiency using NatHERS climate-zone star bands; usage from the loads listed, calibrated to a bill if provided (440 W panels). Figures are indicative, not a guarantee. Powermind is independent and not affiliated with any installer; this is general information, not financial advice. Confirm the final system with an SAA-accredited installer.', 370);
  doc.text(disc, M, H-60);
  doc.setFont('helvetica','bold'); doc.setFontSize(9); doc.setTextColor(15,18,22);
  doc.text('Powermind', W-M, H-60, {align:'right'});
  doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(92,100,112);
  doc.text('powermind.com.au', W-M, H-48, {align:'right'});
  doc.text('a Futerra company', W-M, H-38, {align:'right'});

  doc.save('Powermind-Solar-Report.pdf');
}

var dlBtn = document.getElementById('dlReport');
if (dlBtn){
  dlBtn.addEventListener('click', function(){
    var old = dlBtn.textContent; dlBtn.disabled = true; dlBtn.textContent = 'Preparing…';
    loadJsPDF(function(){
      loadLogo(function(logo){
        try { generatePDF(reportData(), logo); }
        catch(e){ alert('Sorry, the report could not be generated just now.'); }
        dlBtn.disabled = false; dlBtn.textContent = old;
        maybeSignup();
      });
    });
  });
}

// Newsletter opt-in — only shown when a Ghost destination is configured
if (GHOST_URL){
  var nlWrap = document.getElementById('nlWrap'); if (nlWrap) nlWrap.hidden = false;
  var nlOn = document.getElementById('nlOn'), nlRow = document.getElementById('nlEmailRow');
  if (nlOn) nlOn.addEventListener('change', function(){ if (nlRow) nlRow.hidden = !nlOn.checked; });
}
function maybeSignup(){
  if (!GHOST_URL) return;
  var on = document.getElementById('nlOn'), em = document.getElementById('nlEmail'), note = document.getElementById('nlNote');
  if (!on || !on.checked) return;
  var email = (em && em.value || '').trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)){ if (note) note.textContent = 'Enter a valid email to subscribe.'; return; }
  if (note) note.textContent = 'Subscribing…';
  fetch(GHOST_URL.replace(/\/$/,'') + '/members/api/send-magic-link/', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({email:email, emailType:'signup', labels:['Solar report']})
  }).then(function(r){
    if (note) note.textContent = r.ok ? 'Check your inbox to confirm — welcome to Behind the Meter.' : 'Could not subscribe right now.';
  }).catch(function(){ if (note) note.textContent = 'Could not subscribe right now.'; });
}
