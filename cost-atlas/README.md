# CoST Atlas ประเทศไทย

แผนที่ interactive รายจังหวัดจากข้อมูล CoST (`AT_02102026.xlsx`, ชีต `rep131`, 10,171 โครงการ)
เปิด `index.html` ในเบราว์เซอร์ได้ทันที (โหลด d3 จาก cdnjs)

มุมมอง: การกระจายการลงทุน · ต้นทุนและประสิทธิภาพ (รวมต้นทุนถนนต่อ ตร.ม.) · ธรรมาภิบาล (G) · สิ่งแวดล้อม (E) · สังคม (S)
กรองได้ตามปีงบประมาณ, Sector, ประเภทหน่วยงาน, สถานะโครงการ

## อัปเดตข้อมูล

```bash
pip install pandas openpyxl
./build/build.sh path/to/AT_ddmmyyyy.xlsx
```

- `build/prep.py` แปลง Excel เป็นข้อมูลรายโครงการแบบย่อ (ทำความสะอาดค่าผิดปกติ, จัดกลุ่ม Sector, ค้นสาเหตุล่าช้าจากสภาพอากาศ)
- `build/road.py` ดึงขนาดถนนจากชื่อโครงการเพื่อคำนวณบาท/ตร.ม.
- ขอบเขตจังหวัด: ย่อจาก [chingchai/OpenGISData-Thailand](https://github.com/chingchai/OpenGISData-Thailand) ด้วย mapshaper
