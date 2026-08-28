import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from '../src/config.js';
import { estimateOriginUnionCount } from '../src/catalog-client.js';
import { buildOriginCatalogQuery } from '../src/origin-query.js';
import { ROOT_CATEGORIES, categoryGid } from '../src/taxonomy.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_PATH = path.join(__dirname, '..', 'data', 'category-stats.json');

async function main() {
  const queryLabel = buildOriginCatalogQuery();

  console.log('Refreshing category stats from Shopify Global Catalog…');
  console.log(`Catalog: ${config.catalogIdCa}`);
  console.log(`Origin phrases (max per phrase): ${queryLabel}`);
  console.log(`Destination: CA\n`);

  const rows = [];

  for (const category of ROOT_CATEGORIES) {
    process.stdout.write(`  ${category.slug} (${category.name})… `);
    try {
      const { eligibleCount, destinationBlocked } = await estimateOriginUnionCount({
        destination: 'CA',
        categoryGid: categoryGid(category.slug),
      });

      if (destinationBlocked) {
        console.log('blocked (export catalog required)');
        rows.push({ slug: category.slug, name: category.name, eligibleCount: 0 });
        continue;
      }

      console.log(`~${eligibleCount}`);
      rows.push({ slug: category.slug, name: category.name, eligibleCount });
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
    query: queryLabel,
    destination: 'CA',
    note:
      'eligibleCount is the max pagination.total_count across separate English/French origin phrase searches (union estimate lower bound). Not exact inventory. Pagination capped at 1,000 per phrase.',
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
