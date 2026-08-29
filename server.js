import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { config, SHIPPABLE_COUNTRIES } from './src/config.js';
import { getProduct, searchCatalogOriginUnion } from './src/catalog-client.js';
import {
  normalizeProductDetail,
} from './src/normalize-product.js';
import {
  getCategoryBySlug,
} from './src/taxonomy.js';
import { getCategoryStatsMeta, getCategoryStatsSnapshot, getSortedCategories } from './src/category-stats.js';
import {
  fetchCategoryTilePreview,
  fetchCategoryTilePreviews,
  MAX_HOME_TILES_PER_REQUEST,
  parseSlugList,
} from './src/category-tile.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

const NO_STORE = {
  'Cache-Control': 'no-store, no-cache, must-revalidate',
  Pragma: 'no-cache',
};

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function sendJson(res, payload, status = 200) {
  res.status(status).set(NO_STORE).json(payload);
}

function handleApiError(res, err) {
  console.error(err);
  sendJson(res, { error: err.message || 'Catalog request failed' }, 502);
}

/** Parse price filter param (minor currency units). Returns undefined if omitted, null if invalid. */
function parsePriceCents(value) {
  if (value == null || value === '') return undefined;
  const n = Number(value);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) return null;
  return n;
}

app.get('/api/health', (_req, res) => {
  sendJson(res, { ok: true });
});

app.get('/api/categories', (_req, res) => {
  const meta = getCategoryStatsMeta();
  sendJson(res, {
    categories: getSortedCategories(),
    rankedAt: meta.rankedAt,
  });
});

app.get('/api/config', (_req, res) => {
  sendJson(res, {
    utmSource: config.utmSource,
    defaultQuery: config.catalogQuery,
    shippableCountries: SHIPPABLE_COUNTRIES,
    exportCatalogConfigured: Boolean(config.catalogIdExport),
    maxHomeTilesPerRequest: MAX_HOME_TILES_PER_REQUEST,
  });
});

app.get('/api/catalog/search', async (req, res) => {
  try {
    const {
      q,
      category: categorySlug,
      cursor,
      to,
      limit = '50',
      priceMin: priceMinRaw,
      priceMax: priceMaxRaw,
    } = req.query;

    const category = categorySlug ? getCategoryBySlug(String(categorySlug)) : null;
    if (categorySlug && !category) {
      return sendJson(res, { error: 'Unknown category' }, 404);
    }

    const priceMin = parsePriceCents(priceMinRaw);
    const priceMax = parsePriceCents(priceMaxRaw);
    if (priceMin === null || priceMax === null) {
      return sendJson(res, { error: 'Invalid priceMin or priceMax' }, 400);
    }
    if (priceMin != null && priceMax != null && priceMin > priceMax) {
      return sendJson(res, { error: 'priceMin cannot exceed priceMax' }, 400);
    }

    const query = q ? String(q) : '';
    const parsedLimit = Math.min(Math.max(Number(limit) || 50, 1), 50);

    const normalized = await searchCatalogOriginUnion({
      userQuery: query,
      destination: to,
      categorySlug: category ? category.slug : undefined,
      cursor: cursor ? String(cursor) : undefined,
      limit: parsedLimit,
      priceMin,
      priceMax,
    });

    if (normalized.destinationBlocked) {
      return sendJson(res, {
        products: [],
        pagination: { cursor: null, hasNextPage: false, totalCount: 0 },
        destinationBlocked: true,
        message:
          'Shipping outside Canada requires a phase-2 export catalog (SHOPIFY_CATALOG_ID_EXPORT).',
      });
    }

    sendJson(res, normalized);
  } catch (err) {
    handleApiError(res, err);
  }
});

app.get('/api/catalog/home-tiles', async (req, res) => {
  try {
    const slugs = parseSlugList(req.query.slugs);
    if (!slugs.length) {
      return sendJson(res, { error: 'Missing or empty slugs' }, 400);
    }
    if (slugs.length > MAX_HOME_TILES_PER_REQUEST) {
      return sendJson(
        res,
        { error: `At most ${MAX_HOME_TILES_PER_REQUEST} slugs per request` },
        400,
      );
    }

    const snapshot = getCategoryStatsSnapshot();
    const snapshotBySlug = new Map(snapshot?.categories?.map((row) => [row.slug, row]) ?? []);

    const result = await fetchCategoryTilePreviews(slugs, req.query.to, snapshotBySlug);
    sendJson(res, result);
  } catch (err) {
    handleApiError(res, err);
  }
});

app.get('/api/catalog/tile/:slug', async (req, res) => {
  try {
    const category = getCategoryBySlug(req.params.slug);
    if (!category) {
      return sendJson(res, { error: 'Unknown category' }, 404);
    }

    const result = await fetchCategoryTilePreview(category.slug, req.query.to);

    sendJson(res, {
      slug: category.slug,
      name: category.name,
      tile: result.tile,
      destinationBlocked: result.destinationBlocked,
    });
  } catch (err) {
    handleApiError(res, err);
  }
});

app.get('/api/catalog/product', async (req, res) => {
  try {
    const { id, to, variant } = req.query;
    if (!id) {
      return sendJson(res, { error: 'Missing product id' }, 400);
    }

    const selected = variant
      ? [{ id: String(id), variant_id: String(variant) }]
      : [{ id: String(id) }];

    const raw = await getProduct({
      id: String(id),
      destination: to,
      selected,
    });

    if (raw.destinationBlocked) {
      return sendJson(res, {
        product: null,
        destinationBlocked: true,
        message:
          'Shipping outside Canada requires a phase-2 export catalog (SHOPIFY_CATALOG_ID_EXPORT).',
      });
    }

    const detail = normalizeProductDetail(raw.product);
    if (!detail) {
      return sendJson(res, { error: 'Product unavailable or out of stock' }, 404);
    }

    sendJson(res, { product: detail });
  } catch (err) {
    handleApiError(res, err);
  }
});

app.use((_req, res) => {
  res.status(404).sendFile(path.join(__dirname, 'public', 'index.html'));
});

export default app;

if (!process.env.VERCEL) {
  app.listen(config.port, () => {
    console.log(`Buy Canadian running at ${config.publicBaseUrl}`);
  });
}
