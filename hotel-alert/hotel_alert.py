#!/usr/bin/env python3
"""ระบบแจ้งเตือนโรงแรมราคาถูก ย่านพระราม 9 · ห้วยขวาง · รัชโยธิน

อ่านผลค้นหาโรงแรม (snapshot JSON) → กรองเฉพาะที่อยู่ "ในเส้น" ที่สนใจ
→ เทียบกับเพดานราคา/คะแนนรีวิว → แจ้งเตือนเฉพาะที่พักใหม่หรือที่ราคาลดลง
ผ่าน LINE / Telegram / Discord / หน้าจอ  (ใช้แค่ Python standard library)
"""
from __future__ import annotations

import argparse
import html
import json
import math
import os
import sys
import urllib.parse
import urllib.request
from dataclasses import dataclass
from datetime import date, datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent


# ---------------------------------------------------------------- geometry
def haversine_km(a: tuple[float, float], b: tuple[float, float]) -> float:
    lat1, lon1, lat2, lon2 = map(math.radians, (*a, *b))
    h = math.sin((lat2 - lat1) / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin((lon2 - lon1) / 2) ** 2
    return 2 * 6371.0 * math.asin(math.sqrt(h))


def dist_to_segment_km(p, a, b) -> float:
    """ระยะจากจุด p ถึงเส้นตรง a-b (ประมาณบนระนาบ ใช้ได้ดีในระยะไม่กี่กิโลเมตร)"""
    k = math.cos(math.radians(p[0]))
    to_xy = lambda q: ((q[1] - p[1]) * 111.32 * k, (q[0] - p[0]) * 110.57)
    ax, ay = to_xy(a)
    bx, by = to_xy(b)
    dx, dy = bx - ax, by - ay
    seg2 = dx * dx + dy * dy
    t = 0.0 if seg2 == 0 else max(0.0, min(1.0, -(ax * dx + ay * dy) / seg2))
    return math.hypot(ax + t * dx, ay + t * dy)


def dist_to_route_km(p, points) -> float:
    if len(points) == 1:
        return haversine_km(p, points[0])
    return min(dist_to_segment_km(p, a, b) for a, b in zip(points, points[1:]))


# ---------------------------------------------------------------- models
@dataclass
class Zone:
    key: str
    name: str
    route: list[tuple[float, float]]
    buffer_km: float
    max_price: float


@dataclass
class Hotel:
    id: str
    name: str
    total_price: float
    nights: int
    currency: str
    lat: float
    lng: float
    url: str = ""
    rating: float | None = None
    reviews: int = 0
    stars: int | None = None
    kind: str = ""
    checkin: str = ""
    checkout: str = ""
    source: str = ""

    @property
    def per_night(self) -> float:
        return self.total_price / max(1, self.nights)


@dataclass
class Deal:
    hotel: Hotel
    zone: Zone
    distance_km: float
    reason: str  # "new" | "drop"
    previous: float | None = None


# ---------------------------------------------------------------- loading
def load_config(path: Path) -> dict:
    cfg = json.loads(path.read_text(encoding="utf-8"))
    cfg.setdefault("filters", {})
    cfg.setdefault("notify", {"channels": ["console"]})
    return cfg


def zones_from_config(cfg: dict) -> list[Zone]:
    default_max = cfg["filters"].get("max_price_per_night", 1000)
    default_buf = cfg["filters"].get("buffer_km", 1.2)
    return [
        Zone(
            key=z["key"],
            name=z["name"],
            route=[tuple(pt) for pt in z["route"]],
            buffer_km=z.get("buffer_km", default_buf),
            max_price=z.get("max_price_per_night", default_max),
        )
        for z in cfg["zones"]
    ]


def _nights(checkin: str, checkout: str) -> int:
    try:
        return max(1, (date.fromisoformat(checkout) - date.fromisoformat(checkin)).days)
    except (TypeError, ValueError):
        return 1


def _clean_url(url: str) -> tuple[str, dict]:
    """ตัดพารามิเตอร์ติดตาม (aid/label) ออก และคืนค่า query ที่เหลือ"""
    if not url:
        return "", {}
    parts = urllib.parse.urlsplit(url)
    q = dict(urllib.parse.parse_qsl(parts.query))
    for k in ("aid", "label"):
        q.pop(k, None)
    return urllib.parse.urlunsplit(parts._replace(query=urllib.parse.urlencode(q))), q


def parse_snapshot(data) -> list[Hotel]:
    """รองรับทั้งผลดิบจาก Booking.com ({"accommodations": [...]}) และรูปแบบย่อของเราเอง"""
    meta_in = meta_out = meta_src = ""
    if isinstance(data, dict):
        meta_in, meta_out = data.get("checkin", ""), data.get("checkout", "")
        meta_src = data.get("provider", "")
        items = data.get("accommodations") or data.get("hotels") or []
    else:
        items = data
    hotels = []
    for it in items:
        url, q = _clean_url(it.get("url", ""))
        checkin = it.get("checkin") or meta_in or q.get("checkin", "")
        checkout = it.get("checkout") or meta_out or q.get("checkout", "")
        price = it.get("price")
        if isinstance(price, dict):
            total, currency = price.get("book"), price.get("currency", "THB")
        else:
            total, currency = price, it.get("currency", "THB")
        loc = it.get("location", {}).get("coordinates", {}) if "location" in it else it
        lat, lng = loc.get("latitude", loc.get("lat")), loc.get("longitude", loc.get("lng"))
        if total is None or lat is None or lng is None:
            continue
        r = it.get("rating") if isinstance(it.get("rating"), dict) else {}
        hotels.append(Hotel(
            id=str(it["id"]),
            name=it["name"],
            total_price=float(total),
            nights=it.get("nights") or _nights(checkin, checkout),
            currency=currency,
            lat=float(lat),
            lng=float(lng),
            url=url,
            rating=r.get("review_score", it.get("review_score") if not r else None),
            reviews=r.get("number_of_reviews", it.get("reviews", 0)) or 0,
            stars=r.get("stars", it.get("stars")),
            kind=it.get("accommodationType", it.get("type", "")),
            checkin=checkin,
            checkout=checkout,
            source=it.get("source") or meta_src or ("Booking.com" if "booking.com" in url else ""),
        ))
    return hotels


def load_sources(paths: list[str]) -> list[Hotel]:
    hotels: dict[tuple[str, str], Hotel] = {}
    for src in paths:
        if src.startswith(("http://", "https://")):
            with urllib.request.urlopen(src, timeout=30) as resp:
                data = json.load(resp)
        else:
            data = json.loads(Path(src).read_text(encoding="utf-8"))
        for h in parse_snapshot(data):
            key = (h.id, h.checkin)
            if key not in hotels or h.per_night < hotels[key].per_night:
                hotels[key] = h  # ซ้ำกันหลายแหล่ง → เก็บราคาถูกสุด
    return list(hotels.values())


# ---------------------------------------------------------------- core logic
def match_zone(h: Hotel, zones: list[Zone]) -> tuple[Zone, float] | None:
    best = None
    for z in zones:
        d = dist_to_route_km((h.lat, h.lng), z.route)
        if d <= z.buffer_km and (best is None or d < best[1]):
            best = (z, d)
    return best


def passes_filters(h: Hotel, zone: Zone, f: dict) -> bool:
    if h.per_night > zone.max_price:
        return False
    if h.per_night < f.get("min_price_per_night", 0):
        return False
    min_rating = f.get("min_rating")
    if min_rating is not None:
        if h.rating is None:
            if not f.get("allow_unrated", True):
                return False
        elif h.rating < min_rating:
            return False
    if h.reviews < f.get("min_reviews", 0) and h.rating is not None:
        return False
    if h.checkin:
        if f.get("checkin_from") and h.checkin < f["checkin_from"]:
            return False
        if f.get("checkin_to") and h.checkin > f["checkin_to"]:
            return False
        wd = f.get("checkin_weekdays")  # 0=จันทร์ … 6=อาทิตย์
        if wd and date.fromisoformat(h.checkin).weekday() not in wd:
            return False
    if f.get("sources") and h.source not in f["sources"]:
        return False
    kinds = f.get("exclude_types", [])
    return not any(k.lower() in h.kind.lower() for k in kinds)


def find_deals(hotels, zones, filters, state) -> list[Deal]:
    drop_pct = filters.get("price_drop_pct", 5)
    deals = []
    for h in hotels:
        m = match_zone(h, zones)
        if not m or not passes_filters(h, m[0], filters):
            continue
        prev = state.get(f"{h.id}|{h.checkin}")
        if prev is None:
            deals.append(Deal(h, m[0], m[1], "new"))
        elif h.per_night <= prev * (1 - drop_pct / 100):
            deals.append(Deal(h, m[0], m[1], "drop", prev))
    deals.sort(key=lambda d: (zones.index(d.zone), d.hotel.per_night))
    return deals


def load_state(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}


def save_state(path: Path, state: dict, deals: list[Deal]) -> None:
    for d in deals:
        state[f"{d.hotel.id}|{d.hotel.checkin}"] = round(d.hotel.per_night, 2)
    today = date.today().isoformat()
    state = {k: v for k, v in state.items() if k.split("|", 1)[1] >= today or not k.split("|", 1)[1]}
    path.write_text(json.dumps(state, ensure_ascii=False, indent=1, sort_keys=True), encoding="utf-8")


# ---------------------------------------------------------------- formatting
TRIPCOM_URL = ("https://th.trip.com/hotels/list?city=359&checkin={checkin}&checkout={checkout}"
               "&adult=2&crn=1&searchWord={q}")


def tripcom_link(h: "Hotel", template: str = TRIPCOM_URL) -> str:
    """ลิงก์ค้นหาโรงแรมนี้บน Trip.com ตามวันที่เข้าพัก (Trip.com ไม่มี API สาธารณะ จึงเป็นลิงก์ค้นหา)"""
    fmt = lambda d: d.replace("-", "/")
    return template.format(checkin=fmt(h.checkin), checkout=fmt(h.checkout), q=urllib.parse.quote(h.name))


TH_DAYS = "จ. อ. พ. พฤ. ศ. ส. อา.".split()
TH_MONTHS = "ม.ค. ก.พ. มี.ค. เม.ย. พ.ค. มิ.ย. ก.ค. ส.ค. ก.ย. ต.ค. พ.ย. ธ.ค.".split()


def th_date(iso: str) -> str:
    try:
        d = date.fromisoformat(iso)
    except (TypeError, ValueError):
        return iso or "-"
    return f"{TH_DAYS[d.weekday()]} {d.day} {TH_MONTHS[d.month - 1]}"


def money(v: float, cur: str = "THB") -> str:
    return f"฿{v:,.0f}" if cur == "THB" else f"{v:,.0f} {cur}"


def format_deal(d: Deal) -> str:
    h = d.hotel
    tag = "🆕" if d.reason == "new" else f"📉 ลดจาก {money(d.previous, h.currency)}"
    rating = f"⭐ {h.rating:g} ({h.reviews} รีวิว)" if h.rating is not None else "ยังไม่มีคะแนน"
    lines = [
        f"🏨 {h.name}",
        f"   {money(h.per_night, h.currency)}/คืน {tag}",
        f"   📍 {d.zone.name} (ห่างเส้นทาง {d.distance_km:.1f} กม.) · {h.kind}",
        f"   {rating} · เข้าพัก {th_date(h.checkin)}–{th_date(h.checkout)}",
    ]
    if h.url:
        lines.append(f"   🔗 {h.source or 'จอง'}: {h.url}")
    if h.checkin and h.source != "Trip.com":
        lines.append(f"   🔎 เทียบราคา Trip.com: {tripcom_link(h)}")
    return "\n".join(lines)


def build_messages(deals: list[Deal], max_chars: int = 3500) -> list[str]:
    if not deals:
        return []
    header = f"🔔 โรงแรมราคาถูก พระราม 9 · ห้วยขวาง · รัชโยธิน — {len(deals)} รายการ"
    msgs, cur = [], header
    for d in deals:
        block = format_deal(d)
        if len(cur) + len(block) + 2 > max_chars:
            msgs.append(cur)
            cur = header + " (ต่อ)"
        cur += "\n\n" + block
    msgs.append(cur)
    return msgs


def write_html(path: Path, deals: list[Deal], all_matches: list[tuple[Hotel, Zone, float]]) -> None:
    esc = html.escape
    rows = []
    alerted = {d.hotel.id for d in deals}
    for h, z, dist in sorted(all_matches, key=lambda t: t[0].per_night):
        badge = '<span class="new">ใหม่/ลดราคา</span>' if h.id in alerted else ""
        link = f'<a href="{esc(h.url)}" target="_blank" rel="noopener">{esc(h.name)}</a>' if h.url else esc(h.name)
        rating = f"{h.rating:g} ({h.reviews})" if h.rating is not None else "-"
        rows.append(
            f"<tr><td>{link} {badge}</td><td>{esc(z.name)}</td><td class=n>{money(h.per_night, h.currency)}</td>"
            f"<td class=n>{rating}</td><td>{esc(h.kind)}</td><td>{th_date(h.checkin)}</td><td class=n>{dist:.1f}</td></tr>"
        )
    stamp = datetime.now().strftime("%Y-%m-%d %H:%M")
    path.write_text(f"""<!doctype html><html lang="th"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>โรงแรมราคาถูก พระราม 9 · ห้วยขวาง · รัชโยธิน</title>
<style>body{{font:15px/1.5 "Noto Sans Thai",system-ui,sans-serif;margin:0;background:#f5f7fb;color:#1b2333}}
.wrap{{max-width:1000px;margin:0 auto;padding:20px}}h1{{font-size:1.4rem;margin:.2em 0}}.muted{{color:#667}}
table{{width:100%;border-collapse:collapse;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 1px 4px #0001}}
th,td{{padding:8px 10px;border-bottom:1px solid #e6e9f0;text-align:left}}th{{background:#1f4e8c;color:#fff;font-weight:600}}
.n{{text-align:right;white-space:nowrap}}.new{{background:#e8590c;color:#fff;border-radius:99px;padding:1px 8px;font-size:.75rem}}
a{{color:#1f4e8c}}</style></head><body><div class="wrap">
<h1>🏨 โรงแรมราคาถูก พระราม 9 · ห้วยขวาง · รัชโยธิน</h1>
<p class="muted">อัปเดต {stamp} · พบ {len(all_matches)} แห่งที่ผ่านเงื่อนไข · แจ้งเตือนรอบนี้ {len(deals)} แห่ง</p>
<table><tr><th>ที่พัก</th><th>ย่าน</th><th class=n>ราคา/คืน</th><th class=n>รีวิว</th><th>ประเภท</th><th>เข้าพัก</th><th class=n>กม.</th></tr>
{''.join(rows) or '<tr><td colspan=7>ไม่พบที่พักตามเงื่อนไข</td></tr>'}</table></div></body></html>""", encoding="utf-8")


# ---------------------------------------------------------------- notifiers
def _post_json(url: str, payload: dict, headers: dict | None = None) -> None:
    req = urllib.request.Request(
        url, data=json.dumps(payload).encode(), method="POST",
        headers={"Content-Type": "application/json", **(headers or {})},
    )
    with urllib.request.urlopen(req, timeout=20) as resp:
        resp.read()


def notify_console(msg: str) -> None:
    print(msg, end="\n\n")


def notify_line(msg: str) -> None:
    # LINE Messaging API (LINE Notify ปิดบริการแล้วตั้งแต่ 31 มี.ค. 2025)
    token, to = os.environ["LINE_CHANNEL_ACCESS_TOKEN"], os.environ["LINE_TO"]
    _post_json("https://api.line.me/v2/bot/message/push",
               {"to": to, "messages": [{"type": "text", "text": msg[:5000]}]},
               {"Authorization": f"Bearer {token}"})


def notify_telegram(msg: str) -> None:
    token, chat = os.environ["TELEGRAM_BOT_TOKEN"], os.environ["TELEGRAM_CHAT_ID"]
    _post_json(f"https://api.telegram.org/bot{token}/sendMessage",
               {"chat_id": chat, "text": msg[:4096], "disable_web_page_preview": True})


def notify_discord(msg: str) -> None:
    url = os.environ["DISCORD_WEBHOOK_URL"]
    for i in range(0, len(msg), 1900):
        _post_json(url, {"content": msg[i:i + 1900]})


NOTIFIERS = {"console": notify_console, "line": notify_line, "telegram": notify_telegram, "discord": notify_discord}


def send_all(messages: list[str], channels: list[str]) -> list[str]:
    errors = []
    for ch in channels:
        fn = NOTIFIERS.get(ch)
        if fn is None:
            errors.append(f"{ch}: ไม่รู้จักช่องทางนี้")
            continue
        for m in messages:
            try:
                fn(m)
            except KeyError as e:
                errors.append(f"{ch}: ยังไม่ได้ตั้งค่า environment variable {e}")
                break
            except Exception as e:  # noqa: BLE001 — ช่องทางหนึ่งล้มต้องไม่ทำให้ช่องทางอื่นล้ม
                errors.append(f"{ch}: {e}")
                break
    return errors


# ---------------------------------------------------------------- CLI
def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description="แจ้งเตือนโรงแรมราคาถูก พระราม 9 · ห้วยขวาง · รัชโยธิน")
    ap.add_argument("sources", nargs="+", help="ไฟล์หรือ URL ของผลค้นหาโรงแรม (JSON)")
    ap.add_argument("-c", "--config", default=str(HERE / "config.json"))
    ap.add_argument("--state", default=str(HERE / "state.json"), help="ไฟล์จำราคาที่เคยแจ้งแล้ว")
    ap.add_argument("--html", help="สร้างรายงาน HTML ไว้ที่ path นี้")
    ap.add_argument("--channels", help="ช่องทางแจ้งเตือน คั่นด้วยจุลภาค เช่น console,line")
    ap.add_argument("--dry-run", action="store_true", help="แสดงผลอย่างเดียว ไม่ส่ง ไม่บันทึก state")
    ap.add_argument("--all", action="store_true", help="แจ้งทุกแห่งที่ผ่านเงื่อนไข แม้เคยแจ้งแล้ว")
    args = ap.parse_args(argv)

    cfg_path = Path(args.config)
    if not cfg_path.exists():
        cfg_path = HERE / "config.example.json"
    cfg = load_config(cfg_path)
    zones = zones_from_config(cfg)
    filters = cfg["filters"]
    state_path = Path(args.state)
    state = {} if args.all else load_state(state_path)

    hotels = load_sources(args.sources)
    deals = find_deals(hotels, zones, filters, state)

    if args.html:
        matches = [(h, *m) for h in hotels if (m := match_zone(h, zones)) and passes_filters(h, m[0], filters)]
        write_html(Path(args.html), deals, matches)

    print(f"อ่านที่พัก {len(hotels)} แห่ง → เข้าเงื่อนไขและควรแจ้ง {len(deals)} แห่ง", file=sys.stderr)
    messages = build_messages(deals)
    if not messages:
        return 0
    channels = args.channels.split(",") if args.channels else cfg["notify"].get("channels", ["console"])
    if args.dry_run:
        channels = ["console"]
    errors = send_all(messages, channels)
    for e in errors:
        print("⚠️ " + e, file=sys.stderr)
    if not args.dry_run and len(errors) < len(channels):
        save_state(state_path, state, deals)
    return 1 if errors and len(errors) >= len(channels) else 0


if __name__ == "__main__":
    sys.exit(main())
