# RepBot — Simple gym tracker

A honest, no-BS gym tracker. Log your lifts, plan tomorrow, own your data.

## What it doesn't do (on purpose)

- No account. No login.
- No social feed. No followers.
- No ads. No subscriptions.
- No data sent anywhere. Everything lives in your phone's localStorage.

## Run locally

```bash
cd repbot
python3 -m http.server 8000
# open http://localhost:8000
```

## Deploy

Any static host. All 5 pages are just files.

**Cloudflare Pages (free):** push to GitHub → Cloudflare Pages → Connect Git → no build settings needed → live at `*.pages.dev`

**Netlify Drop:** drag the folder to netlify.com/drop → instant URL.

**GitHub Pages:** push to a repo → Settings → Pages → main branch → live at `username.github.io/repo`

## Importing from other apps

Menu → Import from CSV. Expected headers: `date, exercise, weight_kg, reps`. Works with Strong and Hevy exports.

## License

Do what you want. Just don't add ads.
