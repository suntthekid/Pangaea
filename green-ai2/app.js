'use strict';
// ค่าประมาณเพื่อการสาธิต
const GPUS = {
  h100: { label: 'NVIDIA H100 (700 W)', w: 700 },
  a100: { label: 'NVIDIA A100 (400 W)', w: 400 },
  v100: { label: 'NVIDIA V100 (300 W)', w: 300 },
  r4090: { label: 'RTX 4090 (450 W)', w: 450 },
  t4: { label: 'NVIDIA T4 (70 W)', w: 70 },
  cpu: { label: 'CPU เซิร์ฟเวอร์ (150 W)', w: 150 },
};
const REGIONS = {
  th: { label: 'ไทย', g: 480 },
  sg: { label: 'สิงคโปร์', g: 470 },
  in: { label: 'อินเดีย', g: 700 },
  cn: { label: 'จีน', g: 550 },
  us: { label: 'สหรัฐฯ (เฉลี่ย)', g: 370 },
  fr: { label: 'ฝรั่งเศส', g: 55 },
  se: { label: 'สวีเดน', g: 40 },
  no: { label: 'นอร์เวย์', g: 30 },
};
const KG_PER_KM_CAR = 0.17, KG_PER_TREE_YEAR = 21, KG_PER_PHONE_CHARGE = 0.008;
const STORE = 'greenai2.history';

const $ = id => document.getElementById(id);
const fmt = (n, d = 1) => n.toLocaleString('th-TH', { maximumFractionDigits: n < 10 ? 2 : d });
const esc = s => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

for (const [k, v] of Object.entries(GPUS)) $('gpu').add(new Option(v.label, k));
for (const [k, v] of Object.entries(REGIONS)) $('region').add(new Option(`${v.label} – ${v.g} gCO₂/kWh`, k));
$('gpu').value = 'a100'; $('region').value = 'th';

let last = null;

function read() {
  const num = (id, min) => Math.max(min, parseFloat($(id).value) || min);
  const mode = $('mode').value;
  const hours = mode === 'train' ? num('hours', 0.1)
    : num('reqs', 1) * num('sec', 0.001) * num('days', 1) / 3600 / num('count', 1);
  return {
    name: $('name').value.trim() || 'งานไม่มีชื่อ', mode, gpu: $('gpu').value, region: $('region').value,
    count: Math.round(num('count', 1)), util: num('util', 10) / 100, pue: num('pue', 1.05), hours,
  };
}

function energy(p) { // kWh
  return GPUS[p.gpu].w * p.util * p.count * p.hours * p.pue / 1000;
}

function grade(kg) {
  if (kg < 50) return ['A', 'ต่ำมาก'];
  if (kg < 500) return ['B', 'ต่ำ'];
  if (kg < 5000) return ['C', 'ปานกลาง'];
  if (kg < 50000) return ['D', 'สูง'];
  return ['E', 'สูงมาก'];
}

function tips(p, kWh, kg) {
  const t = [];
  const best = Object.entries(REGIONS).sort((a, b) => a[1].g - b[1].g)[0];
  if (REGIONS[p.region].g > 200) {
    const save = kWh * (REGIONS[p.region].g - best[1].g) / 1000;
    t.push(`ย้ายงานไปศูนย์ข้อมูลที่ไฟฟ้าสะอาดกว่า (เช่น ${best[1].label}) ลดได้ประมาณ <b>${fmt(save)} kgCO₂e</b>`);
  }
  if (p.pue > 1.3) t.push(`เลือกผู้ให้บริการคลาวด์ที่ PUE ต่ำ (≈1.1–1.2) แทน ${p.pue.toFixed(2)} จะลดพลังงานได้ราว ${Math.round((1 - 1.15 / p.pue) * 100)}%`);
  if (p.util < 0.6) t.push('อัตราใช้งานการ์ดต่ำ – เพิ่ม batch size หรือรวมงานเพื่อไม่ให้การ์ดว่างแต่ยังกินไฟ');
  if (p.mode === 'train') {
    t.push('ใช้ mixed precision (FP16/BF16) และ early stopping เพื่อลดชั่วโมงฝึก');
    t.push('ทำ fine-tuning จากโมเดลที่มีอยู่ (transfer learning / LoRA) แทนการฝึกใหม่ทั้งหมด');
    t.push('ลดการค้นหา hyperparameter แบบ grid search ด้วย Bayesian optimization');
  } else {
    t.push('ทำ quantization (INT8/INT4) หรือ distillation เพื่อลดกำลังไฟต่อคำขอ');
    t.push('เพิ่ม cache ผลลัพธ์ที่ซ้ำ และ batch คำขอเพื่อใช้การ์ดคุ้มขึ้น');
  }
  if (p.gpu === 'h100' || p.gpu === 'a100') t.push('พิจารณาการ์ดรุ่นเล็ก (เช่น T4) หากโมเดลไม่ต้องการหน่วยความจำสูง');
  t.push('ตั้งเวลาเทรนในช่วงที่สัดส่วนพลังงานหมุนเวียนสูง (carbon-aware scheduling)');
  return t;
}

