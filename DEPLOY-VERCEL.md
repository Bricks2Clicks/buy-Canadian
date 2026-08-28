# Deploy Buy Canadian to Vercel (free Hobby)

Share a preview URL like `https://buy-canadian.vercel.app` with advisors. Custom domains (e.g. `buycanadian.bricks2clicks.online`) are **free** on Hobby — optional below.

## Before you start

1. **Push the repo to GitHub** (e.g. `Bricks2Clicks/buy-Canadian`).
2. Confirm **`.env` is not committed** (only `.env.example`).
3. Confirm **`data/category-stats.json`** is committed (homepage category order).

## 1. Create a Vercel account

1. Go to [vercel.com](https://vercel.com) and sign up with **GitHub**.
2. Authorize Vercel to access your GitHub org/repos.

## 2. Import the project

1. Vercel dashboard → **Add New…** → **Project**.
2. **Import** the `buy-Canadian` repository.
3. Configure:

   | Setting | Value |
   |---------|--------|
   | Framework Preset | **Other** |
   | Root Directory | `.` (leave default) |
   | Build Command | *(leave empty)* |
   | Output Directory | *(leave empty)* |
   | Install Command | `npm install` (default) |

4. Expand **Environment Variables** and add (Production):

   | Name | Value |
   |------|--------|
   | `SHOPIFY_CLIENT_ID` | Your Dev Dashboard client ID |
   | `SHOPIFY_CLIENT_SECRET` | Your Dev Dashboard client secret |
   | `SHOPIFY_CATALOG_ID` | `01m12qne33qw184bkw337397hj` |
   | `CATALOG_QUERY` | `made in Canada` |
   | `UTM_SOURCE` | `buy-canadian` |
   | `PUBLIC_BASE_URL` | See step 3 below |

   Optional (leave unset for now):

   - `SHOPIFY_CATALOG_ID_EXPORT` — phase 2 international shipping
   - `SHOPIFY_AGENT_PROFILE_URL` — only if you override the default profile URL

5. Click **Deploy** and wait for the build to finish.

## 3. Set `PUBLIC_BASE_URL` (important)

Catalog needs your public agent profile at `/.well-known/ucp-agent.json`.

1. After the first deploy, copy your production URL, e.g.  
   `https://buy-canadian-xxxx.vercel.app`
2. Vercel → **Project → Settings → Environment Variables**
3. Set **`PUBLIC_BASE_URL`** to that URL (no trailing slash).
4. **Redeploy** (Deployments → … on latest → Redeploy).

If you add a custom domain later, update `PUBLIC_BASE_URL` to `https://buycanadian.bricks2clicks.online` and redeploy.

## 4. Smoke test

Open your Vercel URL and check:

- [ ] Homepage loads (hero, category grid)
- [ ] `https://YOUR-URL/.well-known/ucp-agent.json` returns JSON
- [ ] Click a category → products load
- [ ] Open a product → detail + merchant link
- [ ] Search works

If API calls fail with timeout errors, Catalog may be slower than Vercel Hobby’s **10 second** function limit. Retry once; if it persists, consider Vercel Pro or Cloud Run.

## 5. Share with advisors

Send the **Production** deployment URL from the Vercel dashboard. Preview deployments (pull requests) use separate URLs and need the same env vars under **Preview** if you want them to hit live Catalog.

## 6. Optional: custom domain (free on Hobby)

1. Vercel → **Project → Settings → Domains**
2. Add `buycanadian.bricks2clicks.online`
3. At your DNS host (Cloudflare, SiteGround, etc.), add the record Vercel shows (usually **CNAME** `buycanadian` → `cname.vercel-dns.com`)
4. Wait for SSL (automatic)
5. Update **`PUBLIC_BASE_URL`** to `https://buycanadian.bricks2clicks.online` and redeploy

## 7. Updates after deploy

| Task | How |
|------|-----|
| Code changes | Push to GitHub → Vercel auto-deploys |
| Category order | Run `npm run refresh-category-stats` locally, commit `data/category-stats.json`, push |
| Secrets | Vercel → Settings → Environment Variables → Redeploy |

## Local dev unchanged

```bash
npm install
cp .env.example .env
# edit .env with credentials
npm start
```

Local uses `.env`; Vercel uses dashboard env vars only.
