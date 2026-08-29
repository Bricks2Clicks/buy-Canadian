import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { categoryGid, getCategoryBySlug } from './taxonomy.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const INDEX_PATH = path.join(__dirname, '..', 'data', 'taxonomy-index.json');

/** Catalog rejects requests with too many category GIDs in one filter. */
export const MAX_CATEGORY_GIDS_PER_REQUEST = 100;

let cachedIndex = null;
let cachedMtimeMs = null;

function loadIndex() {
  try {
    const stat = fs.statSync(INDEX_PATH);
    if (cachedIndex && cachedMtimeMs === stat.mtimeMs) {
      return cachedIndex;
    }
    cachedIndex = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'));
    cachedMtimeMs = stat.mtimeMs;
  } catch (err) {
    console.warn(`Taxonomy index missing (${INDEX_PATH}): ${err.message}`);
    cachedIndex = null;
    cachedMtimeMs = null;
  }
  return cachedIndex;
}

/**
 * All taxonomy GIDs for a root category (root + descendants) for Catalog filters.categories OR matching.
 */
export function getCategoryFilterGids(slug) {
  if (!getCategoryBySlug(slug)) return [];

  const index = loadIndex();
  const fromIndex = index?.roots?.[slug];
  if (fromIndex?.length) return fromIndex;

  return [categoryGid(slug)];
}

/** Split into Catalog-safe batches (max {@link MAX_CATEGORY_GIDS_PER_REQUEST} GIDs each). */
export function getCategoryFilterGidChunks(slug) {
  const gids = getCategoryFilterGids(slug);
  if (gids.length <= MAX_CATEGORY_GIDS_PER_REQUEST) return [gids];
  const chunks = [];
  for (let i = 0; i < gids.length; i += MAX_CATEGORY_GIDS_PER_REQUEST) {
    chunks.push(gids.slice(i, i + MAX_CATEGORY_GIDS_PER_REQUEST));
  }
  return chunks;
}
