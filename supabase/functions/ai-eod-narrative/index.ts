import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

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

    const { eodReview } = await req.json();

    if (!eodReview) {
      return new Response(
        JSON.stringify({ error: "No EOD review data provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const prompt = buildEODPrompt(eodReview);

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
        max_tokens: 2048,
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
      narrative: parsed.narrative || "",
      spawnReasoning: parsed.spawnReasoning || "",
      riskAssessment: parsed.riskAssessment || "",
      nextDayStrategy: parsed.nextDayStrategy || "",
      fleetHealthScore: parsed.fleetHealthScore || 0,
      keyDecisions: parsed.keyDecisions || [],
      warnings: parsed.warnings || [],
      raw: analysisText,
    };

    await supabase.from("llm_eod_narratives").insert({
      user_id: user.id,
      review_date: eodReview.reviewDate || new Date().toISOString().split("T")[0],
      eod_review_data: eodReview,
      narrative: result.narrative,
      spawn_reasoning: result.spawnReasoning,
      risk_assessment: result.riskAssessment,
      next_day_strategy: result.nextDayStrategy,
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

function buildEODPrompt(review: any): string {
  const baseRankings = (review.baseFleetRankings || [])
    .map((r: any) => `  #${r.rank} ${r.name}: ${r.win_rate?.toFixed(1)}% WR, PF=${r.profit_factor?.toFixed(2)}, $${r.total_profit_loss?.toFixed(0)} P&L, ${r.total_trades} trades, ${r.drift_pct?.toFixed(0)}% drift [${r.mode}/${r.strategy_id}]`)
    .join("\n");

  const spawnedRankings = (review.spawnedFleetRankings || [])
    .map((r: any) => `  #${r.rank} ${r.name}: ${r.win_rate?.toFixed(1)}% WR, PF=${r.profit_factor?.toFixed(2)}, $${r.total_profit_loss?.toFixed(0)} P&L, Gen ${r.generation}, ${r.drift_pct?.toFixed(0)}% drift`)
    .join("\n");

  const spawnRecs = (review.spawnRecommendations || [])
    .map((r: any) => `  ${r.suggestedName}: ${r.reason}`)
    .join("\n");

  const retireRecs = (review.retireRecommendations || [])
    .map((r: any) => `  ${r.accountName}: ${r.reason}`)
    .join("\n");

  const promotionRecs = (review.promotionRecommendations || [])
    .map((r: any) => `  ${r.spawnedAccountName} -> replaces ${r.baseAccountName}: +${r.outperformancePct?.toFixed(1)}% outperformance`)
    .join("\n");

  const evolutionCands = (review.evolutionCandidates || [])
    .map((c: any) => `  ${c.accountName}: ${c.driftPct?.toFixed(1)}% drift, +${c.outperformancePct?.toFixed(1)}% vs base, ${c.totalTrades} trades`)
    .join("\n");

  return `You are the Master AI intelligence overseeing a fleet of AI trading accounts. Provide a comprehensive end-of-day narrative and strategic recommendations.

TODAY'S REVIEW (${review.reviewDate}):

MASTER AI TIER: ${review.masterNameTier} ${review.masterName ? `(${review.masterName})` : "(Unnamed)"}

BASE FLEET RANKINGS:
${baseRankings || "  No ranked base accounts yet."}

SPAWNED FLEET RANKINGS:
${spawnedRankings || "  No ranked spawned accounts yet."}

ROTATION ADVICE: ${review.rotationAdvice || "None"}
NEXT DAY NOTES: ${review.nextDayNotes || "None"}

${spawnRecs ? `SPAWN RECOMMENDATIONS:\n${spawnRecs}` : ""}
${retireRecs ? `RETIRE RECOMMENDATIONS:\n${retireRecs}` : ""}
${promotionRecs ? `PROMOTION RECOMMENDATIONS:\n${promotionRecs}` : ""}
${evolutionCands ? `EVOLUTION CANDIDATES:\n${evolutionCands}` : ""}
${review.anomalySummary ? `HUMAN TRADE ANOMALIES:\n  ${review.anomalySummary}` : ""}
${review.patternDiscoverySummary ? `PATTERN DISCOVERY:\n  ${review.patternDiscoverySummary}` : ""}
${review.historicalFleetSummary ? `HISTORICAL FLEET:\n  ${review.historicalFleetSummary}` : ""}

Respond ONLY with a JSON object (no markdown, no code fences):
{
  "narrative": "3-4 paragraph executive summary of today's fleet performance, key events, and overall trajectory. Write as the Master AI reflecting on its fleet.",
  "spawnReasoning": "Detailed reasoning for or against spawning/retiring/promoting. Reference specific account performance.",
  "riskAssessment": "Current risk posture of the fleet. Identify concentration risks, drawdown concerns, and over-reliance on specific strategies.",
  "nextDayStrategy": "Specific tactical recommendations for tomorrow. What should the fleet focus on? Any accounts need special attention?",
  "fleetHealthScore": 0-100,
  "keyDecisions": ["decision1", "decision2"],
  "warnings": ["warning1", "warning2"]
}`;
}
