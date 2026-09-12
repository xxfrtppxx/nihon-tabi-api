/**
 * Seeds prefectures/municipalities from prisma/seed-data/*.json (produced by
 * scripts/map-data/process-gadm.js). Safe to re-run: upserts by id.
 */
import { PrismaClient } from "@prisma/client";
import prefectures from "../prisma/seed-data/prefectures.json";
import municipalities from "../prisma/seed-data/municipalities.json";

const prisma = new PrismaClient();

async function main() {
  for (const p of prefectures) {
    await prisma.prefecture.upsert({
      where: { id: p.id },
      create: p,
      update: p,
    });
  }
  console.log(`Seeded ${prefectures.length} prefectures`);

  for (const m of municipalities) {
    await prisma.municipality.upsert({
      where: { id: m.id },
      create: m,
      update: m,
    });
  }
  console.log(`Seeded ${municipalities.length} municipalities`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
