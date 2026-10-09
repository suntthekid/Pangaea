'use strict';
// ข้อมูลตัวอย่างเพื่อการสาธิต (ไม่ใช่โครงการจริง)
const STORE = 'cost-info.v1';
const SWATCHES = ['#0b6e4f', '#1d5fa8', '#c2410c', '#7c3aed', '#be185d', '#0f766e'];

const DEFAULTS = () => ({
  title: 'โครงการนี้ใช้เงินอย่างไร?',
  subtitle: 'เปิดเผยข้อมูลโครงการก่อสร้างตลอดวงจรโครงการ ตามแนวทาง CoST – Infrastructure Transparency Initiative',
  accent: SWATCHES[0], theme: 'light', layout: 'timeline', fontScale: 100,
  show: { facts: true, kpi: true, stages: true, note: true },
  project: {
    name: 'ก่อสร้างสะพานข้ามแม่น้ำ (ตัวอย่าง)', agency: 'องค์การบริหารส่วนจังหวัดตัวอย่าง',
    location: 'อ.เมือง จ.ตัวอย่าง', sector: 'ถนนและสะพาน', contractor: 'บริษัท ตัวอย่างก่อสร้าง จำกัด',
    start: '2025-03-01', end: '2026-12-31', budget: 250, contract: 238.5, progress: 55,
  },
  note: 'แหล่งข้อมูล: ข้อมูลสมมติเพื่อสาธิต · ปรับปรุงล่าสุดตามที่ผู้ดูแลกรอก',
  stages: [
    { name: 'ระบุโครงการ', icon: '🧭', items: [
      { label: 'วัตถุประสงค์โครงการ', value: 'เชื่อมการเดินทางสองฝั่งแม่น้ำ ลดเวลาเดินทาง', on: true },
      { label: 'ที่ตั้งโครงการ', value: 'ริมแม่น้ำตัวอย่าง ต.ท่าเรือ', on: true },
      { label: 'แหล่งเงินทุน', value: 'งบประมาณแผ่นดิน', on: true },
    ] },
    { name: 'เตรียมโครงการ', icon: '📐', items: [
      { label: 'ผลศึกษาความเป็นไปได้', value: 'เผยแพร่แล้ว', on: true },
      { label: 'ผลกระทบสิ่งแวดล้อม/สังคม', value: 'ผ่านการรับฟังความเห็น', on: true },
      { label: 'ขอบเขตงานและประมาณการ', value: '250 ล้านบาท', on: true },
    ] },
    { name: 'จัดซื้อจัดจ้าง', icon: '📑', items: [
      { label: 'วิธีจัดซื้อจัดจ้าง', value: 'ประกวดราคาอิเล็กทรอนิกส์ (e-bidding)', on: true },
      { label: 'จำนวนผู้เสนอราคา', value: '5 ราย', on: true },
      { label: 'ผู้ชนะและราคา', value: 'บริษัท ตัวอย่างก่อสร้าง จำกัด · 238.5 ล้านบาท', on: true },
    ] },
    { name: 'ก่อสร้าง', icon: '🏗️', items: [
      { label: 'การแก้ไขสัญญา', value: 'ขยายเวลา 1 ครั้ง (30 วัน)', on: true },
      { label: 'ผลการตรวจรับงวดงาน', value: 'ผ่านแล้ว 4 งวด', on: true },
      { label: 'ความคืบหน้า', value: 'ตามที่แสดงด้านบน', on: false },
    ] },
    { name: 'ส่งมอบ/เปิดใช้', icon: '✅', items: [
      { label: 'ต้นทุนสุดท้าย', value: 'รอสรุปเมื่อแล้วเสร็จ', on: true },
      { label: 'รายงานตรวจรับงาน', value: 'รอเผยแพร่', on: true },
      { label: 'แผนบำรุงรักษา', value: 'อปท. รับผิดชอบ', on: false },
    ] },
  ],
});

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nf = (n, d = 2) => (+n || 0).toLocaleString('th-TH', { maximumFractionDigits: d });
const fmtDate = s => { const d = new Date(s); return isNaN(d) ? '–' : d.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' }); };

// รวมค่าที่โหลดมากับค่าเริ่มต้น เพื่อรองรับข้อมูลเก่า/ไฟล์นำเข้าที่ไม่ครบ
function merge(base, src) {
  if (!src || typeof src !== 'object') return base;
  for (const k of Object.keys(base)) {
    if (!(k in src)) continue;
    if (Array.isArray(base[k])) { if (Array.isArray(src[k])) base[k] = src[k]; }
    else if (base[k] && typeof base[k] === 'object') merge(base[k], src[k]);
    else if (typeof src[k] === typeof base[k]) base[k] = src[k];
  }
  return base;
}
const normalize = s => {
  s.stages = s.stages.filter(g => g && Array.isArray(g.items)).map(g => ({
    name: String(g.name ?? ''), icon: String(g.icon ?? '📌'),
    items: g.items.filter(Boolean).map(i => ({ label: String(i.label ?? ''), value: String(i.value ?? ''), on: i.on !== false })),
  }));
  return s;
};
const load = () => { try { return normalize(merge(DEFAULTS(), JSON.parse(localStorage.getItem(STORE)))); } catch { return DEFAULTS(); } };
const save = () => { try { localStorage.setItem(STORE, JSON.stringify(state)); } catch { /* ignore */ } };

let state = load();

const get = (o, p) => p.split('.').reduce((a, k) => a?.[k], o);
const set = (o, p, v) => { const ks = p.split('.'); const l = ks.pop(); ks.reduce((a, k) => a[k], o)[l] = v; };

// ---------- preview ----------
function status(p) {
  const s = new Date(p.start), e = new Date(p.end), now = new Date();
  const span = e - s;
  if (isNaN(span) || span <= 0) return { elapsed: null, label: '', cls: '' };
  const elapsed = Math.min(100, Math.max(0, (now - s) / span * 100));
  const gap = p.progress - elapsed;
  if (now > e && p.progress < 100) return { elapsed, label: 'เลยกำหนดสัญญา', cls: 'bad' };
  if (gap < -10) return { elapsed, label: 'ล่าช้ากว่าแผน', cls: 'bad' };
  if (gap < 0) return { elapsed, label: 'ค่อนข้างช้ากว่าแผน', cls: 'warn' };
  return { elapsed, label: 'เป็นไปตามแผน', cls: 'ok' };
}

function stageHtml(g, i) {
  const items = g.items.filter(x => x.on);
  if (!items.length) return '';
  return `<li class="st"><div class="dot" aria-hidden="true">${esc(g.icon)}</div>
    <div class="body"><h3><small>ระยะที่ ${i + 1}</small> ${esc(g.name)}</h3>
    <dl>${items.map(x => `<dt>${esc(x.label)}</dt><dd>${esc(x.value) || '–'}</dd>`).join('')}</dl></div></li>`;
}

function renderSheet() {
  const s = state, p = s.project, sh = $('sheet');
  sh.dataset.theme = s.theme; sh.dataset.layout = s.layout;
  sh.style.setProperty('--accent', s.accent);
  sh.style.fontSize = s.fontScale + '%';
  const diff = p.budget > 0 ? (p.contract - p.budget) / p.budget * 100 : 0;
  const st = status(p);
  const parts = [`<header class="sh-head"><p class="tag">CoST · Infrastructure Transparency</p>
    <h1>${esc(s.title)}</h1><p class="sub">${esc(s.subtitle)}</p><p class="pname">${esc(p.name)}</p></header>`];

  if (s.show.facts) parts.push(`<section class="facts" aria-label="ข้อมูลทั่วไป">${[
    ['หน่วยงาน', p.agency], ['พื้นที่', p.location], ['ประเภท', p.sector], ['ผู้รับจ้าง', p.contractor],
    ['ระยะสัญญา', `${fmtDate(p.start)} – ${fmtDate(p.end)}`],
  ].map(([k, v]) => `<div><span>${k}</span><b>${esc(v) || '–'}</b></div>`).join('')}</section>`);

  if (s.show.kpi) parts.push(`<section class="kpis" aria-label="ตัวเลขสำคัญ">
    <div class="kpi"><span>งบประมาณที่ตั้งไว้</span><b>${nf(p.budget)}</b><small>ล้านบาท</small></div>
    <div class="kpi"><span>มูลค่าสัญญา</span><b>${nf(p.contract)}</b><small>ล้านบาท</small></div>
    <div class="kpi"><span>ส่วนต่างจากงบประมาณ</span><b class="${diff > 0 ? 'bad' : 'ok'}">${diff > 0 ? '+' : ''}${nf(diff, 1)}%</b><small>${diff > 0 ? 'สูงกว่างบ' : 'ต่ำกว่า/เท่างบ'}</small></div>
    <div class="kpi"><span>ความคืบหน้า</span><b>${nf(p.progress, 0)}%</b><small class="${st.cls}">${esc(st.label)}</small></div>
    <div class="prog" role="img" aria-label="ความคืบหน้า ${p.progress}%">
      <div class="track"><i style="width:${p.progress}%"></i>${st.elapsed === null ? '' : `<u style="left:${st.elapsed.toFixed(1)}%" title="เวลาที่ผ่านไป"></u>`}</div>
      <div class="legend"><span><i></i> ความคืบหน้าจริง</span>${st.elapsed === null ? '' : `<span><u></u> เวลาที่ผ่านไป ${nf(st.elapsed, 0)}%</span>`}</div>
    </div></section>`);

  if (s.show.stages) {
    const li = s.stages.map(stageHtml).join('');
    if (li) parts.push(`<section aria-label="ข้อมูลตามระยะโครงการ"><ol class="stages">${li}</ol></section>`);
  }
  if (s.show.note && s.note.trim()) parts.push(`<footer class="note">${esc(s.note).replace(/\n/g, '<br>')}</footer>`);
  sh.innerHTML = parts.join('');
}

// ---------- editor ----------
function renderStageEditor() {
  $('stageEditor').innerHTML = state.stages.map((g, gi) => `
    <fieldset class="stg" data-g="${gi}">
      <legend><input class="ico" data-k="icon" value="${esc(g.icon)}" maxlength="4" aria-label="ไอคอน">
        <input class="gname" data-k="name" value="${esc(g.name)}" aria-label="ชื่อระยะ"></legend>
      ${g.items.map((x, ii) => `<div class="it" data-i="${ii}">
        <input type="checkbox" data-k="on" ${x.on ? 'checked' : ''} aria-label="แสดงรายการนี้">
        <input data-k="label" value="${esc(x.label)}" aria-label="หัวข้อ">
        <input data-k="value" value="${esc(x.value)}" aria-label="ค่า">
        <button type="button" class="x" data-act="del" aria-label="ลบรายการ">×</button></div>`).join('')}
      <button type="button" class="ghost sm" data-act="add">+ เพิ่มรายการ</button>
    </fieldset>`).join('');
}

function syncControls() {
  document.querySelectorAll('[data-path]').forEach(el => {
    const v = get(state, el.dataset.path);
    if (el.type === 'checkbox') el.checked = !!v; else el.value = v ?? '';
  });
  $('progOut').textContent = state.project.progress;
  $('fsOut').textContent = state.fontScale;
  $('swatches').innerHTML = SWATCHES.map(c => `<button type="button" class="sw${c === state.accent ? ' on' : ''}" style="background:${c}" data-color="${c}" aria-label="สี ${c}"></button>`).join('');
}

const refresh = () => { renderSheet(); save(); };

document.querySelector('.editor').addEventListener('input', e => {
  const el = e.target;
  if (el.dataset.path) {
    const num = el.type === 'number' || el.type === 'range';
    set(state, el.dataset.path, el.type === 'checkbox' ? el.checked : num ? Math.max(0, parseFloat(el.value) || 0) : el.value);
    if (el.dataset.path === 'project.progress') $('progOut').textContent = el.value;
    if (el.dataset.path === 'fontScale') $('fsOut').textContent = el.value;
    if (el.dataset.path === 'accent') syncSwatches();
  } else if (el.dataset.k) {
    const gi = +el.closest('.stg').dataset.g, g = state.stages[gi], it = el.closest('.it');
    const v = el.type === 'checkbox' ? el.checked : el.value;
    if (it) g.items[+it.dataset.i][el.dataset.k] = v; else g[el.dataset.k] = v;
  } else return;
  refresh();
});
const syncSwatches = () => document.querySelectorAll('.sw').forEach(b => b.classList.toggle('on', b.dataset.color === state.accent));

document.querySelector('.editor').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.color) { state.accent = b.dataset.color; document.querySelector('[data-path=accent]').value = state.accent; syncSwatches(); return refresh(); }
  const fs = b.closest('.stg'); if (!fs) return;
  const g = state.stages[+fs.dataset.g];
  if (b.dataset.act === 'add') g.items.push({ label: 'หัวข้อใหม่', value: '', on: true });
  else if (b.dataset.act === 'del') g.items.splice(+b.closest('.it').dataset.i, 1);
  else return;
  renderStageEditor(); refresh();
});

// ---------- toolbar ----------
$('print').addEventListener('click', () => window.print());
$('export').addEventListener('click', () => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' }));
  a.download = 'cost-info.json'; a.click(); URL.revokeObjectURL(a.href);
});
$('import').addEventListener('change', async e => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  try { state = normalize(merge(DEFAULTS(), JSON.parse(await f.text()))); }
  catch { alert('ไฟล์ JSON ไม่ถูกต้อง'); return; }
  syncControls(); renderStageEditor(); refresh();
});
$('reset').addEventListener('click', () => {
  if (!confirm('คืนค่าเริ่มต้นและล้างการแก้ไขทั้งหมด?')) return;
  state = DEFAULTS(); syncControls(); renderStageEditor(); refresh();
});

syncControls(); renderStageEditor(); renderSheet();
