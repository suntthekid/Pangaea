'use strict';
const { PLACES, CATEGORIES, MOODS } = window;
const BY_ID = Object.fromEntries(PLACES.map(p => [p.id, p]));
const KEY_FAV = 'quietdate.favs', KEY_PLAN = 'quietdate.plan';
const BATTERY_START = { low: 50, mid: 75, high: 100 };
const NO_MAP = new Set(['ที่บ้าน', 'ที่ไหนก็ได้']);

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const baht = n => '฿'.repeat(n);
const dots = (n, ch) => ch.repeat(n) + '·'.repeat(5 - n);
const hm = m => { m = ((Math.round(m) % 1440) + 1440) % 1440; return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };
const toMin = t => { const [h, m] = (t || '10:00').split(':').map(Number); return h * 60 + (m || 0); };
const durTxt = m => m >= 60 ? `${Math.floor(m / 60)} ชม.${m % 60 ? ` ${m % 60} น.` : ''}` : `${m} นาที`;
const mapUrl = p => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${p.name} ${p.city}`)}`;

const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage full/blocked */ } };

const favs = new Set(load(KEY_FAV, []));
const defaultPlan = () => ({ title: '', date: '', start: '10:00', travel: 30, safe: '', battery: 'mid', items: [] });
let plan = Object.assign(defaultPlan(), load(KEY_PLAN, {}));
plan.items = (plan.items || []).filter(it => it.type === 'break' || BY_ID[it.id]);
const activeMoods = new Set();

function toast(msg) {
  const t = $('toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 1800);
}

/* ───────── แท็บ ───────── */
function showTab(name) {
  document.querySelectorAll('.tab').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === name));
  document.querySelectorAll('.panel').forEach(p => { p.hidden = p.id !== `tab-${name}`; });
  if (name === 'plan') renderPlan();
}
document.querySelectorAll('.tab').forEach(b => b.addEventListener('click', () => showTab(b.dataset.tab)));

/* ───────── ค้นหา ───────── */
const cities = [...new Set(PLACES.map(p => p.city))];
for (const c of cities) { $('city').add(new Option(c, c)); $('aCity').add(new Option(c, c)); }
for (const [k, v] of Object.entries(CATEGORIES)) $('cat').add(new Option(v, k));
$('moods').innerHTML = MOODS.map(m => `<button type="button" class="chip" aria-pressed="false" data-mood="${esc(m)}">${esc(m)}</button>`).join('');
$('moods').addEventListener('click', e => {
  const b = e.target.closest('.chip'); if (!b) return;
  const m = b.dataset.mood, on = !activeMoods.has(m);
  on ? activeMoods.add(m) : activeMoods.delete(m);
  b.setAttribute('aria-pressed', on); renderResults();
});

function filtered() {
  const q = $('q').value.trim().toLowerCase();
  const city = $('city').value, cat = $('cat').value, setting = $('setting').value;
  const budget = +$('budget').value, quiet = +$('quiet').value;
  const list = PLACES.filter(p =>
    (!q || [p.name, p.city, p.desc, p.tip, CATEGORIES[p.cat], ...p.moods].join(' ').toLowerCase().includes(q)) &&
    (!city || p.city === city) && (!cat || p.cat === cat) && (!setting || p.setting === setting) &&
    p.budget <= budget && p.quiet >= quiet &&
    [...activeMoods].every(m => p.moods.includes(m)) &&
    (!$('favOnly').checked || favs.has(p.id)));
  const by = $('sort').value;
  const cmp = {
    quiet: (a, b) => b.quiet - a.quiet || a.energy - b.energy,
    energy: (a, b) => a.energy - b.energy || b.quiet - a.quiet,
    budget: (a, b) => a.budget - b.budget || b.quiet - a.quiet,
    name: (a, b) => a.name.localeCompare(b.name, 'th'),
  }[by];
  return list.sort(cmp);
}

const inPlan = id => plan.items.some(it => it.id === id);

