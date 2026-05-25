# Hedera Agent App

A Hedera Agent Kit starter project. Ships two run modes out of the box:

- `npm run web` — Next.js chat UI with optional human-in-the-loop transaction signing
- `npm run cli` — interactive terminal chat against the same agent

## Quick start

```bash
cp .env.example .env
# fill HEDERA_OPERATOR_ID, HEDERA_OPERATOR_KEY, and OPENAI_API_KEY (or ANTHROPIC_API_KEY)

npm install
npm run web   # open http://localhost:3000
# or
npm run cli
```

## What to edit

All agent wiring lives in **`shared/config.js`** — a data-only module:

- `plugins` — the list of Hedera Agent Kit plugins available to the agent
- `systemPrompt` — the inline system prompt
- `mode` — `"auto"` (server signs and submits) or `"human"` (browser wallet signs)
- `hooks` — policies and audit hooks applied to every tool call
- `config` — per-plugin runtime configuration
- `client` — the Hedera SDK client bound to your operator

Each runtime (CLI and web) reads from `shared/config.js` and constructs its own toolkit + LLM. Both run modes pick up edits to that file. The web app always uses the Vercel AI SDK; the CLI uses whichever framework was selected at scaffold time (`--framework ai-sdk` or `--framework langchain`).

## Web search (SearXNG)

