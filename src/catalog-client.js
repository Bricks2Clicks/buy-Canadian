import { getAccessToken } from './auth.js';
import { config, getAgentProfileUrl } from './config.js';
import { catalogSemaphore } from './concurrency.js';
import { destinationContext } from './destination.js';
import { combineQueryWithOrigin, getOriginSearchPhrases, PRIMARY_ORIGIN_PHRASE } from './origin-query.js';
import { matchesExpectedCurrency, normalizeProductCard, normalizeSearchResponse } from './normalize-product.js';
import { getCategoryFilterGidChunks, getCategoryFilterGids } from './taxonomy-index.js';

let rpcId = 0;

/** Cap taxonomy-chunk MCP calls per search so large roots cannot fire dozens of tools. */
export const MAX_CHUNKS_PER_REQUEST = 6;

export class CatalogRateLimitError extends Error {
  constructor(message = 'The catalog is busy. Please try again in a moment.') {
    super(message);
    this.name = 'CatalogRateLimitError';
    this.status = 429;
    this.code = 'rate_limited';
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export function isRateLimited(status, body) {
  if (status === 429) return true;
  const products =
    body?.result?.structuredContent?.products ??
    body?.result?.products ??
    body?.products;
  if (status < 400 && Array.isArray(products) && products.length > 0) {
    return false;
  }
  const parts = [];
  if (body?.error) parts.push(body.error);
  if (body?.result?.isError) parts.push(body.result);
  if (typeof body?.message === 'string') parts.push(body.message);
  if (!parts.length) return false;
  const msg = JSON.stringify(parts).toLowerCase();
  return (
    msg.includes('rate limit') ||
    msg.includes('throttl') ||
    msg.includes('too many request') ||
    msg.includes('catalog limit') ||
    msg.includes('query limit')
  );
}

async function callCatalogTool(toolName, catalogArgs, { maxRetries = config.maxRetries } = {}) {
  return catalogSemaphore.run(async () => {
    const token = await getAccessToken();
    const body = {
      jsonrpc: '2.0',
      method: 'tools/call',
      id: ++rpcId,
      params: {
        name: toolName,
        arguments: {
          meta: {
            'ucp-agent': {
              profile: getAgentProfileUrl(),
            },
          },
          catalog: catalogArgs,
        },
      },
    };

    let lastError;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const res = await fetch(config.catalogMcpUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      const data = await res.json().catch(() => ({}));

      if (isRateLimited(res.status, data)) {
        lastError = new CatalogRateLimitError();
        if (attempt >= maxRetries) break;
        const delay = config.retryBaseMs * 2 ** attempt + Math.random() * 200;
        await sleep(delay);
        continue;
      }

      if (data.error) {
        throw new Error(data.error.message || JSON.stringify(data.error));
      }

      if (data.result?.isError) {
        throw new Error(JSON.stringify(data.result));
      }

      return data.result;
    }

    throw lastError || new Error('Catalog request failed after retries');
  });
}

/**
 * v2 fill cursor: { v:2, next, resume }
 * next = chunk index to continue; resume = Catalog cursor for that chunk (or null to start it).
 * v1 { v:1, c:[] } and bare strings are accepted for in-flight clients.
 */
export function decodeFillState(cursor, chunkCount) {
  if (!cursor) return { next: 0, resume: undefined };
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    if (parsed?.v === 2 && Number.isInteger(parsed.next)) {
      return {
        next: Math.max(0, parsed.next),
        resume: parsed.resume || undefined,
      };
    }
    if (parsed?.v === 1 && Array.isArray(parsed.c)) {
      const idx = parsed.c.findIndex((c) => c);
      if (idx === -1) return { next: chunkCount, resume: undefined };
      return { next: idx, resume: parsed.c[idx] };
    }
  } catch {
    /* legacy single-chunk cursor */
  }
  return { next: 0, resume: cursor };
}

export function encodeFillState(next, resume, chunkCount) {
  const hasMoreChunks = next < chunkCount;
  const hasResume = Boolean(resume);
  if (!hasMoreChunks && !hasResume) return null;
  return Buffer.from(
    JSON.stringify({ v: 2, next, resume: resume || null }),
  ).toString('base64url');
}

function buildSearchCatalogArgs({
  query,
  destination,
  categorySlug,
  categoryGids,
  cursor,
  limit = 50,
  priceMin,
  priceMax,
}) {
  const dest = destinationContext(destination);
  const filters = {
    available: true,
    ships_to: { country: dest.country },
  };
  const gids =
    categoryGids ??
    (categorySlug ? getCategoryFilterGids(categorySlug) : null);
  if (gids?.length) {
    filters.categories = gids;
  }
  if (priceMin != null || priceMax != null) {
    filters.price = {};
    if (priceMin != null) filters.price.min = priceMin;
    if (priceMax != null) filters.price.max = priceMax;
  }

  const args = {
    query: query || config.catalogQuery,
    catalog_id: dest.catalogId,
    context: {
      address_country: dest.country,
      currency: dest.currency,
    },
    filters,
    pagination: {
      limit: Math.min(Math.max(limit, 1), 50),
    },
  };

  if (cursor) {
    args.pagination.cursor = cursor;
  }

  return args;
}

function extractChunkContent(raw) {
  return raw?.structuredContent ?? raw ?? {};
}

/**
 * Walk taxonomy GID chunks until `limit` unique destination-currency products
 * are filled, instead of querying every chunk in parallel.
 */
async function searchCatalogChunked(options) {
  const chunks = getCategoryFilterGidChunks(options.categorySlug);
  const dest = destinationContext(options.destination);
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 50);
  const state = decodeFillState(options.cursor, chunks.length);

