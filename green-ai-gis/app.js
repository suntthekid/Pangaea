'use strict';
/* ===== Green AI × GIS : ต้นแบบแผนที่เสี่ยงน้ำท่วม / ไฟป่า =====
   ข้อมูลความเสี่ยงสร้างจากสูตรจำลอง (ไม่ใช่ข้อมูลจริง) – แทนที่ด้วยข้อมูลจริงได้ที่ HAZARDS[x].compute / points */

// ---------- สมมติฐานด้านพลังงาน (เพื่อเปรียบเทียบเท่านั้น) ----------
const GPUS = { h100: ['NVIDIA H100', 700], a100: ['NVIDIA A100', 400], t4: ['NVIDIA T4', 70], cpu: ['CPU เซิร์ฟเวอร์', 150] };
const REGIONS = { th: ['ไทย', 480], sg: ['สิงคโปร์', 470], us: ['สหรัฐฯ', 370], fr: ['ฝรั่งเศส', 55], se: ['สวีเดน', 40] };
const HEAVY_CELLS_PER_S = 25;      // โมเดลใหญ่ (เช่น U-Net/ViT) ประมวลผลได้กี่เซลล์/วินาที
const LIGHT_CELLS_PER_S = 500;     // โมเดลเล็ก (distilled / quantized INT8) คัดกรอง
const CHANGED_SHARE = 0.3;         // สัดส่วนเซลล์เสี่ยงที่เปลี่ยนจากรอบก่อน (นอกนั้นใช้ค่าจากแคช)
const SCREEN_MARGIN = 0.15;        // โมเดลเล็กส่งต่อเซลล์ที่ ≥ เกณฑ์ − margin เพื่อกันตกหล่น
const PUE = 1.4, KG_PER_TREE_YEAR = 21;

// ---------- noise แบบมี seed ----------
const hash = (x, y, s) => { let h = (x * 374761393 + y * 668265263 + s * 1274126177) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
const sm = t => t * t * (3 - 2 * t);
function vnoise(x, y, s) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = sm(x - xi), yf = sm(y - yi);
  const a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s);
  return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
}
const fbm = (x, y, s) => vnoise(x, y, s) * .6 + vnoise(x * 2.3, y * 2.3, s + 7) * .3 + vnoise(x * 5.1, y * 5.1, s + 13) * .1;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));

function distToLine(lat, lon, pts) {
  let best = 1e9;
  for (let i = 0; i < pts.length - 1; i++) {
    const [y1, x1] = pts[i], [y2, x2] = pts[i + 1], dx = x2 - x1, dy = y2 - y1;
    const t = clamp(((lon - x1) * dx + (lat - y1) * dy) / (dx * dx + dy * dy));
    best = Math.min(best, Math.hypot(lon - (x1 + t * dx), lat - (y1 + t * dy)));
  }
  return best;
}

// ---------- นิยามภัยพิบัติ ----------
const CELL = 0.02;
const RIVERS = [
  [[15.45, 100.10], [14.95, 100.30], [14.40, 100.50], [14.00, 100.55], [13.62, 100.50]],  // เจ้าพระยา
  [[14.95, 100.95], [14.60, 100.75], [14.38, 100.55]],                                      // ป่าสัก
];
const CITIES = [['อยุธยา', 14.35, 100.57], ['อ่างทอง', 14.59, 100.45], ['ปทุมธานี', 14.02, 100.53], ['นนทบุรี', 13.86, 100.51],
  ['สิงห์บุรี', 14.89, 100.40], ['ลพบุรี', 14.80, 100.65], ['สระบุรี', 14.53, 100.91], ['ชัยนาท', 15.19, 100.13], ['นครสวรรค์', 15.70, 100.12]];

