# 🏨 Hotel Alert — โรงแรมราคาถูก พระราม 9 · ห้วยขวาง · รัชโยธิน

ระบบแจ้งเตือนเมื่อมีที่พักราคาถูก **อยู่ในแนวถนน** ที่สนใจ ได้แก่ พระราม 9, รัชดา–ห้วยขวาง และรัชโยธิน
แจ้งผ่าน **LINE / Telegram / Discord** หรือแสดงบนหน้าจอ ใช้แค่ Python 3.10+ ไม่ต้องติดตั้งไลบรารีเพิ่ม

## ทำงานอย่างไร

1. **รับข้อมูล:** อ่านผลค้นหาโรงแรมจากไฟล์ JSON หรือ URL (ใส่ได้หลายแหล่ง ถ้าโรงแรมซ้ำกันจะเก็บราคาที่ถูกที่สุด)
   - รับผลดิบจาก Booking.com (`{"accommodations": [...]}`) ได้โดยตรง
   - หรือรูปแบบย่อ: `{"checkin", "checkout", "hotels": [{"id","name","price","lat","lng","review_score","reviews","type","url"}]}` (ดู `sample_snapshot.json`)
2. **กรองตามแนวถนน:** แต่ละย่านคือเส้นที่ลากผ่านพิกัดหลายจุด (`route`) ที่พักต้องอยู่ห่างจากเส้นไม่เกิน `buffer_km`
   | ย่าน | แนวเส้นทาง |
   |---|---|
   | พระราม 9 | MRT พระราม 9 → Central พระราม 9 → พระราม 9 ช่วงตะวันออก |
   | ห้วยขวาง–รัชดา | MRT พระราม 9 → ศูนย์วัฒนธรรมฯ → ห้วยขวาง → สุทธิสาร → รัชดาภิเษก → ลาดพร้าว |
   | รัชโยธิน | ลาดพร้าว → แยกรัชโยธิน → BTS รัชโยธิน → เสนานิคม |
3. **กรองตามเงื่อนไข:** ราคาต่อคืนไม่เกินเพดาน (ตั้งแยกรายย่านได้), คะแนนรีวิวขั้นต่ำ, ตัดประเภทที่ไม่ต้องการ (เช่น แคปซูล)
4. **ไม่แจ้งซ้ำ:** จำราคาที่เคยแจ้งไว้ใน `state.json` จะแจ้งอีกครั้งเฉพาะเมื่อ **ราคาลดลง ≥ `price_drop_pct`%**
5. **ส่งแจ้งเตือน** และสร้างรายงาน HTML (ถ้าสั่ง)

## เริ่มใช้งาน

```bash
cd hotel-alert
cp config.example.json config.json         # ปรับเพดานราคา/ย่าน/ช่องทางแจ้งเตือนได้ที่นี่
python3 hotel_alert.py sample_snapshot.json --dry-run --html report.html
```

ตัวเลือกที่ใช้บ่อย

| ตัวเลือก | ความหมาย |
|---|---|
| `--dry-run` | แสดงบนหน้าจออย่างเดียว ไม่ส่ง ไม่บันทึก state |
| `--channels console,line` | เลือกช่องทาง (แทนค่าใน config) |
| `--html report.html` | สร้างหน้ารายงานรวมทุกแห่งที่ผ่านเงื่อนไข |
| `--all` | แจ้งทุกแห่งแม้เคยแจ้งแล้ว |
| `--state path` | ตำแหน่งไฟล์จำราคา |

## ตั้งค่าช่องทางแจ้งเตือน (environment variables)

| ช่องทาง | ตัวแปร |
|---|---|
| LINE (Messaging API) | `LINE_CHANNEL_ACCESS_TOKEN`, `LINE_TO` (userId หรือ groupId) |
| Telegram | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` |
| Discord | `DISCORD_WEBHOOK_URL` |

> LINE Notify ปิดบริการแล้วตั้งแต่ 31 มี.ค. 2025 จึงใช้ LINE Messaging API แทน
> (สร้าง Official Account → เปิด Messaging API → ออก Channel access token แล้วแอดบอทเป็นเพื่อน)

```bash
export TELEGRAM_BOT_TOKEN=... TELEGRAM_CHAT_ID=...
python3 hotel_alert.py snapshot.json --channels telegram
```

## ตั้งเวลาให้ตรวจอัตโนมัติ

ตัวอย่าง cron ตรวจทุก 3 ชั่วโมง (ให้สคริปต์ดึงข้อมูลของคุณเขียนไฟล์ snapshot ไว้ก่อน)

```cron
0 */3 * * * cd /path/to/hotel-alert && python3 hotel_alert.py /path/to/snapshot.json >> alert.log 2>&1
```

ข้อมูลตัวอย่างใน `sample_snapshot.json` มาจากการค้นหา Booking.com จริงเมื่อ 5 พ.ย. 2026
(เข้าพัก 6–7 พ.ย. 2026, ผู้ใหญ่ 2 คน, 1 ห้อง) ราคาอาจเปลี่ยนตลอดเวลา

## ทดสอบ

```bash
python3 -m unittest -v test_hotel_alert
```
