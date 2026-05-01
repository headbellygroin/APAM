import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface TradeAnalysisRequest {
  symbol: string;
  action: string;
  oddsScore: number;
  entryPrice: number;
  stopLoss: number;
  targetPrice: number;
  reasoning: {
    curvePosition: string;
    trendDirection: string;
    zoneType: string;
    scores: Record<string, number>;
  };
  patternWinRate?: number;
  patternTradeCount?: number;
  recentMarketContext?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: TradeAnalysisRequest = await req.json();

    const riskReward = body.targetPrice && body.stopLoss && body.entryPrice
      ? Math.abs(body.targetPrice - body.entryPrice) / Math.abs(body.entryPrice - body.stopLoss)
      : 0;

    const prompt = buildTradeAnalysisPrompt(body, riskReward);

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "ANTHROPIC_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const llmResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!llmResponse.ok) {
      const errText = await llmResponse.text();
      return new Response(
        JSON.stringify({ error: "LLM request failed", details: errText }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const llmData = await llmResponse.json();
    const analysisText = llmData.content?.[0]?.text || "";

    let parsed;
    try {
      const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { raw: analysisText };
    } catch {
      parsed = { raw: analysisText };
    }

    const result = {
      symbol: body.symbol,
      action: body.action,
      oddsScore: body.oddsScore,
      riskReward: riskReward.toFixed(2),
      llmVerdict: parsed.verdict || "review",
      confidence: parsed.confidence || 50,
      keyFactors: parsed.keyFactors || [],
      risks: parsed.risks || [],
      marketContext: parsed.marketContext || "",
      suggestion: parsed.suggestion || "",
      raw: analysisText,
    };

    await supabase.from("llm_trade_analyses").insert({
      user_id: user.id,
      symbol: body.symbol,
      analysis_type: "trade_analysis",
      input_data: body,
      llm_response: result,
      summary: result.suggestion,
      confidence: result.confidence,
    });

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function buildTradeAnalysisPrompt(data: TradeAnalysisRequest, riskReward: number): string {
  return `You are an expert trading analyst. Analyze this AI-generated trade signal and provide your assessment.

SIGNAL DATA:
- Symbol: ${data.symbol}
- Action: ${data.action}
- Odds Score: ${data.oddsScore}/10
- Entry: $${data.entryPrice}, Stop: $${data.stopLoss}, Target: $${data.targetPrice}
- Risk/Reward: ${riskReward.toFixed(2)}:1
- Curve Position: ${data.reasoning.curvePosition}
- Trend Direction: ${data.reasoning.trendDirection}
- Zone Type: ${data.reasoning.zoneType}
- Score Breakdown: ${JSON.stringify(data.reasoning.scores)}
${data.patternWinRate !== undefined ? `- Historical Pattern Win Rate: ${(data.patternWinRate * 100).toFixed(1)}% over ${data.patternTradeCount} trades` : ""}
${data.recentMarketContext ? `- Recent Market Context: ${data.recentMarketContext}` : ""}

Respond ONLY with a JSON object (no markdown, no code fences):
{
  "verdict": "strong_buy" | "buy" | "neutral" | "avoid",
  "confidence": 0-100,
  "keyFactors": ["factor1", "factor2", "factor3"],
  "risks": ["risk1", "risk2"],
  "marketContext": "Brief market context assessment",
  "suggestion": "One paragraph actionable suggestion"
}`;
}
