import json
import tempfile
import unittest
from pathlib import Path

import hotel_alert as ha

HERE = Path(__file__).parent
CFG = ha.load_config(HERE / "config.example.json")
ZONES = ha.zones_from_config(CFG)


def hotel(id_, price, lat, lng, rating=8.0, kind="Hotel", checkin="2099-01-01"):
    return {"id": id_, "name": f"H{id_}", "price": price, "lat": lat, "lng": lng,
            "review_score": rating, "reviews": 50, "type": kind,
            "checkin": checkin, "checkout": "2099-01-02"}


class GeometryTest(unittest.TestCase):
    def test_point_on_route_is_zero(self):
        self.assertAlmostEqual(ha.dist_to_route_km((13.7787, 100.5737), ZONES[1].route), 0, places=2)

    def test_sukhumvit_outside_all_zones(self):
        h = ha.parse_snapshot([hotel(1, 500, 13.7446, 100.5564)])[0]  # สุขุมวิท 11
        self.assertIsNone(ha.match_zone(h, ZONES))

    def test_zone_assignment(self):
        for (lat, lng), key in [((13.7567, 100.5623), "rama9"), ((13.7895, 100.5770), "huaikhwang"),
                                ((13.8293, 100.5709), "ratchayothin")]:
            h = ha.parse_snapshot([hotel(1, 500, lat, lng)])[0]
            self.assertEqual(ha.match_zone(h, ZONES)[0].key, key)


class ParseTest(unittest.TestCase):
    def test_booking_raw_format_and_nights(self):
        raw = {"accommodations": [{
            "id": 9, "name": "X", "accommodationType": "Hotel",
            "url": "https://www.booking.com/hotel/th/x.html?aid=1&checkin=2099-01-01&checkout=2099-01-03&label=z",
            "price": {"book": 1600, "currency": "THB"},
            "rating": {"number_of_reviews": 10, "review_score": 8.5, "stars": 3},
            "location": {"coordinates": {"latitude": 13.78, "longitude": 100.57}}}]}
        h = ha.parse_snapshot(raw)[0]
        self.assertEqual(h.nights, 2)
        self.assertEqual(h.per_night, 800)
        self.assertEqual(h.rating, 8.5)
        self.assertNotIn("aid=", h.url)
        self.assertNotIn("label=", h.url)


class DealTest(unittest.TestCase):
    def deals(self, items, state=None):
        return ha.find_deals(ha.parse_snapshot(items), ZONES, CFG["filters"], state or {})

    def test_filters(self):
        d = self.deals([
            hotel(1, 900, 13.78, 100.574),                     # ผ่าน
            hotel(2, 1500, 13.78, 100.574),                    # แพงเกิน
            hotel(3, 700, 13.78, 100.574, rating=5.5),         # คะแนนต่ำ
            hotel(4, 400, 13.78, 100.574, kind="Capsule hotel"),  # ประเภทที่ตัดออก
            hotel(5, 800, 13.78, 100.574, rating=None),        # ยังไม่มีรีวิว → ยอมให้ผ่าน
        ])
        self.assertEqual(sorted(x.hotel.id for x in d), ["1", "5"])

    def test_no_repeat_but_alert_on_drop(self):
        state = {"1|2099-01-01": 900}
        self.assertEqual(self.deals([hotel(1, 890, 13.78, 100.574)], state), [])  # ลดน้อยกว่า 5%
        d = self.deals([hotel(1, 800, 13.78, 100.574)], state)
        self.assertEqual(d[0].reason, "drop")
        self.assertEqual(d[0].previous, 900)


class EndToEndTest(unittest.TestCase):
    def test_sample_snapshot_runs_and_remembers(self):
        with tempfile.TemporaryDirectory() as tmp:
            state = Path(tmp) / "state.json"
            # ใช้วันที่ในอนาคตเพื่อไม่ให้ถูกล้างออกจาก state
            data = json.loads((HERE / "sample_snapshot.json").read_text())
            data["checkin"], data["checkout"] = "2099-01-01", "2099-01-02"
            for h in data["hotels"]:
                h["url"] = ""
            snap = Path(tmp) / "snap.json"
            snap.write_text(json.dumps(data))
            args = [str(snap), "-c", str(HERE / "config.example.json"), "--state", str(state),
                    "--channels", "console", "--html", str(Path(tmp) / "r.html")]
            self.assertEqual(ha.main(args), 0)
            first = json.loads(state.read_text())
            self.assertGreater(len(first), 10)
            self.assertNotIn("13259020|2099-01-01", first)  # Kiwi Capsule (สุขุมวิท) ต้องไม่ถูกแจ้ง
            self.assertIn("ห้วยขวาง", (Path(tmp) / "r.html").read_text())
            hotels = ha.load_sources([str(snap)])
            self.assertEqual(ha.find_deals(hotels, ZONES, CFG["filters"], first), [])


if __name__ == "__main__":
    unittest.main()
