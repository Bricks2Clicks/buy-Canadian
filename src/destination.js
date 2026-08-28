import { config, CURRENCY_BY_COUNTRY } from './config.js';

const VALID = new Set(['CA', 'US', 'GB', 'AU', 'FR', 'DE', 'JP', 'MX']);

export function normalizeDestination(raw) {
  const code = String(raw || 'CA')
    .trim()
    .toUpperCase();
  if (!VALID.has(code)) return 'CA';
  return code;
}

export function resolveCatalogId(destination) {
  if (destination === 'CA') {
    return config.catalogIdCa;
  }
  if (config.catalogIdExport) {
    return config.catalogIdExport;
  }
  return config.catalogIdCa;
}

export function canUseDestination(destination) {
  if (destination === 'CA') return true;
  return Boolean(config.catalogIdExport);
}

export function destinationContext(destination) {
  const country = normalizeDestination(destination);
  return {
    country,
    currency: CURRENCY_BY_COUNTRY[country] || 'CAD',
    catalogId: resolveCatalogId(country),
    exportRequired: country !== 'CA' && !config.catalogIdExport,
  };
}
