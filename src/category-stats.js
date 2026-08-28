import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ROOT_CATEGORIES } from './taxonomy.js';
import { tileFromSnapshotRow } from './category-tile.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATS_PATH = path.join(__dirname, '..', 'data', 'category-stats.json');

let cachedSnapshot = null;
let cachedMtimeMs = null;

function loadSnapshotFromDisk() {
  try {
    const stat = fs.statSync(STATS_PATH);
    if (cachedSnapshot && cachedMtimeMs === stat.mtimeMs) {
      return cachedSnapshot;
    }

    const raw = fs.readFileSync(STATS_PATH, 'utf8');
    cachedSnapshot = JSON.parse(raw);
    cachedMtimeMs = stat.mtimeMs;
  } catch (err) {
    if (cachedSnapshot && cachedMtimeMs) {
      console.warn(
        `Category stats snapshot unreadable (${STATS_PATH}): ${err.message}. Using previous snapshot.`,
      );
      return cachedSnapshot;
    }

    console.warn(
      `Category stats snapshot missing or invalid (${STATS_PATH}): ${err.message}. Using static taxonomy order.`,
    );
    cachedSnapshot = null;
    cachedMtimeMs = null;
  }

  return cachedSnapshot;
}

export function getCategoryStatsSnapshot() {
  return loadSnapshotFromDisk();
}

export function getCategoryStatsMeta() {
  const snapshot = loadSnapshotFromDisk();
  return snapshot
    ? {
        rankedAt: snapshot.measuredAt ?? null,
        catalogId: snapshot.catalogId ?? null,
        query: snapshot.query ?? null,
        destination: snapshot.destination ?? null,
      }
    : { rankedAt: null };
}

export function getSnapshotTileBySlug() {
  const snapshot = loadSnapshotFromDisk();
  const map = new Map();
  if (!snapshot?.categories?.length) return map;

  for (const row of snapshot.categories) {
    const tile = tileFromSnapshotRow(row);
    if (tile) map.set(row.slug, tile);
  }
  return map;
}

export function getSortedCategories() {
  const snapshot = loadSnapshotFromDisk();

  if (snapshot?.categories?.length) {
    const known = new Map(ROOT_CATEGORIES.map((c) => [c.slug, c.name]));
    const ranked = snapshot.categories
      .filter((row) => known.has(row.slug))
      .map((row) => {
        const tile = tileFromSnapshotRow(row);
        return {
          slug: row.slug,
          name: known.get(row.slug) ?? row.name,
          ...(tile ? { tile } : {}),
        };
      });

    for (const cat of ROOT_CATEGORIES) {
      if (!ranked.some((r) => r.slug === cat.slug)) {
        ranked.push({ slug: cat.slug, name: cat.name });
      }
    }

    return ranked;
  }

  return ROOT_CATEGORIES.map(({ slug, name }) => ({ slug, name }));
}
