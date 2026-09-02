const KEY_PREFIX = 'buyCanadian.listing.v1.';
const INDEX_KEY = 'buyCanadian.listing.v1.index';
export const LISTING_TTL_MS = 45 * 60 * 1000;
const MAX_LISTING_KEYS = 20;
const MAX_STORED_PRODUCTS = 1000;

function queryHash(query) {
  const normalized = String(query || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
  let hash = 2166136261;
  for (let i = 0; i < normalized.length; i += 1) {
    hash ^= normalized.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function categoryListingKey(slug, destination) {
  return `${KEY_PREFIX}cat.${slug}.${destination}`;
}

export function searchListingKey(query, destination) {
  return `${KEY_PREFIX}q.${queryHash(query)}.${destination}`;
}

function readIndex() {
  try {
    const parsed = JSON.parse(localStorage.getItem(INDEX_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeIndex(index) {
  localStorage.setItem(INDEX_KEY, JSON.stringify(index));
}

function removeKey(key) {
  localStorage.removeItem(key);
  writeIndex(readIndex().filter((entry) => entry.key !== key));
}

function evictOldest() {
  const index = readIndex();
  if (!index.length) return false;
  const oldest = index.reduce((a, b) => (a.fetchedAt <= b.fetchedAt ? a : b));
  removeKey(oldest.key);
  return true;
}

function touchIndex(key, fetchedAt) {
  const index = readIndex().filter((entry) => entry.key !== key);
  index.push({ key, fetchedAt });
  index.sort((a, b) => a.fetchedAt - b.fetchedAt);
  while (index.length > MAX_LISTING_KEYS) {
    const oldest = index.shift();
    if (oldest?.key) localStorage.removeItem(oldest.key);
  }
  writeIndex(index);
}

export function readListing(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || !Array.isArray(data.products) || !data.fetchedAt) {
      removeKey(key);
      return null;
    }
    if (Date.now() - data.fetchedAt > LISTING_TTL_MS) {
      removeKey(key);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

export function writeListing(key, value) {
  const fetchedAt = Date.now();
  const payload = {
    products: (value.products || []).slice(0, MAX_STORED_PRODUCTS),
    cursor: value.cursor ?? null,
    hasNextPage: Boolean(value.hasNextPage),
    nextServerOrder: value.nextServerOrder ?? 0,
    fetchedAt,
  };
  const json = JSON.stringify(payload);

  const attemptWrite = () => {
    localStorage.setItem(key, json);
    touchIndex(key, fetchedAt);
  };

  try {
    attemptWrite();
  } catch {
    evictOldest();
    try {
      attemptWrite();
    } catch {
      /* quota still exceeded — skip persist */
    }
  }
}

export function mergeListingProducts(existing, incoming, nextServerOrder) {
  const seen = new Set(existing.map((p) => p.id));
  const products = [...existing];
  let order = nextServerOrder;
  for (const product of incoming) {
    if (!product?.id || seen.has(product.id)) continue;
    seen.add(product.id);
    products.push({ ...product, _order: order });
    order += 1;
    if (products.length >= MAX_STORED_PRODUCTS) break;
  }
  return { products, nextServerOrder: order };
}
