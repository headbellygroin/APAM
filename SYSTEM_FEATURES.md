# Trading Platform System Features - Questions Answered

## Fibonacci 90-Minute Opening Range Strategy

**Q: Is the 90-minute opening range strategy automatic or an option?**

Fibonacci Opening Range can appear as a **registered strategy** (base or overlay, depending on registry setup). **Training accounts** pick a **single base `strategy_id`** when created; optional **overlays** are chosen on the same flow and stored in **`strategy_overlays`**.

**Important:** **Settings** is a **strategy library / guides** only — it does **not** toggle what runs in production scans. To scan with Fibonacci OR alongside other rulesets, enable it as a **base strategy** on **AI Recommendations** and **Live Signals** if it is registered as a base strategy; if it is overlay-only, it affects training bots through **`analyzeOverlay`**, not the main scan checklist unless wired as base.

---

## API Calls & Market Data

**Q: Does the 15-minute API call include data down to the minute?**

YES! When we call Tradier every 15 minutes, we can request:
- 1-minute candles
- 5-minute candles
- 15-minute candles
- 30-minute candles
- 1-hour candles
- Daily candles

The 15-minute delay is from the exchange, not our choice. Tradier provides delayed market data that's 15 minutes behind real-time.

**How it works:**
1. At 10:00 AM, we fetch data → Get bars from 9:45 AM
2. At 10:15 AM, we fetch data → Get bars from 10:00 AM
3. Cache stores all this data
4. AIs analyze whenever they want using cached data

**Current API usage:**
- 120 requests/minute limit
- We use ~100 requests every 15 minutes (one per symbol in batches)
- Well within limits

---

## Real-Time Data Simulation for Training AIs

**Q: Do training AIs get data fed to them as if it were real-time?**

Currently: Training AIs get all cached data at once and scan based on their `scan_interval_seconds` setting.

**Your vision makes sense!** We should:
1. Cache 15 minutes of 1-minute bars every API call
2. Feed this data to AIs minute-by-minute (or 30-second intervals)
3. Each AI scans according to personality:
   - Hyperactive AI: Checks every 30 seconds
   - Active AI: Checks every 5 minutes
   - Patient AI: Checks every 15 minutes

This creates realistic training where AIs:
- Wait for their next "tick" of data
- Make decisions in real-time simulation
- Can't see future bars (no look-ahead bias)
- Trade based on their personality's patience level

**Implementation needed:** Data replay service that feeds cached bars to training AIs progressively.

---

## Market Scanner

**Q: Does Market Scanner only work when market is open?**

The Market Scanner can run anytime but:
- Data is always 15 minutes delayed
- When market is CLOSED: Shows last known prices from previous close
- When market is OPEN: Shows prices from 15 minutes ago

**Live Signals scanning:**
- Runs manually when you click "Scan"
- Does NOT auto-scan continuously
- Can scan watchlist OR market segments (S&P 500, NASDAQ, etc.)
- When market is closed, it analyzes last available data

**To stop scanning:** Just wait - it only runs once per button click. If it appears to be scanning continuously, that's a bug we can fix.

---

## AI Training System Components

### AI Rulebook
**When does it start being used?**

The AI Rulebook is always active when you have a trading strategy selected. It shows:
- Current strategy rules
- Learned adjustments (if using Adaptive mode)
- Drift decisions
- Pattern overrides

**Location:** AI Rulebook page

---

### AI Neural View
**Q: Which AI does this view represent?**

"AI Neural View" shows **your** personal AI learning state:
- Evolution notifications
- Earned names
- Drift statistics
- Learning weights

It reflects how the system adapts based on **your** activity and outcomes. Training accounts (paper bots) use separate per-account strategy and evolution settings.

---

## Paper Trading

**Q: Error creating paper account - foreign key constraint**

FIXED! The issue was that `paper_accounts` referenced a `profiles` table. Changed to reference `auth.users` directly.

You can now create paper trading accounts without errors.

---

## Journal Entries

**Q: Error creating journal entries - foreign key constraint**

FIXED! Same issue as paper trading - now references `auth.users` directly.

---

## Trade Plan Tab

**Purpose:** Pre-plan your trades before executing

**Use cases:**
- Document your trade thesis before entry
- Set entry/exit rules
- Review before trading
- Compare actual vs planned outcomes

**Typical workflow:**
1. AI suggests a trade
2. You open Trade Plan
3. Write down your thesis, entry, stop, target
4. Review if it matches your rules
5. Execute only if confident

---

## Decision Matrix

**Purpose:** Multi-factor trade evaluation

**Use cases:**
- Score trades across multiple criteria
- Systematic decision-making
- Reduce emotional trading
- Track which factors predict success

**Example factors:**
- Trend alignment (1-10)
- Risk/reward ratio (1-10)
- Pattern quality (1-10)
- Market conditions (1-10)

Total score > threshold = Take trade

---

## Settings vs scan configuration

**Q: Where do I pick Trade Surge vs APAM vs other strategies for scanning?**

- **Settings → Strategy library**: documentation only (read guides); **no global active strategy**.
- **AI Recommendations** and **Live Signals**: checkboxes for **base strategies** used for **`scanMarket`** (saved in browser storage).
- **Training AI create modal**: **base strategy** + optional **overlays** per account; **`trainingSimulator`** applies overlays after **`generateSetup`**.

Multiple strategies during a scan means more CPU/API work but mirrors “many scanners on the same universe.”

---

## Watchlist Add Symbol

**Status:** Should be working - button is properly wired

**Troubleshooting:**
1. Make sure you're logged in
2. Try entering symbol and pressing Enter
3. Or click symbol from search results
4. Check browser console for errors

If still broken, let me know the exact error message.

---

## Charts Breakdown

**Q: Can charts break down to 1 minute? Is that in our data?**

YES! Tradier supports 1-minute candles. When we fetch every 15 minutes, we can request 1-minute bars.

**Implementation needed:**
- Update Chart component to support 1-min timeframe
- Add 1-min, 5-min, 15-min selector buttons
- Use cached intraday data from market data cache

Currently charts likely only show daily bars. We need to add intraday timeframe options.

---

## AI Personality & Bankruptcy System

Each training AI has unique personality traits (1-10 scale):

**Risk Appetite:**
- Conservative (1-3): Max 1% risk per trade
- Moderate (4-7): 1-2% risk
- Aggressive (8-10): 2-3% risk

**Trade Frequency:**
- Patient (1-3): Only perfect setups
- Active (4-7): Regular trading
- Hyperactive (8-10): Scans constantly

**Adaptation Speed:**
- Rigid (1-3): Slow to change
- Balanced (4-7): Moderate learning
- Dynamic (8-10): Rapid adaptation

**Bankruptcy Protection:**
- Comfortable ($80K+): Full risk based on personality
- Warning ($50K-$80K): Normal parameters
- Critical ($20K-$50K): 50% position size, 8.5+ odds only
- Bankrupt (<$20K): Trading paused

AIs don't know they have unlimited funds - they manage risk as if it's real money. When they go broke, they stop trading until manually reset or recovered.

---

## Suggested product follow-ups (engineering backlog)

1. Add 1-minute chart timeframes where intraday data is available
2. Optional progressive bar replay for training simulators (minute-by-minute ticks)
3. Optional configurable auto-scan intervals for Live Signals / background runner

Core flows include personality-based training AI parameters, bankruptcy protection, and multi-strategy scans.