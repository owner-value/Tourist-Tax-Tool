/* ===== CONFIG ===== */
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxGysuLPuiEFXhRaPuvABIzOYdz0Zvo4v4V7VvmeUrcS9aCmMsHuxvkPfGBMUZMyTej/exec";

/* ===== QUARTERS ===== */
const QUARTER_TITLES_IT = {
  Q1:["Gennaio","Febbraio","Marzo"],
  Q2:["Aprile","Maggio","Giugno"],
  Q3:["Luglio","Agosto","Settembre"],
  Q4:["Ottobre","Novembre","Dicembre"]
};
const QUARTER_MONTH_KEYS = {
  Q1:["01","02","03"], Q2:["04","05","06"], Q3:["07","08","09"], Q4:["10","11","12"]
};

/* ===== HELPERS ===== */
const $ = (id) => document.getElementById(id);
const setText = (id, t) => { const el = $(id); if (el) el.textContent = t; };
const euro = (n) => `€${Number(n||0).toFixed(2)}`;
function itDate(iso){ if(!iso) return ""; const d=new Date(iso.length===10?`${iso}T00:00:00`:iso); return d.toLocaleDateString("it-IT",{day:"2-digit",month:"long",year:"numeric"}); }
function sortByCheckoutAsc(rows){ return [...rows].sort((a,b)=> new Date(a.checkout) - new Date(b.checkout)); }
function num(v){ v=Number(v); return isFinite(v)?v:0; }

function showLoader(on){ const ld=$("ov-loader"), btn=$("calcBtn"); if(ld) ld.classList.toggle("ov-hidden",!on); if(btn){btn.disabled=!!on; btn.style.opacity=on?0.6:1;} }
function showErrorModal(msg, sub=""){ const m=$("ov-modal"); if(!m){ alert(msg); return; } setText("ov-modal-msg", msg||"Errore sconosciuto."); const s=$("ov-modal-sub"); if(sub){ s.textContent=sub; s.style.display="block"; } else { s.textContent=""; s.style.display="none"; } m.classList.remove("ov-hidden"); }
function hideErrorModal(){ const m=$("ov-modal"); if(m) m.classList.add("ov-hidden"); }

// Inline message (non-modal)
function showInlineMessage(msg, sub="", type="info"){
  const host=$("tax-app"); if(!host) return;
  let el=$("ov-inline-msg");
  if(!el){
    el=document.createElement("div");
    el.id="ov-inline-msg";
    el.style.margin="12px 0"; el.style.padding="12px";
    el.style.borderRadius="10px"; el.style.display="flex";
    el.style.justifyContent="space-between"; el.style.alignItems="center"; el.style.gap='12px';
    host.insertBefore(el, host.firstChild);
  }
  const color = type==="warn"?"#fff7ed":"#eef2ff";
  const border = type==="warn"?"1px solid #ffd7aa":"1px solid #dbeafe";
  el.style.background = color; el.style.border = border;
  el.innerHTML = `<div style="flex:1"><div style="font-weight:700;margin-bottom:4px">${msg}</div>${sub?`<div style=\"font-size:.95rem;color:#374151;white-space:pre-wrap\">${sub}</div>`:''}</div><div style=\"display:flex;gap:8px;align-items:center\"><button id=\"ov-inline-open\" style=\"background:#4f46e5;color:#fff;border:0;border-radius:8px;padding:8px 10px;cursor:pointer;font-weight:600\">Apri</button><button id=\"ov-inline-copy\" style=\"background:#fff;border:1px solid #d1d5db;border-radius:8px;padding:8px 10px;cursor:pointer\">Copia URL</button><button id=\"ov-inline-msg-close\" aria-label=\"Chiudi\" style=\"background:transparent;border:0;font-size:18px;cursor:pointer;color:#374151\">&times;</button></div>`;
  const closeBtn=$("ov-inline-msg-close"); if(closeBtn){ closeBtn.addEventListener("click", ()=>{ const e=$("ov-inline-msg"); if(e) e.remove(); }); }
  const openBtn=$("ov-inline-open"), copyBtn=$("ov-inline-copy");
  if(openBtn){ openBtn.addEventListener("click", ()=>{ const url=el.getAttribute("data-url"); if(url) window.open(url, "_blank"); }); }
  if(copyBtn){
    copyBtn.addEventListener("click", async ()=>{
      const url=el.getAttribute("data-url"); if(!url) return;
      try{ await navigator.clipboard.writeText(url); copyBtn.textContent='Copiato'; setTimeout(()=> copyBtn.textContent='Copia URL',1500); }
      catch(_){ const ta=document.createElement('textarea'); ta.value=url; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); copyBtn.textContent='Copiato'; setTimeout(()=> copyBtn.textContent='Copia URL',1500); }
    });
  }
}
function clearInlineMessage(){ const el=$("ov-inline-msg"); if(el) el.remove(); }
function setInlineMessageUrl(url){ const el=$("ov-inline-msg"); if(el) el.setAttribute("data-url", url); }

