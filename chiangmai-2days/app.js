const gmap = q => "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(q);

// ข้อมูลที่พัก: ราคาเป็นช่วงประมาณต่อคืน (บาท) สำหรับห้องที่มีอ่างแช่
const HOTELS = [
  {
    id: "fourseasons", name: "Four Seasons Resort Chiang Mai", zone: "แม่ริม", tier: "฿฿฿฿",
    tags: ["rice", "mountain", "pool"], gradient: "linear-gradient(135deg,#6f8f4e,#2f4a3a)",
    why: "ศาลาริมทุ่งนาขั้นบันได วิวดอยล้อมรอบ เงียบและเป็นส่วนตัวมาก",
    room: "แนะนำ: Pavilion วิวทุ่งนา หรือ Pool Villa ถ้าอยากมีสระส่วนตัว",
    feat: ["อ่างแช่ในห้อง", "สปาเต็มรูปแบบ", "วิวนา + ดอย", "พูลวิลล่า"],
    price: [25000, 45000], city: false,
    live: { price: 54721, score: 9.5, reviews: 160, url: "https://www.booking.com/hotel/th/four-seasons-resort-chiang-mai.html?checkin=2026-12-10&checkout=2026-12-11&group_adults=2&no_rooms=1&selected_currency=THB" },
  },
  {
    id: "137pillars", name: "137 Pillars House", zone: "วัดเกต (ใกล้แม่ปิง)", tier: "฿฿฿",
    tags: ["city", "river"], gradient: "linear-gradient(135deg,#c9a25b,#6b4a2b)",
    why: "เรือนไม้โคโลเนียลกลางสวน ห้องสวีทมีอ่างแช่ตัวที่ระเบียงกลางแจ้ง โรแมนติกสุดๆ",
    room: "แนะนำ: สวีทที่มีอ่างอาบน้ำบนระเบียง (Outdoor bathtub)",
    feat: ["อ่างกลางแจ้ง", "สปา", "สระว่ายน้ำ", "เดินไปริมน้ำได้"],
    price: [15000, 28000], city: true,
    live: { price: 34079, score: 9.5, reviews: 52, url: "https://www.booking.com/hotel/th/one-three-seven-pillars-house.html?checkin=2026-12-10&checkout=2026-12-11&group_adults=2&no_rooms=1&selected_currency=THB" },
  },
  {
    id: "veranda", name: "Veranda High Resort – MGallery", zone: "หางดง", tier: "฿฿",
    tags: ["mountain", "pool"], gradient: "linear-gradient(135deg,#7a9bb0,#2f4a3a)",
    why: "รีสอร์ตบนเนิน สระอินฟินิตี้หันหน้าเข้าหาดอย ดูพระอาทิตย์ตกได้จากสระ",
    room: "แนะนำ: ห้องวิวดอยหรือ Pool Villa (ห้องที่มีอ่างให้ระบุตอนจอง)",
    feat: ["อ่างแช่", "สปา", "อินฟินิตี้พูล", "วิวดอย"],
    price: [6000, 15000], city: false,
    live: { price: 12600, score: 8.7, reviews: 239, url: "https://www.booking.com/hotel/th/veranda-chiangmai.html?checkin=2026-12-10&checkout=2026-12-11&group_adults=2&no_rooms=1&selected_currency=THB" },
  },
  {
    id: "anantara", name: "Anantara Chiang Mai Resort", zone: "ริมแม่ปิง ใจกลางเมือง", tier: "฿฿฿",
    tags: ["river", "city"], gradient: "linear-gradient(135deg,#5d8a8a,#24362b)",
    why: "ห้องโปร่งสไตล์มินิมอลริมน้ำปิง ใกล้ไนท์บาซาร์และร้านริมน้ำ เดินทางง่าย",
    room: "แนะนำ: ห้องวิวแม่น้ำ ห้องน้ำกว้างมีอ่างลึก",
    feat: ["อ่างแช่ลึก", "Anantara Spa", "วิวแม่น้ำ", "สระริมน้ำ"],
    price: [12000, 22000], city: true,
    live: { price: 15579, score: 8.8, reviews: 57, url: "https://www.booking.com/hotel/th/anantara-chiang-mai-resort-and-spa.html?checkin=2026-12-10&checkout=2026-12-11&group_adults=2&no_rooms=1&selected_currency=THB" },
  },
  {
    id: "raya", name: "Raya Heritage", zone: "แม่ริม ริมแม่ปิง", tier: "฿฿฿",
    tags: ["river", "mountain"], gradient: "linear-gradient(135deg,#d8c3a0,#8e4526)",
    why: "ดีไซน์ล้านนาร่วมสมัย ผ้าทอมือทั้งห้อง ระเบียงมองแม่น้ำและต้นไม้ใหญ่",
    room: "แนะนำ: ห้องริมน้ำที่มีอ่างแช่และระเบียงส่วนตัว",
    feat: ["อ่างแช่", "สปา", "ริมแม่น้ำ", "ร้านอาหารเหนือดีมาก"],
    price: [10000, 20000], city: false,
    live: { price: 17773, score: 9.6, reviews: 157, url: "https://www.booking.com/hotel/th/raya-heritage.html?checkin=2026-12-10&checkout=2026-12-11&group_adults=2&no_rooms=1&selected_currency=THB" },
  },
  {
    id: "akyra", name: "Akyra Manor Chiang Mai", zone: "นิมมาน", tier: "฿฿",
    tags: ["city"], gradient: "linear-gradient(135deg,#9a7e6f,#3a2e2a)",
    why: "บูทีคในนิมมาน สระรูฟท็อปเห็นดอยสุเทพ ใกล้คาเฟ่และร้านอาหารเยอะ",
    room: "แนะนำ: สวีทที่มีอ่างอาบน้ำบนระเบียง",
    feat: ["อ่างบนระเบียง", "รูฟท็อปพูล", "วิวดอยสุเทพ", "เดินเที่ยวนิมมาน"],
    price: [6000, 12000], city: true,
    soldOut: true,
  },
  {
    id: "panviman", name: "Panviman Chiang Mai Spa Resort", zone: "แม่ริม (โป่งแยง)", tier: "฿",
    tags: ["mountain"], gradient: "linear-gradient(135deg,#8fae8b,#2f4a3a)",
    why: "รีสอร์ตบนดอยท่ามกลางป่าเขา อากาศเย็นกว่าในเมือง สปาเป็นจุดเด่น คุ้มค่าราคา",
    room: "แนะนำ: ห้องสวีทวิวดอยที่มีอ่างอาบน้ำ",
    feat: ["อ่างแช่", "สปาจุดเด่น", "วิวป่าเขา", "อากาศเย็น"],
    price: [4500, 9000], city: false,
    live: { price: 6630, score: 9.1, reviews: 726, url: "https://www.booking.com/hotel/th/panviman-chiang-mai-spa-resort.html?checkin=2026-12-10&checkout=2026-12-11&group_adults=2&no_rooms=1&selected_currency=THB" },
  },
];

