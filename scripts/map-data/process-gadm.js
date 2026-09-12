#!/usr/bin/env node
/**
 * Turns simplified GADM Japan GeoJSON (level 1 = prefectures, level 2 =
 * municipalities) into the files this project actually needs:
 *   - geo-data/prefectures.geojson              (polygons, properties: {id})
 *   - geo-data/municipalities/<prefectureId>.geojson
 *   - prisma/seed-data/prefectures.json          (DB rows)
 *   - prisma/seed-data/municipalities.json       (DB rows)
 *
 * Run after `mapshaper ... -o format=geojson` has produced
 * prefectures.raw.geojson / municipalities.raw.geojson (see README in this folder).
 */
const fs = require("fs");
const path = require("path");

const RAW_DIR = process.argv[2];
if (!RAW_DIR) {
  console.error("Usage: node process-gadm.js <dir with prefectures.raw.geojson + municipalities.raw.geojson>");
  process.exit(1);
}

const API_ROOT = path.join(__dirname, "..", "..");
const GEO_DATA_DIR = path.join(API_ROOT, "geo-data");
const SEED_DATA_DIR = path.join(API_ROOT, "prisma", "seed-data");

// Standard JIS prefecture codes (01-47), grouped by the usual 8-region breakdown.
const REGION_BY_JIS_CODE = {
  1: "Hokkaido",
  2: "Tohoku", 3: "Tohoku", 4: "Tohoku", 5: "Tohoku", 6: "Tohoku", 7: "Tohoku",
  8: "Kanto", 9: "Kanto", 10: "Kanto", 11: "Kanto", 12: "Kanto", 13: "Kanto", 14: "Kanto",
  15: "Chubu", 16: "Chubu", 17: "Chubu", 18: "Chubu", 19: "Chubu", 20: "Chubu", 21: "Chubu", 22: "Chubu", 23: "Chubu",
  24: "Kansai", 25: "Kansai", 26: "Kansai", 27: "Kansai", 28: "Kansai", 29: "Kansai", 30: "Kansai",
  31: "Chugoku", 32: "Chugoku", 33: "Chugoku", 34: "Chugoku", 35: "Chugoku",
  36: "Shikoku", 37: "Shikoku", 38: "Shikoku", 39: "Shikoku",
  40: "Kyushu-Okinawa", 41: "Kyushu-Okinawa", 42: "Kyushu-Okinawa", 43: "Kyushu-Okinawa",
  44: "Kyushu-Okinawa", 45: "Kyushu-Okinawa", 46: "Kyushu-Okinawa", 47: "Kyushu-Okinawa",
};

// GADM 4.1's ISO_1 field is "NA" for these two prefectures (a data gap, not
// an actual absence of an ISO code) - the real codes are well-documented.
const ISO_1_OVERRIDE_BY_NAME_1 = {
  "Hyōgo": 28,
  "Naoasaki": 42, // GADM's own typo for Nagasaki
};

// GADM 4.1 misspells this one prefecture's English name.
const NAME_1_CORRECTIONS = {
  Naoasaki: "Nagasaki",
};

const EXCLUDED_ENGTYPE_2 = new Set(["Water body", "County", "Capital"]);

const TYPE_BY_ENGTYPE_2 = {
  City: "city",
  Town: "town",
  Village: "village",
  "Special Ward": "ward",
  Subprefecture: "subprefecture",
};

function jisCodeFromIso1(iso1, name1) {
  if (iso1 && iso1 !== "NA") {
    const n = Number(iso1.split("-")[1]);
    if (Number.isInteger(n)) return n;
  }
  const override = ISO_1_OVERRIDE_BY_NAME_1[name1];
  if (override) return override;
  throw new Error(`No JIS code for prefecture "${name1}" (ISO_1="${iso1}")`);
}

function ringArea(ring) {
  let sum = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const [x0, y0] = ring[i];
    const [x1, y1] = ring[i + 1];
    sum += x0 * y1 - x1 * y0;
  }
  return sum / 2;
}

function ringCentroid(ring) {
  const area = ringArea(ring);
  if (area === 0) {
    const [sx, sy] = ring.reduce((a, p) => [a[0] + p[0], a[1] + p[1]], [0, 0]);
    return [sx / ring.length, sy / ring.length];
  }
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const [x0, y0] = ring[i];
    const [x1, y1] = ring[i + 1];
    const cross = x0 * y1 - x1 * y0;
    cx += (x0 + x1) * cross;
    cy += (y0 + y1) * cross;
  }
  return [cx / (6 * area), cy / (6 * area)];
}

