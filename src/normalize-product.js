import { withBuyCanadianUtm } from './utm.js';
import { mentionsMadeInCanada } from './origin-badge.js';

function isVariantInStock(variant) {
  return variant?.availability?.available === true;
}

export function pickInStockVariant(product, preferredVariantId) {
  const variants = (product.variants || []).filter(isVariantInStock);
  if (!variants.length) return null;
  if (preferredVariantId) {
    const match = variants.find((v) => v.id === preferredVariantId);
    if (match) return match;
  }
  return variants[0];
}

export function productHasStock(product) {
  return (product.variants || []).some(isVariantInStock);
}

function formatPrice(amount, currency) {
  if (amount == null) return '';
  const value = Number(amount) / 100;
  try {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: currency || 'CAD',
    }).format(value);
  } catch {
    return `$${value.toFixed(2)}`;
  }
}

function variantBuyUrl(variant) {
  return variant.url || variant.checkout_url || null;
}

/** Catalog rating when it has a numeric average and at least one review. */
export function usableRating(rating) {
  if (!rating || typeof rating !== 'object') return null;
  const value = Number(rating.value);
  const count = Number(rating.count);
  if (!Number.isFinite(value) || !Number.isFinite(count) || count <= 0) {
    return null;
  }
  const scaleMin = Number(rating.scale_min);
  const scaleMax = Number(rating.scale_max);
  return {
    value,
    count,
    scale_min: Number.isFinite(scaleMin) ? scaleMin : 1,
    scale_max: Number.isFinite(scaleMax) && scaleMax > 0 ? scaleMax : 5,
  };
}

/** Drop offers priced in a different currency than the buyer destination (e.g. USD on CA). */
export function matchesExpectedCurrency(actual, expected) {
  if (!expected) return true;
  if (!actual) return true;
  return String(actual).toUpperCase() === String(expected).toUpperCase();
}

export function normalizeProductCard(product, preferredVariantId, expectedCurrency = 'CAD') {
  if (!productHasStock(product)) return null;

  const variant = pickInStockVariant(product, preferredVariantId);
  if (!variant) return null;

  const rawCurrency =
    variant.price?.currency ||
    product.price_range?.min?.currency ||
    null;
  if (rawCurrency && !matchesExpectedCurrency(rawCurrency, expectedCurrency)) {
    return null;
  }
  const resolvedCurrency = rawCurrency || expectedCurrency;
  const priceAmount = variant.price?.amount ?? product.price_range?.min?.amount;
  const image =
    variant.media?.[0]?.url ||
    product.media?.[0]?.url ||
    null;
  const seller = variant.seller || product.variants?.[0]?.seller;
  const rating = usableRating(product.rating) || usableRating(variant.rating);

  return {
    id: product.id,
    title: product.title,
    image,
    imageAlt: product.media?.[0]?.alt_text || product.title,
    price: formatPrice(priceAmount, resolvedCurrency),
    priceRaw: priceAmount,
    currency: resolvedCurrency,
    variantId: variant.id,
    sellerName: seller?.name || 'Shopify store',
    sellerDomain: seller?.domain,
    buyUrl: withBuyCanadianUtm(variantBuyUrl(variant)),
    mentionsOrigin: mentionsMadeInCanada(product),
    ...(rating ? { rating } : {}),
  };
}

export function normalizeProductDetail(product, expectedCurrency = 'CAD') {
  if (!productHasStock(product)) return null;

  const inStockVariants = (product.variants || [])
    .filter(isVariantInStock)
    .filter((v) => matchesExpectedCurrency(v.price?.currency, expectedCurrency))
    .map((v) => ({
      id: v.id,
      title: v.title,
      price: formatPrice(v.price?.amount, v.price?.currency),
      priceRaw: v.price?.amount,
      currency: v.price?.currency,
      buyUrl: withBuyCanadianUtm(variantBuyUrl(v)),
      sellerName: v.seller?.name,
      sellerDomain: v.seller?.domain,
      options: v.options,
      availability: v.availability,
    }));

  if (!inStockVariants.length) return null;

  const desc = product.description?.html ?? product.description?.plain ?? '';
  const descriptionPlain =
    typeof desc === 'string'
      ? desc
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
      : '';
  const images = (product.media || []).map((m) => ({
    url: m.url,
    alt: m.alt_text || product.title,
  }));

  return {
    id: product.id,
    title: product.title,
    descriptionHtml: typeof desc === 'string' ? desc : '',
    descriptionPlain,
    images,
    priceRange: product.price_range
      ? {
          min: formatPrice(
            product.price_range.min?.amount,
            product.price_range.min?.currency,
          ),
          max: formatPrice(
            product.price_range.max?.amount,
            product.price_range.max?.currency,
          ),
        }
      : null,
    options: product.options,
    metadata: product.metadata,
    rating: usableRating(product.rating),
    variants: inStockVariants,
    mentionsOrigin: mentionsMadeInCanada(product),
  };
}

export function normalizeSearchResponse(result, preferredVariantId, expectedCurrency = 'CAD') {
  const content = result?.structuredContent ?? result ?? {};
  const products = (content.products || [])
    .map((p) => normalizeProductCard(p, preferredVariantId, expectedCurrency))
    .filter(Boolean);

  const pagination = content.pagination || {};
  return {
    products,
    pagination: {
      cursor: pagination.cursor || null,
      hasNextPage: Boolean(pagination.has_next_page),
      totalCount: pagination.total_count ?? null,
    },
  };
}
