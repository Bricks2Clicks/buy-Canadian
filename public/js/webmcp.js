import { getShipsTo, withShipsTo } from './app.js';

const modelContext = document.modelContext ?? navigator.modelContext;

function apiUrl(path) {
  const sep = path.includes('?') ? '&' : '?';
  return `${path}${sep}to=${encodeURIComponent(getShipsTo())}`;
}

async function apiGet(path) {
  const res = await fetch(apiUrl(path));
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return res.json();
}

function textResult(text) {
  return { content: [{ type: 'text', text }] };
}

function jsonResult(data) {
  return textResult(JSON.stringify(data, null, 2));
}

function showAgentBanner() {
  if (sessionStorage.getItem('buyCanadianAgentBannerDismissed')) return;
  const banner = document.createElement('div');
  banner.className = 'agent-banner';
  banner.innerHTML = `
    <p>This site exposes <strong>WebMCP</strong> tools for in-browser AI assistants.
       <a href="/about.html#agent-ready">Learn more</a></p>
    <button type="button" aria-label="Dismiss">×</button>`;
  banner.querySelector('button').addEventListener('click', () => {
    sessionStorage.setItem('buyCanadianAgentBannerDismissed', '1');
    banner.remove();
  });
  document.body.prepend(banner);
}

function registerTools(controller) {
  const signal = controller.signal;
  const opts = { signal };

  modelContext.registerTool(
    {
      name: 'list_categories',
      title: 'List product categories',
      description:
        'Returns Shopify root categories ranked by eligible product count (most first). Use slug values in search_products.',
      inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true },
      async execute() {
        const data = await apiGet('/api/categories');
        return jsonResult({
          rankedAt: data.rankedAt,
          categories: data.categories,
        });
      },
    },
    opts,
  );

  modelContext.registerTool(
    {
      name: 'search_products',
      title: 'Search Canadian catalog',
      description:
        'Search live in-stock products from Canadian Shopify merchants. Combines optional query with a made-in-Canada catalog filter.',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Optional search terms (e.g. coffee mug)',
          },
          category: {
            type: 'string',
            description: 'Category slug from list_categories (e.g. hg for Home & Garden)',
          },
          limit: {
            type: 'integer',
            minimum: 1,
            maximum: 20,
            description: 'Max products to return (default 10)',
          },
        },
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true },
      async execute({ query, category, limit = 10 } = {}) {
        const params = new URLSearchParams();
        if (query) params.set('q', query);
        if (category) params.set('category', category);
        params.set('limit', String(Math.min(Math.max(limit, 1), 20)));

        const data = await apiGet(`/api/catalog/search?${params}`);
        if (data.destinationBlocked) {
          return textResult(data.message || 'Destination not supported.');
        }

        return jsonResult({
          products: data.products,
          pagination: data.pagination,
        });
      },
    },
    opts,
  );

  modelContext.registerTool(
    {
      name: 'get_product_details',
      title: 'Get product details',
      description:
        'Fetch full details for one catalog product by id and optional variant id (from search_products results).',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Product id from search results' },
          variant: { type: 'string', description: 'Variant id (optional)' },
        },
        required: ['id'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true },
      async execute({ id, variant }) {
        let path = `/api/catalog/product?id=${encodeURIComponent(id)}`;
        if (variant) path += `&variant=${encodeURIComponent(variant)}`;

        const data = await apiGet(path);
        if (data.destinationBlocked) {
          return textResult(data.message || 'Destination not supported.');
        }
        if (!data.product) {
          return textResult('Product not found or out of stock.');
        }

        return jsonResult(data.product);
      },
    },
    opts,
  );

  modelContext.registerTool(
    {
      name: 'open_product_page',
      title: 'Open product page',
      description:
        'Navigate this browser tab to a product detail page on Buy Canadian so the human can review and click through to the merchant.',
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Product id' },
          variant: { type: 'string', description: 'Variant id (optional)' },
        },
        required: ['id'],
        additionalProperties: false,
      },
      async execute({ id, variant }) {
        let path = `/product.html?id=${encodeURIComponent(id)}`;
        if (variant) path += `&variant=${encodeURIComponent(variant)}`;
        const url = withShipsTo(path);
        window.location.href = url;
        return textResult(`Navigating to ${window.location.origin}${url}`);
      },
    },
    opts,
  );

  modelContext.registerTool(
    {
      name: 'open_category_page',
      title: 'Open category page',
      description:
        'Navigate this browser tab to a category listing on Buy Canadian.',
      inputSchema: {
        type: 'object',
        properties: {
          slug: {
            type: 'string',
            description: 'Category slug from list_categories',
          },
        },
        required: ['slug'],
        additionalProperties: false,
      },
      async execute({ slug }) {
        const url = withShipsTo(`/category.html?slug=${encodeURIComponent(slug)}`);
        window.location.href = url;
        return textResult(`Navigating to ${window.location.origin}${url}`);
      },
    },
    opts,
  );
}

function initWebMcp() {
  if (!modelContext?.registerTool) return;

  const controller = new AbortController();
  registerTools(controller);
  showAgentBanner();

  window.addEventListener(
    'pagehide',
    () => {
      controller.abort();
      for (const name of [
        'list_categories',
        'search_products',
        'get_product_details',
        'open_product_page',
        'open_category_page',
      ]) {
        try {
          modelContext.unregisterTool?.(name);
        } catch {
          /* ignore */
        }
      }
    },
    { once: true },
  );
}

initWebMcp();
