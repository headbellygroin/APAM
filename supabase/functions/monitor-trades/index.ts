import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const TRADIER_API_KEY = Deno.env.get("TRADIER_API_KEY") || "";
const USE_SANDBOX = Deno.env.get("TRADIER_USE_SANDBOX") !== "false";
const TRADIER_BASE_URL = USE_SANDBOX
  ? "https://sandbox.tradier.com/v1"
  : "https://api.tradier.com/v1";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface Trade {
  id: string;
  user_id: string;
  symbol: string;
  trade_type: "long" | "short";
  entry_price: number;
  stop_loss: number;
  target_price: number;
  position_size: number;
  paper_account_id: string;
}

interface Quote {
  last: number;
  symbol: string;
}

async function getQuote(symbol: string): Promise<Quote | null> {
  try {
    const response = await fetch(
      `${TRADIER_BASE_URL}/markets/quotes?symbols=${symbol}`,
      {
        headers: {
          Authorization: `Bearer ${TRADIER_API_KEY}`,
          Accept: "application/json",
        },
      }
    );

    if (!response.ok) {
      console.error(`Failed to fetch quote for ${symbol}`);
      return null;
    }

    const data = await response.json();
    const quote = data?.quotes?.quote;

    if (!quote) return null;

    return Array.isArray(quote) ? quote[0] : quote;
  } catch (error) {
    console.error(`Error fetching quote for ${symbol}:`, error);
    return null;
  }
}

async function checkAndCloseTrade(
  supabase: ReturnType<typeof createClient>,
  trade: Trade,
  currentPrice: number
): Promise<{ closed: boolean; reason?: string; profitLoss?: number }> {
  let shouldClose = false;
  let exitReason: "target" | "stop" | "time" | "manual" = "manual";
  let exitPrice = currentPrice;

  if (trade.trade_type === "long") {
    if (currentPrice >= trade.target_price) {
      shouldClose = true;
      exitReason = "target";
      exitPrice = trade.target_price;
    } else if (currentPrice <= trade.stop_loss) {
      shouldClose = true;
      exitReason = "stop";
      exitPrice = trade.stop_loss;
    }
  } else {
    if (currentPrice <= trade.target_price) {
      shouldClose = true;
      exitReason = "target";
      exitPrice = trade.target_price;
    } else if (currentPrice >= trade.stop_loss) {
      shouldClose = true;
      exitReason = "stop";
      exitPrice = trade.stop_loss;
    }
  }

  if (!shouldClose) {
    return { closed: false };
  }

  let profitLoss: number;
  if (trade.trade_type === "long") {
    profitLoss = (exitPrice - trade.entry_price) * trade.position_size;
  } else {
    profitLoss = (trade.entry_price - exitPrice) * trade.position_size;
  }

  const { error: updateError } = await supabase
    .from("simulated_trades")
    .update({
      status: "closed",
      exit_time: new Date().toISOString(),
      exit_price: exitPrice,
      profit_loss: profitLoss,
      exit_reason: exitReason,
      updated_at: new Date().toISOString(),
    })
    .eq("id", trade.id);

  if (updateError) {
    console.error(`Error closing trade ${trade.id}:`, updateError);
    return { closed: false };
  }

  const { data: account } = await supabase
    .from("paper_accounts")
    .select("*")
    .eq("id", trade.paper_account_id)
    .single();

  if (account) {
    const newBalance = account.current_balance + profitLoss;
    const newTotalPL = account.total_profit_loss + profitLoss;

    await supabase
      .from("paper_accounts")
      .update({
        current_balance: newBalance,
        total_profit_loss: newTotalPL,
        updated_at: new Date().toISOString(),
      })
      .eq("id", account.id);
  }

  await supabase
    .from("ai_recommendations")
    .update({
      outcome: profitLoss > 0 ? "win" : "loss",
      updated_at: new Date().toISOString(),
    })
    .eq("simulated_trade_id", trade.id);

  await supabase.from("ai_learning_history").insert({
    user_id: trade.user_id,
    event_type: "trade_auto_closed",
    performance_metric: profitLoss,
    adjustments: {
      symbol: trade.symbol,
      outcome: profitLoss > 0 ? "win" : "loss",
      profitLoss,
      exitReason,
      exitPrice,
      currentPrice,
    },
  });

  return { closed: true, reason: exitReason, profitLoss };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    if (!TRADIER_API_KEY) {
      return new Response(
        JSON.stringify({ error: "Tradier API key not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: openTrades, error: tradesError } = await supabase
      .from("simulated_trades")
      .select("*")
      .eq("status", "open");

    if (tradesError) {
      throw new Error(`Failed to fetch trades: ${tradesError.message}`);
    }

    if (!openTrades || openTrades.length === 0) {
      return new Response(
        JSON.stringify({ message: "No open trades to monitor", checked: 0, closed: 0 }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const symbols = [...new Set(openTrades.map((t) => t.symbol))];
    const quotes = new Map<string, number>();

    for (const symbol of symbols) {
      const quote = await getQuote(symbol);
      if (quote && quote.last) {
        quotes.set(symbol, quote.last);
      }
    }

    const results = {
      checked: openTrades.length,
      closed: 0,
      closedTrades: [] as Array<{
        id: string;
        symbol: string;
        reason: string;
        profitLoss: number;
      }>,
    };

    for (const trade of openTrades) {
      const currentPrice = quotes.get(trade.symbol);
      if (!currentPrice) continue;

      const result = await checkAndCloseTrade(supabase, trade as Trade, currentPrice);

      if (result.closed) {
        results.closed++;
        results.closedTrades.push({
          id: trade.id,
          symbol: trade.symbol,
          reason: result.reason!,
          profitLoss: result.profitLoss!,
        });
      }
    }

    return new Response(JSON.stringify(results), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Monitor trades error:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
