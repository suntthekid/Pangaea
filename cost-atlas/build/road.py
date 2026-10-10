import re
TH=str.maketrans('๐๑๒๓๔๕๖๗๘๙','0123456789')
N=r'([0-9][0-9,]*(?:\.[0-9]+)?)'
def f(x): return float(x.replace(',',''))
def road(name):
    s=name.translate(TH).replace('\n',' ')
    s=re.sub(r'\s+',' ',s)
    if not re.search(r'ถนน|ผิวจราจร',s): return None,None
    if re.search(r'สะพาน|อาคาร|ท่อ|ไฟฟ้า|รางระบาย|เขื่อน|ลานจอด|ฝาย',s): return None,None
    roads=len(re.findall(r'สายทาง|ถนน',s))
    typ=None
    if re.search(r'คอนกรีตเสริมเหล็ก|ค\.ส\.ล|คสล',s): typ='c'
    if re.search(r'แอสฟัล|ลาดยาง|asphalt|พาราแอสฟัลต์|Para',s,re.I): typ='a' if typ is None else 'm'
    if typ in (None,'m'): return None,None
    m=re.search(r'(?:พื้นที่|ผิวจราจร)[^0-9]{0,40}?(?:ไม่น้อยกว่า|รวม)\s*'+N+r'\s*(?:ตารางเมตร|ตร\.ม)',s)
    area=f(m.group(1)) if m else None
    if area is None:
        w=re.search(r'กว้าง\s*(?:เฉลี่ย)?\s*'+N+r'\s*(?:\.00)?\s*(?:ม\.|เมตร)',s); l=re.search(r'ยาว\s*(?:เฉลี่ย)?\s*'+N+r'\s*(?:ม\.|เมตร)',s)
        if w and l and len(re.findall(r'กว้าง',s))==1: area=f(w.group(1))*f(l.group(1))
    if not area or area<200: return None,None
    return typ,area
