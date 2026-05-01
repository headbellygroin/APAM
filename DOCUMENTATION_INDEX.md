# Documentation index (`C:\Bolt Files\APAM`)

High-level markdown maintained alongside the app (omit `node_modules`).

| Document | Audience | Summary |
|----------|----------|---------|
| [README.md](./README.md) | Developers | Entry point, strategy model summary, doc links |
| [PROJECT_WORKFLOW.md](./PROJECT_WORKFLOW.md) | Developers | Git, Bolt.new, Supabase migrations, localStorage keys |
| [PLATFORM_OVERVIEW.md](./PLATFORM_OVERVIEW.md) | Users / PM | Features, pages, env hints |
| [AI_SYSTEM_DOCUMENTATION.md](./AI_SYSTEM_DOCUMENTATION.md) | Engineers | Architecture, AI engine APIs, schema overview (**rotate keys if ever pasted**) |
| [FEATURE_GUIDE.md](./FEATURE_GUIDE.md) | Power users | Master AI, real-world events, anomalies |
| [QUICK_REFERENCE.md](./QUICK_REFERENCE.md) | Operators | Short tables and workflows |
| [SYSTEM_FEATURES.md](./SYSTEM_FEATURES.md) | Support | FAQ-style explanations |
| [STRATEGY_OVERLAY_DESIGN.md](./STRATEGY_OVERLAY_DESIGN.md) | Designers / engineers | Overlay layering model |
| [API_RATE_LIMITS.md](./API_RATE_LIMITS.md) | Engineers | Rate limits & caching narrative |
| [B2B_SAAS_MONETIZATION_STRATEGY.md](./B2B_SAAS_MONETIZATION_STRATEGY.md) | Business | Separate monetization notes |

Strategy source texts also live under **`src/lib/strategies/`** (`.txt` references).

When behavior changes, update **README** + **AI_SYSTEM_DOCUMENTATION** + **PLATFORM_OVERVIEW** first; fold details into **SYSTEM_FEATURES** / **QUICK_REFERENCE** as needed.
