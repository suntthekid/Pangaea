'use strict';
// ---------------------------------------------------------------- ค่าเริ่มต้น (ตรงกับ ../config.example.json)
let ZONES = [
  { key: 'rama9', name: 'พระราม 9', route: [[13.7577, 100.5657], [13.7562, 100.5790], [13.7535, 100.5980], [13.7495, 100.6230]] },
  { key: 'huaikhwang', name: 'ห้วยขวาง–รัชดา', route: [[13.7577, 100.5657], [13.7660, 100.5700], [13.7787, 100.5737], [13.7895, 100.5740], [13.7985, 100.5738], [13.8060, 100.5728]] },
  { key: 'ratchayothin', name: 'รัชโยธิน', route: [[13.8060, 100.5728], [13.8200, 100.5790], [13.8295, 100.5695], [13.8370, 100.5730]] },
];
const ZONE_COLORS = ['var(--z0)', 'var(--z1)', 'var(--z2)', '#0b7285', '#c2255c'];
let DEFAULTS = {
  zones: ZONES.map(z => z.key), q: '', maxPrice: 1000, minPrice: 0, minRating: 7, minReviews: 0,
  allowUnrated: true, buffer: 1.2, excludeTypes: ['capsule hotel'], onlyNew: false, sort: 'price',
};
let DROP_PCT = 5;
const K_FILTERS = 'hotelalert.filters', K_SEEN = 'hotelalert.seen', K_SRC = 'hotelalert.source';

const EMBED = window.HOTEL_EMBED || null; // ใส่มาโดย build_web.py สำหรับไฟล์เดียวเปิดได้เลย
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const baht = v => '฿' + Math.round(v).toLocaleString('th-TH');
const TH_M = 'ม.ค. ก.พ. มี.ค. เม.ย. พ.ค. มิ.ย. ก.ค. ส.ค. ก.ย. ต.ค. พ.ย. ธ.ค.'.split(' ');
const thDate = iso => { const d = new Date(iso + 'T00:00:00'); return isNaN(d) ? '-' : `${d.getDate()} ${TH_M[d.getMonth()]}`; };
const load = (k, def) => { try { return JSON.parse(localStorage.getItem(k)) ?? def; } catch { return def; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };

// ---------------------------------------------------------------- geometry
function distToSegmentKm(p, a, b) {
  const k = Math.cos(p[0] * Math.PI / 180);
  const xy = q => [(q[1] - p[1]) * 111.32 * k, (q[0] - p[0]) * 110.57];
  const [ax, ay] = xy(a), [bx, by] = xy(b);
  const dx = bx - ax, dy = by - ay, seg2 = dx * dx + dy * dy;
  const t = seg2 === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / seg2));
  return Math.hypot(ax + t * dx, ay + t * dy);
}
function distToRouteKm(p, route) {
  if (route.length === 1) return distToSegmentKm(p, route[0], route[0]);
  let m = Infinity;
  for (let i = 1; i < route.length; i++) m = Math.min(m, distToSegmentKm(p, route[i - 1], route[i]));
  return m;
}

// ---------------------------------------------------------------- parsing (เหมือน hotel_alert.py)
function nightsBetween(ci, co) {
  const n = Math.round((new Date(co) - new Date(ci)) / 864e5);
  return Number.isFinite(n) && n > 0 ? n : 1;
}
function cleanUrl(url) {
  if (!url) return ['', {}];
  try {
    const u = new URL(url);
    u.searchParams.delete('aid'); u.searchParams.delete('label');
    return [u.toString(), Object.fromEntries(u.searchParams)];
  } catch { return [url, {}]; }
}
function parseSnapshot(data) {
  let metaIn = '', metaOut = '', items = data;
  if (!Array.isArray(data)) {
    metaIn = data.checkin || ''; metaOut = data.checkout || '';
    items = data.accommodations || data.hotels || [];
  }
  const out = [];
  for (const it of items) {
    const [url, q] = cleanUrl(it.url);
    const checkin = it.checkin || metaIn || q.checkin || '';
    const checkout = it.checkout || metaOut || q.checkout || '';
    const price = it.price;
    const total = typeof price === 'object' && price ? price.book : price;
    const currency = (typeof price === 'object' && price?.currency) || it.currency || 'THB';
    const loc = it.location?.coordinates || it;
    const lat = loc.latitude ?? loc.lat, lng = loc.longitude ?? loc.lng;
    if (total == null || lat == null || lng == null) continue;
    const r = typeof it.rating === 'object' && it.rating ? it.rating : null;
    const nights = it.nights || nightsBetween(checkin, checkout);
    out.push({
      id: String(it.id), name: it.name, total: +total, nights, perNight: +total / nights, currency,
      lat: +lat, lng: +lng, url,
      rating: r ? r.review_score ?? null : it.review_score ?? null,
      reviews: (r ? r.number_of_reviews : it.reviews) || 0,
      stars: r ? r.stars : it.stars, kind: it.accommodationType || it.type || 'อื่นๆ',
      checkin, checkout,
    });
  }
  return out;
}

