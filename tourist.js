/* ===== CONFIG ===== */
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzWeTGNB4JteKk0IxpQn_uQbZ-XLY4L5OSBDjwLvSxhOPObz9xoKzYbHb3QcQ_ekGW6qA/exec";

/* ===== APARTMENTS ===== */
const DEFAULT_APARTMENTS = [
  "Brignole House",
  "Cartai",
  "Cesarea",
  "Lambruschini",
  "Lercari",
  "Oberdan",
  "Romana",
  "Recco",
  "Hilde"
];

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
function normalizeApartments(list){
  if(!Array.isArray(list)) return [];
  const seen=new Set();
  const out=[];
  list.forEach(name=>{
    if(typeof name!=="string") return;
    const n=name.trim();
    if(!n || seen.has(n)) return;
    seen.add(n);
    out.push(n);
  });
  return out;
}

function populateApartmentSelect(names, {preserveSelection=false}={}){
  const select=$("apt"); if(!select) return;
  const prev=preserveSelection?select.value:"";
  const items=normalizeApartments(names);
  const fallback=normalizeApartments(DEFAULT_APARTMENTS);
  const source=items.length?items:fallback;
  select.innerHTML=source.map(name=>`<option value="${name}">${name}</option>`).join("");
  if(preserveSelection && prev && source.includes(prev)){
    select.value=prev;
  } else if(source.length){
    select.value=source[0];
  }
}

async function fetchScriptJson(url, {timeoutMs=10000,retries=0}={}){
  async function attempt(){
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(), timeoutMs);
    try{
      const resp=await fetch(url,{signal:controller.signal, cache:'no-store'});
      if(!resp.ok){
        const text=await resp.text().catch(()=> "");
        const err=new Error(`HTTP ${resp.status}`);
        err.status=resp.status;
        err.body=text;
        throw err;
      }
      const ct=resp.headers.get('content-type')||'';
      if(ct.includes('application/json')) return await resp.json();
      const txt=await resp.text();
      const match=txt.match(/\{[\s\S]*\}/);
      if(match) return JSON.parse(match[0]);
      throw new Error('Unexpected response format');
    } finally {
      clearTimeout(timer);
    }
  }
  let lastErr;
  for(let attemptIdx=0; attemptIdx<=retries; attemptIdx++){
    try{
      return await attempt();
    }catch(err){
      lastErr=err;
      if(attemptIdx===retries) throw err;
      await new Promise(res=>setTimeout(res,400*(attemptIdx+1)));
    }
  }
  throw lastErr;
}

async function hydrateApartmentSelect(){
  const select=$("apt");
  if(!select) return;
  const currentValues=Array.from(select.options||[]).map(opt=>opt.value?.trim()).filter(Boolean);
  if(!select.dataset.apartmentReady){
    const fallback=normalizeApartments(DEFAULT_APARTMENTS);
    const missing=fallback.some(name=>!currentValues.includes(name));
    if(!currentValues.length || missing){
      populateApartmentSelect(DEFAULT_APARTMENTS,{preserveSelection:true});
    }
  }
  select.dataset.apartmentReady="1";
  const discoveryUrls=[
    `${SCRIPT_URL}?meta=apartments`,
    `${SCRIPT_URL}?apartments=list`,
    `${SCRIPT_URL}?apartments=all`,
    `${SCRIPT_URL}?list=apartments`
  ];
  let remoteList=[];
  let lastError=null;
  for(const url of discoveryUrls){
    try{
      const data=await fetchScriptJson(url,{timeoutMs:15000,retries:0});
      const candidates=[
        data?.apartments,
        data?.aptList,
        data?.apts,
        Array.isArray(data)?data:null,
        data?.data?.apartments,
        data?.meta?.apartments
      ];
      const list=normalizeApartments(candidates.find(arr=>Array.isArray(arr))||[]);
      if(list.length){
        remoteList=list;
        break;
      }
    }catch(err){
      lastError=err;
    }
  }
  if(remoteList.length){
    populateApartmentSelect(remoteList,{preserveSelection:true});
    select.dataset.apartmentSource="remote";
    return;
  }
  if(lastError){
    try{ console.warn("[ov] apartments fetch failed:", lastError); }catch(_){}
  }
  if(!select.options.length){
    populateApartmentSelect(DEFAULT_APARTMENTS);
  }
}

