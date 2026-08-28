import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from '../src/config.js';
import { searchCatalog } from '../src/catalog-client.js';
import { ROOT_CATEGORIES, categoryGid } from '../src/taxonomy.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_PATH = path.join(__dirname, '..', 'data', 'category-stats.json');

function extractTotalCount(result) {
  const content = result?.structuredContent ?? result ?? {};
  const pagination = content.pagination ?? {};
  return pagination.total_count ?? 0;
}

async function main() {
  console.log('Refreshing category stats from Shopify Global Catalog…');
  console.log(`Catalog: ${config.catalogIdCa}`);
  console.log(`Query: "${config.catalogQuery}"`);
  console.log(`Destination: CA\n`);

  const rows = [];

  for (const category of ROOT_CATEGORIES) {
    process.stdout.write(`  ${category.slug} (${category.name})… `);
    try {
      const raw = await searchCatalog({
        query: config.catalogQuery,
        destination: 'CA',
        categoryGid: categoryGid(category.slug),
        limit: 1,
      });

      if (raw.destinationBlocked) {
        console.log('blocked (export catalog required)');
        rows.push({ slug: category.slug, name: category.name, eligibleCount: 0 });
        continue;
      }

      const count = extractTotalCount(raw);
      console.log(`~${count}`);
      rows.push({ slug: category.slug, name: category.name, eligibleCount: count });
    } catch (err) {
      console.log(`error: ${err.message}`);
      rows.push({ slug: category.slug, name: category.name, eligibleCount: 0 });
    }
  }

  rows.sort((a, b) => {
    if (b.eligibleCount !== a.eligibleCount) {
      return b.eligibleCount - a.eligibleCount;
    }
    return a.name.localeCompare(b.name);
  });

  const snapshot = {
    measuredAt: new Date().toISOString(),
    catalogId: config.catalogIdCa,
    query: config.catalogQuery,
    destination: 'CA',
    note:
      'eligibleCount values are pagination.total_count estimates from Shopify Global Catalog, not exact inventory counts. Pagination is capped at 1,000 results per query.',
    categories: rows,
  };

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');

  console.log('\nRanked categories (most → least):');
  console.table(
    rows.map((r, i) => ({
      rank: i + 1,
      slug: r.slug,
      name: r.name,
      eligibleCount: r.eligibleCount,
    })),
  );
  console.log(`\nWrote ${OUT_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