const fmt = n => n.toLocaleString("th-TH");
let chosen = null;

function renderHotels(filter = "all") {
  const box = document.getElementById("hotels");
  box.innerHTML = "";
  HOTELS.filter(h => filter === "all" || h.tags.includes(filter))
    .sort((a, b) => (a.live ? a.live.price : 1e9) - (b.live ? b.live.price : 1e9))
    .forEach(h => {
    const el = document.createElement("article");
    el.className = "hotel" + (chosen?.id === h.id ? " selected" : "") + (h.soldOut ? " soldout" : "");
    el.innerHTML = `
      <div class="art" style="background:${h.gradient}">
        <span class="zone">📍 ${h.zone}</span><span class="tier">${h.tier}</span>
      </div>
      <div class="body">
        <h3>${h.name}</h3>
        <p class="why">${h.why}</p>
        <ul class="feat">${h.feat.map(f => `<li>${f}</li>`).join("")}</ul>
        <p class="room">${h.room}</p>
        <div class="foot">
          <span class="price">${h.live
            ? `${fmt(h.live.price)} ฿<small>เริ่มต้น / คืน · ⭐ ${h.live.score} (${fmt(h.live.reviews)} รีวิว)</small>`
            : h.soldOut ? `<span class="sold">เต็มคืน 10 ธ.ค.</span><small>ปกติ ~${fmt(h.price[0])}–${fmt(h.price[1])} ฿</small>`
            : `~${fmt(h.price[0])}–${fmt(h.price[1])} ฿`}</span>
          <div class="actions">
            <a href="${gmap(h.name)}" target="_blank" rel="noopener">แผนที่</a>
            ${h.live ? `<a href="${h.live.url}" target="_blank" rel="noopener">จอง</a>` : ""}
            <button type="button">${chosen?.id === h.id ? "เลือกแล้ว ✓" : "ใช้ในแผน"}</button>
          </div>
        </div>
      </div>`;
    el.querySelector("button").addEventListener("click", () => choose(h));
    box.appendChild(el);
  });
}

