# RepBot — Simple gym tracker

A honest, no-BS gym tracker. Log your lifts, plan tomorrow, own your data.

## What it does

- **Today** — Log exercises, sets, reps, weight. One-tap set completion with rest timer.
- **Plan** — Queue exercises for tomorrow the night before. Copy from a recent workout with one tap.
- **Progress** — Per-exercise charts with PR tracking and plain-English insights.
- **Goals** — Set a target weight. Progress bar fills automatically from your PRs.
- **History** — Every workout, searchable. Export to CSV anytime.

## What it doesn't do (on purpose)

- No account. No login.
- No social feed. No followers.
- No ads. No subscriptions.
- No "AI coach" that nags you.
- No data sent anywhere. Your phone, your data.

## Run locally

```
cd gym-tracker
python3 -m http.server 8000
# open http://localhost:8000
```

Or just open `index.html` in a browser — everything works file:// except the service worker.

## Deploy

Any static host works. The app is pure client-side.

### Cloudflare Pages (recommended, free, fast)

1. Push this folder to a GitHub repo
2. Go to dash.cloudflare.com → Pages → Connect to Git
3. Select the repo, leave build settings blank (no build step)
4. Set output directory to `/` (root)
5. Done. You get a `*.pages.dev` URL.

### GitHub Pages

1. Push to a repo
2. Settings → Pages → Source: main branch, root
3. Site goes live at `username.github.io/repo`

### Netlify

1. Drag the folder to netlify.com/drop
2. Instant URL. Custom domain is free.

## Importing from other apps

Menu → Import from CSV. Expected columns: `date, exercise, weight_kg, reps` (extras are ignored).
Strong and Hevy both export CSVs in compatible formats — just export from them, import here.


## License

Do what you want with this. Just don't stick ads in it.