const $ = (id) => document.getElementById(id);
const setText = (id, t) => { const el = $(id); if (el) el.textContent = t; };
const euro = (n) => `€${Number(n||0).toFixed(2)}`;
function itDate(iso){ if(!iso) return ""; const d=new Date(iso.length===10?`${iso}T00:00:00`:iso); return d.toLocaleDateString("it-IT",{day:"2-digit",month:"long",year:"numeric"}); }
function sortByCheckoutAsc(rows){ return [...rows].sort((a,b)=> new Date(a.checkout) - new Date(b.checkout)); }
function num(v){ v=Number(v); return isFinite(v)?v:0; }

function isLikelyCorsError(err){
  if(!err) return false;
  const msg = String(err && (err.message || err.toString() || "")).toLowerCase();
  if(msg.includes("cors") || msg.includes("access-control-allow-origin")) return true;
  if(msg.includes("failed to fetch") || msg.includes("networkerror")) return true;
  return err instanceof TypeError && !msg.includes("timeout");
}

function showLoader(on){ const ld=$("ov-loader"), btn=$("calcBtn"); if(ld) ld.classList.toggle("ov-hidden",!on); if(btn){btn.disabled=!!on; btn.style.opacity=on?0.6:1;} }
function showErrorModal(msg, sub=""){ const m=$("ov-modal"); if(!m){ alert(msg); return; } setText("ov-modal-msg", msg||"Errore sconosciuto."); const s=$("ov-modal-sub"); if(sub){ s.textContent=sub; s.style.display="block"; } else { s.textContent=""; s.style.display="none"; } m.classList.remove("ov-hidden"); }
function hideErrorModal(){ const m=$("ov-modal"); if(m) m.classList.add("ov-hidden"); }