// ---------------------------------------------------------------- state
let hotels = [];
let F = { ...DEFAULTS, ...load(K_FILTERS, {}) };
let seen = load(K_SEEN, {});
let lastFiltered = [];
let refreshTimer = null;
let notifyOn = false;
const keyOf = h => `${h.id}|${h.checkin}`;

function setData(list, info) {
  const map = new Map();
  for (const h of list) {
    const k = keyOf(h);
    if (!map.has(k) || h.perNight < map.get(k).perNight) map.set(k, h);
  }
  const before = new Set(hotels.map(keyOf));
  hotels = [...map.values()];
  const dates = [...new Set(hotels.map(h => h.checkin).filter(Boolean))].sort();
  $('srcInfo').textContent = `${info} · ${hotels.length} แห่ง` + (dates.length ? ` · เข้าพัก ${dates.map(thDate).join(', ')}` : '');
  buildTypeBoxes();
  render();
  return hotels.filter(h => !before.has(keyOf(h)));
}

function setMsg(text, err = false) { $('msg').textContent = text; $('msg').classList.toggle('err', err); }

async function fetchJson(url) {
  const r = await fetch(url, { cache: 'no-store' });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

// ---------------------------------------------------------------- filtering
function matchZone(h) {
  let best = null;
  ZONES.forEach((z, i) => {
    if (!F.zones.includes(z.key)) return;
    const d = distToRouteKm([h.lat, h.lng], z.route);
    if (d <= F.buffer && (!best || d < best.dist)) best = { zone: z, idx: i, dist: d };
  });
  return best;
}
function statusOf(h) {
  const prev = seen[keyOf(h)];
  if (prev == null) return { kind: 'new' };
  if (h.perNight <= prev * (1 - DROP_PCT / 100)) return { kind: 'drop', prev };
  return { kind: 'seen', prev };
}
function applyFilters() {
  const q = F.q.trim().toLowerCase();
  const res = [];
  for (const h of hotels) {
    const m = matchZone(h);
    if (!m) continue;
    if (h.perNight > F.maxPrice || h.perNight < F.minPrice) continue;
    if (h.rating == null) { if (!F.allowUnrated) continue; }
    else if (h.rating < F.minRating || h.reviews < F.minReviews) continue;
    if (F.excludeTypes.includes(h.kind.toLowerCase())) continue;
    if (q && !h.name.toLowerCase().includes(q)) continue;
    const st = statusOf(h);
    if (F.onlyNew && st.kind === 'seen') continue;
    res.push({ h, ...m, st });
  }
  const val = r => (r.h.rating ?? 0) / r.h.perNight;
  const sorters = {
    price: (a, b) => a.h.perNight - b.h.perNight,
    value: (a, b) => val(b) - val(a) || a.h.perNight - b.h.perNight,
    rating: (a, b) => (b.h.rating ?? -1) - (a.h.rating ?? -1) || b.h.reviews - a.h.reviews,
    distance: (a, b) => a.dist - b.dist,
    zone: (a, b) => a.idx - b.idx || a.h.perNight - b.h.perNight,
  };
  return res.sort(sorters[F.sort] || sorters.price);
}

// ---------------------------------------------------------------- rendering
function buildZoneBoxes() {
  $('zoneBoxes').innerHTML = ZONES.map((z, i) =>
    `<label class="chip"><input type="checkbox" value="${esc(z.key)}" ${F.zones.includes(z.key) ? 'checked' : ''}>` +
    `<i style="background:${ZONE_COLORS[i % ZONE_COLORS.length]}"></i>${esc(z.name)}</label>`).join('');
  $('legend').innerHTML = ZONES.map((z, i) => `<span><i style="background:${ZONE_COLORS[i % ZONE_COLORS.length]}"></i>${esc(z.name)}</span>`).join('');
}
function buildTypeBoxes() {
  const counts = {};
  for (const h of hotels) counts[h.kind] = (counts[h.kind] || 0) + 1;
  const kinds = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
  $('typeBoxes').innerHTML = kinds.length ? kinds.map(k =>
    `<label class="chip"><input type="checkbox" value="${esc(k)}" ${F.excludeTypes.includes(k.toLowerCase()) ? '' : 'checked'}>${esc(k)} <span class="muted">${counts[k]}</span></label>`).join('')
    : '<span class="muted">โหลดข้อมูลก่อน</span>';
}
function syncControls() {
  $('q').value = F.q;
  $('maxPrice').value = F.maxPrice; $('maxPriceOut').textContent = baht(F.maxPrice);
  $('minPrice').value = F.minPrice; $('minPriceOut').textContent = baht(F.minPrice);
  $('minRating').value = String(F.minRating);
  $('minReviews').value = F.minReviews;
  $('allowUnrated').checked = F.allowUnrated;
  $('buffer').value = F.buffer; $('bufferOut').textContent = `${(+F.buffer).toFixed(1)} กม.`;
  $('onlyNew').checked = F.onlyNew;
  $('sort').value = F.sort;
}

function render() {
  syncControls();
  save(K_FILTERS, F);
  const rows = applyFilters();
  lastFiltered = rows;

  // KPI
  $('kCount').textContent = rows.length;
  $('kTotal').textContent = `จาก ${hotels.length} แห่ง`;
  if (rows.length) {
    const cheapest = rows.reduce((a, b) => (b.h.perNight < a.h.perNight ? b : a));
    $('kMin').textContent = baht(cheapest.h.perNight);
    $('kMinName').textContent = cheapest.h.name;
    $('kAvg').textContent = baht(rows.reduce((s, r) => s + r.h.perNight, 0) / rows.length);
  } else { $('kMin').textContent = '-'; $('kMinName').innerHTML = '&nbsp;'; $('kAvg').textContent = '-'; }
  $('kNew').textContent = rows.filter(r => r.st.kind !== 'seen').length;

  // ถูกที่สุดของแต่ละย่าน
  const cheapestByZone = {};
  for (const r of rows) {
    const c = cheapestByZone[r.zone.key];
    if (!c || r.h.perNight < c.h.perNight) cheapestByZone[r.zone.key] = r;
  }

  $('list').innerHTML = rows.length ? rows.map(r => {
    const h = r.h, color = ZONE_COLORS[r.idx % ZONE_COLORS.length];
    const tags = [];
    if (r.st.kind === 'new') tags.push('<span class="tag">ใหม่</span>');
    if (r.st.kind === 'drop') tags.push(`<span class="tag">ลด ${Math.round((1 - h.perNight / r.st.prev) * 100)}%</span>`);
    if (cheapestByZone[r.zone.key] === r) tags.push('<span class="tag cheap">ถูกสุดในย่าน</span>');
    const rating = h.rating != null ? `<span class="score">⭐ ${h.rating}</span> (${h.reviews.toLocaleString('th-TH')} รีวิว)` : 'ยังไม่มีรีวิว';
    const name = h.url ? `<a href="${esc(h.url)}" target="_blank" rel="noopener">${esc(h.name)}</a>` : esc(h.name);
    const was = r.st.kind === 'drop' ? `<small><s>${baht(r.st.prev)}</s></small>` : '';
    return `<article class="item" id="h-${esc(h.id)}" style="--zc:${color}">
      <h3>${name}${tags.join('')}</h3>
      <div class="price">${was}<b>${baht(h.perNight)}</b><small>ต่อคืน${h.nights > 1 ? ` · รวม ${baht(h.total)} (${h.nights} คืน)` : ''}</small></div>
      <div class="meta"><span style="color:${color}">● ${esc(r.zone.name)}</span><span>ห่างถนน ${r.dist.toFixed(1)} กม.</span>
      <span>${esc(h.kind)}${h.stars ? ` · ${h.stars} ดาว` : ''}</span><span>${rating}</span><span>เข้าพัก ${thDate(h.checkin)}–${thDate(h.checkout)}</span></div>
    </article>`;
  }).join('') : `<p class="empty">${hotels.length ? 'ไม่มีที่พักตรงตัวกรอง ลองเพิ่มเพดานราคาหรือระยะห่างจากถนน' : 'โหลดข้อมูลเพื่อเริ่มต้น'}</p>`;

  drawMap(rows);
}

function drawMap(rows) {
  const svg = $('map'), W = 600, H = 420, pad = 24;
  const pts = ZONES.flatMap(z => z.route).concat(hotels.map(h => [h.lat, h.lng]));
  let minLat = Math.min(...pts.map(p => p[0])), maxLat = Math.max(...pts.map(p => p[0]));
  let minLng = Math.min(...pts.map(p => p[1])), maxLng = Math.max(...pts.map(p => p[1]));
  const k = Math.cos(((minLat + maxLat) / 2) * Math.PI / 180);
  const kmW = (maxLng - minLng) * 111.32 * k || 1, kmH = (maxLat - minLat) * 110.57 || 1;
  const s = Math.min((W - 2 * pad) / kmW, (H - 2 * pad) / kmH); // px ต่อ กม.
  const ox = (W - kmW * s) / 2, oy = (H - kmH * s) / 2;
  const P = ([lat, lng]) => [ox + (lng - minLng) * 111.32 * k * s, oy + (maxLat - lat) * 110.57 * s];
  const line = route => route.map(P).map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');

  let out = '';
  ZONES.forEach((z, i) => {
    const c = ZONE_COLORS[i % ZONE_COLORS.length];
    if (F.zones.includes(z.key)) out += `<polyline class="buf" points="${line(z.route)}" stroke="${c}" stroke-width="${(2 * F.buffer * s).toFixed(1)}"/>`;
    out += `<polyline class="route" points="${line(z.route)}" stroke="${c}" ${F.zones.includes(z.key) ? '' : 'opacity=".25"'}/>`;
    const [lx, ly] = P(z.route[Math.floor(z.route.length / 2)]);
    out += `<text class="lbl" x="${(lx + 8).toFixed(1)}" y="${(ly - 8).toFixed(1)}">${esc(z.name)}</text>`;
  });
  const active = new Map(rows.map(r => [r.h, r]));
  for (const h of hotels) {
    const [x, y] = P([h.lat, h.lng]);
    const r = active.get(h);
    const cls = r ? (r.st.kind !== 'seen' ? 'dot hot' : 'dot') : 'dot off';
    const fill = r ? ZONE_COLORS[r.idx % ZONE_COLORS.length] : '';
    out += `<circle class="${cls}" data-id="${esc(h.id)}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r ? 6 : 4}" ${fill ? `fill="${fill}"` : ''}>` +
      `<title>${esc(h.name)} · ${baht(h.perNight)}/คืน${r ? '' : ' (ไม่ผ่านตัวกรอง)'}</title></circle>`;
  }
  // มาตราส่วน 1 กม.
  out += `<line x1="${W - pad - s}" y1="${H - 12}" x2="${W - pad}" y2="${H - 12}" stroke="currentColor" stroke-width="2"/>` +
    `<text class="lbl" x="${W - pad - s}" y="${H - 16}">1 กม.</text>`;
  svg.innerHTML = out;
}

// ---------------------------------------------------------------- actions
function markSeen() {
  for (const r of lastFiltered) seen[keyOf(r.h)] = Math.round(r.h.perNight * 100) / 100;
  const today = new Date().toISOString().slice(0, 10);
  for (const k of Object.keys(seen)) { const ci = k.split('|')[1]; if (ci && ci < today) delete seen[k]; }
  save(K_SEEN, seen);
  setMsg(`บันทึกราคาของ ${lastFiltered.length} แห่งเป็นฐานแล้ว ครั้งหน้าจะไฮไลต์เฉพาะที่ใหม่หรือราคาลด ≥ ${DROP_PCT}%`);
  render();
}

function exportCsv() {
  const head = ['ชื่อ', 'ย่าน', 'ราคาต่อคืน', 'คะแนน', 'รีวิว', 'ประเภท', 'ห่างถนน(กม.)', 'เช็คอิน', 'เช็คเอาท์', 'สถานะ', 'ลิงก์'];
  const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = lastFiltered.map(r => [r.h.name, r.zone.name, Math.round(r.h.perNight), r.h.rating ?? '', r.h.reviews, r.h.kind,
    r.dist.toFixed(2), r.h.checkin, r.h.checkout, { new: 'ใหม่', drop: 'ลดราคา', seen: '' }[r.st.kind], r.h.url].map(q).join(','));
  const csv = [head.map(q).join(','), ...lines].join('\n');
  if (EMBED?.artifact) {
    navigator.clipboard.writeText(csv).then(() => setMsg(`คัดลอก CSV ${lastFiltered.length} แถวแล้ว วางใน Excel/Google Sheets ได้เลย`),
      () => setMsg('คัดลอกไม่สำเร็จ', true));
    return;
  }
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv' });
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'hotels.csv' });
  a.click(); URL.revokeObjectURL(a.href);
}

