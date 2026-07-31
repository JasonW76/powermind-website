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
  // Clean Energy Regulator solar PV zones — 137 postcode ranges [rangeEnd, zone], contiguous 0000-9999.
  // Source: CER "Postcode zone ratings and zones for solar (photovoltaic) systems". Zones cross state lines,
  // so this is finer than a state figure (e.g. Cairns, Brisbane and the Gold Coast sit in different zones).
  var ZR = [[799,3],[853,2],[854,3],[861,2],[862,3],[869,2],[879,1],[885,3],[1000,2],[2355,3],[2357,2],[2384,3],[2389,2],[2395,3],[2397,2],[2399,3],[2400,2],[2404,3],[2407,2],[2544,3],[2554,4],[2627,3],[2628,4],[2629,3],[2639,4],[2816,3],[2817,2],[2820,3],[2829,2],[2830,3],[2841,2],[2872,3],[2873,2],[2877,3],[2889,2],[2999,3],[3035,4],[3038,3],[3044,4],[3045,3],[3046,4],[3049,3],[3058,4],[3059,3],[3060,4],[3064,3],[3074,4],[3076,3],[3098,4],[3099,3],[3292,4],[3302,3],[3308,4],[3319,3],[3333,4],[3337,3],[3339,4],[3758,3],[3760,4],[3764,3],[3999,4],[4416,3],[4417,2],[4427,3],[4473,2],[4476,1],[4478,2],[4485,1],[4491,2],[4492,1],[4493,2],[4494,3],[4497,2],[4719,3],[4722,2],[4723,3],[4734,2],[4736,1],[4822,3],[4823,2],[4824,3],[4827,2],[4828,3],[4829,1],[5431,3],[5450,2],[5654,3],[5669,2],[5679,3],[5699,2],[5709,3],[5722,2],[5724,1],[5730,2],[5731,1],[5732,2],[5799,1],[6043,3],[6044,2],[6256,3],[6270,4],[6316,3],[6349,4],[6353,3],[6356,4],[6394,3],[6400,4],[6430,3],[6431,2],[6433,3],[6440,2],[6441,1],[6444,3],[6459,4],[6467,3],[6469,2],[6471,3],[6472,2],[6506,3],[6508,2],[6509,3],[6536,2],[6537,1],[6555,2],[6573,3],[6602,2],[6607,3],[6641,2],[6724,1],[6750,2],[6764,1],[6765,2],[6797,1],[6799,2],[6999,3],[8999,4],[9999,3]];
  // Yield per zone: CER's own zone rating *ratios* (1.622 / 1.536 / 1.382 / 1.185), anchored so zone 3
  // equals the real 1,409 kWh/kW/yr measured on Jason's Canberra system. Keeps it grounded in a real roof.
  var zoneYield = {1:1640, 2:1555, 3:1409, 4:1210};   // kWh/kW/yr
  function zoneFromPostcode(v){
    var pc = parseInt(v, 10);
    if (isNaN(pc) || pc < 0 || pc > 9999) return 3;
    for (var i=0;i<ZR.length;i++){ if (pc <= ZR[i][0]) return ZR[i][1]; }
    return 3;
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
    var z = zoneFromPostcode(document.getElementById('pc').value);
    var y = zoneYield[z];
    document.getElementById('pcOut').textContent = (document.getElementById('pc').value || '—') + ' · solar zone ' + z;
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
