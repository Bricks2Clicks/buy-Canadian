/** English and French product-copy phrases — each is searched separately, then merged. */
export const ORIGIN_SEARCH_PHRASES = [
  'made in Canada',
  'fabriqué au Canada',
  'fabrique au Canada',
];

const ORIGIN_IN_USER_QUERY = [
  /made in canada/i,
  /fabriqu[ée] au canada/i,
  /fabrique au canada/i,
];

/** Primary phrase used for cursor pagination (load-more). */
export const PRIMARY_ORIGIN_PHRASE = ORIGIN_SEARCH_PHRASES[0];

export function getOriginSearchPhrases() {
  const override = process.env.CATALOG_QUERY?.trim();
  if (override) return [override];
  return [...ORIGIN_SEARCH_PHRASES];
}

/** Human-readable label stored in category-stats snapshots. */
export function buildOriginCatalogQuery() {
  return getOriginSearchPhrases().join('; ');
}

export function queryIncludesOriginPhrase(text) {
  return ORIGIN_IN_USER_QUERY.some((re) => re.test(text || ''));
}

/**
 * Combine a user search term with one origin phrase (implicit AND — not OR).
 * Catalog OR syntax does not union result sets reliably.
 */
export function combineQueryWithOrigin(userQuery, originPhrase) {
  const phrase = (originPhrase || '').trim();
  const extra = (userQuery || '').trim();
  if (!extra) return phrase;
  if (queryIncludesOriginPhrase(extra)) return extra;
  return `${extra} ${phrase}`;
}

/** Short label for UI copy. */
export const ORIGIN_FILTER_LABEL =
  '“made in Canada” / “fabriqué au Canada” wording';