function choose(h) {
  chosen = h;
  localStorage.setItem("cm-hotel", h.id);
  document.getElementById("chosen-hotel").textContent = `${h.name} (${h.zone})`;
  document.getElementById("b-hotel").value = h.live ? h.live.price : Math.round((h.price[0] + h.price[1]) / 2 / 500) * 500;
  renderHotels(document.querySelector(".chip.active").dataset.filter);
  renderDay(currentDay);
  calcBudget();
}

// แผนเที่ยว: ปรับบางช่วงตามโซนที่พัก (ในเมือง vs นอกเมือง)
function plan(day) {
  const h = chosen;
  const hotelName = h ? h.name : "ที่พักที่เลือก";
  const inCity = h ? h.city : true;
  if (day === 1) return [
    { t: "10:30", title: "พฤ. 10 ธ.ค. · ถึงเชียงใหม่", d: "วันรัฐธรรมนูญ (วันหยุด) คนเที่ยวเยอะ จองตั๋วและร้านล่วงหน้า ลงเครื่องหรือรถไฟ เรียก Grab ฝากกระเป๋าที่โรงแรมก่อน หรือไปหาอะไรกินเลยก็ได้" },
    { t: "11:30", title: "ข้าวซอยมื้อแรก", d: "ข้าวซอยแม่สาย ใกล้นิมมาน รสกลมกล่อม ร้านเปิดถึงบ่าย ไปเร็วหน่อยคิวจะสั้นกว่า", map: "Khao Soi Mae Sai Chiang Mai" },
    { t: "13:00", title: "คาเฟ่ชิลล์ ย่อยอาหาร", d: inCity
        ? "เดินเล่นนิมมาน ซอย 9–13 แวะคาเฟ่เล็กๆ ก่อนกลับเช็กอิน"
        : "ระหว่างทางไปที่พัก แวะคาเฟ่วิวดอยแถวแม่ริม/หางดง นั่งดูวิวสักชั่วโมง" },
    { t: "14:30", title: `เช็กอิน ${hotelName}`, d: "ขอห้องชั้นบนหรือมุมที่วิวดีตอนเช็กอิน แจ้งว่ามาฉลองกันสองคน บางที่มีของขวัญเล็กๆ ให้", hi: true },
    { t: "15:30", title: "สปาคู่ 90–120 นาที", d: h && !h.feat.some(f => f.includes("สปา"))
        ? "ที่พักนี้ไม่เน้นสปา แนะนำ Fah Lanna Spa ในเมืองเก่า บรรยากาศสวนร่มรื่น (ควรจองล่วงหน้า)"
        : "จองสปาของโรงแรมแบบห้องคู่ ลองนวดน้ำมันหรือประคบสมุนไพรแบบล้านนา เสร็จแล้วแช่ตัวต่อได้เลย",
      map: h && !h.feat.some(f => f.includes("สปา")) ? "Fah Lanna Spa Chiang Mai" : null, hi: true },
    { t: "17:45", title: "ดูพระอาทิตย์ตก", d: inCity
        ? "ขึ้นรูฟท็อปหรือเดินริมแม่ปิง แสงเย็นสวยมากช่วงหน้าหนาว"
        : "ไม่ต้องไปไหน นั่งระเบียงหรือริมสระดูแสงสุดท้ายหลังดอย" },
    { t: "19:00", title: "ดินเนอร์", d: inCity
        ? "ร้านริมน้ำปิง เช่น The Riverside หรือ The Good View มีดนตรีสด ขอโต๊ะริมน้ำล่วงหน้า"
        : "ดินเนอร์ที่ร้านอาหารของรีสอร์ต ไม่ต้องขับรถกลางคืน ขอโต๊ะใต้แสงเทียนได้",
      map: inCity ? "The Riverside Bar & Restaurant Chiang Mai" : null },
    { t: "21:00", title: "แช่อ่างอุ่นๆ 🛁", d: "เติมเกลือแช่ตัวหรือบาธบอมบ์ที่เตรียมมา เปิดเพลงเบาๆ แล้วนอนให้เต็มอิ่ม", hi: true },
  ];
  return [
    { t: "07:30", title: "ตื่นมารับแสงเช้า", d: inCity
        ? "ตื่นสบายๆ ชงกาแฟดื่มที่ระเบียง หรือแช่อ่างอีกรอบตอนเช้า"
        : "ดูหมอกบนดอยตอนเช้า (ชัดที่สุดช่วงพ.ย.–ม.ค.) แล้วกินมื้อเช้าในห้องหรือริมสระ", hi: true },
    { t: "09:30", title: "ศ. 11 ธ.ค. · มื้อสายช้าๆ", d: inCity
        ? "นั่งคาเฟ่ใกล้ที่พัก หรือแวะ No.39 Cafe มีสระน้ำกับป่าสน (ตลาดจริงใจเปิดแค่เสาร์-อาทิตย์ ทริปนี้ตรงกับวันศุกร์)"
        : "กินมื้อเช้าที่รีสอร์ตแบบไม่รีบ หรือแวะคาเฟ่วิวดอยใกล้ที่พัก (ตลาดจริงใจเปิดแค่เสาร์-อาทิตย์ ทริปนี้ตรงกับวันศุกร์)",
      map: inCity ? "No.39 Cafe Chiang Mai" : null },
    { t: "11:30", title: "เช็กเอาต์", d: "ขอ Late check-out ไว้ตั้งแต่ตอนจอง จะได้ว่ายน้ำหรือแช่อ่างรอบสุดท้ายแบบไม่รีบ" },
    { t: "12:30", title: "อาหารเหนือมื้อเที่ยง", d: "ร้านเฮือนเพ็ญ ในเมืองเก่า แกงฮังเล น้ำพริกหนุ่ม ไส้อั่ว ครบในมื้อเดียว", map: "Huen Phen Chiang Mai" },
    { t: "14:00", title: "เดินเล่นวัดอุโมงค์", d: "วัดป่ากลางเมือง มีอุโมงค์โบราณและสระน้ำ เงียบ ร่มรื่น เดินจับมือกันได้สบายๆ", map: "Wat Umong Chiang Mai" },
    { t: "15:00", title: "บ้านข้างวัด", d: "หมู่บ้านศิลปะใกล้วัดอุโมงค์ ร้านเซรามิก ของแฮนด์เมด เหมาะซื้อของที่ระลึกให้กันและกัน (ส่วนใหญ่ปิดวันจันทร์)", map: "Baan Kang Wat Chiang Mai" },
    { t: "16:30", title: "ไปสนามบิน", d: "จากโซนนี้ถึงสนามบินประมาณ 15–20 นาที เย็นวันศุกร์รถติดกว่าปกติ เผื่อเวลาอย่างน้อย 45 นาที" },
  ];
}