async function toggleNotify() {
  if (!('Notification' in window)) return setMsg('เบราว์เซอร์นี้ไม่รองรับการแจ้งเตือน', true);
  if (!notifyOn) {
    const p = await Notification.requestPermission();
    if (p !== 'granted') return setMsg('ไม่ได้รับอนุญาตให้แจ้งเตือน', true);
  }
  notifyOn = !notifyOn;
  $('btnNotify').textContent = notifyOn ? '🔔 แจ้งเตือน: เปิด' : '🔔 แจ้งเตือนในเบราว์เซอร์';
  setMsg(notifyOn ? 'จะแจ้งเตือนเมื่อดึงข้อมูลจาก URL รอบใหม่แล้วพบที่ใหม่/ลดราคา (เปิดแท็บนี้ค้างไว้)' : 'ปิดการแจ้งเตือนแล้ว');
}

function maybeNotify() {
  if (!notifyOn) return;
  const hot = lastFiltered.filter(r => r.st.kind !== 'seen');
  if (!hot.length) return;
  const top = hot.slice().sort((a, b) => a.h.perNight - b.h.perNight)[0];
  new Notification(`พบที่พักใหม่/ลดราคา ${hot.length} แห่ง`, {
    body: `ถูกสุด: ${top.h.name} ${baht(top.h.perNight)}/คืน (${top.zone.name})`, tag: 'hotel-alert',
  });
}

