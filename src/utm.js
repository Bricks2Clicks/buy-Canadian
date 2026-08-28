import { config } from './config.js';

/** Append Buy Canadian tracking without clobbering Shopify Catalog attribution. */
export function withBuyCanadianUtm(url, utmSource = config.utmSource) {
  if (!url) return url;
  try {
    const u = new URL(url);
    if (u.searchParams.get('utm_source') === 'shopify') {
      u.searchParams.set('utm_campaign', utmSource);
    } else {
      u.searchParams.set('utm_source', utmSource);
      if (!u.searchParams.get('utm_medium')) {
        u.searchParams.set('utm_medium', 'referral');
      }
    }
    return u.toString();
  } catch {
    return url;
  }
}