  const seen = new Set();
  const products = [];
  let maxTotalCount = 0;
  let chunkIndex = state.next;
  let resume = state.resume;
  let chunksThisRequest = 0;

  while (products.length < limit && chunkIndex < chunks.length) {
    if (chunksThisRequest >= MAX_CHUNKS_PER_REQUEST) break;

    const remaining = limit - products.length;
    let raw;
    try {
      raw = await callCatalogTool(
        'search_catalog',
        buildSearchCatalogArgs({
          ...options,
          categorySlug: undefined,
          categoryGids: chunks[chunkIndex],
          cursor: resume,
          limit: Math.min(Math.max(remaining, 1), 50),
        }),
        { maxRetries: products.length > 0 ? 0 : config.maxRetries },
      );
    } catch (err) {
      if (err instanceof CatalogRateLimitError && products.length > 0) {
        break;
      }
      throw err;
    }
    chunksThisRequest += 1;

    const content = extractChunkContent(raw);
    const pagination = content.pagination ?? {};
    if (typeof pagination.total_count === 'number') {
      maxTotalCount = Math.max(maxTotalCount, pagination.total_count);
    }

    for (const product of content.products ?? []) {
      if (seen.has(product.id)) continue;
      if (!normalizeProductCard(product, undefined, dest.currency)) continue;
      seen.add(product.id);
      products.push(product);
      if (products.length >= limit) break;
    }

    if (pagination.has_next_page && pagination.cursor) {
      resume = pagination.cursor;
      if (products.length >= limit) break;
      continue;
    }

    resume = undefined;
    chunkIndex += 1;
  }

  const nextCursor = encodeFillState(chunkIndex, resume, chunks.length);

  return {
    structuredContent: {
      products,
      pagination: {
        cursor: nextCursor,
        has_next_page: Boolean(nextCursor),
        total_count: maxTotalCount || null,
      },
    },
    destinationBlocked: false,
  };
}

export async function searchCatalog(options) {
  const dest = destinationContext(options.destination);
  if (dest.exportRequired) {
    return {
      products: [],
      pagination: { cursor: null, hasNextPage: false, totalCount: 0 },
      destinationBlocked: true,
    };
  }

  if (options.categorySlug && getCategoryFilterGidChunks(options.categorySlug).length > 1) {
    return searchCatalogChunked(options);
  }

  const result = await callCatalogTool(
    'search_catalog',
    buildSearchCatalogArgs(options),
  );
  return { ...result, destinationBlocked: false };
}

