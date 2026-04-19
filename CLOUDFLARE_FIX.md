# Cloudflare Pages — fixing the broken sub-pages

If only `/` works and `/plan.html`, `/goals.html` etc. return errors, try these in order.

## Fix 1: Re-upload with `_headers` and `_redirects`

These two files have been added to the project. They tell Cloudflare Pages how to serve each file type correctly. Just re-deploy with these files included and the issue usually resolves.

## Fix 2: Check "Auto minify" and asset settings

In your Cloudflare dashboard:

1. Go to your Pages project → **Settings** → **Functions**
2. Make sure nothing there is enabled unless you intentionally added functions
3. Go to **Settings** → **Builds & deployments**
4. Confirm **Build output directory** is either empty or `/` (not `dist` or `build`)
5. Confirm **Root directory** is `/` (or whatever subfolder your files are in)

## Fix 3: The "Replace extensions" setting

This is the most likely cause. By default, Cloudflare Pages sometimes serves `/plan` instead of `/plan.html`, and any link that explicitly writes `.html` breaks.

1. Go to your Pages project → **Settings** → **Builds & deployments**
2. Scroll to **Build configurations** or **Deployment details**
3. Look for **"Serve `.html` files"** or **"Replace extensions"** — toggle it so `.html` extensions are preserved
4. Redeploy

If you can't find that option, the `_redirects` file I added handles it anyway — it maps `/plan` → `/plan.html` with a 200 rewrite, so both URLs work.

## Fix 4: Nuclear option — delete and re-create the project

Sometimes Cloudflare Pages caches a bad initial config. If nothing above works:

1. Delete the Pages project entirely
2. Create a new one with a different name (e.g. `repbot-v2`)
3. Upload the files fresh

## Fix 5: If GitHub integration is the problem

Sometimes the Git integration gets confused about file paths. Try the direct upload method instead:

1. In Pages dashboard → **Create project** → **Direct Upload** (not Git)
2. Zip the `repbot` folder contents (select all files inside, not the folder itself)
3. Upload the zip
4. Deploy

## How to verify it worked

After deploying, test each URL directly in your browser:

- `https://your-site.pages.dev/` — should load Today
- `https://your-site.pages.dev/plan.html` — should load Plan
- `https://your-site.pages.dev/plan` — should also load Plan (via `_redirects`)

If direct `.html` URLs still fail but `/plan` works, the pretty-URL fallback is doing the job. Ship it that way.

## Why Netlify works but Cloudflare doesn't

Netlify is permissive by default — it serves `.html` files at both `/plan` and `/plan.html` out of the box. Cloudflare Pages requires explicit configuration via `_headers` / `_redirects` files, which Netlify also supports but doesn't need.

The files in this project work on both platforms, so the app itself is fine. It's purely a Cloudflare config issue.
