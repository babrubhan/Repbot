# RepBot — RepBot

A honest, no-BS gym tracker. Log your lifts, plan tomorrow, own your data.

## What's in the box

5 real HTML pages, each with its own URL:

- `index.html` — Today (log workouts, weekly volume chart)
- `plan.html` — Plan tomorrow's workout
- `progress.html` — Per-exercise progress charts
- `goals.html` — Target weights, auto-filling progress bars
- `history.html` — Past workouts + CSV export (in the menu)

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