function card(p) {
  const added = inPlan(p.id);
  return `<article class="place" data-id="${p.id}">
    <div class="top">
      <span class="emo" aria-hidden="true">${p.emoji}</span>
      <button class="fav" type="button" data-act="fav" aria-pressed="${favs.has(p.id)}" aria-label="ถูกใจ ${esc(p.name)}">${favs.has(p.id) ? '♥' : '♡'}</button>
    </div>
    <h3>${esc(p.name)}</h3>
    <div class="meta">📍 ${esc(p.city)} · ${CATEGORIES[p.cat]}</div>
    <p>${esc(p.desc)}</p>
    <div class="meters">
      <span title="ความเงียบ">🤫 ${dots(p.quiet, '●')}</span>
      <span title="พลังสังคมที่ใช้">🔋 ใช้แบต ${dots(p.energy, '●')}</span>
      <span>${baht(p.budget)}</span>
      <span>⏱ ${durTxt(p.dur)}</span>
    </div>
    <div class="tagline">${p.moods.map(m => `<span>${esc(m)}</span>`).join('')}</div>
    <div class="act">
      <button type="button" class="ghost" data-act="detail">รายละเอียด</button>
      <button type="button" data-act="add" class="${added ? 'added' : ''}">${added ? '✓ อยู่ในแผน' : '+ ใส่แผน'}</button>
    </div>
  </article>`;
}

function renderResults() {
  const list = filtered();
  $('resultInfo').textContent = list.length
    ? `พบ ${list.length} ที่ — เรียงจากที่สบายใจที่สุดตามตัวเลือกของคุณ`
    : '';
  $('results').innerHTML = list.length ? list.map(card).join('')
    : '<p class="empty">ไม่เจอที่ตรงเงื่อนไขเลย 🥲 ลองลดระดับความเงียบหรือเอาแท็กบางอันออก</p>';
  $('planCount').textContent = plan.items.filter(i => i.type === 'place').length;
}

['q', 'city', 'cat', 'budget', 'setting', 'sort', 'favOnly'].forEach(id => $(id).addEventListener('input', renderResults));
$('quiet').addEventListener('input', () => { $('quietOut').textContent = '🤫'.repeat(+$('quiet').value); renderResults(); });

$('results').addEventListener('click', e => {
  const btn = e.target.closest('button[data-act]'); if (!btn) return;
  const id = btn.closest('.place').dataset.id;
  if (btn.dataset.act === 'fav') toggleFav(id);
  else if (btn.dataset.act === 'add') togglePlan(id);
  else openDetail(id);
});

function toggleFav(id) {
  favs.has(id) ? favs.delete(id) : favs.add(id);
  save(KEY_FAV, [...favs]); renderResults();
}

function togglePlan(id) {
  if (inPlan(id)) {
    plan.items = plan.items.filter(it => it.id !== id);
    toast('เอาออกจากแผนแล้ว');
  } else {
    plan.items.push({ type: 'place', id, dur: BY_ID[id].dur, note: '' });
    toast(`เพิ่ม “${BY_ID[id].name}” ในแผนแล้ว`);
  }
  savePlan(); renderResults();
}

$('random').addEventListener('click', () => {
  const list = filtered();
  if (!list.length) return toast('ไม่มีที่ให้สุ่ม ลองปรับตัวกรองดูนะ');
  openDetail(list[Math.floor(Math.random() * list.length)].id, true);
});

function openDetail(id, random = false) {
  const p = BY_ID[id];
  $('detailBody').innerHTML = `
    ${random ? '<p class="muted small">🎲 วันนี้ลองไปที่นี่ไหม?</p>' : ''}
    <h2><span aria-hidden="true">${p.emoji}</span> ${esc(p.name)}</h2>
    <p>${esc(p.desc)}</p>
    <div class="tipbox">💡 <b>ทริคสำหรับ Introvert:</b> ${esc(p.tip)}</div>
    <dl>
      <dt>พื้นที่</dt><dd>${esc(p.city)}</dd>
      <dt>ประเภท</dt><dd>${CATEGORIES[p.cat]} · ${p.setting === 'in' ? 'ในร่ม' : 'กลางแจ้ง'}</dd>
      <dt>ช่วงที่คนน้อย</dt><dd>${esc(p.best)}</dd>
      <dt>ความเงียบ</dt><dd>${'🤫'.repeat(p.quiet)} (${p.quiet}/5)</dd>
      <dt>ใช้แบตสังคม</dt><dd>${'🔋'.repeat(p.energy)} (${p.energy}/5)</dd>
      <dt>งบ / เวลา</dt><dd>${baht(p.budget)} · ประมาณ ${durTxt(p.dur)}</dd>
    </dl>
    <div class="btns">
      ${NO_MAP.has(p.city) ? '' : `<a href="${mapUrl(p)}" target="_blank" rel="noopener">🗺️ เปิดใน Google Maps</a>`}
    </div>
    <p><button type="button" class="primary" id="dAdd">${inPlan(id) ? 'เอาออกจากแผน' : '+ ใส่ในแผนเที่ยว'}</button></p>`;
  $('dAdd').onclick = () => { togglePlan(id); $('detail').close(); };
  $('detail').showModal();
}

