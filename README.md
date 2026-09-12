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

ดูรายละเอียด entity ทั้งหมดที่ SYSTEM_DESIGN.md ส่วน "Data model (core)" — ย่อ: `users`, `prefectures`, `municipalities`, `visits`, `visit_photos`

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
POST   /visits/:id/photos
DELETE /photos/:id

GET    /stats/me
```

ยังไม่ทำ: Swagger docs (`@nestjs/swagger`), presigned upload URL ไป Cloudflare R2 (ตอนนี้ `POST /visits/:id/photos` รับ `url` ที่อัปโหลดไว้แล้วมาบันทึกเฉยๆ)
