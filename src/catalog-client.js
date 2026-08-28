import { getAccessToken } from './auth.js';
import { config, getAgentProfileUrl } from './config.js';
import { catalogSemaphore } from './concurrency.js';
import { destinationContext } from './destination.js';

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
  const base = config.catalogQuery.trim();
  const extra = (userQuery || '').trim();
  if (!extra) return base;
  if (extra.toLowerCase().includes('made in canada')) return extra;
  return `${extra} ${base}`;
}
