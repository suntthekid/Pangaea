'use strict';
/*
 * รายชื่อร้าน — ตรวจสอบเมื่อ พ.ย. 2569 จาก GoWabi / WAUG / Klook
 * ราคา (priceMin/priceMax) = ราคาประมาณต่อ "2 คน ต่อรอบ" ยังไม่ได้ยืนยันกับร้าน
 * demo: true = ร้านสมมติไว้สาธิตตัวกรอง ไม่ใช่ร้านจริง
 * แก้ไข/เพิ่มร้านได้ที่ไฟล์นี้ หรือผ่านฟอร์ม "เพิ่มร้าน" ในหน้าเว็บ (เก็บใน localStorage)
 */
const AREAS = {
  rama9: 'พระราม 9',
  huaikhwang: 'ห้วยขวาง',
  ratchada: 'รัชดา',
  ratchayothin: 'รัชโยธิน',
};

const VENUES = [
  {
    id: 'bayleaf',
    name: 'Bayleaf Massage & Onsen Spa',
    areas: ['ratchada', 'huaikhwang'],
    address: '88 ถ.เทียมร่วมมิตร ห้วยขวาง (ชั้น G คอนโด Artisan Ratchada)',
    near: 'MRT ศูนย์วัฒนธรรมฯ / พระราม 9',
    open: '11:00', close: '23:00', closedDays: [],
    duration: [45, 75, 90],
    priceMin: 1800, priceMax: 4500, priceVerified: false,
    privateForTwo: 'yes',
    features: ['ห้องออนเซ็นส่วนตัว', 'แพ็กเกจคู่ + นวดไทย', 'มีห้อง Deluxe'],
    book: 'https://www.gowabi.com/en/provider/3806',
  },
  {
    id: 'avani-ratchada',
    name: 'Onsen @ Avani Ratchada Bangkok (ชั้น 12)',
    areas: ['ratchada', 'rama9'],
    address: 'Avani Ratchada Bangkok Hotel (ฝั่งดินแดง ติด MRT พระราม 9)',
    near: 'MRT พระราม 9',
    open: '10:00', close: '22:00', closedDays: [],
    duration: [60, 90],
    priceMin: 2500, priceMax: 5000, priceVerified: false,
    privateForTwo: 'yes',
    features: ['มีห้องออนเซ็นส่วนตัว', 'อยู่ในโรงแรม'],
    book: 'https://gowabi.com/en/provider/avani-ratchada-bangkok-hotel-mrt-rama-9',
  },
  {
    id: 'tensei',
    name: 'TENSEI Onsen & Spa (Cassia Rama 9 ชั้น 22)',
    areas: ['rama9', 'huaikhwang'],
    address: 'โรงแรม Cassia Rama 9 ชั้น 22 ห้วยขวาง',
    near: 'MRT พระราม 9',
    open: '10:00', close: '22:00', closedDays: [],
    duration: [60, 120],
    priceMin: 1500, priceMax: 3500, priceVerified: false,
    privateForTwo: 'check',
    features: ['ออนเซ็นสไตล์ญี่ปุ่น', 'วิวชั้น 22', 'โซนรวมแยกชาย/หญิง'],
    book: 'https://www.gowabi.com/en/provider/tensei-onsen-spa-22nd-floor-at-cassia-rama-9-hotel',
  },

  // ---------- ร้านสมมติสำหรับสาธิต ----------
  {
    id: 'demo-ratchayothin', demo: true,
    name: '[ตัวอย่าง] ร้านสมมติ A – รัชโยธิน',
    areas: ['ratchayothin'],
    address: 'ข้อมูลสมมติ', near: 'BTS รัชโยธิน',
    open: '12:00', close: '24:00', closedDays: [2],
    duration: [60, 90],
    priceMin: 1200, priceMax: 2200, priceVerified: false,
    privateForTwo: 'yes',
    features: ['อ่างแช่คู่', 'ห้องส่วนตัว'],
    book: '',
  },
  {
    id: 'demo-huaikhwang', demo: true,
    name: '[ตัวอย่าง] ร้านสมมติ B – ห้วยขวาง',
    areas: ['huaikhwang'],
    address: 'ข้อมูลสมมติ', near: 'MRT ห้วยขวาง',
    open: '13:00', close: '01:00', closedDays: [],
    duration: [90, 120],
    priceMin: 2800, priceMax: 6000, priceVerified: false,
    privateForTwo: 'yes',
    features: ['ห้อง Suite', 'ซาวน่าในห้อง'],
    book: '',
  },
];
