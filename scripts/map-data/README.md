# Map data pipeline

สร้างขอบเขตจังหวัด/เมืองจาก [GADM](https://gadm.org) (Japan, level 1 = จังหวัด, level 2 = เมือง/เขต) แล้วผลิตทั้ง GeoJSON สำหรับ serve ให้ client และ JSON สำหรับ seed เข้า DB

ผลลัพธ์ (`geo-data/`, `prisma/seed-data/`) commit ไว้ใน repo แล้ว ไม่ต้องรันซ้ำเว้นแต่จะอัปเดตข้อมูล

## ขั้นตอน (รันครั้งเดียว หรือรันใหม่เมื่อ GADM ออกเวอร์ชันใหม่)

```bash
# 1. โหลด + แตกไฟล์ shapefile (นอก repo — ไฟล์ดิบ ~18MB ไม่ต้อง commit)
mkdir -p /tmp/gadm && cd /tmp/gadm
curl -o gadm41_JPN_shp.zip https://geodata.ucdavis.edu/gadm/gadm4.1/shp/gadm41_JPN_shp.zip
unzip gadm41_JPN_shp.zip

# 2. simplify + แปลงเป็น GeoJSON ด้วย mapshaper (ไม่ต้องใช้ GDAL)
npx mapshaper gadm41_JPN_1.shp -simplify 10% \
  -filter-fields NAME_1,NL_NAME_1,ISO_1 \
  -o format=geojson precision=0.0001 prefectures.raw.geojson

npx mapshaper gadm41_JPN_2.shp -simplify 10% \
  -filter-fields NAME_1,NAME_2,NL_NAME_2,GID_1,ENGTYPE_2 \
  -o format=geojson precision=0.0001 municipalities.raw.geojson

# 3. ประมวลผล -> geo-data/*.geojson + prisma/seed-data/*.json
cd <nihon-tabi-api>
node scripts/map-data/process-gadm.js /tmp/gadm

# 4. seed เข้า DB (upsert, รันซ้ำได้)
npm run seed:geo
```

## หมายเหตุ

- **id ของ prefectures** = รหัส JIS มาตรฐาน (01-47) แกะจากฟิลด์ `ISO_1` ของ GADM (`JP-13` → 13) — Hyōgo และ Nagasaki ใน GADM 4.1 ไม่มีค่า `ISO_1` (เป็น `NA`) จึง hardcode ไว้ใน `ISO_1_OVERRIDE_BY_NAME_1`
- **id ของ municipalities** = `prefectureId * 1000 + ลำดับในจังหวัดนั้น` —**ไม่ใช่รหัส JIS 5 หลักจริง** (GADM ไม่มีรหัสนี้ให้) เป็นแค่ id ภายในที่ stable และ unique พอสำหรับระบบเรา
- ตัดข้อมูลที่ไม่ใช่เขตปกครองจริงออก (`Water body`, `County`, `Capital` — รวม 5 รายการจาก 1,811) เหลือ municipalities จริง 1,806 รายการ
- ความละเอียดของ boundary มาจาก GADM ซึ่งอาจไม่ตรงกับขอบเขตทางการล่าสุดของญี่ปุ่นเป๊ะ ๆ (เช่นการควบรวมเทศบาลใหม่ ๆ) — ถ้าต้องการความแม่นยำระดับทางการ ให้พิจารณาสลับไปใช้ข้อมูลจาก [MLIT/e-Stat](https://www.e-stat.go.jp/) แทนในอนาคต
