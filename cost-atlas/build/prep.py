import pandas as pd, numpy as np, json, sys, re, os
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from road import road
df=pd.read_excel(sys.argv[1],sheet_name='rep131',dtype=str)
num=lambda c: pd.to_numeric(df[c],errors='coerce')
SECT={'ขนส่งทางถนน':'ถนนและสะพาน','อาคารและที่พักอาศัย':'อาคาร/ที่พักอาศัย','ชลประทาน':'ชลประทาน/ป้องกันน้ำ','อาคารการศึกษา':'อาคารการศึกษา','ประปา':'ประปา','อื่น ๆ':'อื่น ๆ','แหล่งท่องเที่ยวและกีฬา':'ท่องเที่ยว/กีฬา','พลังงานและไฟฟ้า':'พลังงาน/ไฟฟ้า','อาคารสาธารณสุข':'สาธารณสุข','สถานที่พักผ่อน':'สวนสาธารณะ/สุขภาพ','ระบบบำบัดน้ำเสีย':'บำบัดน้ำเสีย','ขนส่งทางอากาศ':'ท่าอากาศยาน','อาคารการเกษตร':'อาคารเกษตร','ขนส่งทางเรือ':'ท่าเรือ','ระบบกำจัดขยะ':'กำจัดขยะ','โรงงาน':'โรงงาน'}
def sec(s):
    for k,v in SECT.items():
        if s.strip().startswith(k): return v
    return s
df['sec']=df['Sector'].map(sec)
AG={'องค์การบริหารส่วนตำบล':'อบต.','เทศบาล':'เทศบาล','องค์การบริหารส่วนจังหวัด':'อบจ.','หน่วยงานราชการระดับกรมหรือเทียบเท่า':'ส่วนราชการ (กรม)','องค์กรปกครองส่วนท้องถิ่นรูปแบบพิเศษ (กทม./พัทยา)':'กทม./พัทยา','รัฐวิสาหกิจ':'รัฐวิสาหกิจ','อื่น ๆ':'อื่น ๆ'}
df['ag']=df['ประเภทหน่วยงาน'].map(AG)
ST={'โครงการเสร็จสิ้น และการจัดการข้อร้องเรียน':'เสร็จสิ้น','บริหารสัญญา':'บริหารสัญญา','ลงนามในสัญญาจัดซื้อจัดจ้าง แต่ยังไม่เริ่มโครงการ':'ลงนามแล้ว ยังไม่เริ่ม','ก่อนทำการเปิดเผยเอกสาร TOR':'ก่อนเปิดเผย TOR','จัดซื้อจัดจ้าง แต่ยังไม่ได้ลงนามในสัญญา':'จัดซื้อ ยังไม่ลงนาม','เปิดเผย TOR และราคากลาง':'เปิดเผย TOR/ราคากลาง'}
df['st']=df['สถานะโครงการ CoST'].map(ST).fillna('ไม่ระบุ')
cause=df['สาเหตุล่าช้า'].fillna('')
clim=cause.str.contains('ฝน|น้ำท่วม|อุทกภัย|น้ำหลาก|พายุ|มรสุม|ภัยพิบัติ|ภัยแล้ง|น้ำขึ้น|ระดับน้ำ|ดินสไลด์|ดินโคลน|สภาพอากาศ|ฤดูฝน')
mat=cause.str.contains('วัสดุ|ขาดแคลน|ราคา')
con=cause.str.contains('ผู้รับจ้าง')
budget=num('งบประมาณ'); ref=num('ราคากลาง'); bid=num('จำนวนผู้เข้าร่วมแข่งขัน'); ctr=num('ราคาสัญญาทั้งหมด')
delay=num('จำนวนวันที่ล่าช้า'); dur=num('ระยะเวลาดำเนินการ (วัน)'); disc=num('ร้อยละเปิดเผย')
delay=delay.where((delay>=0)&(delay<=1500))   # outliers (e.g. 23,407 days) treated as data error
dur=dur.where(dur>0)
ref=ref.where(ref>0); budget=budget.where(budget>0)
provs=sorted(df['จังหวัด'].unique()); secs=list(df['sec'].value_counts().index); ags=list(df['ag'].value_counts().index); sts=list(df['st'].value_counts().index)
pi={p:i for i,p in enumerate(provs)}; si={s:i for i,s in enumerate(secs)}; ai={a:i for i,a in enumerate(ags)}; ti={s:i for i,s in enumerate(sts)}
def r(x,nd=0):
    if pd.isna(x): return None
    return round(float(x),nd) if nd else int(round(float(x)))
rs=df['ชื่อโครงการ'].map(road)
rtyp=[{'c':1,'a':2}.get(x[0],0) for x in rs]; rarea=[x[1] for x in rs]
rows=[]
for i in range(len(df)):
    rows.append([pi[df['จังหวัด'][i]],si[df['sec'][i]],ai[df['ag'][i]],int(df['ปีงบประมาณ'][i]),
      r(budget[i]/1e3),r(ref[i]/1e3),r(bid[i]),r(ctr[i]/1e3),r(delay[i]),r(dur[i]),r(disc[i],1),ti[df['st'][i]],
      int(clim[i])+2*int(mat[i])+4*int(con[i]), rtyp[i], (r(ctr[i]/rarea[i]) if rtyp[i] and not pd.isna(ctr[i]) and 150<=ctr[i]/rarea[i]<=3000 else None)])
out=dict(provs=provs,secs=secs,ags=ags,sts=sts,
  cols=['p','s','a','y','budgetK','refK','bid','ctrK','delay','dur','disc','st','cause','rt','uc'],rows=rows,
  meta=dict(n=len(df),source='AT_02102026.xlsx (rep131)'))
json.dump(out,open(sys.argv[2],'w'),ensure_ascii=False,separators=(',',':'))
# quick insights
d=pd.DataFrame(rows,columns=out['cols'])
print('climate-coded causes',clim.sum(),'contractor',con.sum(),'material',mat.sum(), 'causes non-empty',(cause.str.strip()!='').sum())
print('bid<=1 share',(d.bid<=1).mean().round(3),'bid==0',(d.bid==0).mean().round(3))
v=d.dropna(subset=['refK','ctrK']); sav=1-v.ctrK/v.refK
print('savings median',sav.median().round(3),'mean',sav.mean().round(3),'contract>=99%ref',(v.ctrK/v.refK>=0.99).mean().round(3))
print('late share',(d.delay>0).mean().round(3),'late>30',(d.delay>30).mean().round(3))
print('corr bidders vs savings', np.corrcoef(v.bid,sav.clip(-1,1))[0,1].round(3))
print(v.assign(sav=sav).groupby(v.bid.clip(upper=10)).sav.median().round(3).to_dict())
