'use strict';
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const baht = n => n.toLocaleString('th-TH');
const STORE = 'onsen4two.custom';

const loadCustom = () => { try { return JSON.parse(localStorage.getItem(STORE)) || []; } catch { return []; } };
let custom = loadCustom();
const allVenues = () => [...VENUES, ...custom];

// ---------- รอบเวลา ----------
const toMin = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const fmtTime = m => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

// hash แบบกำหนดได้ เพื่อให้รอบว่างจำลองคงที่ต่อ (ร้าน, วัน, รอบ)
function hash(str) {
  let h = 2166136261;
  for (const c of str) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  return (h >>> 0) / 4294967296;
}

function slotsFor(v, dateStr) {
  const d = new Date(dateStr + 'T00:00');
  if (v.closedDays?.includes(d.getDay())) return null; // ปิดทำการ
  const open = toMin(v.open);
  let close = toMin(v.close === '24:00' ? '23:59' : v.close);
  if (close <= open) close += 24 * 60; // ปิดหลังเที่ยงคืน
  const len = Math.min(...(v.duration || [90]));
  const weekend = d.getDay() === 0 || d.getDay() === 5 || d.getDay() === 6;
  const busy = weekend ? 0.6 : 0.35;
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const out = [];
  for (let t = open; t + len <= close; t += 90) {
    const past = isToday && t < nowMin;
    const free = !past && hash(`${v.id}|${dateStr}|${t}`) > busy;
    out.push({ t, free, past });
  }
  return out;
}

const inTod = (t, tod) => {
  const h = (t / 60) % 24, hh = t >= 24 * 60 ? h + 24 : h;
  return tod === 'any' ? true
    : tod === 'afternoon' ? hh >= 12 && hh < 17
    : tod === 'evening' ? hh >= 17 && hh < 21
    : hh >= 21;
};

// ---------- UI ตัวกรอง ----------
const selectedAreas = new Set(Object.keys(AREAS));
for (const [k, label] of Object.entries(AREAS)) {
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'chip on'; b.textContent = label; b.dataset.k = k;
  b.setAttribute('aria-pressed', 'true');
  b.onclick = () => {
    selectedAreas.has(k) ? selectedAreas.delete(k) : selectedAreas.add(k);
    b.classList.toggle('on'); b.setAttribute('aria-pressed', b.classList.contains('on'));
    render();
  };
  $('areas').append(b);
  $('addArea').add(new Option(label, k));
}

[['ไม่เกิน 1,500', 0, 1500], ['1,500–3,000', 1500, 3000], ['3,000+', 3000, 8000]].forEach(([l, a, b]) => {
  const c = document.createElement('button');
  c.type = 'button'; c.className = 'chip'; c.textContent = l;
  c.onclick = () => { $('pmin').value = a; $('pmax').value = b; $('prange').value = b; render(); };
  $('presets').append(c);
});

const today = new Date();
const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
$('date').min = iso(today);
$('date').value = iso(today);

$('prange').oninput = () => { $('pmax').value = $('prange').value; render(); };
$('pmax').oninput = () => { $('prange').value = $('pmax').value; render(); };
['pmin', 'date', 'tod', 'onlyFree', 'onlyConfirmed', 'showDemo', 'sort'].forEach(id => $(id).addEventListener('input', render));

$('reset').onclick = () => {
  Object.keys(AREAS).forEach(k => selectedAreas.add(k));
  document.querySelectorAll('#areas .chip').forEach(c => { c.classList.add('on'); c.setAttribute('aria-pressed', 'true'); });
  $('pmin').value = 0; $('pmax').value = 6000; $('prange').value = 6000;
  $('date').value = iso(today); $('tod').value = 'any';
  $('onlyFree').checked = true; $('onlyConfirmed').checked = false; $('showDemo').checked = true;
  $('sort').value = 'price';
  render();
};

