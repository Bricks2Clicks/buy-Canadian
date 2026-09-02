export const SITE_NAME = 'Buy Canadian';
export const SITE_TAGLINE = 'By Canadians, For Canadians';
export const DEFAULT_DESCRIPTION =
  'Discover products from Canadian Shopify merchants. Live search from the Shopify Global Catalog — no stored product database. Ships within Canada.';
export const DEFAULT_KEYWORDS =
  'Buy Canadian, Canadian products, Shopify Canada, made in Canada, Canadian merchants, shop local Canada';

export function siteOrigin() {
  return window.location.origin;
}

export function absoluteUrl(path) {
  return new URL(path, siteOrigin()).href;
}

function upsertMeta(attr, key, content) {
  if (!content) return;
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function upsertLink(rel, href) {
  if (!href) return;
  let el = document.head.querySelector(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

export function injectJsonLd(data) {
  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.textContent = JSON.stringify(data);
  document.head.appendChild(script);
}

/**
 * @param {object} opts
 * @param {string} opts.title
 * @param {string} [opts.description]
 * @param {string} opts.path - pathname + search, e.g. /faq.html
 * @param {string} [opts.type] - Open Graph type
 * @param {boolean} [opts.noindex]
 * @param {string} [opts.image] - absolute or site-relative OG image
 */
export function applyPageSeo({
  title,
  description = DEFAULT_DESCRIPTION,
  path,
  type = 'website',
  noindex = false,
  image,
}) {
  const url = absoluteUrl(path);
  const ogImage = image ? absoluteUrl(image) : absoluteUrl('/buyCanadian.png');

  document.title = title;

  upsertMeta('name', 'description', description);
  upsertMeta('name', 'keywords', DEFAULT_KEYWORDS);
  upsertMeta('name', 'author', SITE_NAME);
  upsertMeta('name', 'robots', noindex ? 'noindex, nofollow' : 'index, follow');

  upsertMeta('name', 'geo.region', 'CA');
  upsertMeta('name', 'geo.placename', 'Canada');
  upsertMeta('name', 'language', 'English');
  upsertMeta('name', 'content-language', 'en-CA');

  upsertMeta('property', 'og:site_name', SITE_NAME);
  upsertMeta('property', 'og:title', title);
  upsertMeta('property', 'og:description', description);
  upsertMeta('property', 'og:url', url);
  upsertMeta('property', 'og:type', type);
  upsertMeta('property', 'og:locale', 'en_CA');
  upsertMeta('property', 'og:image', ogImage);

  upsertMeta('name', 'twitter:card', image ? 'summary' : 'summary_large_image');
  upsertMeta('name', 'twitter:title', title);
  upsertMeta('name', 'twitter:description', description);
  upsertMeta('name', 'twitter:image', ogImage);

  upsertLink('canonical', url);
  upsertLink('alternate', url);
  document.documentElement.lang = 'en-CA';
}

export function webSiteSchema() {
  const origin = siteOrigin();
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${origin}/#website`,
    name: SITE_NAME,
    alternateName: SITE_TAGLINE,
    url: origin,
    inLanguage: 'en-CA',
    description: DEFAULT_DESCRIPTION,
    publisher: { '@id': `${origin}/#organization` },
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${origin}/search.html?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };
}

export function organizationSchema() {
  const origin = siteOrigin();
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${origin}/#organization`,
    name: SITE_NAME,
    url: origin,
    logo: `${origin}/icons/maple-leaf.png`,
    description: DEFAULT_DESCRIPTION,
    areaServed: {
      '@type': 'Country',
      name: 'Canada',
    },
  };
}

export function webApplicationSchema() {
  const origin = siteOrigin();
  return {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: SITE_NAME,
    url: origin,
    applicationCategory: 'ShoppingApplication',
    operatingSystem: 'Any',
    inLanguage: 'en-CA',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'CAD',
    },
    featureList: [
      'Live Shopify Global Catalog search',
      'Canadian merchant discovery',
      'WebMCP agent tools for in-browser AI assistants',
    ],
  };
}

export function faqPageSchema(items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map(({ question, answer }) => ({
      '@type': 'Question',
      name: question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: answer,
      },
    })),
  };
}

export function aboutPageSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'AboutPage',
    name: `About — ${SITE_NAME}`,
    url: absoluteUrl('/about.html'),
    inLanguage: 'en-CA',
    description:
      'Who built Buy Canadian, why it exists, and how live catalog discovery works for Canadian shoppers.',
    isPartOf: { '@id': `${siteOrigin()}/#website` },
  };
}

export function breadcrumbSchema(items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

export function productSchema(product, pagePath) {
  const variant = product.variants?.[0];
  const price = variant?.priceRaw ?? product.priceRange?.min?.amount;
  const currency = variant?.currency ?? product.priceRange?.min?.currency ?? 'CAD';
  const image = product.images?.[0]?.url;

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.title,
    description: product.descriptionPlain || product.title,
    url: absoluteUrl(pagePath),
    image: image ? [image] : undefined,
    brand: product.mentionsOrigin
      ? { '@type': 'Brand', name: 'Mentions made in Canada (product copy)' }
      : undefined,
    offers: price
      ? {
          '@type': 'Offer',
          price: (Number(price) / 100).toFixed(2),
          priceCurrency: currency,
          availability: 'https://schema.org/InStock',
          url: variant?.buyUrl || absoluteUrl(pagePath),
          seller: variant?.sellerName
            ? { '@type': 'Organization', name: variant.sellerName }
            : undefined,
        }
      : undefined,
  };

  return schema;
}

export function itemListSchema(products, listName, pagePath) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: listName,
    url: absoluteUrl(pagePath),
    numberOfItems: products.length,
    itemListElement: products.slice(0, 20).map((p, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: absoluteUrl(
        `/product.html?id=${encodeURIComponent(p.id)}&variant=${encodeURIComponent(p.variantId)}`,
      ),
      name: p.title,
    })),
  };
}
