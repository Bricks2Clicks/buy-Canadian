import { searchCatalogOriginUnion } from './catalog-client.js';
import { normalizeProductCard } from './normalize-product.js';
import { categoryGid, getCategoryBySlug } from './taxonomy.js';
import { getOriginSearchPhrases } from './origin-query.js';

export const MAX_HOME_TILES_PER_REQUEST = 5;

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

function tileFromProduct(product) {
  const card = product ? normalizeProductCard(product) : null;
  return card
    ? { image: card.image, imageAlt: card.imageAlt, title: card.title }
    : null;
}

export async function fetchCategoryTilePreview(slug, destination) {
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

  const results = await Promise.all(
    getOriginSearchPhrases().map((phrase) =>
      searchCatalogOriginUnion({
        userQuery: '',
        destination,
        categoryGid: categoryGid(category.slug),
        limit: 1,
        originPhrases: [phrase],
      }),
    ),
  );

  for (const result of results) {
    if (result.destinationBlocked) {
      destinationBlocked = true;
      continue;
    }
    const tile = tileFromProduct(result.products?.[0]);
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

export async function fetchCategoryTilePreviews(slugs, destination) {
  const tiles = {};
  const errors = [];
  let destinationBlocked = false;

  const results = await Promise.all(
    slugs.map(async (slug) => {
      try {
        return await fetchCategoryTilePreview(slug, destination);
      } catch (err) {
        errors.push({ slug, message: err.message || 'Catalog request failed' });
        return { slug, tile: null, destinationBlocked: false, unknown: false };
      }
    }),
  );

  for (const result of results) {
    tiles[result.slug] = result.unknown ? null : result.tile;
    if (result.destinationBlocked) destinationBlocked = true;
  }

  const response = { tiles, destinationBlocked };
  if (errors.length) response.errors = errors;
  return response;
}