let currentDay = 1;
function renderDay(day) {
  currentDay = day;
  document.querySelectorAll(".tab").forEach(t => t.classList.toggle("active", +t.dataset.day === day));
  document.getElementById("timeline").innerHTML = plan(day).map(s => `
    <li class="${s.hi ? "highlight" : ""}">
      <span class="time">${s.t}</span>
      <h3>${s.title}</h3>
      <p>${s.d}</p>
      ${s.map ? `<a class="map" href="${gmap(s.map)}" target="_blank" rel="noopener">เปิดแผนที่ →</a>` : ""}
    </li>`).join("");
}

// งบประมาณ
const B = ["b-hotel", "b-spa", "b-food", "b-transport", "b-flight"];
const LABEL = { "b-hotel": "ที่พัก 1 คืน", "b-spa": "สปาคู่", "b-food": "อาหาร 2 วัน", "b-transport": "เดินทางในเมือง", "b-flight": "ตั๋วไป-กลับ" };
function calcBudget() {
  const vals = B.map(id => [id, Math.max(0, +document.getElementById(id).value || 0)]);
  const total = vals.reduce((s, [, v]) => s + v, 0);
  document.getElementById("b-total").textContent = fmt(total) + " ฿";
  document.getElementById("b-each").textContent = `ตกคนละประมาณ ${fmt(Math.round(total / 2))} ฿`;
  document.getElementById("b-break").innerHTML = vals.map(([id, v]) => `<li><span>${LABEL[id]}</span><span>${fmt(v)} ฿</span></li>`).join("");
}

