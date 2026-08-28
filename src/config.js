import 'dotenv/config';
import { buildOriginCatalogQuery } from './origin-query.js';

const SHOPIFY_SAMPLE_PROFILE =
  'https://shopify.dev/ucp/agent-profiles/2026-04-08/valid-with-capabilities.json';

function resolvePublicBaseUrl() {
  const explicit = process.env.PUBLIC_BASE_URL || process.env.SITE_BASE_URL;
  if (explicit) {
    return explicit.replace(/\/$/, '');
  }

  // Vercel sets these automatically — no manual PUBLIC_BASE_URL needed on Hobby
  const production = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (production) {
    const host = production.replace(/^https?:\/\//, '').replace(/\/$/, '');
    return `https://${host}`;
  }

  const vercel = process.env.VERCEL_URL;
  if (vercel) {
    const host = vercel.replace(/^https?:\/\//, '').replace(/\/$/, '');
    return `https://${host}`;
  }

  return 'http://localhost:3000';
}

export const config = {
  port: Number(process.env.PORT) || 3000,
  publicBaseUrl: resolvePublicBaseUrl(),
  clientId: process.env.SHOPIFY_CLIENT_ID,
  clientSecret: process.env.SHOPIFY_CLIENT_SECRET,
  catalogIdCa: process.env.SHOPIFY_CATALOG_ID || '01m12qne33qw184bkw337397hj',
  catalogIdExport: process.env.SHOPIFY_CATALOG_ID_EXPORT || '',
  catalogQuery: process.env.CATALOG_QUERY || buildOriginCatalogQuery(),
  utmSource: process.env.UTM_SOURCE || 'buy-canadian',
  tokenUrl: 'https://api.shopify.com/auth/access_token',
  catalogMcpUrl: 'https://catalog.shopify.com/api/ucp/mcp',
  maxConcurrency: 3,
  maxRetries: 3,
  retryBaseMs: 800,
};

export function getAgentProfileUrl() {
  if (process.env.SHOPIFY_AGENT_PROFILE_URL) {
    return process.env.SHOPIFY_AGENT_PROFILE_URL;
  }
  const base = config.publicBaseUrl;
  if (base.includes('localhost') || base.includes('127.0.0.1')) {
    return SHOPIFY_SAMPLE_PROFILE;
  }
  return `${base.replace(/\/$/, '')}/.well-known/ucp-agent.json`;
}

export const CURRENCY_BY_COUNTRY = {
  CA: 'CAD',
  US: 'USD',
  GB: 'GBP',
  AU: 'AUD',
  FR: 'EUR',
  DE: 'EUR',
  JP: 'JPY',
  MX: 'MXN',
};

export const SHIPPABLE_COUNTRIES = [
  { code: 'CA', name: 'Canada' },
  { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'AU', name: 'Australia' },
  { code: 'FR', name: 'France' },
  { code: 'DE', name: 'Germany' },
  { code: 'JP', name: 'Japan' },
  { code: 'MX', name: 'Mexico' },
];
