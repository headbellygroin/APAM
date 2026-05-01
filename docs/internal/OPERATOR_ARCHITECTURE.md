# Operator architecture reference (CONFIDENTIAL TO OPERATORS)

This document describes behavior that **must not appear in subscriber-facing manuals**. It exists so builders (and Cursor) have a single place for lineage, fleet-wide synthesis, and admin-gated surfaces.

---

## Distribution rule

- **Subscribers / normal accounts**: document only core flows (paper trading, AI Recommendations, Live Signals, training bots, journal, analytics, etc.).
- **Operators**: full picture below + codebase paths.

---

## Product intent: who sees what

| Audience | Goal | Product scope |
|----------|------|----------------|
| **Regular subscribers** | Volume + labeled outcomes improve models over time | Core app: bots, scans, paper execution, personal AI drift/neural views, standard nav items |
| **Operator** (allowlisted admin) | Tune fleet-wide synthesis, historical replay, pattern/event tooling | Same core **plus** admin-only routes (see below) |

**Monetization note:** Subscription scale improves signal quality only if telemetry and learning loops are sound; accuracy work belongs in orchestration, drift, and evaluation pipelines—not in customer-facing copy.

---

## How operator access is gated

1. **`useAuth` (`src/hooks/useAuth.tsx`)**  
   - Sets `isAdmin` when:
     - Email matches built-in allowlist (`DEFAULT_MASTER_ADMIN_EMAILS`, includes `usmchayward@yahoo.com` and legacy `master@trading.com`), and/or  
     - `VITE_MASTER_ADMIN_EMAILS` (comma-separated), and/or  
     - Row exists in **`admin_users`** for `auth.uid()` (needed for **RLS**: `public.is_admin()` policies).

2. **Navigation (`src/components/Layout.tsx`)**  
   - Routes labeled below are **only added to `navItems` when `isAdmin` is true.**

3. **Route guards**  
   - Pages such as **`MasterAI.tsx`** and **`HistoricalFleet.tsx`** also check `isAdmin` and redirect or hide primary UI if false.

**Important:** UI hiding is not security by itself—RLS and policies on sensitive tables remain authoritative.

---

## Operator-only routes (current app)

When `isAdmin`:

| Path | Page | Role |
|------|------|------|
| `/master-ai` | `MasterAI.tsx` | Fleet-wide synthesis UI (snapshots, sync, orchestrator hooks) |
| `/real-world-events` | Real-world events | Anomalies, manual events, pattern catalog |
| `/pattern-discovery` | Pattern discovery | Automated pattern mining across accounts |
| `/historical-fleet` | `HistoricalFleet.tsx` | Accelerated historical simulations + Master-linked fleet helpers |
| `/external-data` | External data | Supplementary datasets |
| `/market-archive` | Market archive | Archived candle/storage tooling |

**Note:** `/admin` loads **`AdminDashboard.tsx`** but may not appear in the sidebar—bookmark or link internally.

Subscribers never see these nav entries when `isAdmin` is false.

---

## Multi-tier AI model (engineering mental model)

1. **Training AI accounts** (`ai_training_accounts`, `trainingAccountService`)  
   Paper bots with per-account **`strategy_id`**, **`strategy_overlays`**, personality, drift. Produce trades and learning artifacts used upstream.

2. **Fleet-wide “Master” synthesis layer** (`src/lib/masterAI.ts`, `master_ai_state`, snapshots)  
   Aggregates **contributions** from many users’ evolution state (weights, thresholds, patterns), computes **collective intelligence** and **boost reports**, and persists operator-visible state. This is **not** the same as a single subscriber’s personal AI—it’s the cross-account blend the operator curates.

3. **Orchestration / lineage** (`src/lib/masterAIOrchestrator.ts`, `lineageService.ts`)  
   - Rank training accounts, spawn/retire/absorb recommendations within caps (`MAX_SPAWNED_ACCOUNTS`, trade thresholds, etc.).  
   - **`recordSpawnLineage` / `recordPromotionLineage`** → **`ai_account_lineage`** (parent/child graph, generation, event types `spawn` \| `promote` \| `evolve` \| `create`).  
   - Spawn audit: **`master_ai_spawn_log`** (`action` ∈ `spawn` \| `retire` \| `absorb`, `spawned_account_id`, etc.).  
   - Training rows may include **`spawned_by_master`**, **`generation`** (see migrations under `supabase/migrations/*master*`).

4. **Evolved rulesets / pattern promotion**  
   Validated patterns can feed **`ai_evolved_rulesets`** and discovery flows—tie-break logic lives in pattern services and migrations.

5. **End-of-day reviews**  
   **`master_ai_eod_reviews`** stores structured review outputs (including spawn recommendations JSON where applicable).

---

## Key source files (quick map)

| Area | Files |
|------|--------|
| Synthesis API | `src/lib/masterAI.ts` (`synthesizeMasterAI`, `saveMasterAIState`, types `MasterAISynthesis`, `UserContribution`, `CollectiveIntelligence`) |
| Orchestrator | `src/lib/masterAIOrchestrator.ts` (ranking, spawn/evolution thresholds, name tiers `MASTER_NAME_TIERS`) |
| Fleet helpers | `src/lib/masterAIFleetService.ts` |
| Lineage | `src/lib/lineageService.ts` → **`ai_account_lineage`** |
| UI | `src/pages/MasterAI.tsx`, `src/components/MasterAIOrchestrator.tsx`, `src/components/MasterAIFleetForm.tsx` |
| Historical fleet | `src/pages/HistoricalFleet.tsx`, `src/lib/historicalFleetService.ts` |

---

## Parent–child relationships (data model)

- **`ai_account_lineage`**: append-only style lineage events linking **`account_id`** ↔ **`parent_account_id`**, **`generation`**, **`event_type`**, **`blend_weight`**, **`performance_snapshot`**.  
- **`master_ai_spawn_log`**: operational log for spawn/retire/absorb tied to training account IDs.  
- **`ai_training_accounts`**: bot metadata; columns such as **`spawned_by_master`** and **`generation`** tie rows back to orchestrated spawns.

Building new features (e.g. monetization tiers) should preserve **clear separation**: subscriber rows vs operator-only aggregates, and **never** expose orchestration URLs in customer docs.

---

## Overlay / strategy note

Training accounts use **base `strategy_id` + overlays** (`strategy_overlays`). Fleet-wide synthesis can inform weights/thresholds at the operator layer; per-account blending remains in the simulator/engine paths—see `STRATEGY_OVERLAY_DESIGN.md` (public) for layering concepts without operator branding.

---

## Secrets & compliance

- Do **not** paste API keys or Tradier credentials into this folder or any markdown tracked in Git.  
- If subscriber data feeds aggregation, document **privacy/consent** separately (legal)—this file is technical only.

---

## Changelog discipline

When you change orchestration thresholds, new admin routes, or RLS on Master tables, update **this file** so internal references stay accurate; **do not** mirror those details in root-level customer guides.
