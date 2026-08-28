import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { config, SHIPPABLE_COUNTRIES } from './src/config.js';
import { combineQuery, getProduct, searchCatalog } from './src/catalog-client.js';
import {
  normalizeProductCard,
  normalizeProductDetail,
  normalizeSearchResponse,
} from './src/normalize-product.js';
import {
  categoryGid,
  getCategoryBySlug,
} from './src/taxonomy.js';
import { getCategoryStatsMeta, getSortedCategories } from './src/category-stats.js';

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
    } = req.query;

    const category = categorySlug ? getCategoryBySlug(String(categorySlug)) : null;
    if (categorySlug && !category) {
      return sendJson(res, { error: 'Unknown category' }, 404);
    }

    const query = combineQuery(q ? String(q) : '');
    const parsedLimit = Math.min(Math.max(Number(limit) || 50, 1), 50);

    const raw = await searchCatalog({
      query,
      destination: to,
      categoryGid: category ? categoryGid(category.slug) : undefined,
      cursor: cursor ? String(cursor) : undefined,
      limit: parsedLimit,
    });

    if (raw.destinationBlocked) {
      return sendJson(res, {
        products: [],
        pagination: { cursor: null, hasNextPage: false, totalCount: 0 },
        destinationBlocked: true,
        message:
          'Shipping outside Canada requires a phase-2 export catalog (SHOPIFY_CATALOG_ID_EXPORT).',
      });
    }

    const normalized = normalizeSearchResponse(raw);
    sendJson(res, normalized);
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

    const raw = await searchCatalog({
      query: config.catalogQuery,
      destination: req.query.to,
      categoryGid: categoryGid(category.slug),
      limit: 1,
    });

    if (raw.destinationBlocked) {
      return sendJson(res, { tile: null, destinationBlocked: true });
    }

    const content = raw?.structuredContent ?? raw ?? {};
    const product = content.products?.[0];
    const card = product ? normalizeProductCard(product) : null;

    sendJson(res, {
      slug: category.slug,
      name: category.name,
      tile: card
        ? { image: card.image, imageAlt: card.imageAlt, title: card.title }
        : null,
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
