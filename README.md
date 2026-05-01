# APAM — AI-assisted paper trading platform

**Canonical folder:** `C:\Bolt Files\APAM` — treat this as the only active checkout (avoid duplicate trees under OneDrive or other sync copies).

React + TypeScript + Vite front end; Supabase (Postgres + Auth + Edge Functions) for persistence and API proxy; Tradier or configured provider for delayed market data.

## Quick start

```bash
npm install
npm run dev
```

Configure `.env` with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (see **[PROJECT_WORKFLOW.md](./PROJECT_WORKFLOW.md)** for migrations and hosting).

## How strategies work now

| Area | Role |
|------|------|
| **Settings → Strategy library** | Read-only rulesets + expandable guides — **not** a global “active strategy” switch |
| **AI Recommendations / Live Signals** | Checkbox **parallel base strategies** for scans; stored in browser (`apam.marketScanner.strategyIds.v1`) |
| **Training accounts** | Each account has **one base `strategy_id`** + optional **overlays** (`strategy_overlays` table); simulator blends overlays after `generateSetup` |
| **Background runner** (`Layout` mounts `MarketScanBackgroundRunner`) | Uses the **same** saved scanner strategy list and persists scans/signals with **`symbol + strategy_id`** deduping |

## Documentation map

| File | Contents |
|------|----------|
| [PLATFORM_OVERVIEW.md](./PLATFORM_OVERVIEW.md) | User-facing features & flows |
| [AI_SYSTEM_DOCUMENTATION.md](./AI_SYSTEM_DOCUMENTATION.md) | Architecture, AI engine, schema notes (**no secrets** — use `.env`) |
| [FEATURE_GUIDE.md](./FEATURE_GUIDE.md) | Master AI, anomaly/events workflows |
| [QUICK_REFERENCE.md](./QUICK_REFERENCE.md) | Short operational cheatsheets |
| [SYSTEM_FEATURES.md](./SYSTEM_FEATURES.md) | Q&A style capability notes |
| [STRATEGY_OVERLAY_DESIGN.md](./STRATEGY_OVERLAY_DESIGN.md) | Overlay model & DB intent |
| [API_RATE_LIMITS.md](./API_RATE_LIMITS.md) | Tradier-style caching strategy |
| [PROJECT_WORKFLOW.md](./PROJECT_WORKFLOW.md) | **Git, Bolt.new, Supabase** — read this for deployment |

See **[DOCUMENTATION_INDEX.md](./DOCUMENTATION_INDEX.md)** for a fuller list.

## Security

Never commit API keys or Supabase service-role keys. The docs deliberately omit real credentials; if any leaked elsewhere, rotate them at the provider.