// เช็กลิสต์
const PACK = [
  "เสื้อกันหนาว (ธ.ค. เช้าในเมือง ~15°C บนดอยเย็นกว่านี้)", "ชุดว่ายน้ำ", "เกลือแช่ตัว / บาธบอมบ์", "เทียนหอมหรือลำโพงเล็ก",
  "ยืนยันการจองสปาแล้ว", "ขอ Late check-out แล้ว", "แจ้งโรงแรมว่ามาฉลอง", "ชุดสุภาพสำหรับเข้าวัด",
  "รองเท้าเดินสบาย", "ครีมกันแดด + ยากันยุง", "พาวเวอร์แบงก์", "ของขวัญเล็กๆ ให้แฟน 🎁",
];
function renderChecklist() {
  const saved = JSON.parse(localStorage.getItem("cm-pack") || "[]");
  const ul = document.getElementById("checklist");
  ul.innerHTML = PACK.map((p, i) => `<li><label><input type="checkbox" data-i="${i}" ${saved.includes(i) ? "checked" : ""}><span>${p}</span></label></li>`).join("");
  ul.addEventListener("change", () => {
    const on = [...ul.querySelectorAll("input:checked")].map(c => +c.dataset.i);
    localStorage.setItem("cm-pack", JSON.stringify(on));
  });
}

// init
document.querySelectorAll(".chip").forEach(c => c.addEventListener("click", () => {
  document.querySelectorAll(".chip").forEach(x => x.classList.remove("active"));
  c.classList.add("active");
  renderHotels(c.dataset.filter);
}));
document.querySelectorAll(".tab").forEach(t => t.addEventListener("click", () => renderDay(+t.dataset.day)));
B.forEach(id => document.getElementById(id).addEventListener("input", calcBudget));

renderHotels();
renderDay(1);
renderChecklist();
const savedHotel = HOTELS.find(h => h.id === localStorage.getItem("cm-hotel"));
if (savedHotel) choose(savedHotel); else calcBudget();
