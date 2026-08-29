/**
 * Build data/taxonomy-index.json — root slug -> all taxonomy GIDs (root + descendants).
 * Source: Shopify Standard Product Taxonomy (public).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ROOT_CATEGORIES } from '../src/taxonomy.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_PATH = path.join(__dirname, '..', 'data', 'taxonomy-index.json');
const LOCAL_TXT = path.join(__dirname, '..', 'data', 'taxonomy-categories.txt');
const REMOTE_TXT =
  'https://raw.githubusercontent.com/Shopify/product-taxonomy/main/dist/en/categories.txt';

const ROOT_SLUGS = new Set(ROOT_CATEGORIES.map((c) => c.slug));

function belongsToRoot(categoryId, rootSlug) {
  return categoryId === rootSlug || categoryId.startsWith(`${rootSlug}-`);
}

function buildIndexFromLines(lines) {
  const byRoot = Object.fromEntries([...ROOT_SLUGS].map((slug) => [slug, []]));

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^(gid:\/\/shopify\/TaxonomyCategory\/[^\s:]+)/);
    if (!match) continue;

    const gid = match[1];
    const categoryId = gid.replace('gid://shopify/TaxonomyCategory/', '');

    for (const rootSlug of ROOT_SLUGS) {
      if (belongsToRoot(categoryId, rootSlug)) {
        byRoot[rootSlug].push(gid);
      }
    }
  }

  for (const slug of ROOT_SLUGS) {
    if (!byRoot[slug].length) {
      byRoot[slug].push(`gid://shopify/TaxonomyCategory/${slug}`);
    }
  }

  return byRoot;
}

async function loadCategoryLines() {
  if (fs.existsSync(LOCAL_TXT)) {
    return fs.readFileSync(LOCAL_TXT, 'utf8').split(/\r?\n/);
  }

  const res = await fetch(REMOTE_TXT);
  if (!res.ok) {
    throw new Error(`Failed to download taxonomy (${res.status})`);
  }
  const text = await res.text();
  fs.mkdirSync(path.dirname(LOCAL_TXT), { recursive: true });
  fs.writeFileSync(LOCAL_TXT, text, 'utf8');
  return text.split(/\r?\n/);
}

async function main() {
  console.log('Building taxonomy index…');
  const lines = await loadCategoryLines();
  const index = buildIndexFromLines(lines);

  const payload = {
    generatedAt: new Date().toISOString(),
    source: fs.existsSync(LOCAL_TXT) ? 'data/taxonomy-categories.txt' : REMOTE_TXT,
    roots: index,
  };

  fs.writeFileSync(OUT_PATH, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

  for (const { slug, name } of ROOT_CATEGORIES) {
    console.log(`  ${slug} (${name}): ${index[slug].length} categories`);
  }
  console.log(`\nWrote ${OUT_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
