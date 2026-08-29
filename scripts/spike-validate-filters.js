/**
 * One-off validation spike: price filter, seller.links, seller field inventory.
 * Run: node scripts/spike-validate-filters.js
 */
import 'dotenv/config';
import { getAccessToken } from '../src/auth.js';
import { config, getAgentProfileUrl } from '../src/config.js';
import { combineQueryWithOrigin, PRIMARY_ORIGIN_PHRASE } from '../src/origin-query.js';
import { getCategoryFilterGids } from '../src/taxonomy-index.js';

async function rawSearch({ categorySlug, priceMin, priceMax, limit = 10 }) {
  const token = await getAccessToken();
  const query = combineQueryWithOrigin('', PRIMARY_ORIGIN_PHRASE);

  const filters = {
    available: true,
    ships_to: { country: 'CA' },
    categories: getCategoryFilterGids(categorySlug),
  };
  if (priceMin != null || priceMax != null) {
    filters.price = {};
    if (priceMin != null) filters.price.min = priceMin;
    if (priceMax != null) filters.price.max = priceMax;
  }

  const body = {
    jsonrpc: '2.0',
    method: 'tools/call',
    id: 1,
    params: {
      name: 'search_catalog',
      arguments: {
        meta: { 'ucp-agent': { profile: getAgentProfileUrl() } },
        catalog: {
          query,
          catalog_id: config.catalogIdCa,
          context: { address_country: 'CA', currency: 'CAD' },
          filters,
          pagination: { limit },
        },
      },
    },
  };

  const res = await fetch(config.catalogMcpUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
  if (data.result?.isError) throw new Error(JSON.stringify(data.result));

  return data.result?.structuredContent ?? data.result ?? {};
}

function collectSellerKeys(products) {
  const keys = new Set();
  for (const p of products) {
    for (const v of p.variants || []) {
      const s = v.seller;
      if (!s) continue;
      for (const k of Object.keys(s)) keys.add(k);
    }
  }
  return [...keys].sort();
}

function analyzeProducts(products) {
  const linkTypes = {};
  let withShippingPolicy = 0;
  let sellersWithLinks = 0;
  const extraSellerFields = [];
  const knownSellerKeys = new Set(['name', 'id', 'domain', 'url', 'links']);
  const prices = [];
  const freeShippingInText = [];

  for (const p of products) {
    const desc =
      p.description?.plain ??
      p.description?.html ??
      (typeof p.description === 'string' ? p.description : '');
    const usps = p.metadata?.unique_selling_points || [];
    const textBlob = [p.title, desc, ...usps].join(' ').toLowerCase();
    if (/free shipping/i.test(textBlob)) {
      freeShippingInText.push(p.title);
    }

    const minAmt = p.price_range?.min?.amount;
    const cur = p.price_range?.min?.currency;
    if (minAmt != null) prices.push({ title: p.title, amount: minAmt, currency: cur });

    for (const v of p.variants || []) {
      const s = v.seller;
      if (!s) continue;
      for (const k of Object.keys(s)) {
        if (!knownSellerKeys.has(k)) {
          extraSellerFields.push({ key: k, sample: s[k] });
        }
      }
      if (s.links?.length) {
        sellersWithLinks++;
        for (const link of s.links) {
          const t = link.type || 'unknown';
          linkTypes[t] = (linkTypes[t] || 0) + 1;
          if (t === 'shipping_policy') withShippingPolicy++;
        }
      }
    }
  }

  return {
    productCount: products.length,
    priceSamples: prices.slice(0, 5),
    linkTypes,
    sellersWithLinks,
    withShippingPolicy,
    extraSellerFields: extraSellerFields.slice(0, 5),
    freeShippingInText,
  };
}

async function main() {
  console.log('Catalog validation spike (category: aa — Apparel & Accessories)\n');

  const baseline = await rawSearch({ categorySlug: 'aa', limit: 15 });
  const baselineProducts = baseline.products || [];
  const baselinePagination = baseline.pagination || {};

  console.log('=== Baseline search (no price filter) ===');
  console.log(`Products returned: ${baselineProducts.length}`);
  console.log(`total_count estimate: ${baselinePagination.total_count ?? 'n/a'}`);
  console.log(`Seller object keys seen: ${collectSellerKeys(baselineProducts).join(', ') || '(none)'}`);
  console.log(JSON.stringify(analyzeProducts(baselineProducts), null, 2));

  const sample = baselineProducts[0];
  if (sample?.variants?.[0]?.seller) {
    console.log('\nSample seller (first hit):');
    console.log(JSON.stringify(sample.variants[0].seller, null, 2));
  }

  const filtered = await rawSearch({
    categorySlug: 'aa',
    priceMin: 2500,
    priceMax: 7500,
    limit: 15,
  });
  const filteredProducts = filtered.products || [];
  const filteredPagination = filtered.pagination || {};

  console.log('\n=== Price filter search (min $25, max $75 CAD) ===');
  console.log(`Products returned: ${filteredProducts.length}`);
  console.log(`total_count estimate: ${filteredPagination.total_count ?? 'n/a'}`);

  const outOfRange = [];
  for (const p of filteredProducts) {
    const amt = p.price_range?.min?.amount;
    if (amt == null) continue;
    if (amt < 2500 || amt > 7500) {
      outOfRange.push({ title: p.title, amount: amt, currency: p.price_range?.min?.currency });
    }
  }
  console.log(
    outOfRange.length
      ? `WARNING: ${outOfRange.length} products outside $25–$75 by price_range.min:`
      : 'All returned products have price_range.min within $25–$75 (by minor units).',
  );
  if (outOfRange.length) console.log(JSON.stringify(outOfRange.slice(0, 5), null, 2));

  const baselineMin = baselinePagination.total_count;
  const filteredMin = filteredPagination.total_count;
  if (typeof baselineMin === 'number' && typeof filteredMin === 'number') {
    console.log(
      `\ntotal_count: baseline ~${baselineMin} vs filtered ~${filteredMin} (${filteredMin <= baselineMin ? 'filtered <= baseline as expected' : 'unexpected'})`,
    );
  }

  const expensive = await rawSearch({
    categorySlug: 'aa',
    priceMin: 50000,
    limit: 5,
  });
  console.log('\n=== Price filter search (min $500 CAD) ===');
  console.log(`Products returned: ${(expensive.products || []).length}`);
  console.log(`total_count estimate: ${expensive.pagination?.total_count ?? 'n/a'}`);

  console.log('\nDone.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