async function loadUrl(url, quiet = false) {
  try {
    if (!quiet) setMsg('กำลังโหลด…');
    const data = await fetchJson(url);
    setData(parseSnapshot(data), `URL: ${url.length > 50 ? url.slice(0, 47) + '…' : url}`);
    setMsg(`โหลดล่าสุด ${new Date().toLocaleTimeString('th-TH')}`);
    save(K_SRC, { url, refresh: $('refresh').value });
    maybeNotify();
  } catch (e) {
    setMsg(`โหลด URL ไม่สำเร็จ: ${e.message} (ปลายทางต้องอนุญาต CORS)`, true);
  }
}

async function loadSample() {
  try {
    const data = EMBED?.sample || await fetchJson('../sample_snapshot.json');
    setData(parseSnapshot(data), EMBED?.sampleLabel || 'ข้อมูลตัวอย่าง (Booking.com 5 พ.ย. 2026)');
    setMsg('');
  } catch {
    setMsg('เปิดไฟล์ตัวอย่างไม่ได้ (เปิดหน้าเว็บผ่าน file:// อยู่) ให้รัน python3 -m http.server ในโฟลเดอร์ hotel-alert หรือกด "อัปโหลดไฟล์ JSON"', true);
  }
}

// ---------------------------------------------------------------- events
function bind() {
  const num = (id, key, fn = Number) => $(id).addEventListener('input', e => { F[key] = fn(e.target.value); render(); });
  num('maxPrice', 'maxPrice'); num('minPrice', 'minPrice'); num('minRating', 'minRating');
  num('minReviews', 'minReviews', v => Math.max(0, +v || 0)); num('buffer', 'buffer');
  num('q', 'q', String); num('sort', 'sort', String);
  $('allowUnrated').addEventListener('change', e => { F.allowUnrated = e.target.checked; render(); });
  $('onlyNew').addEventListener('change', e => { F.onlyNew = e.target.checked; render(); });
  $('zoneBoxes').addEventListener('change', () => {
    F.zones = [...$('zoneBoxes').querySelectorAll('input:checked')].map(i => i.value); render();
  });
  $('typeBoxes').addEventListener('change', () => {
    F.excludeTypes = [...$('typeBoxes').querySelectorAll('input:not(:checked)')].map(i => i.value.toLowerCase()); render();
  });
  $('btnReset').addEventListener('click', () => { F = { ...DEFAULTS }; buildZoneBoxes(); buildTypeBoxes(); render(); });

  $('btnSample').addEventListener('click', loadSample);
  $('file').addEventListener('change', async e => {
    const all = [];
    try {
      for (const f of e.target.files) all.push(...parseSnapshot(JSON.parse(await f.text())));
      setData(all, `ไฟล์: ${[...e.target.files].map(f => f.name).join(', ')}`);
      setMsg('');
    } catch (err) { setMsg(`อ่านไฟล์ไม่สำเร็จ: ${err.message}`, true); }
    e.target.value = '';
  });
  $('btnPaste').addEventListener('click', () => { $('pasteBox').hidden = !$('pasteBox').hidden; });
  $('btnPasteLoad').addEventListener('click', () => {
    try {
      setData(parseSnapshot(JSON.parse($('pasteText').value)), 'ข้อมูลที่วาง');
      $('pasteBox').hidden = true; setMsg('');
    } catch (err) { setMsg(`JSON ไม่ถูกต้อง: ${err.message}`, true); }
  });
  $('urlForm').addEventListener('submit', e => {
    e.preventDefault();
    const url = $('url').value.trim();
    if (!url) return;
    clearInterval(refreshTimer);
    const mins = +$('refresh').value;
    if (mins) refreshTimer = setInterval(() => loadUrl(url, true), mins * 60e3);
    loadUrl(url);
  });

  $('btnSeen').addEventListener('click', markSeen);
  $('btnCsv').addEventListener('click', exportCsv);
  $('btnNotify').addEventListener('click', toggleNotify);
  $('map').addEventListener('click', e => {
    const id = e.target.dataset?.id;
    const el = id && document.getElementById('h-' + id);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 1500);
  });
}

