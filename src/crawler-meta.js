import fs from 'fs';
import path from 'path';
import { getCategoryBySlug, ROOT_CATEGORIES } from './taxonomy.js';

export const CANONICAL_ORIGIN = 'https://buycanadian.bricks2clicks.online';
export const OG_IMAGE_PATH = '/buyCanadian1200x627.png';
export const OG_IMAGE_WIDTH = '1200';
export const OG_IMAGE_HEIGHT = '627';
export const OG_IMAGE_ALT =
  'Buy Canadian | By Canadians, For Canadians. Discover Canadian made products sold by Canadian merchants.';

const META_START = '<!-- crawler-meta:start -->';
const META_END = '<!-- crawler-meta:end -->';
const FAQ_JSONLD_MARKER = '<!-- faq-jsonld -->';
const htmlCache = new Map();

const HTML_ENTITIES = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

function escapeHtmlAttr(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function absoluteUrl(origin, urlPath) {
  return new URL(urlPath, `${origin.replace(/\/$/, '')}/`).href;
}

function sanitizeSearchQuery(raw) {
  return String(raw || '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
}

export function buildCrawlerMetaBlock({
  title,
  description,
  path: urlPath,
  type = 'website',
  noindex = false,
  origin = CANONICAL_ORIGIN,
  ogTitle,
  ogDescription,
}) {
  const url = absoluteUrl(origin, urlPath);
  const image = absoluteUrl(origin, OG_IMAGE_PATH);
  const shareTitle = ogTitle || title;
  const shareDescription = ogDescription || description;
  const robots = noindex ? 'noindex, follow' : 'index, follow';

  return `${META_START}
    <title>${escapeHtmlAttr(title)}</title>
    <meta name="description" content="${escapeHtmlAttr(description)}" />
    <meta name="robots" content="${robots}" />
    <link rel="canonical" href="${escapeHtmlAttr(url)}" />
    <meta property="og:type" content="${escapeHtmlAttr(type)}" />
    <meta property="og:locale" content="en_CA" />
    <meta property="og:site_name" content="Buy Canadian" />
    <meta property="og:url" content="${escapeHtmlAttr(url)}" />
    <meta property="og:title" content="${escapeHtmlAttr(shareTitle)}" />
    <meta
      property="og:description"
      content="${escapeHtmlAttr(shareDescription)}" />
    <meta property="og:image" content="${escapeHtmlAttr(image)}" />
    <meta property="og:image:alt" content="${escapeHtmlAttr(OG_IMAGE_ALT)}" />
    <meta property="og:image:type" content="image/png" />
    <meta property="og:image:width" content="${OG_IMAGE_WIDTH}" />
    <meta property="og:image:height" content="${OG_IMAGE_HEIGHT}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtmlAttr(shareTitle)}" />
    <meta
      name="twitter:description"
      content="${escapeHtmlAttr(shareDescription)}" />
    <meta name="twitter:image" content="${escapeHtmlAttr(image)}" />
    <meta name="twitter:image:alt" content="${escapeHtmlAttr(OG_IMAGE_ALT)}" />
    ${META_END}`;
}

export function injectCrawlerMeta(html, meta) {
  const start = html.indexOf(META_START);
  const end = html.indexOf(META_END);
  if (start === -1 || end === -1) return html;
  return (
    html.slice(0, start) +
    buildCrawlerMetaBlock(meta) +
    html.slice(end + META_END.length)
  );
}

export function categoryCrawlerMeta(slug, origin = CANONICAL_ORIGIN) {
  const category = slug ? getCategoryBySlug(String(slug).toLowerCase()) : null;
  if (!category) {
    return {
      title: 'Shop by Category — Buy Canadian',
      description:
        'Browse live catalog categories from Canadian Shopify merchants. Ships within Canada.',
      path: '/category.html',
      origin,
    };
  }
  return {
    title: `${category.name} — Buy Canadian`,
    description: `Shop ${category.name} from Canadian Shopify merchants. Live catalog results with a made-in-Canada search filter. Ships within Canada.`,
    path: `/category.html?slug=${encodeURIComponent(category.slug)}`,
    origin,
  };
}

export function searchCrawlerMeta(q, origin = CANONICAL_ORIGIN) {
  const query = sanitizeSearchQuery(q);
  if (!query) {
    return {
      title: 'Search — Buy Canadian',
      description:
        'Search live in-stock products from Canadian Shopify merchants, including made-in-Canada catalog wording. Ships within Canada.',
      path: '/search.html',
      origin,
    };
  }
  return {
    title: `Search: ${query} — Buy Canadian`,
    description: `Live search results for “${query}” from Canadian Shopify merchants, including made-in-Canada catalog filter.`,
    path: `/search.html?q=${encodeURIComponent(query)}`,
    noindex: true,
    origin,
  };
}

export function productCrawlerMeta(query = {}, origin = CANONICAL_ORIGIN) {
  const id = query.id ? String(query.id).trim() : '';
  const variant = query.variant ? String(query.variant).trim() : '';
  const category = query.category
    ? getCategoryBySlug(String(query.category).toLowerCase())
    : null;

  const params = new URLSearchParams();
  if (id) params.set('id', id);
  if (variant) params.set('variant', variant);
  if (category) params.set('category', category.slug);
  const qs = params.toString();

  const inCategory = category ? ` in ${category.name}` : '';
  return {
    title: category
      ? `Product — ${category.name} — Buy Canadian`
      : 'Product — Buy Canadian',
    description: `Live catalog listing${inCategory} from a Canadian Shopify merchant on Buy Canadian. Checkout, shipping, and policies are on the merchant's store.`,
    path: qs ? `/product.html?${qs}` : '/product.html',
    type: 'website',
    origin,
  };
}

export function sendHtmlPage(
  res,
  publicDir,
  fileName,
  meta,
  { faqJsonLd = false } = {},
) {
  let html = htmlCache.get(fileName);
  if (!html) {
    html = fs.readFileSync(path.join(publicDir, fileName), 'utf8');
    htmlCache.set(fileName, html);
  }
  if (meta) html = injectCrawlerMeta(html, meta);
  if (faqJsonLd) html = injectFaqJsonLd(html);
  res.type('html').send(html);
}

function xmlEscape(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildSitemapXml(origin = CANONICAL_ORIGIN) {
  const entries = [
    { loc: `${origin}/`, changefreq: 'daily', priority: '1.0' },
    { loc: `${origin}/search.html`, changefreq: 'weekly', priority: '0.8' },
    ...ROOT_CATEGORIES.map((category) => ({
      loc: `${origin}/category.html?slug=${encodeURIComponent(category.slug)}`,
      changefreq: 'weekly',
      priority: '0.7',
    })),
    { loc: `${origin}/about.html`, changefreq: 'monthly', priority: '0.6' },
    { loc: `${origin}/faq.html`, changefreq: 'monthly', priority: '0.6' },
  ];

  const body = entries
    .map(
      (entry) => `  <url>
    <loc>${xmlEscape(entry.loc)}</loc>
    <changefreq>${entry.changefreq}</changefreq>
    <priority>${entry.priority}</priority>
  </url>`,
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>
`;
}

function decodeHtmlEntities(text) {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity) => {
    if (entity[0] === '#') {
      const code =
        entity[1] === 'x' || entity[1] === 'X'
          ? parseInt(entity.slice(2), 16)
          : parseInt(entity.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    return HTML_ENTITIES[entity.toLowerCase()] ?? match;
  });
}

function htmlToPlainText(fragment) {
  const withLabels = String(fragment).replace(
    /<[^>]*\baria-label="([^"]+)"[^>]*>/gi,
    ' $1 ',
  );
  return decodeHtmlEntities(
    withLabels
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<\/(?:p|h2|li)>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim(),
  );
}

export function extractFaqItems(html) {
  const items = [];
  const itemRe = /<div class="faq-item\b[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;
  let match;
  while ((match = itemRe.exec(html))) {
    const body = match[1];
    const heading = body.match(/<h2\b[^>]*>([\s\S]*?)<\/h2>/i);
    if (!heading) continue;
    const question = htmlToPlainText(heading[1]);
    const answer = [...body.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
      .map((part) => htmlToPlainText(part[1]))
      .filter(Boolean)
      .join(' ');
    if (question && answer) items.push({ question, answer });
  }
  return items;
}

export function buildFaqJsonLd(html, origin = CANONICAL_ORIGIN) {
  const items = extractFaqItems(html);
  const url = `${origin.replace(/\/$/, '')}/faq.html`;
  const titleMatch = html.match(/<title>([^<]*)<\/title>/i);
  const descriptionMatch = html.match(
    /name="description"\s+content="([^"]*)"/i,
  );
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'FAQPage',
        '@id': `${url}#webpage`,
        name: titleMatch ? htmlToPlainText(titleMatch[1]) : 'FAQ — Buy Canadian',
        url,
        inLanguage: 'en-CA',
        description: descriptionMatch
          ? decodeHtmlEntities(descriptionMatch[1])
          : undefined,
        isPartOf: { '@id': `${origin.replace(/\/$/, '')}/#website` },
        breadcrumb: { '@id': `${url}#breadcrumb` },
        mainEntity: items.map(({ question, answer }) => ({
          '@type': 'Question',
          name: question,
          acceptedAnswer: {
            '@type': 'Answer',
            text: answer,
          },
        })),
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${url}#breadcrumb`,
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: 'Home',
            item: `${origin.replace(/\/$/, '')}/`,
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: 'FAQ',
            item: url,
          },
        ],
      },
    ],
  };
}

export function injectFaqJsonLd(html, origin = CANONICAL_ORIGIN) {
  const items = extractFaqItems(html);
  if (!items.length) return html;

  const json = JSON.stringify(buildFaqJsonLd(html, origin), null, 2).replace(
    /</g,
    '\\u003c',
  );
  const script = `<script type="application/ld+json">\n${json}\n    </script>`;

  if (html.includes(FAQ_JSONLD_MARKER)) {
    return html.replace(FAQ_JSONLD_MARKER, script);
  }
  return html.replace('</head>', `    ${script}\n  </head>`);
}