$('goHome').addEventListener('click', () => {
  $('city').value = 'ที่บ้าน'; $('quiet').value = 1; $('quietOut').textContent = '🤫';
  showTab('explore'); renderResults();
});

/* ───────── วางแผน ───────── */
function savePlan() { save(KEY_PLAN, plan); }

const detailFields = { pTitle: 'title', pDate: 'date', pStart: 'start', pTravel: 'travel', pSafe: 'safe' };
for (const [id, key] of Object.entries(detailFields)) {
  $(id).addEventListener('input', () => {
    plan[key] = id === 'pTravel' ? Math.max(0, Math.min(180, +$(id).value || 0)) : $(id).value;
    savePlan(); renderPlan(false);
  });
}
$('aBattery').addEventListener('input', () => { plan.battery = $('aBattery').value; savePlan(); renderPlan(false); });

// แบตสังคม: สถานที่ยิ่งเสียงดัง/ต้องเข้าสังคมมาก ยิ่งกินแบต ช่วงพักช่วยชาร์จคืน
function drain(p, dur) { return (p.energy * 3 + (5 - p.quiet) * 3) * dur / 60; }

function computeTimeline() {
  let t = toMin(plan.start), batt = BATTERY_START[plan.battery] ?? 75, prev = null;
  const rows = [];
  for (const [i, it] of plan.items.entries()) {
    let travel = 0;
    if (it.type === 'place') {
      const p = BY_ID[it.id];
      if (prev && !(p.city === 'ที่บ้าน' && prev.city === 'ที่บ้าน')) travel = plan.travel;
      t += travel; batt -= travel ? 3 : 0;
      rows.push({ i, it, p, at: t, travel });
      batt -= drain(p, it.dur); prev = p;
    } else {
      rows.push({ i, it, at: t });
      batt += it.dur / 60 * 30;
    }
    batt = Math.max(0, Math.min(100, batt));
    rows[rows.length - 1].batt = batt;
    t += it.dur;
  }
  return { rows, end: t, batt: Math.round(batt) };
}