function recalcBookingQuarterTotal(){
  const months = ["Jan","Feb","Mar"];
  const sum = months.reduce((acc,id)=>{
    const el = document.getElementById(`ov-${id}-tax-total`);
    return acc + (el ? Number(el.textContent||"0") : 0);
  }, 0);
  setText("ov-booking-tax-total", sum.toFixed(2));
  setText("ov-totalTaxDisplay", (sum + Number(($("ov-airbnb-tax-total")?.textContent||"0"))).toFixed(2));
}


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
  // usa sempre il valore normalizzato dal backend se disponibile
  if (typeof r.minors === "number") return Math.max(0, Number(r.minors)||0);

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
function buildMainTable(rows, apt, year, quarter){
  // includi tutto di default; abilita il toggle solo per le righe dedotte da Booking Ref
  const data = sortByCheckoutAsc(rows).map(r => ({
    ...r,
    _include: true   // sempre true all'avvio (nessun salvataggio)
  }));

  const hasToggle = data.some(r => r.inferredByBookingRef);
  const hasNote   = data.some(r => r.bookingRefNote || r.inferredByBookingRefMsg);

  const tbl = document.createElement("table");
  tbl.className = "ov-table";
  tbl.innerHTML = `<thead><tr>
    <th>Check-in</th>
    <th>Check-out</th>
    <th>Notti</th>
    <th>Ospiti</th>
    <th>Ospiti tass.</th>
    <th>Pern. tassabili</th>
    <th>Imposta</th>
    ${hasNote   ? '<th>Nota</th>'   : ''}
    ${hasToggle ? '<th>Incl.</th>'  : ''}
  </tr></thead><tbody></tbody><tfoot></tfoot>`;

  const tb = tbl.querySelector("tbody");

  function totals(){
    return data.reduce((a,r)=>{
      if(!r._include) return a;
      a.n  += num(r.nights);
      a.g  += num(r.guests);
      a.gt += num(r.guestsTaxable ?? r.adultsEffective ?? Math.max(0, num(r.guests)-num(r.minors)));
      a.tn += num(r.taxableNights);
      a.t  += num(r.tax);
      return a;
    }, {n:0,g:0,gt:0,tn:0,t:0});
  }

  function renderBody(){
    tb.innerHTML = "";
    data.forEach((r, i) => {
      const note = r.bookingRefNote || r.inferredByBookingRefMsg || "";
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td data-label="Check-in">${itDate(r.checkin)}</td>
        <td data-label="Check-out">${itDate(r.checkout)}</td>
        <td data-label="Notti">${num(r.nights)}</td>
        <td data-label="Ospiti">${num(r.guests)}</td>
        <td data-label="Ospiti tass.">${num(r.guestsTaxable ?? r.adultsEffective ?? (num(r.guests)-num(r.minors)))}</td>
        <td data-label="Pern. tassabili">${num(r.taxableNights)}</td>
        <td data-label="Imposta">${euro(r.tax)}</td>
        ${hasNote   ? `<td data-label="Nota">${note ? note : "—"}</td>` : ``}
        ${hasToggle ? `<td data-label="Incl.">${r.inferredByBookingRef ? `<input type="checkbox" data-i="${i}" checked />` : "—"}</td>` : ``}
      `;
      tb.appendChild(tr);
    });

    // toggle on/off solo per righe dedotte da booking ref
    tb.querySelectorAll('input[type="checkbox"][data-i]').forEach(chk => {
      chk.addEventListener("change", (ev) => {
        const i = Number(ev.target.getAttribute("data-i"));
        data[i]._include = !!ev.target.checked;

        renderFoot();                    // aggiorna totali tabella
        if (tbl._updateMonthTotals) {    // aggiorna KPI del mese
          tbl._updateMonthTotals();
        }
        recalcBookingQuarterTotal();     // aggiorna riepilogo Booking e totale complessivo
      });
    });
  }

  const tf = tbl.querySelector("tfoot");
  function renderFoot(){
    const t = totals();
    tf.innerHTML = `
      <tr>
        <td colspan="2" style="text-align:right;font-weight:700">Totale</td>
        <td>${t.n}</td>
        <td>${t.g}</td>
        <td>${t.gt}</td>
        <td>${t.tn}</td>
        <td>${euro(t.t)}</td>
        ${hasNote ? '<td></td>' : ''}
        ${hasToggle ? '<td></td>' : ''}
      </tr>
    `;
  }

  renderBody();
  renderFoot();

  // esposto al chiamante per aggiornare il numero nel box del mese
  tbl._updateMonthTotals = function(){
    const t = totals();
    const host = tbl.closest('[id^="ov-"][id$="-block"]');
    if (host) {
      const hid = host.id.replace('-block','');      // es: ov-Jan
      const span = document.getElementById(`${hid}-tax-total`);
      if (span) span.textContent = t.t.toFixed(2);
    }
  };

  return tbl;
}


function buildExemptTable(rows, type = "minori"){
  const CAP = 8;
  const data = sortByCheckoutAsc(rows);

  const filtered = data.filter(r=>{
    const total = num(r.nights);
    const v = (type === "minori") ? computeMinorsUnder14(r) : Math.max(0, total - CAP);
    return v > 0;
  });
  if (!filtered.length) return null;

  const tbl = document.createElement("table");
  tbl.className = "ov-table";

  const labelEsenti = (type === "minori") ? "Minori esenti" : "Notti oltre 8 (esenti)";
  tbl.innerHTML = `<thead><tr>
    <th>Check-in</th>
    <th>Check-out</th>
    <th>${labelEsenti}</th>
    <th>Notti esenti</th>
    <th>Notti totali</th>
  </tr></thead><tbody></tbody><tfoot></tfoot>`;

  const tb = tbl.querySelector("tbody");

  // Totali
  let totEsenti = 0;       // prima colonna (minori o notti >8)
  let totNottiEsenti = 0;  // nuova colonna
  let totNotti = 0;        // notti totali

  filtered.forEach(r=>{
    const total = num(r.nights);
    const minors = computeMinorsUnder14(r);
    const guestsTaxable = getGuestsTaxable(r);
    const nightsOver8 = Math.max(0, total - CAP);

    // valori per riga
    const esenti = (type === "minori") ? minors : nightsOver8;
    const nottiEsenti = (type === "minori")
      ? minors * total                         // es.: 3 minori * 5 notti = 15
      : guestsTaxable * nightsOver8;           // es.: 2 adulti tass. * (notti-8)

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td data-label="Check-in">${itDate(r.checkin)}</td>
      <td data-label="Check-out">${itDate(r.checkout)}</td>
      <td data-label="${labelEsenti}">${num(esenti)}</td>
      <td data-label="Notti esenti">${num(nottiEsenti)}</td>
      <td data-label="Notti totali">${total}</td>
    `;
    tb.appendChild(tr);

    // accumula totali
    totEsenti += num(esenti);
    totNottiEsenti += num(nottiEsenti);
    totNotti += total;
  });

  tbl.querySelector("tfoot").innerHTML = `
    <tr>
      <td colspan="2" style="text-align:right;font-weight:700">Totale</td>
      <td>${totEsenti}</td>
      <td>${totNottiEsenti}</td>
      <td>${totNotti}</td>
    </tr>
  `;

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
  const fromISO = payload?.period?.from || `${new Date().getFullYear()}-01-01`;
  const year    = new Date(fromISO).getFullYear().toString();
  const keys    = QUARTER_MONTH_KEYS[quarter] || [];
  const details = payload.details || [];

  // --- Map mesi IT (anche abbreviazioni) -> 1..12
  const MONTH_IT = {
    "gennaio":1,"gen":1,
    "febbraio":2,"feb":2,
    "marzo":3,"mar":3,
    "aprile":4,"apr":4,
    "maggio":5,"mag":5,
    "giugno":6,"giu":6,
    "luglio":7,"lug":7,
    "agosto":8,"ago":8,
    "settembre":9,"sett":9,"set":9,
    "ottobre":10,"ott":10,
    "novembre":11,"nov":11,
    "dicembre":12,"dic":12
  };

  // --- Normalizza "9", "09" ecc.
  const pad2 = (n) => String(n).padStart(2,'0');

  // --- Estrae una data dal testo; se manca l'anno usa fallbackYear; se nulla trovata, ritorna ""
  function extractDateFromText(text, fallbackYear){
    if (!text) return "";

    const s = String(text);

    // 1) yyyy-mm-dd
    let m = s.match(/\b(20\d{2})-(0?[1-9]|1[0-2])-(0?[1-9]|[12]\d|3[01])\b/);
    if (m) return `${m[1]}-${pad2(m[2])}-${pad2(m[3])}`;

    // 2) dd/mm/yyyy o dd-mm-yyyy
    m = s.match(/\b(0?[1-9]|[12]\d|3[01])[\/\-](0?[1-9]|1[0-2])[\/\-](20\d{2})\b/);
    if (m) return `${m[3]}-${pad2(m[2])}-${pad2(m[1])}`;

    // 3) dd/mm o dd-mm (senza anno) -> usa fallbackYear
    m = s.match(/\b(0?[1-9]|[12]\d|3[01])[\/\-](0?[1-9]|1[0-2])\b/);
    if (m) return `${fallbackYear}-${pad2(m[2])}-${pad2(m[1])}`;

    // 4) dd mese yyyy  (es: 9 luglio 2025) – mese IT, case-insensitive, accenti ok
    m = s.match(/\b(0?[1-9]|[12]\d|3[01])\s+([A-Za-zÀ-ÿ\.]+)\s+(20\d{2})\b/);
    if (m){
      const mm = MONTH_IT[m[2].toLowerCase().replace(/\./g,"")] || null;
      if (mm) return `${m[3]}-${pad2(mm)}-${pad2(m[1])}`;
    }

    // 5) dd mese (senza anno) -> usa fallbackYear
    m = s.match(/\b(0?[1-9]|[12]\d|3[01])\s+([A-Za-zÀ-ÿ\.]+)\b/);
    if (m){
      const mm = MONTH_IT[m[2].toLowerCase().replace(/\./g,"")] || null;
      if (mm) return `${fallbackYear}-${pad2(mm)}-${pad2(m[1])}`;
    }

    return "";
  }

  // --- Tabella "Data | Messaggio" dalle prenotazioni inferite (usa checkout come fallback)
  function buildInferredTable(items, maxRows=10){
    if (!items.length) return null;
    const tbl = document.createElement("table");
    tbl.className = "ov-table";
    tbl.innerHTML = `<thead><tr>
      <th>Data</th><th>Messaggio</th>
    </tr></thead><tbody></tbody><tfoot></tfoot>`;
    const tb = tbl.querySelector("tbody");

    items.slice(0, maxRows).forEach(e=>{
      const raw = String(e.bookingRef || "").trim();
      // se più righe, prendo la prima “parlante” per il messaggio
      const firstLine = raw.split(/\r?\n/).find(l => l.trim().length) || "";
      // anno di fallback = anno del checkout della prenotazione
      const fbYear = (e.checkout && /^\d{4}-\d{2}-\d{2}$/.test(e.checkout)) ? e.checkout.slice(0,4) : year;
      // cerco la data su TUTTO il testo; se non trovo, uso il checkout
      const extracted = extractDateFromText(raw, fbYear);
      const shownDate = extracted || (e.checkout ? e.checkout : "—");

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td data-label="Data">${shownDate !== "" ? shownDate : "—"}</td>
        <td data-label="Messaggio">${firstLine || "—"}</td>
      `;
      tb.appendChild(tr);
    });

    if (items.length > maxRows){
      const tr = document.createElement("tr");
      tr.innerHTML = `<td colspan="2" style="font-style:italic;color:#6b7280">
        …e altre ${items.length - maxRows} prenotazioni
      </td>`;
      tb.appendChild(tr);
    }
    return tbl;
  }

  // indicizza per mese (YYYY-MM)
  const byMonth = {};
  details.forEach(d => {
    const k = d.month || "unknown";
    (byMonth[k] ||= []).push(d);
  });

  // ====== 3 mesi (Booking) ======
  ["Jan","Feb","Mar"].forEach((id, idx) => {
    const ym   = keys[idx] ? `${year}-${keys[idx]}` : null;
    const host = ensureDetailsHost(`ov-${id}-block`);
    if (!host) return;
    host.innerHTML = "";

    const rowsAll = ym ? (byMonth[ym] || []).filter(r => r.platform === "booking") : [];
    if (!rowsAll.length){
      const p = document.createElement("p");
      p.className = "ov-empty";
      p.textContent = "Nessuna prenotazione Booking con checkout in questo mese.";
      host.appendChild(p);
      return;
    }

    // Tabella “Data | Messaggio” per righe inferite da Booking reference
    const inferred = rowsAll.filter(r => r.inferredByBookingRef);
    if (inferred.length){
      const box = document.createElement("section");
      box.className = "ov-subsection";
      const h3 = document.createElement("h3");
      h3.textContent = "Prenotazioni inferite da Booking reference";
      box.appendChild(h3);

      const tbl = buildInferredTable(inferred, 10);
      if (tbl){
        const wrap = document.createElement("div");
        wrap.className = "ov-tablewrap";
        wrap.appendChild(tbl);
        box.appendChild(wrap);
      }
      host.appendChild(box);
    }

    // Soggetti a imposta (con colonna “Incl.” sulle righe inferite)
    const payable = rowsAll.filter(r => (num(r.taxableNights) > 0) || (num(r.tax) > 0));
    addSection(host, "Soggetti a imposta", payable.length ? buildMainTable(payable) : null);
    addSection(host, "Minori esenti", buildExemptTable(rowsAll, "minori"));
    addSection(host, "Oltre 8 notti (esenti)", buildExemptTable(rowsAll, "cap"));
  });

  // ====== Airbnb (trimestre) ======
  const ahost = ensureDetailsHost("ov-airbnb-block");
  if (ahost){
    const rowsQ = details.filter(r => r.platform === "airbnb");
    ahost.innerHTML = "";
    if (!rowsQ.length){
      const p = document.createElement("p");
      p.className = "ov-empty";
      p.textContent = "Nessuna prenotazione Airbnb nel trimestre.";
      ahost.appendChild(p);
    } else {
      const payable = rowsQ.filter(r => (num(r.taxableNights) > 0) || (num(r.tax) > 0));
      addSection(ahost, "Soggetti a imposta", payable.length ? buildMainTable(payable) : null);
      addSection(ahost, "Minori esenti", buildExemptTable(rowsQ, "minori"));
      addSection(ahost, "Oltre 8 notti (esenti)", buildExemptTable(rowsQ, "cap"));
    }
  }

  // ====== Booking (trimestre) ======
  const bhost = ensureDetailsHost("ov-booking-block");
  if (bhost){
    const rowsQ = details.filter(r => r.platform === "booking");
    bhost.innerHTML = "";
    if (!rowsQ.length){
      const p = document.createElement("p");
      p.className = "ov-empty";
      p.textContent = "Nessuna prenotazione Booking nel trimestre.";
      bhost.appendChild(p);
    } else {
      const inferredQ = rowsQ.filter(r => r.inferredByBookingRef);
      if (inferredQ.length){
        const box = document.createElement("section");
        box.className = "ov-subsection";
        const h3 = document.createElement("h3");
        h3.textContent = "Prenotazioni inferite da Booking reference (trimestre)";
        box.appendChild(h3);

        const tbl = buildInferredTable(inferredQ, 15);
        if (tbl){
          const wrap = document.createElement("div");
          wrap.className = "ov-tablewrap";
          wrap.appendChild(tbl);
          box.appendChild(wrap);
        }
        bhost.appendChild(box);
      }

      const payable = rowsQ.filter(r => (num(r.taxableNights) > 0) || (num(r.tax) > 0));
      addSection(bhost, "Soggetti a imposta", payable.length ? buildMainTable(payable) : null);
      addSection(bhost, "Minori esenti", buildExemptTable(rowsQ, "minori"));
      addSection(bhost, "Oltre 8 notti (esenti)", buildExemptTable(rowsQ, "cap"));
    }
  }
}


// Badge "pernottamenti tassabili" nel titolo mese
function setMonthHeaderWithChip(id, label, nights) {
  const h = document.querySelector(`#ov-${id}-block h2.ov-section-h`);
  if (!h) return;
  h.innerHTML = `${label} – <span class="booking-color">Booking</span>`;
}

/* ===== RENDER KPI ===== */
function renderResult(payload, quarter) {
  setText("ov-totalTaxDisplay", Number(payload.totalTax || 0).toFixed(2));
  setText("ov-bookingTaxDisplay", Number(payload.booking?.tax || 0).toFixed(2));
  setText("ov-airbnbTaxDisplay", Number(payload.airbnb?.tax || 0).toFixed(2));

  const fromISO = payload?.period?.from || `${new Date().getFullYear()}-01-01`;
  const year = new Date(fromISO).getFullYear().toString();
  const labels = QUARTER_TITLES_IT[quarter] || ["Gennaio", "Febbraio", "Marzo"];
  const keys = QUARTER_MONTH_KEYS[quarter] || [];

  ["Jan", "Feb", "Mar"].forEach((id, idx) => {
    const k = keys[idx] ? `${year}-${keys[idx]}` : null;
    const d = k && payload.bookingByMonth ? payload.bookingByMonth[k] : null;

    const tax    = num(d?.tax);
    const guests = num(d?.guests);
    const minors = (typeof d?.minorsUnder14 === "number")
      ? num(d.minorsUnder14)
      : num(d?.minors);
    const books  = num(d?.bookings);
    const nights = num(d?.taxableNights); // 🔹 totale pern. tassabili del mese

    setText(`ov-${id}-tax-total`, tax.toFixed(2));
    ensureInfoRow(`ov-${id}`, 1, `Prenotazioni: ${books}`);
    ensureInfoRow(`ov-${id}`, 2, `Ospiti totali: ${guests}`);
    ensureInfoRow(`ov-${id}`, 3, `Pernottamenti tassabili: ${nights}`);
    ensureInfoRow(`ov-${id}`, 4, `Minori esenti: ${minors}`);

    // 🔹 Aggiorna titolo mese con badge "Pern. tassabili"
    setMonthHeaderWithChip(id, labels[idx] || "", nights);
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

  const handleResponse = (res) => {
    if(!res || !res.ok){
      const msg=res && res.error ? res.error : "Impossibile calcolare.";
      let hint="";
      if(/Cartella trimestre non trovata/i.test(msg)) hint=`Controlla in Drive: Appartamenti ➜ ${apt} ➜ ${year} ➜ ${quarter} (cartella mancante).`;
      else if(/Nessun file nel trimestre/i.test(msg)) hint="La cartella esiste ma non contiene alcun file report.";
      else if(/Cartella appartamento non trovata/i.test(msg)) hint="Il nome dell'appartamento deve corrispondere alla cartella in Drive.";
      else if(/Parametri richiesti/i.test(msg)) hint="Verifica apt, year e quarter (Q1..Q4).";
      showErrorModal(msg, hint);
      return false;
    }
    const aptCandidates=[
      res.apartments,
      res.apartmentsList,
      res.aptList,
      res.meta?.apartments,
      res.data?.apartments
    ];
    const remoteApts=normalizeApartments(aptCandidates.find(arr=>Array.isArray(arr))||[]);
    if(remoteApts.length){
      populateApartmentSelect(remoteApts,{preserveSelection:true});
      const select=$("apt"); if(select) select.dataset.apartmentSource="remote";
    }
    renderResult(res, quarter);
    return true;
  };

  // Use fetch with a single retry. If the endpoint blocks CORS we fall back to the JSONP helper.
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

    doFetch().then(handleResponse).catch(async err=>{
      console.error('[ov] fetch error:', err);
      if(isLikelyCorsError(err)){
        try{
          const res = await jsonp(url, null, 20000);
          if(handleResponse(res)) return;
        }catch(jsonpErr){
          try{ console.error('[ov] jsonp fallback failed:', jsonpErr); }catch(_){}
        }
      }
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
  hydrateApartmentSelect();
  const btn=$("calcBtn");
  if(btn){
    btn.addEventListener("click", ()=>{
      const apt=$("apt")?.value, year=$("year")?.value, quarter=$("quarter")?.value;
      if(!apt||!year||!quarter){ showErrorModal("Parametri mancanti","Compila appartamento, anno e trimestre."); return; }
      loadTax(apt, year, quarter);
    });
  }
});