export async function getProduct({ id, destination, selected }) {
  const dest = destinationContext(destination);
  if (dest.exportRequired) {
    return { destinationBlocked: true, product: null };
  }

  const args = {
    id,
    context: {
      address_country: dest.country,
      currency: dest.currency,
    },
    filters: {
      available: true,
      ships_to: { country: dest.country },
    },
  };

  if (selected?.length) {
    args.selected = selected;
  }

  const result = await callCatalogTool('get_product', args);
  const content = result?.structuredContent ?? result ?? {};
  return {
    product: content.product || content,
    destinationBlocked: false,
  };
}

export function combineQuery(userQuery) {
  return combineQueryWithOrigin(userQuery, PRIMARY_ORIGIN_PHRASE);
}

function extractPagination(raw) {
  const content = raw?.structuredContent ?? raw ?? {};
  return content.pagination ?? {};
}

/**
 * Merge catalog searches (dedupe by product id).
 * total_count uses the max estimate across phrases (union is >= max; Catalog OR is unreliable).
 */
export function mergeSearchResults(rawResults, limit, expectedCurrency) {
  const seen = new Set();
  const products = [];
  let maxTotalCount = 0;
  let hasNextPage = false;
  let primaryCursor = null;

  for (let i = 0; i < rawResults.length; i++) {
    const raw = rawResults[i];
    if (raw.destinationBlocked) {
      return { destinationBlocked: true };
    }

    const normalized = normalizeSearchResponse(raw, undefined, expectedCurrency);
    const total = normalized.pagination.totalCount;
    if (typeof total === 'number') {
      maxTotalCount = Math.max(maxTotalCount, total);
    }
    if (normalized.pagination.hasNextPage) hasNextPage = true;
    if (i === 0) primaryCursor = normalized.pagination.cursor;

    for (const product of normalized.products) {
      if (seen.has(product.id)) continue;
      seen.add(product.id);
      products.push(product);
    }
  }

  return {
    destinationBlocked: false,
    products: products.slice(0, limit),
    pagination: {
      cursor: primaryCursor,
      hasNextPage,
      totalCount: maxTotalCount || null,
    },
  };
}

export function parseOriginPass(value) {
  const v = String(value || 'all').toLowerCase();
  if (v === 'en' || v === 'primary' || v === 'english') return 'en';
  if (v === 'fr' || v === 'secondary' || v === 'french') return 'fr';
  return 'all';
}

function originUnionPayload(products, pagination, expectedCurrency, parsedLimit) {
  return {
    destinationBlocked: false,
    products: products
      .filter((p) => matchesExpectedCurrency(p.currency, expectedCurrency))
      .slice(0, parsedLimit),
    pagination,
  };
}

/**
 * Merge secondary origin phrases into `products`. A 429 on a later phrase keeps
 * whatever was already collected instead of failing the whole listing.
 */
async function mergeSecondaryOriginPhrases({
  phrases,
  userQuery,
  destination,
  categorySlug,
  parsedLimit,
  priceFilter,
  expectedCurrency,
  products,
  seen,
  maxTotalCount,
}) {
  let total = maxTotalCount;
  for (const phrase of phrases) {
    if (products.length >= parsedLimit) break;
    let raw;
    try {
      raw = await searchCatalog({
        query: combineQueryWithOrigin(userQuery, phrase),
        destination,
        categorySlug,
        limit: parsedLimit,
        ...priceFilter,
      });
    } catch (err) {
      if (err instanceof CatalogRateLimitError) {
        break;
      }
      throw err;
    }
    if (raw.destinationBlocked) {
      break;
    }
    const extra = normalizeSearchResponse(raw, undefined, expectedCurrency);
    if (typeof extra.pagination.totalCount === 'number') {
      total =
        typeof total === 'number'
          ? Math.max(total, extra.pagination.totalCount)
          : extra.pagination.totalCount;
    }
    for (const product of extra.products) {
      if (seen.has(product.id)) continue;
      seen.add(product.id);
      products.push(product);
      if (products.length >= parsedLimit) break;
    }
  }
  return total;
}

