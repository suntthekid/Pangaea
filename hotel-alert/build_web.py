#!/usr/bin/env python3
"""รวมหน้าเว็บ + config + ข้อมูล เป็นไฟล์ HTML ไฟล์เดียว ดับเบิลคลิกเปิดได้เลยไม่ต้องรันเซิร์ฟเวอร์

    python3 build_web.py                       # ใช้ sample_snapshot.json → hotel-alert.html
    python3 build_web.py snapshot.json         # ใช้ข้อมูลล่าสุดของคุณ
    python3 build_web.py -o out.html --artifact  # รุ่นสำหรับเผยแพร่เป็นลิงก์ claude.ai
"""
import argparse
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
WEB = HERE / "web"


def safe_json(obj) -> str:
    # กัน </script> ในข้อมูลทำให้หน้าเว็บพัง
    return json.dumps(obj, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")


def build(snapshot: Path, out: Path, artifact: bool) -> None:
    cfg_path = HERE / "config.json"
    if not cfg_path.exists():
        cfg_path = HERE / "config.example.json"
    config = json.loads(cfg_path.read_text(encoding="utf-8"))
    sample = json.loads(snapshot.read_text(encoding="utf-8"))
    label = sample.get("source", snapshot.name) if isinstance(sample, dict) else snapshot.name
    embed = {"config": config, "sample": sample, "sampleLabel": label, "artifact": artifact}

    page = (WEB / "index.html").read_text(encoding="utf-8")
    css = (WEB / "style.css").read_text(encoding="utf-8")
    js = (WEB / "app.js").read_text(encoding="utf-8").replace("</script", "<\\/script")
    page = page.replace('<link rel="stylesheet" href="style.css">', f"<style>\n{css}</style>")
    page = page.replace('<script src="app.js"></script>',
                        f"<script>window.HOTEL_EMBED={safe_json(embed)};</script>\n<script>\n{js}</script>")
    out.write_text(page, encoding="utf-8")
    print(f"สร้าง {out} แล้ว ({out.stat().st_size / 1024:.0f} KB)")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("snapshot", nargs="?", default=str(HERE / "sample_snapshot.json"))
    ap.add_argument("-o", "--out", default=str(HERE / "hotel-alert.html"))
    ap.add_argument("--artifact", action="store_true", help="ซ่อนฟังก์ชันที่ใช้ไม่ได้ในลิงก์ claude.ai")
    a = ap.parse_args()
    build(Path(a.snapshot), Path(a.out), a.artifact)
