/** In-flight request coalescing. Not a result cache — the map entry is deleted when the live call finishes. */
const inflight = new Map();

export function singleFlight(key, fn) {
  const existing = inflight.get(key);
  if (existing) return existing;

  const pending = Promise.resolve()
    .then(fn)
    .finally(() => {
      inflight.delete(key);
    });

  inflight.set(key, pending);
  return pending;
}

export function searchInflightKey({
  categorySlug = '',
  query = '',
  cursor = '',
  destination = 'CA',
  limit = 50,
  priceMin = '',
  priceMax = '',
}) {
  return [
    'search',
    categorySlug,
    query,
    cursor,
    destination,
    limit,
    priceMin,
    priceMax,
  ].join('\0');
}

export function productInflightKey({ id, destination = 'CA', variant = '' }) {
  return ['product', id, destination, variant].join('\0');
}
