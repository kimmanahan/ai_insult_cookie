# Misfortune Cookie 🥠

A darkly funny fortune cookie web app powered by Claude. Click the cookie, get insulted by an AI oracle.

## Architecture

Two pieces:
- **`index.html`** — the frontend. Opens in a browser.
- **`src/worker.js`** — a Cloudflare Worker that holds your Anthropic API key server-side and proxies requests to Claude. The browser never sees the key.

```
misfortune-cookie/
├── wrangler.toml          ← Cloudflare config
├── src/
│   └── worker.js          ← Backend (deployed to Cloudflare)
└── index.html             ← Frontend (open in browser)
```

---

## Prerequisites

You'll need:

1. **Node.js** installed — [nodejs.org](https://nodejs.org) if you don't have it
2. **A Cloudflare account** — free tier is fine, sign up at [dash.cloudflare.com](https://dash.cloudflare.com)
3. **An Anthropic API key** — see "Getting an API Key" below

---

## Getting an Anthropic API Key

1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Sign up or log in
3. Click your profile (top right) → **API Keys**
4. Click **Create Key** → name it something like `misfortune-cookie`
5. Copy the key (starts with `sk-ant-...`) — **save it somewhere safe, you can't view it again**
6. Add billing info under **Plans & Billing** if you haven't already (you'll need a small balance — even a few dollars will run this app for thousands of fortunes)

---

## First-Time Setup

### 1. Install Wrangler (Cloudflare's CLI)

```bash
npm install -g wrangler
```

### 2. Log in to Cloudflare

```bash
wrangler login
```

This opens a browser window — authorize Wrangler to access your Cloudflare account.

### 3. Add your Anthropic API key as a secret

From inside the `misfortune-cookie/` folder:

```bash
wrangler secret put ANTHROPIC_API_KEY
```

It'll prompt you to paste your key. Paste it and hit enter. Cloudflare encrypts it — it's never in your code, never in git, never in the browser.

### 4. Deploy the worker

```bash
wrangler deploy
```

You'll see output like:
```
Published misfortune-cookie (1.23 sec)
  https://misfortune-cookie.your-subdomain.workers.dev
```

**Copy that URL.** You'll need it next.

### 5. Connect the frontend to the worker

Open `index.html` and find this line near the bottom of the `<script>` block:

```js
const WORKER_URL = 'https://misfortune-cookie.YOUR-SUBDOMAIN.workers.dev/fortune';
```

Replace it with your actual worker URL — and **keep `/fortune` on the end**:

```js
const WORKER_URL = 'https://misfortune-cookie.your-actual-subdomain.workers.dev/fortune';
```

Save the file.

### 6. Open it

Double-click `index.html` to open it in your browser. Click the cookie.

---

## Updating the Code

### Updating the worker (backend)

After changing anything in `src/worker.js` — including the system prompt, rate limits, or allowed origins:

```bash
wrangler deploy
```

That's it. Changes go live in seconds.

### Updating the frontend (HTML)

Just save the file. If you have it open in a browser, refresh the page. No deploy needed (unless you're hosting the HTML somewhere — see "Hosting the Frontend" below).

### Updating the API key

If you regenerate or replace your Anthropic key:

```bash
wrangler secret put ANTHROPIC_API_KEY
```

Paste the new key. The worker picks it up immediately, no redeploy needed.

### Viewing your secrets

```bash
wrangler secret list
```

You'll see `ANTHROPIC_API_KEY` listed but not its value (Cloudflare doesn't let you read secrets back — that's the point).

### Deleting a secret

```bash
wrangler secret delete ANTHROPIC_API_KEY
```

---

## Customizing the Fortunes

The personality of the misfortune cookie is controlled by the `SYSTEM_PROMPT` at the top of `src/worker.js`. To change the tone, voice, or rules:

1. Edit `SYSTEM_PROMPT` in `src/worker.js`
2. Run `wrangler deploy`

Examples of things you can tweak:
- **Length** — change `1–2 sentences maximum` to whatever you want
- **Voice** — make it nicer, meaner, more philosophical, more chaotic
- **Format** — change or remove the `UNLUCKY: numbers` line
- **Topics** — change what it focuses on (procrastination, ego, etc.)

---

## Locking It Down for Public Use

Before sharing the URL publicly, do these two things in `src/worker.js`:

### 1. Restrict allowed origins

Find this line:
```js
const ALLOWED_ORIGINS = ['*'];
```

Replace `*` with the domain(s) where your HTML is hosted:
```js
const ALLOWED_ORIGINS = ['https://your-site.com', 'https://www.your-site.com'];
```

This prevents random websites from hitting your worker and burning your Anthropic credits.

### 2. Tune the rate limit

Find this line:
```js
const RATE_LIMIT_PER_MIN = 10;
```

Lower it (e.g. `5`) if you're worried about abuse, or higher (e.g. `30`) if your friends are spamming the cookie.

After changes: `wrangler deploy`.

---

## Hosting the Frontend

For just you, double-clicking `index.html` works fine.

To put it on the internet for free:

- **Cloudflare Pages** — easiest, same dashboard as your Worker. Drag `index.html` into Pages.
- **GitHub Pages** — push the file to a GitHub repo, enable Pages in settings.
- **Netlify / Vercel** — drag and drop, you'll get a URL.

After hosting, remember to update `ALLOWED_ORIGINS` in the worker to your hosted domain.

---

## Troubleshooting

**"Even the oracle is ghosting you. HTTP 500"**
The worker is missing the API key secret. Run `wrangler secret put ANTHROPIC_API_KEY`.

**"HTTP 502" or "Upstream error"**
Anthropic API rejected the request. Most common cause: your account is out of credits. Check [console.anthropic.com](https://console.anthropic.com) → Plans & Billing.

**"HTTP 429: Even bad luck has a cooldown"**
You hit the rate limit (10 requests/minute by default). Wait a minute or bump `RATE_LIMIT_PER_MIN` in the worker.

**"Failed to fetch" / CORS error in browser console**
The frontend can't reach the worker. Check:
1. `WORKER_URL` in `index.html` matches your deployed worker URL exactly (with `/fortune` on the end)
2. If you've locked down `ALLOWED_ORIGINS`, the page you're viewing the HTML from is in the list

**Worker URL doesn't load**
Make sure you ran `wrangler deploy` after creating it. Check status at [dash.cloudflare.com](https://dash.cloudflare.com) → Workers & Pages.

---

## Costs

- **Cloudflare Workers** — free tier: 100,000 requests/day. You will not hit this with a personal cookie app.
- **Anthropic API** — pay-as-you-go. With Claude Sonnet 4 and a 200-token cap per response, each fortune costs roughly half a cent. $5 of credits will run thousands of fortunes.

---

## File Reference

| File | What it does | Deployed where |
|---|---|---|
| `wrangler.toml` | Tells Wrangler the worker's name and entry point | Local only |
| `src/worker.js` | Backend code that calls the Anthropic API | Cloudflare Workers |
| `index.html` | The frontend page users see | Your browser (or hosted) |

---

## License

MIT (or whatever you want — it's your cookie).