function renderPlan(syncInputs = true) {
  if (syncInputs) {
    for (const [id, key] of Object.entries(detailFields)) $(id).value = plan[key] ?? '';
    $('aBattery').value = plan.battery || 'mid';
  }
  const { rows, end, batt } = computeTimeline();
  const n = plan.items.length;
  $('emptyPlan').hidden = n > 0;
  $('planCount').textContent = plan.items.filter(i => i.type === 'place').length;

  const dateTxt = plan.date ? new Date(`${plan.date}T00:00`).toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : '';
  $('planSummary').innerHTML = n ? [
    plan.title && `<b>${esc(plan.title)}</b>`, dateTxt && `📅 ${esc(dateTxt)}`,
    `⏰ ${hm(toMin(plan.start))}–${hm(end)} (${durTxt(end - toMin(plan.start))})`,
    plan.safe && `🔐 คำลับ: “${esc(plan.safe)}”`,
  ].filter(Boolean).join(' · ') : '';

  $('bFill').style.width = `${batt}%`;
  $('bFill').style.background = batt < 25 ? 'var(--bad)' : batt < 50 ? 'var(--warn)' : 'var(--good)';
  $('bText').textContent = `${batt}%`;
  const weekend = plan.date && [0, 6].includes(new Date(`${plan.date}T00:00`).getDay());
  $('bNote').textContent = !n ? '' : [
    batt < 25 ? '⚠️ แผนนี้น่าจะเหนื่อยเกินไป ลองตัดสักที่ หรือเพิ่มช่วงพัก ☕' :
      batt < 50 ? 'พอไหว แต่อาจต้องการเวลาเงียบ ๆ หลังกลับบ้าน' : 'สบาย ๆ กลับถึงบ้านยังมีแรงเหลือ 💜',
    weekend ? 'วันที่เลือกเป็นเสาร์–อาทิตย์ หลายที่จะคนเยอะกว่าปกติ' : '',
  ].filter(Boolean).join(' · ');

  $('timeline').innerHTML = rows.map(r => {
    const ctl = `<div class="ctl">
        <button type="button" data-act="up" aria-label="เลื่อนขึ้น" ${r.i === 0 ? 'disabled' : ''}>↑</button>
        <button type="button" data-act="down" aria-label="เลื่อนลง" ${r.i === n - 1 ? 'disabled' : ''}>↓</button>
        <button type="button" data-act="del" aria-label="ลบ">✕</button></div>`;
    const row2 = `<div class="row2">
        <label class="muted">นาน <input class="dur" type="number" min="10" max="720" step="10" value="${r.it.dur}" data-f="dur"> นาที</label>
        <input class="note" type="text" maxlength="80" placeholder="โน้ต เช่น จองโต๊ะริมหน้าต่าง" value="${esc(r.it.note || '')}" data-f="note">
        <span>🔋 ${Math.round(r.batt)}%</span></div>`;
    if (r.it.type === 'break') {
      return `<li class="ti brk" data-i="${r.i}"><time>${hm(r.at)}</time><span class="dot"></span><div class="box">
        <div class="row1"><b>☕ พักชาร์จแบต — นั่งเงียบ ๆ ด้วยกัน</b>${ctl}</div>${row2}</div></li>`;
    }
    return `<li class="ti" data-i="${r.i}"><time>${hm(r.at)}</time><span class="dot"></span><div class="box">
      ${r.travel ? `<div class="travel">🚗 เดินทาง ~${r.travel} นาที</div>` : ''}
      <div class="row1"><span aria-hidden="true">${r.p.emoji}</span><b>${esc(r.p.name)}</b>${ctl}</div>
      <div class="travel">📍 ${esc(r.p.city)} · คนน้อยช่วง ${esc(r.p.best)}</div>${row2}</div></li>`;
  }).join('') + (n ? `<li class="ti end"><time>${hm(end)}</time><span class="dot"></span><div class="box">🏠 กลับบ้านพักผ่อน</div></li>` : '');
}

$('timeline').addEventListener('click', e => {
  const b = e.target.closest('button[data-act]'); if (!b) return;
  const i = +b.closest('.ti').dataset.i, a = b.dataset.act;
  if (a === 'del') plan.items.splice(i, 1);
  else {
    const j = a === 'up' ? i - 1 : i + 1;
    if (j < 0 || j >= plan.items.length) return;
    [plan.items[i], plan.items[j]] = [plan.items[j], plan.items[i]];
  }
  savePlan(); renderPlan(false);
});
$('timeline').addEventListener('change', e => {
  const f = e.target.dataset.f; if (!f) return;
  const it = plan.items[+e.target.closest('.ti').dataset.i];
  it[f] = f === 'dur' ? Math.max(10, Math.min(720, Math.round(+e.target.value || it.dur))) : e.target.value;
  savePlan(); renderPlan(false);
});

$('addBreak').addEventListener('click', () => {
  plan.items.push({ type: 'break', dur: 30, note: '' });
  savePlan(); renderPlan(false); toast('เพิ่มช่วงพักแล้ว — เลื่อนตำแหน่งได้ด้วยปุ่ม ↑↓');
});
$('clearPlan').addEventListener('click', () => {
  if (!plan.items.length || !confirm('ล้างแผนทั้งหมดเลยไหม?')) return;
  plan.items = []; savePlan(); renderPlan(false); renderResults();
});
$('printPlan').addEventListener('click', () => window.print());

