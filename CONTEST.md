# WebMCP Challenge — Buy Canadian submission kit

**Contest:** [The WebMCP Challenge](https://webmcp.devpost.com/)  
**Deadline:** September 3, 2026 @ 1:00pm PDT  
**Live URL:** https://buycanadian.bricks2clicks.online  
**Repo:** https://github.com/Bricks2Clicks/buy-Canadian  

---

## Submission description (paste into Devpost)

### What we built

**Buy Canadian** is a live discovery site that helps Canadians find products from domestic Shopify merchants. Listings come from the Shopify Global Catalog — no product database on our servers. Tagline: *By Canadians, For Canadians.*

### Why WebMCP is a strong fit

Shopping discovery is naturally collaborative: a person knows what they want; an in-browser agent can search, compare, and navigate faster — but only if the site exposes structured tools instead of forcing HTML scraping.

Buy Canadian registers **WebMCP tools** on the client that call the same live Catalog APIs as the human UI. An assistant in ChatGPT’s browser or Chrome with WebMCP can:

1. **`list_categories`** — get ranked categories (most eligible products first)
2. **`search_products`** — search with optional query + category slug
3. **`get_product_details`** — fetch full product data by id
4. **`open_product_page`** / **`open_category_page`** — navigate the visible tab so human and agent stay in sync

### Human + agent together (before vs after)

**Before WebMCP:** Agents guess form fields or parse product cards from DOM snapshots. Category filters and live inventory are easy to miss.

**After WebMCP:** The agent calls typed tools backed by live `search_catalog` / `get_product`. The user sees the same tab update, reviews options, and clicks through to the merchant’s Shopify store for checkout.

### Implementation

- **Browser:** [`public/js/webmcp.js`](public/js/webmcp.js) — `document.modelContext.registerTool()` (with `navigator.modelContext` fallback), AbortController lifecycle, five catalog tools
- **Server:** Express proxy to Shopify Catalog MCP ([`src/catalog-client.js`](src/catalog-client.js)), concurrency cap, in-flight coalescing, no-store API responses
- **Agent profile:** [`public/.well-known/ucp-agent.json`](public/.well-known/ucp-agent.json) for UCP catalog capabilities

### Impact

Canadian shoppers want to support local merchants; origin claims are noisy. Buy Canadian provides a focused, live, agent-ready entry point — not a marketplace, but a pass-through discovery layer with clear disclaimers.

---

## Judge testing instructions

1. Open **https://buycanadian.bricks2clicks.online** in:
   - ChatGPT desktop **in-app browser**, OR
   - **Chrome 149+** with `chrome://flags/#enable-webmcp-testing` enabled (restart required)
2. No login required. Shipping destination defaults to **Canada (CA)**.
3. Example agent prompts:
   - “Call list_categories and tell me the top three categories.”
   - “Search for maple syrup in category fb with search_products, limit 5.”
   - “Get details for the first result, then open_product_page so I can see it.”
4. Verify UCP profile: `/.well-known/ucp-agent.json`

---

## WebMCP tools reference

| Tool | readOnly | Description |
|------|----------|-------------|
| `list_categories` | yes | Ranked category slugs from admin snapshot |
| `search_products` | yes | Live catalog search (`query`, `category`, `limit`) |
| `get_product_details` | yes | Product by `id` + optional `variant` |
| `open_product_page` | no | Navigate tab to product detail |
| `open_category_page` | no | Navigate tab to category grid |

---

## Demo video script (~2:30)

| Time | Content |
|------|---------|
| 0:00–0:20 | Problem: finding Canadian products; stale directories fail |
| 0:20–0:45 | Human: homepage → category → product → merchant CTA |
| 0:45–1:00 | Switch to WebMCP-capable browser on same site |
| 1:00–1:30 | Agent: `list_categories` → `search_products` (category + query) |
| 1:30–2:00 | Agent: `get_product_details` → `open_product_page` |
| 2:00–2:15 | Human clicks merchant link; emphasize live Catalog, no DB |
| 2:15–2:30 | Architecture: WebMCP + Catalog MCP + UCP profile |

---

## Pre-existing project note

Buy Canadian existed before the hackathon. WebMCP integration was added during the submission window (August 2026). See git history for commits tagged `webmcp` / `feat(webmcp)`.

---

## Judging criteria mapping

| Criterion | How Buy Canadian addresses it |
|-----------|-------------------------------|
| **WebMCP Leverage** | Five production tools, schemas, execute handlers, lifecycle cleanup |
| **Execution** | Full site: home, category, search, product, FAQ, about |
| **Potential Impact** | Real audience (Canadian shoppers), real Catalog data |
| **Creativity & Ambition** | Live global catalog + dual agent layers (WebMCP + UCP), no cached catalog |
