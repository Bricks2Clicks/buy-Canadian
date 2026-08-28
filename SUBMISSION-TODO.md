# Buy Canadian — submission & launch checklist

Track remaining tasks for the [WebMCP Challenge](https://webmcp.devpost.com/) and site polish.  
**Deadline: September 3, 2026 @ 1:00pm PDT**

---

## Your action items (manual)

- [ ] **Edit creator bio** in [`public/about.html`](public/about.html) — replace `[Your name]` and `[One-line bio]` placeholders
- [ ] **Make GitHub repo public** — [Bricks2Clicks/buy-Canadian](https://github.com/Bricks2Clicks/buy-Canadian) (or your repo URL)
- [ ] **Set GitHub About license** to MIT (matches [`LICENSE`](LICENSE))
- [ ] **Deploy to Vercel** after merging — confirm live URL works
- [ ] **Verify agent profile** — `https://buycanadian.bricks2clicks.online/.well-known/ucp-agent.json`
- [ ] **Test WebMCP tools** in ChatGPT desktop in-app browser OR Chrome 149+ with `chrome://flags/#enable-webmcp-testing`
- [ ] **Record demo video** (<3 min, YouTube, public, with audio) — script in [`CONTEST.md`](CONTEST.md)
- [ ] **Submit on Devpost** — live URL, repo URL, description (copy from CONTEST.md), video link
- [ ] **Do not edit submission** after Sep 3 1:00pm PT until winners announced

---

## Implemented in codebase

- [x] About page ([`public/about.html`](public/about.html)) — **edit `[Your name]` and bio placeholders**
- [x] Footer About link on all pages; Flaticon credit moved to About
- [x] WebMCP tools ([`public/js/webmcp.js`](public/js/webmcp.js)) — 5 tools + dismissible banner
- [x] SEO / GEO meta + JSON-LD ([`public/js/seo.js`](public/js/seo.js))
- [x] [`robots.txt`](public/robots.txt) and [`sitemap.xml`](public/sitemap.xml)
- [x] MIT [`LICENSE`](LICENSE)
- [x] Contest docs ([`CONTEST.md`](CONTEST.md))
- [x] README WebMCP + judge testing section

---

## Pre-submit verification

- [ ] Homepage loads; category tiles fill in rank order
- [ ] Search and product pages work (CA shipping)
- [ ] About and FAQ pages render
- [ ] View page source — JSON-LD present on home, FAQ, about, product
- [ ] Agent can call `list_categories` → `search_products` → `get_product_details`
- [ ] `open_product_page` navigates the tab to a product
- [ ] **Remove local/Vercel `CATALOG_QUERY`** if set to English-only — default is bilingual OR query
- [ ] **Re-run** `npm run refresh-category-stats` and commit updated `data/category-stats.json`

---

## Demo video shot list (~2:30)

1. (0:00) Problem — finding Canadian products is hard; stale directories don’t work
2. (0:20) Human browses homepage categories and opens a product
3. (0:50) Open ChatGPT browser / Chrome WebMCP on the same site
4. (1:00) Agent calls `list_categories`, then `search_products` with category + query
5. (1:30) Agent calls `get_product_details`, then `open_product_page`
6. (2:00) Show merchant CTA; mention live Shopify Global Catalog (no stored DB)
7. (2:15) Brief: browser WebMCP + server Catalog MCP + UCP agent profile

---

## Devpost description

Use the **Submission description** section in [`CONTEST.md`](CONTEST.md) when filling the form.

---

## Post-contest (optional)

- [ ] Add `SITE_BASE_URL` on Vercel if canonical URLs should use custom domain
- [ ] **Remove `CATALOG_QUERY` from Vercel env** if set to `made in Canada` only — default now includes French (`fabriqué au Canada`)
- [ ] Request Netlify credits before Sep 1 if needed (optional per contest rules)