function planText() {
  const { rows, end, batt } = computeTimeline();
  const lines = [`🌙 ${plan.title || 'แผนเดตเงียบ ๆ ของเรา'}`];
  if (plan.date) lines.push(`📅 ${new Date(`${plan.date}T00:00`).toLocaleDateString('th-TH', { dateStyle: 'full' })}`);
  for (const r of rows) {
    const name = r.it.type === 'break' ? '☕ พักชาร์จแบต' : `${r.p.emoji} ${r.p.name} (${r.p.city})`;
    lines.push(`${hm(r.at)}  ${name} – ${durTxt(r.it.dur)}${r.it.note ? ` · ${r.it.note}` : ''}`);
  }
  lines.push(`${hm(end)}  🏠 กลับบ้าน`, `🔋 แบตสังคมคาดว่าเหลือ ~${batt}%`);
  if (plan.safe) lines.push(`🔐 คำลับอยากกลับบ้าน: “${plan.safe}”`);
  return lines.join('\n');
}
$('copyPlan').addEventListener('click', async () => {
  if (!plan.items.length) return toast('ยังไม่มีแผนให้คัดลอก');
  try { await navigator.clipboard.writeText(planText()); toast('คัดลอกแผนแล้ว ส่งให้แฟนได้เลย 💌'); }
  catch { prompt('คัดลอกข้อความนี้', planText()); }
});

// จัดแผนอัตโนมัติ
$('autoPlan').addEventListener('click', () => {
  const city = $('aCity').value, budget = +$('aBudget').value, battery = $('aBattery').value;
  const target = $('aLen').value === 'full' ? 480 : 240;
  const low = battery === 'low';
  const extra = city === 'ที่บ้าน' ? [] : PLACES.filter(p => p.city === 'ที่ไหนก็ได้' && p.setting === 'in');
  const pool = [...PLACES.filter(p => p.city === city), ...extra]
    .filter(p => !p.when && p.budget <= budget && (!low || p.energy <= 2))
    .map(p => ({ p, s: p.quiet * 2 - p.energy * (low ? 3 : 1) + (favs.has(p.id) ? 2 : 0) + Math.random() * 2.5 }))
    .sort((a, b) => b.s - a.s).map(x => x.p);
  if (!pool.length) return toast('ไม่มีที่ตรงเงื่อนไข ลองเพิ่มงบดูนะ');

  const items = []; let used = 0, sinceBreak = 0;
  for (const p of pool) {
    const travel = items.length && city !== 'ที่บ้าน' ? +plan.travel || 0 : 0;
    const dur = Math.min(p.dur, target);
    if (items.length && used + travel + dur > target * 1.1) continue;
    if (items.length && sinceBreak >= (low ? 60 : 150)) {
      items.push({ type: 'break', dur: low ? 40 : 30, note: '' }); used += low ? 40 : 30; sinceBreak = 0;
    }
    items.push({ type: 'place', id: p.id, dur, note: '' });
    used += travel + dur; sinceBreak += dur;
    if (used >= target * 0.9) break;
  }
  // จัดลำดับตามช่วงเวลาที่คนน้อย: ที่แนะนำตอนเช้าไปก่อน ตอนเย็นไว้ท้าย (ช่วงพักคงไว้ระหว่างสถานที่)
  const slot = p => /เช้า/.test(p.best) ? 0 : /เย็น/.test(p.best) ? 2 : 1;
  const places = items.filter(i => i.type === 'place').sort((a, b) => slot(BY_ID[a.id]) - slot(BY_ID[b.id]));
  items.forEach((it, k) => { if (it.type === 'place') items[k] = places.shift(); });
  plan.items = items; plan.battery = battery;
  if (!plan.title) plan.title = `เดตเงียบ ๆ ที่${city}`;
  savePlan(); renderPlan(); renderResults();
  toast('จัดแผนให้แล้ว ปรับแก้ได้ตามใจเลย ✨');
});

/* ───────── เริ่มต้น ───────── */
$('quietOut').textContent = '🤫'.repeat(+$('quiet').value);
renderResults();
renderPlan();
