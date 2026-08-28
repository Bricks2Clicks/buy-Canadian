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

export function normalizeProductCard(product, preferredVariantId) {
  if (!productHasStock(product)) return null;

  const variant = pickInStockVariant(product, preferredVariantId);
  if (!variant) return null;

  const currency =
    variant.price?.currency ||
    product.price_range?.min?.currency ||
    'CAD';
  const priceAmount = variant.price?.amount ?? product.price_range?.min?.amount;
  const image =
    variant.media?.[0]?.url ||
    product.media?.[0]?.url ||
    null;
  const seller = variant.seller || product.variants?.[0]?.seller;

  return {
    id: product.id,
    title: product.title,
    image,
    imageAlt: product.media?.[0]?.alt_text || product.title,
    price: formatPrice(priceAmount, currency),
    priceRaw: priceAmount,
    currency,
    variantId: variant.id,
    sellerName: seller?.name || 'Shopify store',
    sellerDomain: seller?.domain,
    buyUrl: withBuyCanadianUtm(variantBuyUrl(variant)),
    mentionsOrigin: mentionsMadeInCanada(product),
  };
}

export function normalizeProductDetail(product) {
  if (!productHasStock(product)) return null;

  const inStockVariants = (product.variants || []).filter(isVariantInStock).map((v) => ({
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
    rating: product.rating,
    variants: inStockVariants,
    mentionsOrigin: mentionsMadeInCanada(product),
  };
}

export function normalizeSearchResponse(result, preferredVariantId) {
  const content = result?.structuredContent ?? result ?? {};
  const products = (content.products || [])
    .map((p) => normalizeProductCard(p, preferredVariantId))
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
