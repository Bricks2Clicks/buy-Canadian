import { searchCatalog } from './catalog-client.js';
import { destinationContext } from './destination.js';
import { normalizeProductCard } from './normalize-product.js';
import { getCategoryBySlug } from './taxonomy.js';
import { getOriginSearchPhrases } from './origin-query.js';

/** Homepage can request all ranked categories in one batch (live fallback only). */
export const MAX_HOME_TILES_PER_REQUEST = 20;

export function parseSlugList(slugsParam) {
  if (!slugsParam) return [];
  const seen = new Set();
  const result = [];
  for (const part of String(slugsParam).split(',')) {
    const slug = part.trim();
    if (slug && !seen.has(slug)) {
      seen.add(slug);
      result.push(slug);
    }
  }
  return result;
}

function extractPagination(raw) {
  const content = raw?.structuredContent ?? raw ?? {};
  return content.pagination ?? {};
}

function tileFromRawProduct(product, destination) {
  const expectedCurrency = destinationContext(destination).currency;
  const card = product ? normalizeProductCard(product, undefined, expectedCurrency) : null;
  if (!card?.image) return null;
  return { image: card.image, imageAlt: card.imageAlt, title: card.title };
}

function tileFromSnapshotRow(row) {
  const tile = row?.tile;
  if (!tile?.image) return null;
  return {
    image: tile.image,
    imageAlt: tile.imageAlt || tile.title || '',
    title: tile.title || '',
  };
}

/**
 * One Catalog call per phrase until a preview image is found (usually English only).
 */
export async function fetchLiveCategoryTilePreview(slug, destination) {
  const category = getCategoryBySlug(slug);
  if (!category) {
    return {
      slug,
      name: null,
      tile: null,
      destinationBlocked: false,
      unknown: true,
    };
  }

  let destinationBlocked = false;

  for (const phrase of getOriginSearchPhrases()) {
    const raw = await searchCatalog({
      query: phrase,
      destination,
      categorySlug: category.slug,
      limit: 1,
    });

    if (raw.destinationBlocked) {
      destinationBlocked = true;
      break;
    }

    const content = raw?.structuredContent ?? raw ?? {};
    const tile = tileFromRawProduct(content.products?.[0], destination);
    if (tile) {
      return {
        slug: category.slug,
        name: category.name,
        tile,
        destinationBlocked: false,
        unknown: false,
      };
    }
  }

  return {
    slug: category.slug,
    name: category.name,
    tile: null,
    destinationBlocked,
    unknown: false,
  };
}

/** Used by refresh-category-stats — count + tile in one pass (no extra API calls). */
export async function fetchCategoryOriginSnapshotRow(category, destination = 'CA') {
  let eligibleCount = 0;
  let tile = null;
  let destinationBlocked = false;

  for (const phrase of getOriginSearchPhrases()) {
    const raw = await searchCatalog({
      query: phrase,
      destination,
      categorySlug: category.slug,
      limit: 1,
    });

    if (raw.destinationBlocked) {
      destinationBlocked = true;
      break;
    }

    eligibleCount = Math.max(eligibleCount, extractPagination(raw).total_count ?? 0);

    if (!tile) {
      const content = raw?.structuredContent ?? raw ?? {};
      tile = tileFromRawProduct(content.products?.[0], destination);
    }
  }

  return {
    slug: category.slug,
    name: category.name,
    eligibleCount,
    tile,
    destinationBlocked,
  };
}

export async function fetchCategoryTilePreview(slug, destination, snapshotRow = null) {
  const fromSnapshot = tileFromSnapshotRow(snapshotRow);
  if (fromSnapshot) {
    const category = getCategoryBySlug(slug);
    return {
      slug,
      name: category?.name ?? snapshotRow?.name ?? null,
      tile: fromSnapshot,
      destinationBlocked: false,
      unknown: !category,
      source: 'snapshot',
    };
  }

  const live = await fetchLiveCategoryTilePreview(slug, destination);
  return { ...live, source: 'live' };
}

export async function fetchCategoryTilePreviews(slugs, destination, snapshotBySlug = null) {
  const tiles = {};
  const errors = [];
  let destinationBlocked = false;

  for (const slug of slugs) {
    try {
      const snapshotRow = snapshotBySlug?.get(slug) ?? null;
      const result = await fetchCategoryTilePreview(slug, destination, snapshotRow);
      tiles[result.slug] = result.unknown ? null : result.tile;
      if (result.destinationBlocked) destinationBlocked = true;
    } catch (err) {
      errors.push({ slug, message: err.message || 'Catalog request failed' });
      tiles[slug] = null;
    }
  }

  const response = { tiles, destinationBlocked };
  if (errors.length) response.errors = errors;
  return response;
}

export { tileFromSnapshotRow };
