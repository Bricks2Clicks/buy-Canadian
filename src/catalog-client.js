import { getAccessToken } from './auth.js';
import { config, getAgentProfileUrl } from './config.js';
import { catalogSemaphore } from './concurrency.js';
import { destinationContext } from './destination.js';
import { combineQueryWithOrigin, getOriginSearchPhrases, PRIMARY_ORIGIN_PHRASE } from './origin-query.js';
import { normalizeSearchResponse } from './normalize-product.js';

let rpcId = 0;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function isRateLimited(status, body) {
  if (status === 429) return true;
  const msg = JSON.stringify(body || '').toLowerCase();
  return msg.includes('rate limit');
}

async function callCatalogTool(toolName, catalogArgs) {
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
    for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
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
        const delay = config.retryBaseMs * 2 ** attempt + Math.random() * 200;
        await sleep(delay);
        lastError = new Error('Catalog rate limit exceeded');
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

function buildSearchCatalogArgs({
  query,
  destination,
  categoryGid,
  cursor,
  limit = 50,
}) {
  const dest = destinationContext(destination);
  const filters = {
    available: true,
    ships_to: { country: dest.country },
  };
  if (categoryGid) {
    filters.categories = [categoryGid];
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

export async function searchCatalog(options) {
  const dest = destinationContext(options.destination);
  if (dest.exportRequired) {
    return {
      products: [],
      pagination: { cursor: null, hasNextPage: false, totalCount: 0 },
      destinationBlocked: true,
    };
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
 * Merge parallel catalog searches (dedupe by product id).
 * total_count uses the max estimate across phrases (union is >= max; Catalog OR is unreliable).
 */
export function mergeSearchResults(rawResults, limit) {
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

    const normalized = normalizeSearchResponse(raw);
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

/**
 * Search with each origin phrase separately, then merge (true EN ∪ FR coverage).
 * Paginated requests (cursor set) use the primary English phrase only.
 */
export async function searchCatalogOriginUnion({
  userQuery,
  destination,
  categoryGid,
  cursor,
  limit = 50,
  originPhrases = getOriginSearchPhrases(),
}) {
  const parsedLimit = Math.min(Math.max(limit, 1), 50);

  if (cursor) {
    const query = combineQueryWithOrigin(userQuery, PRIMARY_ORIGIN_PHRASE);
    const raw = await searchCatalog({
      query,
      destination,
      categoryGid,
      cursor,
      limit: parsedLimit,
    });
    if (raw.destinationBlocked) {
      return { destinationBlocked: true };
    }
    return normalizeSearchResponse(raw);
  }

  const phrases = originPhrases.length ? originPhrases : getOriginSearchPhrases();
  const rawResults = await Promise.all(
    phrases.map((phrase) => {
      const query = combineQueryWithOrigin(userQuery, phrase);
      return searchCatalog({
        query,
        destination,
        categoryGid,
        limit: parsedLimit,
      });
    }),
  );

  const merged = mergeSearchResults(rawResults, parsedLimit);
  if (merged.destinationBlocked) {
    return {
      products: [],
      pagination: { cursor: null, hasNextPage: false, totalCount: 0 },
      destinationBlocked: true,
    };
  }

  return merged;
}

/**
 * Max pagination.total_count across origin phrases (for category ranking snapshots).
 */
export async function estimateOriginUnionCount({
  userQuery,
  destination,
  categoryGid,
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
      categoryGid,
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
