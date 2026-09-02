import assert from 'node:assert/strict';
import { ORIGIN_SEARCH_PHRASES, getOriginSearchPhrases } from '../src/origin-query.js';
import {
  CatalogRateLimitError,
  decodeFillState,
  encodeFillState,
  isRateLimited,
  MAX_CHUNKS_PER_REQUEST,
  parseOriginPass,
} from '../src/catalog-client.js';
import { matchesExpectedCurrency, normalizeProductCard } from '../src/normalize-product.js';
import { singleFlight } from '../src/inflight.js';
import { catalogSemaphore } from '../src/concurrency.js';
import { config } from '../src/config.js';
import { mergeListingProducts } from '../public/js/listing-store.js';

assert.equal(ORIGIN_SEARCH_PHRASES.length, 2);
assert.equal(ORIGIN_SEARCH_PHRASES[0], 'made in Canada');
assert.equal(ORIGIN_SEARCH_PHRASES[1], 'fabriqué au Canada');
assert.deepEqual(getOriginSearchPhrases(), ORIGIN_SEARCH_PHRASES);

assert.equal(MAX_CHUNKS_PER_REQUEST, 6);
assert.equal(catalogSemaphore.max, config.maxConcurrency);

const encoded = encodeFillState(3, 'abc', 10);
const decoded = decodeFillState(encoded, 10);
assert.equal(decoded.next, 3);
assert.equal(decoded.resume, 'abc');
assert.equal(encodeFillState(10, undefined, 10), null);
assert.deepEqual(decodeFillState(null, 10), { next: 0, resume: undefined });

assert.equal(isRateLimited(429, {}), true);
assert.equal(isRateLimited(200, { error: { message: 'Rate limit exceeded' } }), true);
assert.equal(isRateLimited(200, { error: { message: 'catalog limit' } }), true);
assert.equal(isRateLimited(200, { ok: true }), false);
assert.equal(
  isRateLimited(200, {
    result: {
      structuredContent: {
        products: [{ description: 'lower exhaust gas temperatures improve throttle response' }],
      },
    },
  }),
  false,
);
assert.equal(new CatalogRateLimitError().status, 429);
assert.equal(parseOriginPass(), 'all');
assert.equal(parseOriginPass('en'), 'en');
assert.equal(parseOriginPass('french'), 'fr');

assert.equal(matchesExpectedCurrency('USD', 'CAD'), false);
assert.equal(matchesExpectedCurrency('CAD', 'CAD'), true);
assert.equal(matchesExpectedCurrency(undefined, 'CAD'), true);

const usdProduct = {
  id: 'p1',
  title: 'Indigo USD',
  variants: [
    {
      id: 'v1',
      availability: { available: true },
      price: { amount: 1299, currency: 'USD' },
    },
  ],
};
assert.equal(normalizeProductCard(usdProduct, undefined, 'CAD'), null);
assert.ok(normalizeProductCard(usdProduct, undefined, 'USD'));

const ratedCad = {
  id: 'p2',
  title: 'Rated CAD',
  rating: { value: 4.9, scale_min: 1, scale_max: 5, count: 99 },
  variants: [
    {
      id: 'v2',
      availability: { available: true },
      price: { amount: 5195, currency: 'CAD' },
    },
  ],
};
assert.deepEqual(normalizeProductCard(ratedCad, undefined, 'CAD').rating, {
  value: 4.9,
  count: 99,
  scale_min: 1,
  scale_max: 5,
});
assert.equal(
  normalizeProductCard(
    { ...ratedCad, rating: { value: 5, count: 0 } },
    undefined,
    'CAD',
  ).rating,
  undefined,
);

const merged = mergeListingProducts(
  [{ id: 'a', _order: 0 }],
  [{ id: 'a' }, { id: 'b' }],
  1,
);
assert.deepEqual(
  merged.products.map((p) => p.id),
  ['a', 'b'],
);
assert.equal(merged.nextServerOrder, 2);

let starts = 0;
const slow = () => {
  starts += 1;
  return new Promise((resolve) => setTimeout(() => resolve('ok'), 20));
};
const [a, b] = await Promise.all([singleFlight('k', slow), singleFlight('k', slow)]);
assert.equal(a, 'ok');
assert.equal(b, 'ok');
assert.equal(starts, 1);

console.log('verify-efficiency: ok');
