var mode = 'bill';
  var add = {ev:0, ac:0, pool:false, hpswap:false};       // counts + toggles
  var ADD = {ev:2800, ac:1100, pool:2500};                 // kWh/yr each EV / split AC / pool adds
  function hpDelta(){                                        // heat-pump swap depends on CURRENT system
    if (!add.hpswap) return 0;
    var t = document.getElementById('hwtype').value;
    if (t === 'electric') return -1800;                      // replaces resistive → saves
    if (t === 'gas') return 1200;                            // gas → electric → adds power
    return 0;                                                // already heat pump / solar
  }
  // self-consumption is derived from "days at home" in render():
  //   0 days ≈ 30% self-use (empty in daylight) → 7 days ≈ 62% (someone always home).
  //   Anchored to Jason's measured 47% at ~4 days. UNSW/ANU baseline for the 30–60% range.
  var yieldKwh = {act:1400, nsw:1380, vic:1280, qld:1460, sa:1440, wa:1550, tas:1180, nt:1540};   // kWh/kW/yr (CEC/CSIRO)
  function stateFromPostcode(v){
    var pc = parseInt(v, 10);
    if (isNaN(pc)) return 'act';
    if ((pc>=2600 && pc<=2618) || (pc>=2900 && pc<=2920) || (pc>=200 && pc<=299)) return 'act';
    if (pc>=800 && pc<=999) return 'nt';
    if (pc>=1000 && pc<=2999) return 'nsw';
    if (pc>=3000 && pc<=3999) return 'vic';
    if (pc>=4000 && pc<=4999) return 'qld';
    if (pc>=5000 && pc<=5799) return 'sa';
    if (pc>=6000 && pc<=6799) return 'wa';
    if (pc>=7000 && pc<=7799) return 'tas';
    return 'nsw';
  }
  var RATE = 0.32;         // $/kWh all-in, for bill<->usage conversion
  var HEADROOM = 1.45;     // size generously over yearly use
  function billEl(){ return document.getElementById('bill'); }
  function useEl(){ return document.getElementById('use'); }
  // single source of truth: annual kWh, always taken from the ACTIVE input
  function annualNow(){
    if (mode === 'bill'){ return (+billEl().value) * 4 / RATE; }
    return (+useEl().value) * 365;
  }
  function render(){
    var annual = annualNow();
    // both displayed numbers derive from the SAME annual figure, so they always reconcile
    if (mode === 'bill'){
      document.getElementById('billOut').textContent = '$' + (+billEl().value) + ' a quarter \u00b7 \u2248 ' + (annual/365).toFixed(1) + ' kWh/day';
    } else {
      document.getElementById('useOut').textContent = (+useEl().value).toFixed(1) + ' kWh a day \u00b7 \u2248 $' + Math.round(annual*RATE/4) + '/quarter';
    }
    var use = annual + add.ev*ADD.ev + add.ac*ADD.ac + (add.pool?ADD.pool:0) + hpDelta();
    if (use < 800) use = 800;
    var st = stateFromPostcode(document.getElementById('pc').value);
    var y = yieldKwh[st];
    document.getElementById('pcOut').textContent = (document.getElementById('pc').value || '—') + ' · ' + st.toUpperCase();
    var kwMid = use / y * HEADROOM;
    var lo = Math.max(3, Math.round((kwMid-0.5)*2)/2);
    var hi = Math.round((kwMid+0.5)*2)/2;
    if (hi <= lo) hi = lo + 0.5;
    var pLo = Math.ceil(lo*1000/440), pHi = Math.ceil(hi*1000/440);
    var gen = Math.round(((lo+hi)/2) * y);
    var dailyAvg = ((lo+hi)/2) * y / 365;     // avg generation per day across the year
    var days = +document.getElementById('days').value;
    var frac = 0.30 + (days/7)*0.32;          // days-at-home → self-consumption fraction
    var s = Math.round(frac*100);
    document.getElementById('daysOut').textContent = days + (days===1 ? ' day' : ' days') + ' a week \u00b7 you\u2019d use ~' + s + '% of your solar directly';
    document.getElementById('kw').textContent = lo + '\u2013' + hi + ' kW';
    document.getElementById('panels').textContent = '\u2248 ' + pLo + '\u2013' + pHi + ' panels';
    document.getElementById('usey').textContent = Math.round(use).toLocaleString() + ' kWh/yr';
    document.getElementById('geny').textContent = gen.toLocaleString() + ' kWh/yr';
    document.getElementById('sumd').textContent = '~' + Math.round(dailyAvg*1.4);   // ~summer peak vs annual mean
    document.getElementById('wind').textContent = '~' + Math.round(dailyAvg*0.6);   // ~winter trough
    document.getElementById('selfuse').textContent = '~' + s + '%';
    var exported = gen * (1 - frac);                                       // surplus that leaves the home
    document.getElementById('wkwh').textContent = '~' + Math.round(exported).toLocaleString();
    document.getElementById('wfeed').textContent = Math.round(exported*0.06).toLocaleString();   // ~6c feed-in
    document.getElementById('wpeak').textContent = Math.round(exported*0.33).toLocaleString();   // ~33c buy-back
  }
  // toggling carries the current value across so nothing jumps inconsistently
  function toBill(){
    var annual = (+useEl().value) * 365;
    var q = Math.min(2200, Math.max(250, Math.round((annual*RATE/4)/25)*25));
    billEl().value = q; mode = 'bill';
    document.getElementById('mBill').classList.add('on'); document.getElementById('mUse').classList.remove('on');
    document.getElementById('fBill').style.display=''; document.getElementById('fUse').style.display='none'; render();
  }
  function toUse(){
    var annual = (+billEl().value) * 4 / RATE;
    var d = Math.min(75, Math.max(6, Math.round((annual/365)/0.5)*0.5));
    useEl().value = d; mode = 'use';
    document.getElementById('mUse').classList.add('on'); document.getElementById('mBill').classList.remove('on');
    document.getElementById('fUse').style.display=''; document.getElementById('fBill').style.display='none'; render();
  }
  document.getElementById('mBill').addEventListener('click', toBill);
  document.getElementById('mUse').addEventListener('click', toUse);
  billEl().addEventListener('input', render);
  useEl().addEventListener('input', render);
  document.getElementById('pc').addEventListener('input', render);
  document.getElementById('days').addEventListener('input', render);
  var MAXN = {ev:2, ac:3};
  Array.prototype.forEach.call(document.querySelectorAll('[data-step]'), function(btn){
    btn.addEventListener('click', function(){
      var k = btn.getAttribute('data-step'), d = +btn.getAttribute('data-d');
      add[k] = Math.max(0, Math.min(MAXN[k], add[k] + d));
      document.getElementById(k === 'ev' ? 'nEv' : 'nAc').textContent = add[k];
      render();
    });
  });
  Array.prototype.forEach.call(document.querySelectorAll('[data-toggle]'), function(c){
    c.addEventListener('click', function(){
      var k = c.getAttribute('data-toggle'); add[k] = !add[k];
      c.classList.toggle('on'); c.textContent = add[k] ? 'Yes' : 'No'; render();
    });
  });
  function syncHw(){
    var t = document.getElementById('hwtype').value;
    var row = document.getElementById('rowHp'), note = document.getElementById('hpNote'), chip = document.getElementById('cHp');
    if (t === 'heatpump' || t === 'solar'){
      row.style.display = 'none'; note.style.display = 'none';
      add.hpswap = false; chip.classList.remove('on'); chip.textContent = 'No';
    } else {
      row.style.display = ''; note.style.display = '';
      note.innerHTML = (t === 'electric')
        ? 'A heat pump replaces your electric system, so it usually <b style="color:var(--muted)">lowers</b> your use by ~1,800 kWh/yr.'
        : 'Moving hot water from gas to a heat pump <b style="color:var(--muted)">adds</b> ~1,200 kWh/yr of electricity (but cuts your gas).';
    }
  }
  document.getElementById('hwtype').addEventListener('change', function(){ syncHw(); render(); });
  syncHw();
  render();