// ---------- แสดงผล ----------
function render() {
  const pmin = Number($('pmin').value) || 0;
  const pmax = Number($('pmax').value) || Infinity;
  const date = $('date').value || iso(today);
  const tod = $('tod').value;

  const rows = allVenues()
    .filter(v => $('showDemo').checked || !v.demo)
    .filter(v => v.areas.some(a => selectedAreas.has(a)))
    // ช่วงราคาของร้านต้องซ้อนกับงบที่ตั้งไว้
    .filter(v => v.priceMin <= pmax && v.priceMax >= pmin)
    .filter(v => !$('onlyConfirmed').checked || v.privateForTwo === 'yes')
    .map(v => {
      const all = slotsFor(v, date);
      const slots = all ? all.filter(s => inTod(s.t, tod)) : null;
      return { v, slots, free: slots ? slots.filter(s => s.free).length : 0 };
    })
    .filter(r => !$('onlyFree').checked || r.free > 0);

  const s = $('sort').value;
  rows.sort((a, b) => s === 'price' ? a.v.priceMin - b.v.priceMin
    : s === 'priceDesc' ? b.v.priceMax - a.v.priceMax
    : b.free - a.free);

  $('count').textContent = `(${rows.length} ร้าน)`;
  $('list').innerHTML = rows.length ? rows.map(card).join('')
    : '<p class="empty">ไม่พบร้านที่ตรงเงื่อนไข ลองขยายงบ เปลี่ยนวัน หรือเลือกย่านเพิ่ม</p>';
}

function card({ v, slots, free }) {
  const areas = v.areas.map(a => `<span class="tag">${esc(AREAS[a] || a)}</span>`).join('');
  const priv = v.privateForTwo === 'yes'
    ? '<span class="tag ok">ห้องแช่คู่ส่วนตัว ✓</span>'
    : '<span class="tag warn">ห้องส่วนตัว – โปรดสอบถามร้าน</span>';
  const slotHtml = slots === null
    ? '<p class="closed">ร้านปิดวันนี้</p>'
    : slots.length === 0 ? '<p class="closed">ไม่มีรอบในช่วงเวลาที่เลือก</p>'
    : `<div class="slots">${slots.map(x => `<span class="slot ${x.free ? 'free' : 'full'}" title="${x.free ? 'ว่าง' : x.past ? 'เลยเวลาแล้ว' : 'เต็ม'}">${fmtTime(x.t)}</span>`).join('')}</div>`;
  const book = v.book
    ? `<a class="btn" href="${esc(v.book)}" target="_blank" rel="noopener">จอง / เช็กรอบจริง ↗</a>` : '';
  const map = v.demo ? '' : `<a class="btn ghost" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(v.name + ' ' + (v.address || ''))}" target="_blank" rel="noopener">แผนที่ ↗</a>`;
  const del = v.custom ? `<button class="ghost small" data-del="${esc(v.id)}">ลบ</button>` : '';
  return `<article class="card venue${v.demo ? ' demo' : ''}">
    <div class="vhead">
      <div>
        <h3>${esc(v.name)}</h3>
        <p class="meta">${esc(v.near || '')}${v.address ? ' · ' + esc(v.address) : ''}</p>
      </div>
      <div class="price">
        <b>฿${baht(v.priceMin)}–${baht(v.priceMax)}</b>
        <small>/ 2 คน / รอบ${v.priceVerified ? '' : ' · ประมาณการ'}</small>
      </div>
    </div>
    <div class="tags">${areas}${priv}${(v.features || []).map(f => `<span class="tag soft">${esc(f)}</span>`).join('')}</div>
    <p class="meta">เปิด ${esc(v.open)}–${esc(v.close)} · คอร์ส ${(v.duration || []).join('/')} นาที · <b>${free}</b> รอบว่าง</p>
    ${slotHtml}
    <div class="actions">${book}${map}${del}</div>
  </article>`;
}

$('list').addEventListener('click', e => {
  const id = e.target.dataset.del;
  if (!id) return;
  custom = custom.filter(v => v.id !== id);
  localStorage.setItem(STORE, JSON.stringify(custom));
  render();
});

// ---------- เพิ่มร้าน ----------
$('openAdd').onclick = () => { $('addForm').reset(); $('addDlg').showModal(); };
$('addDlg').addEventListener('close', () => {
  if ($('addDlg').returnValue !== 'ok') return;
  const f = Object.fromEntries(new FormData($('addForm')));
  const lo = Number(f.priceMin), hi = Number(f.priceMax);
  custom.push({
    id: 'c' + Date.now(), custom: true,
    name: f.name, areas: [f.area], near: f.near, address: '',
    open: f.open, close: f.close, closedDays: [], duration: [90],
    priceMin: Math.min(lo, hi), priceMax: Math.max(lo, hi), priceVerified: true,
    privateForTwo: 'yes', features: ['เพิ่มเอง'],
    book: /^https?:\/\//.test(f.book) ? f.book : '',
  });
  localStorage.setItem(STORE, JSON.stringify(custom));
  render();
});

render();