const HAZARDS = {
  flood: {
    name: 'น้ำท่วม', center: [14.6, 100.55], zoom: 8,
    bbox: [13.6, 100.0, 15.4, 101.1],
    title: 'สถานการณ์น้ำท่วมจำลอง', driver: { label: 'ฝนสะสม 3 วัน (มม.)', min: 0, max: 400, val: 220, step: 10 },
    ptsLabel: 'แสดงจังหวัด/เมืองหลัก', legend: ['#bfe3ff', '#0b4f9c'], legendTxt: ['ท่วมน้อย', 'ท่วมลึก'],
    kpi: ['พื้นที่เสี่ยงท่วม (ตร.กม.)', 'เมืองได้รับผลกระทบ', 'ความเสี่ยงสูงสุด'],
    color: r => `hsl(${210 - 10 * r} ${60 + 30 * r}% ${80 - 50 * r}%)`,
    compute(rows, cols, [lat0, lon0], v) {
      const lvl = v / 400, out = new Float32Array(rows * cols);
      for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) {
        const lat = lat0 + i * CELL, lon = lon0 + j * CELL;
        const prox = Math.exp(-Math.min(...RIVERS.map(r => distToLine(lat, lon, r))) / 0.14);
        const low = clamp((15.4 - lat) / 1.8);                       // ที่ราบลุ่มต่ำทางใต้
        const n = fbm(j / 12, i / 12, 3);
        out[i * cols + j] = clamp((prox * 0.9 + low * 0.35 + (n - .5) * .5) * (lvl * 1.5) - 0.12 + prox * .1 * lvl);
      }
      return out;
    },
    points(risk, rows, cols, o, thr) {
      return CITIES.map(([n, lat, lon]) => {
        const r = risk[clamp(Math.round((lat - o[0]) / CELL), 0, rows - 1) * cols + clamp(Math.round((lon - o[1]) / CELL), 0, cols - 1)];
        return { lat, lon, r, hit: r >= thr, label: `${n}: ความเสี่ยงน้ำท่วม ${(r * 100).toFixed(0)}%` };
      });
    },
  },
  fire: {
    name: 'ไฟป่า', center: [18.9, 98.8], zoom: 8,
    bbox: [17.9, 98.0, 19.9, 99.7],
    title: 'สถานการณ์ไฟป่าจำลอง', driver: { label: 'จำนวนวันไร้ฝน', min: 0, max: 60, val: 45, step: 1 },
    ptsLabel: 'แสดงจุดความร้อน (จำลอง)', legend: ['#ffe08a', '#a50f15'], legendTxt: ['เสี่ยงต่ำ', 'เสี่ยงสูง'],
    kpi: ['พื้นที่เสี่ยงไฟ (ตร.กม.)', 'จุดความร้อนจำลอง', 'ความเสี่ยงสูงสุด'],
    color: r => `hsl(${50 - 50 * r} 90% ${70 - 30 * r}%)`,
    compute(rows, cols, [lat0, lon0], v) {
      const dry = clamp(v / 60), out = new Float32Array(rows * cols);
      for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) {
        const lat = lat0 + i * CELL, lon = lon0 + j * CELL;
        const forest = clamp((fbm(j / 22, i / 22, 11) - .35) * 3.2);           // ป่า/เชื้อเพลิง
        const ridge = fbm(j / 9, i / 9, 21);                                     // ความลาดชัด/แนวสัน
        const west = clamp((lon - 98.0) / 1.7);                                  // แห้งกว่าฝั่งตะวันออกเล็กน้อย
        out[i * cols + j] = clamp(forest * (0.1 + 1.3 * Math.pow(dry, 1.5)) * (0.65 + 0.5 * ridge) * (0.85 + 0.25 * (1 - west)) - 0.05);
      }
      return out;
    },
    points(risk, rows, cols, o, thr) {
      const pts = [];
      for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) {
        const r = risk[i * cols + j];
        if (r >= Math.max(thr, 0.6) && hash(j, i, 99) < 0.05 + 0.1 * (r - .6)) pts.push({ lat: o[0] + (i + .5) * CELL, lon: o[1] + (j + .5) * CELL, r, hit: true, label: `จุดความร้อน (จำลอง) · ความเสี่ยง ${(r * 100).toFixed(0)}%` });
      }
      return pts.slice(0, 400);
    },
  },
};

// ---------- สถานะ + แผนที่ ----------
const $ = id => document.getElementById(id);
const map = L.map('map', { preferCanvas: true });
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 14, attribution: '© OpenStreetMap' }).addTo(map);
const cellLayer = L.layerGroup().addTo(map), ptLayer = L.layerGroup().addTo(map);
let key = 'flood', H, rows, cols, risk, cells = [];

for (const [k, [l, w]] of Object.entries(GPUS)) $('gpu').add(new Option(`${l} (${w} W)`, k));
for (const [k, [l, g]] of Object.entries(REGIONS)) $('region').add(new Option(`${l} – ${g} gCO₂/kWh`, k));
$('gpu').value = 'a100'; $('region').value = 'th';

function setHazard(k) {
  key = k; H = HAZARDS[k];
  $('tab-flood').classList.toggle('on', k === 'flood'); $('tab-fire').classList.toggle('on', k === 'fire');
  const [s, w, n, e] = H.bbox; rows = Math.round((n - s) / CELL); cols = Math.round((e - w) / CELL);
  $('s-title').textContent = H.title; $('drv-label').textContent = H.driver.label; $('pts-label').textContent = H.ptsLabel;
  Object.assign($('driver'), { min: H.driver.min, max: H.driver.max, step: H.driver.step, value: H.driver.val });
  [$('k1l').textContent, $('k2l').textContent, $('k3l').textContent] = H.kpi;
  $('legend').innerHTML = `${H.legendTxt[0]}<i style="background:linear-gradient(90deg,${H.legend[0]},${H.legend[1]})"></i>${H.legendTxt[1]}`;
  map.setView(H.center, H.zoom);
  cellLayer.clearLayers(); cells = [];
  for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) {
    const r = L.rectangle([[s + i * CELL, w + j * CELL], [s + (i + 1) * CELL, w + (j + 1) * CELL]], { stroke: false, fillOpacity: 0, interactive: false });
    cellLayer.addLayer(r); cells.push(r);
  }
  update(true);
}

