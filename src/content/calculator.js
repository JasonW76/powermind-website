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

  // ============================================================
  // SOLAR REPORT (PDF) — recomputes from the same model as render()
  // ============================================================
  var GHOST_URL = '';   // set to your Ghost site, e.g. 'https://behindthemeter.ghost.io', to enable the newsletter opt-in

  function reportData(){
    var annual = annualNow();
    var use = annual + add.ev*ADD.ev + add.ac*ADD.ac + (add.pool?ADD.pool:0) + hpDelta();
    if (use < 800) use = 800;
    var pcVal = document.getElementById('pc').value || '—';
    var z = zoneFromPostcode(pcVal);
    var y = zoneYield[z];
    var kwMid = use / y * HEADROOM;
    var lo = Math.max(3, Math.round((kwMid-0.5)*2)/2);
    var hi = Math.round((kwMid+0.5)*2)/2; if (hi <= lo) hi = lo + 0.5;
    var pLo = Math.ceil(lo*1000/440), pHi = Math.ceil(hi*1000/440);
    var gen = Math.round(((lo+hi)/2) * y);
    var dailyAvg = ((lo+hi)/2) * y / 365;
    var days = +document.getElementById('days').value;
    var frac = 0.30 + (days/7)*0.32;
    var s = Math.round(frac*100);
    var exported = gen * (1 - frac);
    var hwMap = {electric:'Electric (resistive)', gas:'Gas', heatpump:'Heat pump', solar:'Solar hot water'};
    var bits = [];
    if (add.ev) bits.push(add.ev + ' EV' + (add.ev>1?'s':''));
    if (add.ac) bits.push(add.ac + ' split AC' + (add.ac>1?'s':''));
    if (add.pool) bits.push('pool');
    if (add.hpswap) bits.push('heat-pump hot water');
    var useStr = '~' + (annual/365).toFixed(1) + ' kWh/day';
    return {
      date: new Date().toLocaleDateString('en-AU', {day:'numeric', month:'long', year:'numeric'}),
      postcode: pcVal, zone: z, currentUse: useStr,
      daysHome: days + (days===1?' day':' days') + '/week',
      hotWater: hwMap[document.getElementById('hwtype').value] || '—',
      adding: bits.length ? bits.join(' · ') : 'Nothing extra',
      kw: lo + '–' + hi + ' kW', panels: '~' + pLo + '–' + pHi + ' panels',
      annualGen: gen.toLocaleString() + ' kWh', annualUse: Math.round(use).toLocaleString() + ' kWh',
      selfPct: '~' + s + '%',
      seasonal: Math.round(dailyAvg*1.4) + ' / ' + Math.round(dailyAvg*0.6) + ' kWh',
      exportedKwh: Math.round(exported).toLocaleString(),
      feedVal: Math.round(exported*0.06).toLocaleString(),
      peakVal: Math.round(exported*0.33).toLocaleString()
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
    var lede = doc.splitTextToSize('An independent estimate of the system your home needs — sized to your actual power use, not just your roof. Take it to any installer and quote against these figures.', CW);
    doc.text(lede, M, y); y += lede.length*13 + 12;

    function label(t){ doc.setFont('helvetica','bold'); doc.setFontSize(8.5); doc.setTextColor(150,158,170); doc.text(t.toUpperCase(), M, y); y += 13; }

    label('Your home');
    var items = [['Location','Postcode '+d.postcode],['Solar zone (CER)','Zone '+d.zone],['Current use',d.currentUse],['Adding',d.adding]];
    var colW = CW/4, rowH = 40, gy = y;
    doc.setDrawColor(224,228,235); doc.setLineWidth(1);
    doc.roundedRect(M, gy, CW, rowH, 8, 8);
    for (var vln=1;vln<4;vln++) doc.line(M+colW*vln, gy, M+colW*vln, gy+rowH);
    for (var i=0;i<4;i++){
      var cx = M + i*colW + 12;
      doc.setFont('helvetica','bold'); doc.setFontSize(7.5); doc.setTextColor(150,158,170);
      doc.text(items[i][0].toUpperCase(), cx, gy+16);
      doc.setFont('helvetica','bold'); doc.setFontSize(10.5); doc.setTextColor(15,18,22);
      doc.text(doc.splitTextToSize(items[i][1], colW-18)[0], cx, gy+30);
    }
    y = gy + rowH + 18;

    label('Recommended system');
    var hy = y, hH = 46;
    doc.setFillColor(15,18,22); doc.roundedRect(M, hy, CW, hH, 8, 8, 'F');
    doc.setFont('helvetica','bold'); doc.setFontSize(21); doc.setTextColor(255,255,255);
    doc.text(d.kw, M+18, hy+30);
    doc.setFont('helvetica','normal'); doc.setFontSize(11); doc.setTextColor(199,204,211);
    doc.text(d.panels, W-M-14, hy+30, {align:'right'});
    y = hy + hH;
    var stats = [['Est. annual generation',d.annualGen,' in your zone',green],['Your annual use',d.annualUse,'',ink],['Sizing basis','1.45x use',' · 440 W panels',ink]];
    var sW = CW/3, sH = 42;
    doc.setDrawColor(224,228,235); doc.rect(M, y, CW, sH);
    for (var j=1;j<3;j++) doc.line(M+sW*j, y, M+sW*j, y+sH);
    for (var k=0;k<3;k++){
      var sx = M + sW*k + 12;
      doc.setFont('helvetica','bold'); doc.setFontSize(7.5); doc.setTextColor(150,158,170);
      doc.text(stats[k][0].toUpperCase(), sx, y+16);
      doc.setFont('helvetica','bold'); doc.setFontSize(12.5); doc.setTextColor(stats[k][3][0],stats[k][3][1],stats[k][3][2]);
      doc.text(stats[k][1], sx, y+32);
      if (stats[k][2]){ var vw = doc.getTextWidth(stats[k][1]); doc.setFont('helvetica','normal'); doc.setFontSize(8.5); doc.setTextColor(92,100,112); doc.text(stats[k][2], sx+vw+3, y+32); }
    }
    y += sH + 18;

    label('What to raise with your installer');
    var qs = [
      ['Meter the house while they’re here.', 'Ask them to fit energy monitoring during the install, so you can see what your home and big appliances actually use — not just what the panels make. Doing it now saves a call-out later.'],
      ['Don’t get locked into one app.', 'Will you be stuck inside one brand’s app, or can you get at your own data and add other smart gear later? Closed systems box you in.'],
      ['Set the big loads to run on solar.', 'Can your hot water — and later your EV and aircon — be set to run in the middle of the day on your own solar, instead of at night off the grid? Cheap to leave the wiring ready now.'],
      ['Room to grow — battery, panels, EV.', 'A battery-ready inverter, space to add more panels, and a spot at the switchboard for an EV charger. Leaving room now beats swapping gear out later.'],
      ['The accredited installer on the roof.', 'Will the accredited (SAA) installer be on site for the whole job, not just the final sign-off? Your rebate and the quality both depend on it.'],
      ['Exact models, proof, and both warranties.', 'Get the exact panel and inverter model (not just “premium”), proof they’re well reviewed, and both warranties — the one on the product, and the one on its output over the years.'],
      ['Price per kW after the rebate.', 'What’s the price per kW once the rebate’s applied? It’s the only fair way to compare quotes.']
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
    y = Math.max(yL, yR) + 6;

    label('For your installer');
    var noteTxt = 'This homeowner sized their system with Powermind before shopping — an independent tool that matches system size to real household usage, not just roof area. Please quote against the figures above. Questions on the method: powermind.com.au.';
    var nl = doc.splitTextToSize(noteTxt, CW-30);
    var nH = nl.length*12 + 26;
    doc.setFillColor(244,250,247); doc.roundedRect(M, y-4, CW, nH, 6, 6, 'F');
    doc.setFillColor(29,110,80); doc.rect(M, y-4, 3, nH, 'F');
    doc.setFont('helvetica','bold'); doc.setFontSize(8); doc.setTextColor(29,110,80);
    doc.text('A NOTE TO THE SOLAR COMPANY', M+16, y+11);
    doc.setFont('helvetica','normal'); doc.setFontSize(9.5); doc.setTextColor(38,48,43);
    doc.text(nl, M+16, y+25);

    doc.setDrawColor(224,228,235); doc.line(M, H-72, W-M, H-72);
    doc.setFont('helvetica','normal'); doc.setFontSize(7.5); doc.setTextColor(150,158,170);
    var disc = doc.splitTextToSize('Method & disclaimer. System size is estimated from the Clean Energy Regulator postcode solar-zone yields and the household’s stated usage, anchored to a measured 1,409 kWh/kW/yr on a Canberra roof (440 W panels, 1.45x headroom). Figures are indicative, not a guarantee. Powermind is independent and not affiliated with any installer; this is general information, not financial advice. Confirm the final system with an SAA-accredited installer.', 370);
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
