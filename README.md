# nihon-tabi-api

Backend REST API สำหรับแอพบันทึกการท่องเที่ยวญี่ปุ่น — เป็น source of truth เดียวให้ทั้ง Android app และ Web app เรียกใช้

ดู design รวมทั้งระบบที่ [`../SYSTEM_DESIGN.md`](../SYSTEM_DESIGN.md)

## Stack

- Node.js + NestJS + TypeScript
- PostgreSQL + Prisma ORM
- JWT (access token อายุสั้น + refresh token)
- Zod/class-validator สำหรับ validate request

## โครงสร้างโฟลเดอร์

```
src/
  auth/            -- register, login, refresh, logout, guards, JWT strategy
  users/           -- profile ของ user ปัจจุบัน (GET/PATCH /users/me)
  geo/             -- prefectures, municipalities (read-only, metadata จาก DB)
  visits/          -- CRUD visits + photos
  trips/           -- CRUD trips + days (จัดกลุ่ม visit เป็นทริป)
  stats/           -- GET /stats/me
  prisma/          -- PrismaService, PrismaModule
prisma/
  schema.prisma
  migrations/
  seed-data/        -- prefectures.json, municipalities.json (ผลิตจาก scripts/map-data/)
scripts/
  seed-geo.ts        -- upsert prefectures/municipalities จาก prisma/seed-data/*.json เข้า DB
  map-data/           -- pipeline แปลง GADM shapefile → GeoJSON (ดู README ในนั้น)
geo-data/
  prefectures.geojson              -- polygon ทั้ง 47 จังหวัด (properties: {id})
  municipalities/<prefectureId>.geojson  -- polygon เมือง/เขตของจังหวัดนั้น
```

## Data model

ดูรายละเอียด entity ทั้งหมดที่ SYSTEM_DESIGN.md ส่วน "Data model (core)" — ย่อ: `users`, `prefectures`, `municipalities`, `visits`, `visit_photos`, `trips`, `trip_days`

## Map data (GADM → GeoJSON → seed)

ทำเสร็จแล้ว — ดูขั้นตอนที่ [`scripts/map-data/README.md`](scripts/map-data/README.md) ผลลัพธ์ (`geo-data/*.geojson`, `prisma/seed-data/*.json`) commit ไว้ใน repo แล้ว ไม่ต้องรัน pipeline ใหม่เว้นแต่จะอัปเดตข้อมูล — รัน `npm run seed:geo` เพื่อ upsert เข้า DB ใหม่ (เช่นหลัง migrate ใน environment ใหม่)

Polygon geometry ถูก serve เป็น static file ที่ `GET /geo/files/prefectures.geojson` และ `GET /geo/files/municipalities/:prefectureId.geojson` (ผ่าน `@nestjs/serve-static`) แยกจาก endpoint metadata (`/geo/prefectures` ฯลฯ) ที่มาจาก DB — client จับคู่กันด้วย `properties.id` ในไฟล์ GeoJSON ↔ `id` ที่ได้จาก DB endpoint

## Setup

```bash
npm install
cp .env.example .env      # แก้ secret จริงก่อน deploy
npm run db:up              # Postgres local ผ่าน Docker (dev เท่านั้น)
npm run prisma:migrate      # สร้างตารางตาม prisma/schema.prisma
npm run start:dev           # http://localhost:3000
```

ทดสอบแล้วด้วยมือ (register → login → /users/me → สร้าง visit → mark ownership guard → logout invalidate refresh token → /stats/me) ทำงานถูกต้องครบทุกเคส

`WEB_ORIGIN` ใน `.env` ต้องตรงกับ origin จริงของ `nihon-tabi-web` (เช่น `http://localhost:3001` ตอน dev, โดเมน Vercel จริงตอน deploy) — ใช้ตั้งค่า CORS ให้อนุญาต credentials (cookie) จาก origin นั้นเท่านั้น ผิดแล้ว refresh token cookie จะไม่ถูกส่ง/รับ

