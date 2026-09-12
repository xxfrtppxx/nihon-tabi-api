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
  geo/             -- prefectures, municipalities (read-only, seed จาก GADM ทีหลัง)
  visits/          -- CRUD visits + photos
  stats/           -- GET /stats/me
  prisma/          -- PrismaService, PrismaModule
prisma/
  schema.prisma
  migrations/
```

ยังไม่มี `scripts/import-geo.ts` — จะเพิ่มตอนทำ map data pipeline (ขั้นตอนที่ 2 ใน SYSTEM_DESIGN.md) ตอนนี้ `prefectures`/`municipalities` ในตารางยังว่างเปล่า

## Data model

ดูรายละเอียด entity ทั้งหมดที่ SYSTEM_DESIGN.md ส่วน "Data model (core)" — ย่อ: `users`, `prefectures`, `municipalities`, `visits`, `visit_photos`

## Map data (GADM → GeoJSON → seed)

Pipeline การแปลงข้อมูลขอบเขตจังหวัด/เมืองจาก GADM shapefile เป็น GeoJSON แล้ว seed เข้า DB อธิบายไว้ใน SYSTEM_DESIGN.md ข้อ 6 — เก็บ raw/intermediate geo files ไว้นอก git (ใน `.gitignore`) แล้ว commit เฉพาะ script + ไฟล์ simplified GeoJSON ที่ใช้จริง

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

GET    /visits?prefectureId=&status=      (ต้องมี access token, กรองเฉพาะของ user)
POST   /visits
PATCH  /visits/:id
DELETE /visits/:id
POST   /visits/:id/photos
DELETE /photos/:id

GET    /stats/me
```

ยังไม่ทำ: Swagger docs (`@nestjs/swagger`), presigned upload URL ไป Cloudflare R2 (ตอนนี้ `POST /visits/:id/photos` รับ `url` ที่อัปโหลดไว้แล้วมาบันทึกเฉยๆ), และ seed ข้อมูล prefecture/municipality จริงจาก GADM (รอ map data pipeline)
