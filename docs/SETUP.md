# Setup & Deployment

## Prerequisites

- [Bun](https://bun.sh) >= 1.0
- [Turso CLI](https://docs.turso.tech/cli/installation)

## 1. Turso credentials

```bash
# Org name (personal username or org slug)
turso org list

# Platform API token (creates per-user DBs at runtime)
turso auth api-tokens mint openkani
```

## 2. Create group & databases

```bash
# Group — all DBs belong to one group
turso group create openkani

# Group auth token — connects to any DB in the group
turso group tokens create openkani

# Template DB — new per-user DBs are cloned from this
turso db create wani-template --group openkani

# Registry DB — maps Bearer tokens → user IDs
turso db create wani-registry --group openkani
```

## 3. Environment variables

```bash
cp .env.example .env
```

| Variable | Description |
|----------|-------------|
| `TURSO_API_TOKEN` | Platform API token — creates/deletes per-user databases |
| `TURSO_ORG` | Turso org slug (or personal username) |
| `TURSO_GROUP` | Group name — all databases belong to this group |
| `TURSO_DATABASE_NAME` | Template database name — new user DBs seeded from this |
| `TURSO_REGISTRY_DATABASE_NAME` | Registry database — stores token-to-user mappings |
| `TURSO_GROUP_AUTH_TOKEN` | Group auth token — connects to any DB in the group |

## 4. Push schemas & run

```bash
bun install
bun run db:push:template   # push schema to template DB
bun run db:push:registry   # push schema to registry DB
bun run dev                # http://localhost:3000, hot reload
```

## 5. Migrate a user

```bash
curl -X POST http://localhost:3000/v2/migrate \
  -H "Content-Type: application/json" \
  -d '{"wanikani_api_key": "YOUR_WANIKANI_API_KEY"}'
```

Response:
```json
{
  "status": "completed",
  "user_id": "...",
  "db_name": "...",
  "counts": { "subjects": 9000, "assignments": 5000 },
  "token": "bearer-token-for-subsequent-requests"
}
```

Save the `token` — use as `Authorization: Bearer <token>` for all subsequent requests.

### Re-migrate

Wipe and re-import all data:

```bash
curl -X POST http://localhost:3000/v2/migrate?force=true \
  -H "Content-Type: application/json" \
  -d '{"wanikani_api_key": "YOUR_KEY"}'
```

## Deploy to Vercel

### API

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FsarmientoF%2FOpenKani&env=TURSO_API_TOKEN,TURSO_ORG,TURSO_GROUP,TURSO_DATABASE_NAME,TURSO_REGISTRY_DATABASE_NAME,TURSO_GROUP_AUTH_TOKEN&envDescription=Turso%20credentials%20for%20the%20OpenKani%20API&project-name=openkani-api&repository-name=openkani-api)

Vercel auto-detects Hono from `package.json` and uses `@vercel/hono`. The `build` script pre-bundles `src/index.ts` → `dist/index.js` via esbuild.

Set the same env vars from your `.env` in Vercel project settings.

> **Build note**: `hono`, `@libsql/client`, `libsql`, `@tursodatabase/api` kept external so Vercel's nft correctly traces native `.node` binaries.

### Web client

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FsarmientoF%2FOpenKani&env=VITE_API_URL&envDescription=URL%20of%20your%20deployed%20OpenKani%20API%20(e.g.%20https%3A%2F%2Fopenkani.vercel.app)&project-name=openkani-web&repository-name=openkani-web)

| Env var | Description |
|---------|-------------|
| `VITE_API_URL` | URL of your deployed OpenKani API (e.g. `https://openkani.vercel.app`) |

### Local web client

```bash
cd apps/kanji-school
bun install
bun run dev        # :5174
```

Log in → enter WaniKani API key → check "Migrate to custom backend" → done.

## Free tier limits

| Service | Plan | Limits |
|---------|------|--------|
| **Vercel** | Hobby (free) | 100GB bandwidth, serverless functions |
| **Turso** | Starter (free) | 100 databases, 9GB total storage, 1B row reads/mo |

Enough for ~95+ users on free tier (template + registry + 1 DB per user).