// ---------------------------------------------------------------- init
(async function init() {
  // ใช้ย่านและเงื่อนไขจาก config ของระบบแจ้งเตือน ถ้าเปิดผ่านเว็บเซิร์ฟเวอร์
  for (const path of EMBED?.config ? [null] : ['../config.json', '../config.example.json']) {
    try {
      const cfg = EMBED?.config || await fetchJson(path);
      ZONES = cfg.zones.map(z => ({ key: z.key, name: z.name, route: z.route }));
      const f = cfg.filters || {};
      DROP_PCT = f.price_drop_pct ?? DROP_PCT;
      DEFAULTS = {
        ...DEFAULTS, zones: ZONES.map(z => z.key),
        maxPrice: f.max_price_per_night ?? DEFAULTS.maxPrice, minPrice: f.min_price_per_night ?? 0,
        minRating: f.min_rating ?? DEFAULTS.minRating, minReviews: f.min_reviews ?? 0,
        allowUnrated: f.allow_unrated ?? true, buffer: f.buffer_km ?? cfg.zones[0]?.buffer_km ?? DEFAULTS.buffer,
      };
      F = { ...DEFAULTS, ...load(K_FILTERS, {}) };
      F.zones = F.zones.filter(k => ZONES.some(z => z.key === k));
      break;
    } catch { /* ไม่มีไฟล์ หรือเปิดผ่าน file:// → ใช้ค่าเริ่มต้น */ }
  }
  buildZoneBoxes();
  bind();
  render();
  const src = load(K_SRC, null);
  if (src?.url) { $('url').value = src.url; $('refresh').value = src.refresh || '0'; }
  if (EMBED?.artifact) { $('urlForm').hidden = true; $('btnNotify').hidden = true; $('btnCsv').textContent = '⧉ คัดลอก CSV'; }
  if (EMBED || location.protocol !== 'file:') loadSample();
})();