function update(recompute) {
  const thr = +$('thr').value, v = +$('driver').value;
  $('drv-val').textContent = v; $('thr-val').textContent = `${(thr * 100).toFixed(0)}%`;
  if (recompute) risk = H.compute(rows, cols, H.bbox, v);
  let n = 0, max = 0;
  const lat = (H.bbox[0] + H.bbox[2]) / 2, km2 = (CELL * 111.32) ** 2 * Math.cos(lat * Math.PI / 180);
  for (let i = 0; i < risk.length; i++) {
    const r = risk[i]; if (r > max) max = r;
    if (r >= thr) { n++; cells[i].setStyle({ fillColor: H.color(r), fillOpacity: 0.35 + 0.5 * r }); } else cells[i].setStyle({ fillOpacity: 0 });
  }
  ptLayer.clearLayers();
  const pts = H.points(risk, rows, cols, H.bbox, thr);
  if ($('showpts').checked) for (const p of pts) L.circleMarker([p.lat, p.lon], { radius: key === 'fire' ? 4 : 7, color: '#fff', weight: 1.5, fillColor: p.hit ? '#d62728' : '#2c7a4b', fillOpacity: .95 }).bindTooltip(p.label).addTo(ptLayer);
  $('k1').textContent = Math.round(n * km2).toLocaleString('th-TH');
  $('k2').textContent = key === 'flood' ? `${pts.filter(p => p.hit).length}/${pts.length}` : pts.length;
  $('k3').textContent = `${(max * 100).toFixed(0)}%`;
  green(n, risk.length, thr);
}

// ---------- Green AI ----------
function green(hitCells, total, thr) {
  const w = GPUS[$('gpu').value][1], g = REGIONS[$('region').value][1], runs = +$('runs').value;
  $('runs-val').textContent = runs;
  const flagged = risk.reduce((a, r) => a + (r >= thr - SCREEN_MARGIN), 0);
  const whHeavy = w * PUE / HEAVY_CELLS_PER_S / 3600, whLight = w * PUE / LIGHT_CELLS_PER_S / 3600;
  const heavyCellsGreen = Math.round(flagged * CHANGED_SHARE);
  const naive = total * whHeavy * runs / 1000;                                   // kWh/วัน
  const eco = (total * whLight + heavyCellsGreen * whHeavy) * runs / 1000;
  const co2 = k => k * g / 1000;                                                  // kg/วัน
  const f = (x, d = 2) => x.toLocaleString('th-TH', { maximumFractionDigits: d });
  const rowsHtml = [
    ['เซลล์ในพื้นที่', f(total, 0), f(total, 0)],
    ['เซลล์ที่รันโมเดลใหญ่/รอบ', f(total, 0), f(heavyCellsGreen, 0)],
    ['พลังงาน (kWh/วัน)', f(naive), `<b>${f(eco)}</b>`],
    ['CO₂ (kg/วัน)', f(co2(naive)), `<b>${f(co2(eco))}</b>`],
    ['CO₂ (kg/ปี)', f(co2(naive) * 365, 0), `<b>${f(co2(eco) * 365, 0)}</b>`],
  ];
  document.querySelector('#cmp tbody').innerHTML = rowsHtml.map(r => `<tr><td>${r[0]}</td><td>${r[1]}</td><td class="g">${r[2]}</td></tr>`).join('');
  const saved = (co2(naive) - co2(eco)) * 365;
  $('saving').textContent = `ลดได้ ${f((1 - eco / naive) * 100, 0)}% ≈ ${f(saved, 0)} kgCO₂/ปี (เทียบการดูดซับของต้นไม้ ~${f(saved / KG_PER_TREE_YEAR, 0)} ต้น/ปี)`;
}

$('tab-flood').onclick = () => setHazard('flood');
$('tab-fire').onclick = () => setHazard('fire');
$('driver').oninput = () => update(true);
$('thr').oninput = () => update(false);
$('showpts').onchange = () => update(false);
for (const id of ['gpu', 'region', 'runs']) $(id).oninput = () => green(0, risk.length, +$('thr').value);
setHazard('flood');
