# Tradier API Rate Limits & Strategy

## Current API Limits (Tradier Sandbox)
- **120 requests per minute** per API key
- **15-minute delayed data** (not real-time)
- Data includes: quotes, historical candles, market data

## Our Caching Strategy

### Current Implementation
- Cache refreshes every 15 minutes
- One fetch = one API call per symbol
- 100 symbols = 100 API calls
- With batching (10 at a time with 100ms delay) = ~10 seconds total
- Well within 120 requests/minute limit

### Data Granularity
**What we GET from Tradier:**
- Daily candles (OHLCV) - historical data
- Current quote - last price as of 15 minutes ago
- Data is already 15-minute delayed by Tradier

**What this means:**
- When we fetch at 10:00 AM, we get data from 9:45 AM
- When we fetch at 10:15 AM, we get data from 10:00 AM
- The 15-minute delay is from the exchange, not our cache

### Proposed Intraday Strategy
Since data is 15-min delayed anyway, we can:
1. **Fetch every 15 minutes** (matches exchange delay)
2. **Get 1-minute candles** for each symbol (Tradier supports this)
3. **Cache all 15 minutes worth of 1-min bars**
4. **AIs can analyze at 1-min, 5-min, or 15-min intervals**

This means:
- Still only 100 API calls every 15 minutes
- AIs get granular data to make decisions every 1-5 minutes
- We stay well within rate limits

## AI Training Account Risk Management

### Bankruptcy Protection
Each AI gets:
- **Starting Balance:** $100,000 (sandbox money)
- **Critical Reserve:** $20,000 (20% of start)
- **Warning Level:** $50,000 (50% of start)
- **Comfortable Level:** $80,000+ (80%+ of start)

### Risk Behavior by Balance
1. **Bankrupt (<$20,000):**
   - AI pauses all trading
   - Marked as "bankrupt" in database
   - Can analyze but not execute
   - Waits for manual intervention or reset

2. **Critical ($20,000-$50,000):**
   - Maximum 1% risk per trade (down from normal)
   - Only takes highest confidence setups (8.5+ odds score)
   - Reduces position size by 50%
   - Conservative personality traits amplified

3. **Warning ($50,000-$80,000):**
   - Normal risk parameters
   - Follows personality-based risk profile
   - Standard position sizing

4. **Comfortable ($80,000+):**
   - Can take slightly higher risk if personality allows
   - Aggressive AIs can use full personality risk
   - Position sizing based on personality

## AI Personality System

Each AI spawns with a random personality that determines:

### Risk Profile (1-10 scale)
- **1-3: Conservative** - 0.5-1% risk per trade, high odds only (8+)
- **4-7: Moderate** - 1-2% risk per trade, good odds (7+)
- **8-10: Aggressive** - 2-3% risk per trade, decent odds (6+)

### Trading Frequency (1-10 scale)
- **1-3: Patient** - Only perfect setups, may skip days
- **4-7: Active** - Regular trading, balanced approach
- **8-10: Hyperactive** - Constant scanning, high trade volume

### Adaptation Speed (1-10 scale)
- **1-3: Rigid** - Sticks to original strategy, slow drift
- **4-7: Balanced** - Moderate learning and adaptation
- **8-10: Dynamic** - Rapid learning, quick drift adjustments

### Example AI Personalities
1. **"The Sniper"** - Conservative risk (2), Patient (2), Rigid (3)
2. **"The Gambler"** - Aggressive risk (9), Hyperactive (8), Dynamic (7)
3. **"The Professor"** - Moderate risk (5), Active (5), Balanced (5)
4. **"The Cowboy"** - Aggressive risk (10), Hyperactive (9), Rigid (4)

## Implementation Plan

1. **Enhanced Caching:**
   - Store 1-minute candles in cache
   - Provide 1-min, 5-min, 15-min aggregated views
   - AIs can check every 1-5 minutes using cached data

2. **Personality Traits:**
   - Add personality columns to training accounts
   - Generate random personality on spawn
   - Use personality in risk calculations

3. **Bankruptcy System:**
   - Check balance before every trade
   - Adjust risk based on balance tier
   - Pause trading if bankrupt
   - Track bankruptcy events

4. **Risk Management:**
   - Dynamic position sizing based on balance + personality
   - Confidence threshold adjusts with balance
   - Track risk-adjusted returns per personality type