## Endpoints ที่ implement แล้ว

```
POST   /auth/register
POST   /auth/login
POST   /auth/refresh
POST   /auth/logout          (ต้องมี access token)

GET    /users/me             (ต้องมี access token)
PATCH  /users/me

GET    /geo/prefectures
GET    /geo/prefectures/:id/municipalities
GET    /geo/files/prefectures.geojson
GET    /geo/files/municipalities/:prefectureId.geojson

GET    /visits?prefectureId=&status=      (ต้องมี access token, กรองเฉพาะของ user)
POST   /visits
PATCH  /visits/:id
DELETE /visits/:id
POST   /visits/:id/photos/presign  -- ขอ presigned PUT URL ไป R2 (body: { contentType })
POST   /visits/:id/photos          -- บันทึก url หลังอัปโหลดขึ้น R2 สำเร็จแล้ว
DELETE /photos/:id

GET    /stats/me

GET    /trips                       (ต้องมี access token, เฉพาะของ user)
GET    /trips/:id
POST   /trips                       -- body: { title, startDate?, endDate?, days?: [{ dayNumber, municipalityId, note? }] }
PATCH  /trips/:id                   -- แก้ title/startDate/endDate เท่านั้น (days จัดการผ่าน endpoint แยก)
DELETE /trips/:id
POST   /trips/:id/days              -- body: { dayNumber, municipalityId, note? } — dayNumber ซ้ำในทริปเดียวกัน = 409
PATCH  /trips/:id/days/:dayId
DELETE /trips/:id/days/:dayId
```

`cityCount`/`dayCount`/`totalKm` ในทุก response ของ trip คำนวณสดจาก days จริงทุกครั้ง (ไม่ได้เก็บไว้) — `totalKm` รวมระยะทางแบบเส้นตรง (haversine) ระหว่าง centroid ของเมืองในแต่ละวันตามลำดับ `dayNumber`

ยังไม่ทำ: Swagger docs (`@nestjs/swagger`)

## Auth: refresh token

`register`/`login`/`refresh` ตั้ง refresh token เป็น httpOnly cookie (`Secure; SameSite=None; Path=/auth`) ให้อัตโนมัติ — เว็บไม่ต้องเก็บ/ส่งเองเลย (แค่ต้องเรียก fetch ด้วย `credentials: "include"`) ส่วน response body ยังมี `refreshToken` แถมมาด้วยเผื่อ client ที่ไม่มี cookie jar แบบเบราว์เซอร์ (เช่น Android ตาม SYSTEM_DESIGN.md) — `POST /auth/refresh` รับ token จาก cookie ก่อน ถ้าไม่มีค่อย fallback ไปอ่านจาก body `{ refreshToken }`

## Photo upload (Cloudflare R2)

Client (web/Android) ขอ presigned URL จาก `POST /visits/:id/photos/presign` แล้วอัปโหลดไฟล์ตรงไปที่ R2 ด้วย `PUT` (ไม่ผ่าน backend) จากนั้นเรียก `POST /visits/:id/photos` เพื่อบันทึก public URL ลง DB

ต้องตั้งค่าใน `.env` ก่อนใช้งานจริง:

```
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=...
R2_PUBLIC_URL=https://pub-xxxxxxxx.r2.dev
```

ขั้นตอนสร้างใน Cloudflare dashboard:
1. R2 → Create bucket
2. เปิด public access ของ bucket (Settings → Public access → Allow Access ผ่าน r2.dev subdomain) แล้วคัดลอก URL มาใส่ `R2_PUBLIC_URL`
3. R2 → Manage API tokens → สร้าง token ที่มีสิทธิ์ Object Read & Write เฉพาะ bucket นี้ → เอา Access Key ID / Secret Access Key มาใส่ `.env`
4. Account ID ดูได้จากมุมขวาบนของหน้า R2 overview