function ensureDetailsHost(containerId){
  const c=$(containerId); if(!c) return null;
  let h=c.querySelector(".ov-details-host");
  if(!h){ h=document.createElement("div"); h.className="ov-details-host"; c.appendChild(h); }
  h.innerHTML=""; return h;
}
function ensureInfoRow(prefix, idx, text){
  const id=`${prefix}-info${idx}`;
  if(!$(id)){
    const wrap=$(`${prefix}-block`); if(!wrap) return;
    const p=document.createElement("p"); p.id=id; p.style.marginTop="6px"; p.style.color="#6b7280"; p.style.fontSize=".9rem"; wrap.appendChild(p);
  }
  setText(id, text);
}
function resetTotals(){
  setText("ov-totalTaxDisplay","0.00"); setText("ov-bookingTaxDisplay","0.00"); setText("ov-airbnbTaxDisplay","0.00");
  ["Jan","Feb","Mar"].forEach(m=>{ setText(`ov-${m}-tax-total`,"0.00"); const host=ensureDetailsHost(`ov-${m}-block`); if(host) host.innerHTML=""; for(let i=1;i<=4;i++){ const el=$(`ov-${m}-info${i}`); if(el) el.textContent=""; }});
  setText("ov-booking-tax-total","0.00"); const bhost=ensureDetailsHost("ov-booking-block"); if(bhost) bhost.innerHTML="";
  setText("ov-airbnb-tax-total","0.00"); const ahost=ensureDetailsHost("ov-airbnb-block"); if(ahost) ahost.innerHTML=""; for(let i=1;i<=3;i++){ const el=$(`ov-airbnb-info${i}`); if(el) el.textContent=""; }
}
function renameQuarterHeadings(q){ const labels=QUARTER_TITLES_IT[q]||["Gennaio","Febbraio","Marzo"]; ["Jan","Feb","Mar"].forEach((id,idx)=>{ const h=document.querySelector(`#ov-${id}-block h2.ov-section-h`); if(h) h.innerHTML=`${labels[idx]} – <span class="booking-color">Booking</span>`; }); }

/* ======== <14 helpers ======== */
// Conta i minori di 14 anni con massima tolleranza sui nomi campo/forme
function computeMinorsUnder14(r){
  if (typeof r.minorsUnder14 === "number") return Math.max(0, Number(r.minorsUnder14)||0);
  if (typeof r.minors_under_14 === "number") return Math.max(0, Number(r.minors_under_14)||0);
  if (typeof r.minors14 === "number") return Math.max(0, Number(r.minors14)||0);
  if (typeof r.childrenUnder14 === "number") return Math.max(0, Number(r.childrenUnder14)||0);
  if (Array.isArray(r.guestsAges)) return r.guestsAges.reduce((acc, a)=> acc + (Number(a) < 14 ? 1 : 0), 0);
  if (Array.isArray(r.guestsBirthYears)) {
    const nowYear = new Date().getFullYear();
    return r.guestsBirthYears.reduce((acc, by)=>{
      const y=Number(by); if(!isFinite(y)||y<=0) return acc;
      return acc + ((nowYear - y) < 14 ? 1 : 0);
    }, 0);
  }
  if (typeof r.minors === "number") return Math.max(0, Number(r.minors)||0);
  return 0;
}

