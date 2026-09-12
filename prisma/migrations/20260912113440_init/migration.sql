-- CreateEnum
CREATE TYPE "VisitStatus" AS ENUM ('visited', 'want_to_go');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "avatar_url" TEXT,
    "refresh_token_hash" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prefectures" (
    "id" INTEGER NOT NULL,
    "name_ja" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "centroid_lat" DOUBLE PRECISION,
    "centroid_lng" DOUBLE PRECISION,

    CONSTRAINT "prefectures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "municipalities" (
    "id" INTEGER NOT NULL,
    "prefecture_id" INTEGER NOT NULL,
    "name_ja" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "centroid_lat" DOUBLE PRECISION,
    "centroid_lng" DOUBLE PRECISION,

    CONSTRAINT "municipalities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visits" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "municipality_id" INTEGER NOT NULL,
    "status" "VisitStatus" NOT NULL,
    "visited_on" DATE,
    "note" TEXT,
    "rating" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "visits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visit_photos" (
    "id" TEXT NOT NULL,
    "visit_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "visit_photos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- AddForeignKey
ALTER TABLE "municipalities" ADD CONSTRAINT "municipalities_prefecture_id_fkey" FOREIGN KEY ("prefecture_id") REFERENCES "prefectures"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visits" ADD CONSTRAINT "visits_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visits" ADD CONSTRAINT "visits_municipality_id_fkey" FOREIGN KEY ("municipality_id") REFERENCES "municipalities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visit_photos" ADD CONSTRAINT "visit_photos_visit_id_fkey" FOREIGN KEY ("visit_id") REFERENCES "visits"("id") ON DELETE CASCADE ON UPDATE CASCADE;
