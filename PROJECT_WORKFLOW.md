# Project workflow: Git, Bolt.new, Supabase, and Cursor

## Answering common questions

### Do docs/code update “in real time”?

No automatic sync. When you or an assistant edits **`C:\Bolt Files\APAM`**, files change **on disk immediately**. Nothing pushes to Supabase or Bolt.new until **you** run deploy steps, apply migrations, or push Git.

### Single folder rule

Use **`C:\Bolt Files\APAM`** only. Delete or archive duplicate copies (e.g. under OneDrive) after copying anything unique into this tree, so Cursor/Bolt/Git always point here.

### Supabase — do you still need to fix / migrate things?

**Yes, when schema and code diverge.** This repo’s SQL lives in **`supabase/migrations`**. Any new columns or tables the app expects must exist on your **hosted** Supabase project.

Typical approaches:

1. **Supabase CLI** (recommended): `supabase link` → `supabase db push` (or generate migration from Dashboard diff).
2. **Dashboard SQL**: open SQL editor, run the migration files in order for anything missing.

Cursor assistants **cannot** reach your hosted Supabase unless you configure MCP or paste errors — **you** apply migrations or grant tooling access.

### Git + Bolt.new

Common pattern:

1. Initialize Git in **`C:\Bolt Files\APAM`** (if not already): `git init`, add remote (GitHub/GitLab).
2. Commit and push from your machine.
3. In Bolt.new (or any host), **import from Git** / connect the repo and pull.

Bolt.new is useful for scaffolding and broad edits; use Cursor here for tight refactors and keeping **`supabase/migrations`** aligned.

### Can the assistant update Supabase if you “give access”?

Only if you expose it through an integration (Supabase CLI in terminal with your login, MCP server, or pasted migration errors). There is no magic remote access by default.

## LocalStorage keys (browser-only config)

| Key | Purpose |
|-----|---------|
| `apam.marketScanner.strategyIds.v1` | JSON array of base strategy IDs for parallel scans |
| `apam.backgroundScan.v1` | Background automation (segment, interval, session window, EOD, etc.) |

These are **per browser profile**, not shared across devices unless you export/import.

## Background automation UI note

`MarketScanBackgroundRunner` reads **`apam.backgroundScan.v1`**. If you need on-screen controls for that blob again, re-add a small Settings section or a dedicated “Automation” panel — the runner component itself stays mounted from **`Layout.tsx`**.