/* === valore coerente "Ospiti tass." === */
function getGuestsTaxable(r){
  if (typeof r.guestsTaxable === "number") return Math.max(0, Number(r.guestsTaxable)||0);
  if (typeof r.adultsEffective === "number") return Math.max(0, Number(r.adultsEffective)||0);
  const totalGuests = Math.max(0, Number(r.guests)||0);
  const minors14 = computeMinorsUnder14(r);
  return Math.max(0, Math.min(totalGuests, totalGuests - minors14));
}

/* ===== TABLES ===== */
function buildMainTable(rows){
  const data = sortByCheckoutAsc(rows);
  const tbl = document.createElement("table");
  tbl.className = "ov-table";

  // Header desktop (su mobile verrà nascosto dal CSS)
  tbl.innerHTML = `<thead><tr>
    <th>Check-in</th>
    <th>Check-out</th>
    <th>Notti</th>
    <th>Ospiti</th>
    <th>Ospiti tass.</th>
    <th>Pern. tassabili</th>
    <th>Imposta</th>
  </tr></thead><tbody></tbody><tfoot></tfoot>`;

  const tb = tbl.querySelector("tbody");

  data.forEach(r=>{
    const gt = getGuestsTaxable(r);
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td data-label="Check-in">${itDate(r.checkin)}</td>
      <td data-label="Check-out">${itDate(r.checkout)}</td>
      <td data-label="Notti">${num(r.nights)}</td>
      <td data-label="Ospiti">${num(r.guests)}</td>
      <td data-label="Ospiti tass.">${num(gt)}</td>
      <td data-label="Pern. tassabili">${num(r.taxableNights)}</td>
      <td data-label="Imposta">${euro(r.tax)}</td>
    `;
    tb.appendChild(tr);
  });

  const tot = data.reduce((a,r)=>{
    const gt = getGuestsTaxable(r);
    return {
      n:a.n+num(r.nights),
      g:a.g+num(r.guests),
      gt:a.gt+num(gt),
      tn:a.tn+num(r.taxableNights),
      t:a.t+num(r.tax)
    };
  },{n:0,g:0,gt:0,tn:0,t:0});

  // Tfoot desktop + leggibile su mobile (si mostra come card, righe etichettate)
  const tf = tbl.querySelector("tfoot");
  tf.innerHTML = `
    <tr>
      <td data-label="Totale (colspan)">Totale</td>
      <td data-label="Notti totali">${tot.n}</td>
      <td data-label="Ospiti totali">${tot.g}</td>
      <td data-label="Ospiti tass. totali">${tot.gt}</td>
      <td data-label="Pern. tassabili totali">${tot.tn}</td>
      <td data-label="Imposta totale">${euro(tot.t)}</td>
    </tr>
  `;
  return tbl;
}

function buildExemptTable(rows, type="minori"){
  const CAP=8;
  const data=sortByCheckoutAsc(rows);
  const filtered=data.filter(r=>{
    const total=num(r.nights);
    let v;
    if(type==="minori"){
      v = computeMinorsUnder14(r);
    } else {
      v = Math.max(0,total-CAP);
    }
    return v>0;
  });
  if(!filtered.length) return null;

  const tbl=document.createElement("table"); tbl.className="ov-table";
  const label=(type==="minori")?"Minori esenti":"Notti oltre 8 (esenti)";
  tbl.innerHTML=`<thead><tr>
    <th>Check-in</th><th>Check-out</th><th>Notti totali</th><th>${label}</th>
  </tr></thead><tbody></tbody><tfoot></tfoot>`;
  const tb=tbl.querySelector("tbody");
  filtered.forEach(r=>{
    const total=num(r.nights);
    const v = (type==="minori") ? computeMinorsUnder14(r) : Math.max(0,total-CAP);
    const tr=document.createElement("tr");
    tr.innerHTML=`<td>${itDate(r.checkin)}</td><td>${itDate(r.checkout)}</td><td>${total}</td><td>${v}</td>`;
    tb.appendChild(tr);
  });
  const tot=filtered.reduce((a,r)=>{
    const total=num(r.nights);
    const v = (type==="minori") ? computeMinorsUnder14(r) : Math.max(0,total-CAP);
    a.n+=total; a.e+=v; return a;
  },{n:0,e:0});
  tbl.querySelector("tfoot").innerHTML=`<tr><td colspan="2" style="text-align:right;font-weight:700">Totale</td><td>${tot.n}</td><td>${tot.e}</td></tr>`;
  return tbl;
}

function addSection(host, title, tableOrNull){
  const box=document.createElement("section"); box.className="ov-subsection";
  const h3=document.createElement("h3"); h3.textContent=title; box.appendChild(h3);
  if(tableOrNull){ const wrap=document.createElement("div"); wrap.className="ov-tablewrap"; wrap.appendChild(tableOrNull); box.appendChild(wrap); }
  else { const p=document.createElement("p"); p.className="ov-empty"; p.textContent="Nessun dato."; box.appendChild(p); }
  host.appendChild(box);
}

/* ===== RENDER DETAILS ===== */
function renderDetailsTables(payload, quarter){
  const fromISO=payload?.period?.from||`${new Date().getFullYear()}-01-01`;
  const year=new Date(fromISO).getFullYear().toString();
  const keys=QUARTER_MONTH_KEYS[quarter]||[];
  const details=payload.details||[];
  const byMonth={}; details.forEach(d=>{ if(!byMonth[d.month]) byMonth[d.month]=[]; byMonth[d.month].push(d); });

  ["Jan","Feb","Mar"].forEach((id,idx)=>{
    const k=keys[idx]?`${year}-${keys[idx]}`:null;
    const rows=k?(byMonth[k]||[]).filter(r=>r.platform==="booking"):[];
    const host=ensureDetailsHost(`ov-${id}-block`); if(!host) return; host.innerHTML="";
    if(!rows.length){ const p=document.createElement("p"); p.className="ov-empty"; p.textContent="Nessuna prenotazione Booking con checkout in questo mese."; host.appendChild(p); return; }
    const payable=rows.filter(r=>(r.taxableNights||0)>0||(r.tax||0)>0);
    addSection(host,"Soggetti a imposta", payable.length?buildMainTable(payable):null);
    addSection(host,"Minori esenti", buildExemptTable(rows,"minori"));
    addSection(host,"Oltre 8 notti (esenti)", buildExemptTable(rows,"cap"));
  });

  const ahost=ensureDetailsHost("ov-airbnb-block");
  if(ahost){
    const rowsQ=details.filter(r=>r.platform==="airbnb"); ahost.innerHTML="";
    if(!rowsQ.length){ const p=document.createElement("p"); p.className="ov-empty"; p.textContent="Nessuna prenotazione Airbnb nel trimestre."; ahost.appendChild(p); }
    else{
      const payable=rowsQ.filter(r=>(r.taxableNights||0)>0||(r.tax||0)>0);
      addSection(ahost,"Soggetti a imposta", payable.length?buildMainTable(payable):null);
      addSection(ahost,"Minori esenti", buildExemptTable(rowsQ,"minori"));
      addSection(ahost,"Oltre 8 notti (esenti)", buildExemptTable(rowsQ,"cap"));
    }
  }

  const bhost=ensureDetailsHost("ov-booking-block");
  if(bhost){
    const rowsQ=details.filter(r=>r.platform==="booking"); bhost.innerHTML="";
    if(!rowsQ.length){ const p=document.createElement("p"); p.className="ov-empty"; p.textContent="Nessuna prenotazione Booking nel trimestre."; bhost.appendChild(p); }
    else{
      const payable=rowsQ.filter(r=>(r.taxableNights||0)>0||(r.tax||0)>0);
      addSection(bhost,"Soggetti a imposta", payable.length?buildMainTable(payable):null);
      addSection(bhost,"Minori esenti", buildExemptTable(rowsQ,"minori"));
      addSection(bhost,"Oltre 8 notti (esenti)", buildExemptTable(rowsQ,"cap"));
    }
  }
}

/* ===== RENDER KPI ===== */
function renderResult(payload, quarter){
  setText("ov-totalTaxDisplay", Number(payload.totalTax||0).toFixed(2));
  setText("ov-bookingTaxDisplay", Number(payload.booking?.tax||0).toFixed(2));
  setText("ov-airbnbTaxDisplay", Number(payload.airbnb?.tax||0).toFixed(2));

  const labels=QUARTER_TITLES_IT[quarter]||["Gennaio","Febbraio","Marzo"];
  ["Jan","Feb","Mar"].forEach((id,idx)=>{ const h=document.querySelector(`#ov-${id}-block h2.ov-section-h`); if(h) h.innerHTML=`${labels[idx]} – <span class="booking-color">Booking</span>`; });

  const fromISO=payload?.period?.from||`${new Date().getFullYear()}-01-01`;
  const year=new Date(fromISO).getFullYear().toString();
  const keys=QUARTER_MONTH_KEYS[quarter]||[];
  ["Jan","Feb","Mar"].forEach((id,idx)=>{
    const k=keys[idx]?`${year}-${keys[idx]}`:null;
    const d=k&&payload.bookingByMonth?payload.bookingByMonth[k]:null;
    const tax=num(d?.tax), guests=num(d?.guests), minors=(typeof d?.minorsUnder14 === 'number')?num(d.minorsUnder14):num(d?.minors),
          books=num(d?.bookings), nights=num(d?.taxableNights);
    setText(`ov-${id}-tax-total`, tax.toFixed(2));
    ensureInfoRow(`ov-${id}`,1,`Prenotazioni: ${books}`);
    ensureInfoRow(`ov-${id}`,2,`Ospiti totali: ${guests}`);
    ensureInfoRow(`ov-${id}`,3,`Pernottamenti tassabili: ${nights}`);
    ensureInfoRow(`ov-${id}`,4,`Minori esenti: ${minors}`);
  });

  setText("ov-airbnb-tax-total", num(payload.airbnb?.tax).toFixed(2));
  setText("ov-booking-tax-total", num(payload.booking?.tax).toFixed(2));

  renderDetailsTables(payload, quarter);
}

/* ===== JSONP helper ===== */
function jsonp(url, cbName, timeoutMs=20000){
  return new Promise((resolve,reject)=>{
    const name = cbName || `ovTT_cb_${Date.now()}_${Math.floor(Math.random()*1e6)}`;
    const sep = url.includes("?") ? "&" : "?";
    const src = `${url}${sep}callback=${name}&_ts=${Date.now()}`;
    let cleaned=false, script, timer;
    window[name] = (data)=>{
      if(cleaned) return;
      cleaned=true; clearTimeout(timer);
      if(script) script.remove();
      try{ delete window[name]; }catch(_){}
      resolve(data);
    };
    script = document.createElement("script");
    script.src = src; script.async = true;
    script.onerror = ()=>{
        if(cleaned) return;
        cleaned=true; clearTimeout(timer);
        if(script) script.remove();
        try{ delete window[name]; }catch(_){}
        const e=new Error("JSONP load error"); e.url = src; console.error("JSONP load error for", src, e);
        reject(e);
      };
    document.head.appendChild(script);
    timer = setTimeout(()=>{
      if(cleaned) return;
      cleaned=true;
      if(script) script.remove();
      try{ delete window[name]; }catch(_){}
      const e=new Error("JSONP timeout"); e.url = src; console.error("JSONP timeout for", src, e);
      reject(e);
    }, timeoutMs);
  });
}

/* ===== LOAD ===== */
function loadTax(apt, year, quarter){
  resetTotals(); showLoader(true);
  clearInlineMessage();
  const url = `${SCRIPT_URL}?apt=${encodeURIComponent(apt)}&year=${encodeURIComponent(year)}&quarter=${encodeURIComponent(quarter)}&details=1`;

  try{ console.info("[ov] Request URL:", url); }catch(_){}

    // Use fetch with a single retry. The Apps Script endpoint returns Access-Control-Allow-Origin: *
    // so a CORS fetch is the preferred, reliable path. JSONP fallback removed to avoid script tag issues.
    const doFetch = (attempt=1) => {
      const controller = new AbortController();
      const timeoutMs = 15000;
      const tmr = setTimeout(()=> controller.abort(), timeoutMs);
      return fetch(url, { signal: controller.signal, cache: 'no-store' })
        .then(async resp => {
          clearTimeout(tmr);
          if(!resp.ok){
            const text = await resp.text().catch(()=>"");
            const err = new Error(`HTTP ${resp.status}`);
            err.status = resp.status; err.body = text; throw err;
          }
          const ct = resp.headers.get('content-type') || '';
          if(ct.includes('application/json')) return resp.json();
          const txt = await resp.text();
          // try extract JSON object from JSONP-like response
          const m = txt.match(/\{[\s\S]*\}/);
          if(m) return JSON.parse(m[0]);
          throw new Error('Unexpected response format');
        })
        .catch(async err => {
          // retry once for transient network/CORS issues
          if(attempt===1){
            console.warn('[ov] fetch failed, retrying once:', err);
            await new Promise(r=>setTimeout(r,800));
            return doFetch(2);
          }
          throw err;
        });
    };

    doFetch().then(res=>{
      if(!res || !res.ok){
        const msg=res && res.error ? res.error : "Impossibile calcolare.";
        let hint="";
        if(/Cartella trimestre non trovata/i.test(msg)) hint=`Controlla in Drive: Appartamenti ➜ ${apt} ➜ ${year} ➜ ${quarter} (cartella mancante).`;
        else if(/Nessun file nel trimestre/i.test(msg)) hint="La cartella esiste ma non contiene alcun file report.";
        else if(/Cartella appartamento non trovata/i.test(msg)) hint="Il nome dell'appartamento deve corrispondere alla cartella in Drive.";
        else if(/Parametri richiesti/i.test(msg)) hint="Verifica apt, year e quarter (Q1..Q4).";
        showErrorModal(msg, hint);
        return;
      }
      renderResult(res, quarter);
    }).catch(err=>{
      console.error('[ov] fetch error:', err);
      let msg = 'Errore rete';
      let sub = String(err && err.message ? err.message : err);
      if(err && err.status) sub = `HTTP ${err.status}\n\n${err.body||''}`;
      if(/Cartella trimestre non trovata/i.test(sub)){
        showInlineMessage('Cartella trimestre non trovata', `Controlla Drive per: ${apt} / ${year} / ${quarter}` , 'warn');
      } else {
        showInlineMessage(msg, sub, 'warn');
        setInlineMessageUrl(url);
      }
    }).finally(()=> showLoader(false));
}

/* ===== BOOTSTRAP ===== */
document.addEventListener("DOMContentLoaded", ()=>{
  const ld=$("ov-loader"); if(ld && !ld.classList.contains("ov-hidden")) ld.classList.add("ov-hidden");
  ["ov-modal-close","ov-modal-x"].forEach(id=>{ const el=$(id); if(el) el.addEventListener("click", hideErrorModal); });
  const btn=$("calcBtn");
  if(btn){
    btn.addEventListener("click", ()=>{
      const apt=$("apt")?.value, year=$("year")?.value, quarter=$("quarter")?.value;
      if(!apt||!year||!quarter){ showErrorModal("Parametri mancanti","Compila appartamento, anno e trimestre."); return; }
      loadTax(apt, year, quarter);
    });
  }
});