/**
 * Search English first; add French only if the page is still short of `limit`.
 * Paginated requests (cursor set) use the primary English phrase only.
 *
 * `originPass`: `en` skips French, `fr` runs French only (for a follow-up
 * request after English is already on screen), `all` keeps the combined path
 * used by WebMCP. French 429s never discard English products.
 */
export async function searchCatalogOriginUnion({
  userQuery,
  destination,
  categorySlug,
  cursor,
  limit = 50,
  priceMin,
  priceMax,
  originPhrases = getOriginSearchPhrases(),
  originPass: originPassRaw = 'all',
}) {
  const parsedLimit = Math.min(Math.max(limit, 1), 50);
  const originPass = parseOriginPass(originPassRaw);
  const priceFilter = { priceMin, priceMax };
  const dest = destinationContext(destination);
  const expectedCurrency = dest.currency;
  const phrases = originPhrases.length ? originPhrases : getOriginSearchPhrases();
  const [primary, ...rest] = phrases;

  if (cursor && originPass !== 'fr') {
    const query = combineQueryWithOrigin(userQuery, PRIMARY_ORIGIN_PHRASE);
    const raw = await searchCatalog({
      query,
      destination,
      categorySlug,
      cursor,
      limit: parsedLimit,
      ...priceFilter,
    });
    if (raw.destinationBlocked) {
      return { destinationBlocked: true };
    }
    return normalizeSearchResponse(raw, undefined, expectedCurrency);
  }

  if (originPass === 'fr') {
    const products = [];
    const seen = new Set();
    const maxTotalCount = await mergeSecondaryOriginPhrases({
      phrases: rest,
      userQuery,
      destination,
      categorySlug,
      parsedLimit,
      priceFilter,
      expectedCurrency,
      products,
      seen,
      maxTotalCount: null,
    });
    return originUnionPayload(
      products,
      {
        cursor: null,
        hasNextPage: false,
        totalCount: maxTotalCount ?? null,
      },
      expectedCurrency,
      parsedLimit,
    );
  }

  const firstRaw = await searchCatalog({
    query: combineQueryWithOrigin(userQuery, primary),
    destination,
    categorySlug,
    limit: parsedLimit,
    ...priceFilter,
  });
  if (firstRaw.destinationBlocked) {
    return {
      products: [],
      pagination: { cursor: null, hasNextPage: false, totalCount: 0 },
      destinationBlocked: true,
    };
  }

  const first = normalizeSearchResponse(firstRaw, undefined, expectedCurrency);
  const seen = new Set(first.products.map((p) => p.id));
  const products = [...first.products];
  let maxTotalCount = first.pagination.totalCount;

  if (originPass !== 'en' && products.length < parsedLimit) {
    maxTotalCount = await mergeSecondaryOriginPhrases({
      phrases: rest,
      userQuery,
      destination,
      categorySlug,
      parsedLimit,
      priceFilter,
      expectedCurrency,
      products,
      seen,
      maxTotalCount,
    });
  }

  return originUnionPayload(
    products,
    {
      cursor: first.pagination.cursor,
      hasNextPage: Boolean(first.pagination.hasNextPage),
      totalCount: maxTotalCount ?? null,
    },
    expectedCurrency,
    parsedLimit,
  );
}

/**
 * Max pagination.total_count across origin phrases (for category ranking snapshots).
 */
export async function estimateOriginUnionCount({
  userQuery,
  destination,
  categorySlug,
  originPhrases = getOriginSearchPhrases(),
}) {
  const phrases = originPhrases.length ? originPhrases : getOriginSearchPhrases();
  let maxCount = 0;
  let destinationBlocked = false;

  for (const phrase of phrases) {
    const query = combineQueryWithOrigin(userQuery, phrase);
    const raw = await searchCatalog({
      query,
      destination,
      categorySlug,
      limit: 1,
    });
    if (raw.destinationBlocked) {
      destinationBlocked = true;
      break;
    }
    const pagination = extractPagination(raw);
    maxCount = Math.max(maxCount, pagination.total_count ?? 0);
  }

  return { eligibleCount: maxCount, destinationBlocked };
}