function render(p) {
  const kWh = energy(p), kg = kWh * REGIONS[p.region].g / 1000;
  last = { p, kWh, kg };
  $('kWh').textContent = fmt(kWh);
  $('kg').textContent = fmt(kg);
  const [g, note] = grade(kg);
  $('grade').textContent = g; $('gradeNote').textContent = note;
  $('equiv').innerHTML = [
    `🚗 เท่ากับขับรถยนต์ประมาณ <b>${fmt(kg / KG_PER_KM_CAR, 0)}</b> กม.`,
    `🌳 ต้นไม้ต้องใช้เวลา <b>${fmt(kg / KG_PER_TREE_YEAR)}</b> ต้น·ปี ในการดูดซับ`,
    `📱 เท่ากับการชาร์จโทรศัพท์ <b>${fmt(kg / KG_PER_PHONE_CHARGE, 0)}</b> ครั้ง`,
  ].map(s => `<li>${s}</li>`).join('');
  const rows = Object.entries(REGIONS).map(([k, r]) => [k, r.label, kWh * r.g / 1000]).sort((a, b) => b[2] - a[2]);
  const max = Math.max(...rows.map(r => r[2]), 1e-9);
  $('chart').innerHTML = rows.map(([k, l, v]) =>
    `<div class="row${k === p.region ? ' cur' : ''}"><span>${l}</span><div class="bar"><i style="width:${(v / max * 100).toFixed(1)}%"></i></div><span class="v">${fmt(v)}</span></div>`).join('');
  $('tips').innerHTML = tips(p, kWh, kg).map(s => `<li>${s}</li>`).join('');
}

const load = () => { try { return JSON.parse(localStorage.getItem(STORE)) || []; } catch { return []; } };
const store = a => { try { localStorage.setItem(STORE, JSON.stringify(a)); } catch { /* ignore */ } };

function renderHist() {
  const h = load();
  $('histEmpty').hidden = h.length > 0;
  $('hist').innerHTML = h.map((r, i) => `<tr><td>${esc(r.name)}</td><td>${r.mode === 'train' ? 'ฝึก' : 'ให้บริการ'}</td><td>${esc(r.gpu)} ×${r.count}</td><td class="num">${fmt(r.kWh)}</td><td class="num">${fmt(r.kg)}</td><td><button type="button" class="ghost" data-del="${i}" aria-label="ลบ ${esc(r.name)}">ลบ</button></td></tr>`).join('');
}

$('form').addEventListener('submit', e => { e.preventDefault(); render(read()); });
$('mode').addEventListener('change', () => {
  const tr = $('mode').value === 'train';
  $('hoursRow').hidden = !tr; $('inferRows').hidden = tr;
  $('name').value = tr ? 'ฝึกโมเดลจำแนกภาพดาวเทียม' : 'บริการแชตบอตตอบคำถามประชาชน';
  $('gpu').value = tr ? 'a100' : 't4'; $('count').value = tr ? 8 : 4;
  render(read());
});
$('util').addEventListener('input', () => { $('utilOut').textContent = $('util').value; });
$('pue').addEventListener('input', () => { $('pueOut').textContent = (+$('pue').value).toFixed(2); });
$('save').addEventListener('click', () => {
  if (!last) return;
  const h = load(); h.unshift({ name: last.p.name, mode: last.p.mode, gpu: GPUS[last.p.gpu].label.split(' (')[0], count: last.p.count, kWh: last.kWh, kg: last.kg });
  store(h.slice(0, 50)); renderHist();
});
$('hist').addEventListener('click', e => {
  const i = e.target.dataset.del; if (i === undefined) return;
  const h = load(); h.splice(+i, 1); store(h); renderHist();
});
$('csv').addEventListener('click', () => {
  const h = load(); if (!h.length) return;
  const q = v => `"${String(v).replace(/"/g, '""')}"`;
  const csv = '﻿name,mode,hardware,count,kWh,kgCO2e\n' + h.map(r => [r.name, r.mode, r.gpu, r.count, r.kWh.toFixed(3), r.kg.toFixed(3)].map(q).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = 'green-ai2-history.csv'; a.click(); URL.revokeObjectURL(a.href);
});

render(read()); renderHist();