// Centroid of the largest exterior ring, so a MultiPolygon of scattered
// islands centers on its main landmass instead of open water.
function featureCentroid(geometry) {
  const polygons = geometry.type === "MultiPolygon" ? geometry.coordinates : [geometry.coordinates];
  let best = null;
  let bestArea = -Infinity;
  for (const rings of polygons) {
    const exterior = rings[0];
    const area = Math.abs(ringArea(exterior));
    if (area > bestArea) {
      bestArea = area;
      best = exterior;
    }
  }
  const [lng, lat] = ringCentroid(best);
  return { lat: Math.round(lat * 1e5) / 1e5, lng: Math.round(lng * 1e5) / 1e5 };
}

function readGeoJSON(file) {
  return JSON.parse(fs.readFileSync(path.join(RAW_DIR, file), "utf8"));
}

function main() {
  fs.mkdirSync(GEO_DATA_DIR, { recursive: true });
  fs.mkdirSync(path.join(GEO_DATA_DIR, "municipalities"), { recursive: true });
  fs.mkdirSync(SEED_DATA_DIR, { recursive: true });

  const prefecturesRaw = readGeoJSON("prefectures.raw.geojson");
  const municipalitiesRaw = readGeoJSON("municipalities.raw.geojson");

  const prefectureSeed = [];
  const prefectureFeatures = [];
  const jisCodeByName1 = new Map();

  for (const feature of prefecturesRaw.features) {
    const { NAME_1, NL_NAME_1, ISO_1 } = feature.properties;
    const id = jisCodeFromIso1(ISO_1, NAME_1);
    jisCodeByName1.set(NAME_1, id);
    const { lat, lng } = featureCentroid(feature.geometry);
    prefectureSeed.push({
      id,
      nameJa: NL_NAME_1,
      nameEn: NAME_1_CORRECTIONS[NAME_1] ?? NAME_1,
      region: REGION_BY_JIS_CODE[id],
      centroidLat: lat,
      centroidLng: lng,
    });
    prefectureFeatures.push({
      type: "Feature",
      properties: { id },
      geometry: feature.geometry,
    });
  }

  prefectureSeed.sort((a, b) => a.id - b.id);
  prefectureFeatures.sort((a, b) => a.properties.id - b.properties.id);

  fs.writeFileSync(
    path.join(GEO_DATA_DIR, "prefectures.geojson"),
    JSON.stringify({ type: "FeatureCollection", features: prefectureFeatures }),
  );
  fs.writeFileSync(
    path.join(SEED_DATA_DIR, "prefectures.json"),
    JSON.stringify(prefectureSeed, null, 2),
  );

  const municipalitySeed = [];
  const municipalityFeaturesByPrefecture = new Map();
  const localIndexByPrefecture = new Map();
  let skipped = 0;

  for (const feature of municipalitiesRaw.features) {
    const { NAME_1, NAME_2, NL_NAME_2, ENGTYPE_2 } = feature.properties;
    if (EXCLUDED_ENGTYPE_2.has(ENGTYPE_2)) {
      skipped++;
      continue;
    }
    const prefectureId = jisCodeByName1.get(NAME_1);
    if (!prefectureId) throw new Error(`Unknown prefecture "${NAME_1}" for municipality "${NAME_2}"`);

    const localIndex = (localIndexByPrefecture.get(prefectureId) ?? 0) + 1;
    localIndexByPrefecture.set(prefectureId, localIndex);
    const id = prefectureId * 1000 + localIndex;

    const { lat, lng } = featureCentroid(feature.geometry);
    municipalitySeed.push({
      id,
      prefectureId,
      nameJa: NL_NAME_2,
      nameEn: NAME_2,
      type: TYPE_BY_ENGTYPE_2[ENGTYPE_2] ?? "other",
      centroidLat: lat,
      centroidLng: lng,
    });

    const list = municipalityFeaturesByPrefecture.get(prefectureId) ?? [];
    list.push({ type: "Feature", properties: { id }, geometry: feature.geometry });
    municipalityFeaturesByPrefecture.set(prefectureId, list);
  }

  municipalitySeed.sort((a, b) => a.id - b.id);
  fs.writeFileSync(
    path.join(SEED_DATA_DIR, "municipalities.json"),
    JSON.stringify(municipalitySeed, null, 2),
  );

  for (const [prefectureId, features] of municipalityFeaturesByPrefecture) {
    features.sort((a, b) => a.properties.id - b.properties.id);
    fs.writeFileSync(
      path.join(GEO_DATA_DIR, "municipalities", `${prefectureId}.geojson`),
      JSON.stringify({ type: "FeatureCollection", features }),
    );
  }

  console.log(`prefectures: ${prefectureSeed.length}`);
  console.log(`municipalities: ${municipalitySeed.length} (skipped ${skipped} non-municipality records: water bodies, counties, etc.)`);
}

main();
