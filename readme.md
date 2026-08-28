# Buy Canadian

**By Canadians, For Canadians.**

Live product discovery from Canadian Shopify merchants via the [Shopify Global Catalog](https://shopify.dev/docs/agents/catalog). This site does not store catalog results or images — every page load runs fresh `search_catalog` / `get_product` calls through a small Node proxy.

## Requirements

- Node.js 18+
- Shopify Dev Dashboard app with Catalog API access
- Saved catalog with buyer CA, ships to CA, ships from CA

## Setup

1. Clone the repo and install dependencies:

   ```bash
   npm install
   ```

2. Copy environment variables:

   ```bash
   cp .env.example .env
   ```

3. Add your Dev Dashboard credentials to `.env`:

   - `SHOPIFY_CLIENT_ID`
   - `SHOPIFY_CLIENT_SECRET`
   - `SHOPIFY_CATALOG_ID` (default: saved CA catalog)

4. Start the server:

   ```bash
   npm start
   ```

   Open [http://localhost:3000](http://localhost:3000).

## Environment variables

| Variable | Description |
|----------|-------------|
| `SHOPIFY_CLIENT_ID` | Dev Dashboard client ID |
| `SHOPIFY_CLIENT_SECRET` | Dev Dashboard client secret |
| `SHOPIFY_CATALOG_ID` | Saved catalog (CA buyer / ships to & from CA) |
| `SHOPIFY_CATALOG_ID_EXPORT` | Phase 2: export catalog (ships from CA only) |
| `PUBLIC_BASE_URL` | Public site URL (agent profile in production) |
| `SHOPIFY_AGENT_PROFILE_URL` | Override agent profile URL (localhost uses Shopify sample) |
| `CATALOG_QUERY` | Default query suffix (default: `made in Canada`) |
| `UTM_SOURCE` | Outbound link campaign tag (default: `buy-canadian`) |
| `PORT` | Server port (default: `3000`; Vercel sets this automatically) |

## Deploy to Vercel (preview / advisors)

Step-by-step: **[DEPLOY-VERCEL.md](DEPLOY-VERCEL.md)**

Quick summary: push to GitHub → import in [Vercel](https://vercel.com) → add env vars → deploy → set `PUBLIC_BASE_URL` to your `*.vercel.app` URL → redeploy. Custom domains are free on Hobby.

**Note:** Vercel Hobby functions time out after **10 seconds**. Slow Catalog responses may occasionally fail on the free tier.

## Architecture

- **Express proxy** — JWT auth, concurrency cap (3), 429 backoff, `Cache-Control: no-store`
- **Catalog MCP** — `search_catalog` and `get_product` with `filters.available: true`
- **Taxonomy** — Static Shopify Standard Product Taxonomy root categories (public data)
- **Category ranking** — Homepage category order from [`data/category-stats.json`](data/category-stats.json), refreshed by admin (not on each page load)
- **UTM helper** — Preserves Shopify `utm_source=shopify`; adds `utm_campaign` from `UTM_SOURCE`

## Category ranking (admin)

Homepage categories are ordered **most eligible listings → least**, using a static snapshot in `data/category-stats.json`. Counts come from Catalog `pagination.total_count` (estimates, not exact inventory).

Refresh quarterly or after major catalog changes:

```bash
npm run refresh-category-stats
```

This runs ~20 live `search_catalog` calls (one per root category, `limit: 1`) with the same filters as the site (`made in Canada`, in-stock, ships to CA). Commit the updated JSON so production picks up the new order without re-running on deploy.

## Pages

| Path | Purpose |
|------|---------|
| `/` | Hero, top-ranked category row, phased tile loading |
| `/category.html?slug=aa` | Category grid, 50 per page, Load more |
| `/search.html?q=…` | Search + made in Canada query |
| `/product.html?id=…` | Product detail, merchant CTA in new tab |
| `/faq.html` | Disclaimers and FAQ |

## Phase 2

- Set `SHOPIFY_CATALOG_ID_EXPORT` for non-CA shipping destinations
- Footer “Ships to” dropdown becomes active

## Remote monitoring

To get phone notifications while a long-running agent session works on this repo, use **Remote Control** from the Cursor Agents window (`/remote-control`). That is separate from Auto/unlimited usage.

## License

Private project — see repository owner.
