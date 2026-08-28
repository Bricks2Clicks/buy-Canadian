import 'dotenv/config';

const DEFAULT_QUERY = 'made in Canada';
const SHOPIFY_SAMPLE_PROFILE =
  'https://shopify.dev/ucp/agent-profiles/2026-04-08/valid-with-capabilities.json';

export const config = {
  port: Number(process.env.PORT) || 3000,
  publicBaseUrl: process.env.PUBLIC_BASE_URL || 'http://localhost:3000',
  clientId: process.env.SHOPIFY_CLIENT_ID,
  clientSecret: process.env.SHOPIFY_CLIENT_SECRET,
  catalogIdCa: process.env.SHOPIFY_CATALOG_ID || '01m12qne33qw184bkw337397hj',
  catalogIdExport: process.env.SHOPIFY_CATALOG_ID_EXPORT || '',
  catalogQuery: process.env.CATALOG_QUERY || DEFAULT_QUERY,
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