The agent has a built-in web search tool backed by [SearXNG](https://docs.searxng.org/), a self-hosted, privacy-respecting meta-search engine. Both the CLI and the web app share the same tool; `SEARXNG_URL` points both at the same instance.

### Quick start with Docker

A minimal `searxng/settings.yml` is already included in the repo. Run SearXNG with:

```bash
docker compose up -d
```

Then verify it is reachable:

```bash
curl "http://localhost:8080/search?q=hedera&format=json" | head -c 200
```

### Environment variable

| Variable | Purpose | Default |
|---|---|---|
| `SEARXNG_URL` | Base URL of your SearXNG instance | `http://localhost:8080` |

Add it to your `.env` if you run SearXNG on a different host or port:

```
SEARXNG_URL=http://localhost:8080
```

### Disabling web search

If you do not want to run SearXNG, remove `webSearchTool` / `webSearchToolAiSdk` from the tool lists in `cli/index.js` and `web/src/features/chat-hedera/server/toolkit.js`. The agent will fall back to its training data for any question that would otherwise trigger a search.

## Web page fetching (Crawl4AI)

The agent has a built-in `fetch_page` tool backed by [Crawl4AI](https://docs.crawl4ai.com/), a self-hosted web crawler that converts any URL into clean markdown. The agent uses it to read documentation pages, blog posts, HashScan explorer links, or any URL the user provides — automatically stripping navigation, footers, and boilerplate so only the relevant body content is sent to the LLM.

Both the CLI and the web app share the same tool via `shared/crawl-tool.js`.

### Quick start with Docker

Crawl4AI is included in the same `docker-compose.yml` as SearXNG. Start both with:

```bash
docker compose up -d
```

Then verify Crawl4AI is reachable:

```bash
curl -s -X POST http://localhost:11235/crawl \
  -H "content-type: application/json" \
  -d '{"urls":["https://example.com"],"crawler_config":{"type":"CrawlerRunConfig","params":{}}}' \
  | python3 -m json.tool | head -30
```

The response should be a JSON object with `"success": true` and a `results` array containing the page markdown.

### Environment variables

| Variable | Purpose | Default |
|---|---|---|
| `CRAWL4AI_URL` | Base URL of your Crawl4AI instance | `http://localhost:11235` |
| `CRAWL4AI_API_TOKEN` | Bearer token if the container is started with JWT auth enabled | _(none)_ |

Add to your `.env` if you run Crawl4AI on a different host, port, or with auth:

```
CRAWL4AI_URL=http://localhost:11235
CRAWL4AI_API_TOKEN=
```

Authentication is **disabled by default** in the standard Crawl4AI Docker image. Set `CRAWL4AI_API_TOKEN` only if you started the container with JWT security enabled.

### Disabling web page fetching

If you do not want to run Crawl4AI, remove `crawlTool` / `crawlToolAiSdk` from the tool lists in `cli/index.js` and `web/src/features/chat-hedera/server/toolkit.js`. The agent will still be able to search the web via SearXNG but will not be able to read the full content of individual pages.

## Third-party plugins

Plugins outside `@hashgraph/hedera-agent-kit/plugins` — including Saucerswap, Memejob, Pyth, Chainlink, and CoinCap — are **not bundled with downloads from the Hedera Portal**. If you selected one in the Agent Lab wizard, your downloaded zip ships with the 10 core plugins only.

To add a third-party plugin manually:

1. `npm install <package-name>` (e.g. `npm install chainlink-pricefeed-plugin`)
2. Import the plugin symbol in `shared/config.js` and add it to the `plugins` array.
3. If the plugin needs runtime config, add a key to the `config` export per the plugin's docs (e.g. `saucerswap: { apiKey: process.env.SAUCERSWAP_API_KEY }`).
4. Set any required env vars in `.env`.

## Switching frameworks

Re-download the project from the Hedera Portal with the other framework selected, then copy your plugin selection + custom prompt into the new `shared/config.js`.

## Project layout

```
shared/config.js             # single edit surface for agent wiring (data only)
cli/index.js                 # terminal chat (AI SDK or LangChain, per scaffold)
web/                         # Next.js project root
  src/app/page.jsx           # chat home
  src/app/api/chat/route.js  # chat-completion endpoint (AI SDK)
  src/features/              # chat UI + Hedera integration + wallet
.env                         # operator credentials and LLM keys (never commit)
```

## Environment variables

| Variable | Purpose |
|---|---|
| `HEDERA_OPERATOR_ID` | Account ID like `0.0.x` |
| `HEDERA_OPERATOR_KEY` | ECDSA private key (DER hex or `0x`-prefixed 64-hex) |
| `HEDERA_NETWORK` | `testnet` (default) or `mainnet` |
| `LLM_PROVIDER` | `openai` or `anthropic` |
| `LLM_MODEL` | Model id; provider-specific defaults apply if unset |
| `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` | Pick the one matching `LLM_PROVIDER` |
| `SEARXNG_URL` | Base URL of your SearXNG instance | `http://localhost:8080` |
| `CRAWL4AI_URL` | Base URL of your Crawl4AI instance | `http://localhost:11235` |
| `CRAWL4AI_API_TOKEN` | Bearer token if Crawl4AI JWT auth is enabled | _(none)_ |

## Deploying the web app to Vercel

`web/` is a standard Next.js 16 project root. `web/next.config.js` already pins `outputFileTracingRoot` one level up so the bundler picks up `shared/config.js` from outside the Next.js root — no extra Vercel config needed for that.

### Step by step (dashboard)

1. **Push your project to Git.**

   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   # then create a GitHub/GitLab/Bitbucket repo and push
   ```

   Confirm `.env` is in `.gitignore` (the scaffold ships it that way) — never commit operator credentials.

2. **Import the repo in Vercel.** Go to <https://vercel.com/new> and pick your repo.

3. **Set the Root Directory to `web`.** In the project settings during import, click "Edit" next to the auto-detected root and change it to `web`. This is critical — the scaffold's root holds `shared/` + `cli/`; Vercel deploys only what's under the Root Directory you choose.

4. **Add environment variables.** Project Settings → Environment Variables. Add each for **Production**, **Preview**, and **Development**:

   | Variable | Value |
   |---|---|
   | `HEDERA_OPERATOR_ID` | Your account ID (e.g. `0.0.1234`) |
   | `HEDERA_OPERATOR_KEY` | Your ECDSA private key |
   | `HEDERA_NETWORK` | `testnet` or `mainnet` |
   | `LLM_PROVIDER` | `openai` or `anthropic` |
   | `LLM_MODEL` | (optional) e.g. `gpt-4o-mini` |
   | `OPENAI_API_KEY` *or* `ANTHROPIC_API_KEY` | Pick the one matching `LLM_PROVIDER` |

5. **Click Deploy.** First build takes ~2–3 minutes. Subsequent commits to the default branch auto-deploy.

### Step by step (Vercel CLI)

```bash
npm install -g vercel
vercel login
vercel link             # accept defaults; when asked for project root, enter: web
vercel env add HEDERA_OPERATOR_ID production
vercel env add HEDERA_OPERATOR_KEY production
vercel env add HEDERA_NETWORK production
vercel env add LLM_PROVIDER production
vercel env add LLM_MODEL production
vercel env add OPENAI_API_KEY production   # or ANTHROPIC_API_KEY
vercel --prod
```

### Notes

- `cli/` is not deployed — Vercel only serves the Next.js app under `web/`. To run the CLI in production, run it locally or in a separate container with the same `.env`.
- Edits to `shared/config.js` (e.g. changing the plugin set or system prompt) require a new commit and redeploy.
- For local dev against Vercel's environment, `vercel dev` runs the project the way Vercel does and reads the same env vars from the dashboard.
