import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface FleetAccountSummary {
  name: string;
  strategy: string;
  mode: string;
  winRate: number;
  profitFactor: number;
  totalTrades: number;
  totalPL: number;
  maxDrawdown: number;
  learnedWeights: Record<string, number>;
  thresholdAdjustments: Record<string, number>;
  driftPct: number;
  generation: number;
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

    const { fleetData }: { fleetData: FleetAccountSummary[] } = await req.json();

    if (!fleetData || fleetData.length === 0) {
      return new Response(
        JSON.stringify({ error: "No fleet data provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const prompt = buildStrategyPrompt(fleetData);

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
      proposalName: parsed.proposalName || "AI-Generated Strategy",
      proposedWeights: parsed.proposedWeights || {},
      proposedThresholds: parsed.proposedThresholds || {},
      proposedPatterns: parsed.proposedPatterns || {},
      reasoning: parsed.reasoning || "",
      expectedImprovement: parsed.expectedImprovement || "",
      fleetInsights: parsed.fleetInsights || [],
      convergenceAnalysis: parsed.convergenceAnalysis || "",
      raw: analysisText,
    };

    await supabase.from("llm_strategy_proposals").insert({
      user_id: user.id,
      proposal_name: result.proposalName,
      based_on_fleet_data: { accounts: fleetData.length, summary: fleetData.map(a => ({ name: a.name, wr: a.winRate, pf: a.profitFactor })) },
      proposed_weights: result.proposedWeights,
      proposed_thresholds: result.proposedThresholds,
      proposed_patterns: result.proposedPatterns,
      reasoning: result.reasoning,
      expected_improvement: result.expectedImprovement,
      status: "pending",
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

function buildStrategyPrompt(fleet: FleetAccountSummary[]): string {
  const topPerformers = [...fleet].sort((a, b) => b.winRate - a.winRate).slice(0, 5);
  const bottomPerformers = [...fleet].sort((a, b) => a.winRate - b.winRate).slice(0, 3);
  const drifters = fleet.filter(a => a.driftPct > 15).sort((a, b) => b.driftPct - a.driftPct);

  const formatAccount = (a: FleetAccountSummary) =>
    `  ${a.name}: ${a.strategy}/${a.mode}, WR=${a.winRate.toFixed(1)}%, PF=${a.profitFactor.toFixed(2)}, Trades=${a.totalTrades}, P&L=$${a.totalPL.toFixed(0)}, DD=${a.maxDrawdown.toFixed(1)}%, Drift=${a.driftPct.toFixed(0)}%, Gen=${a.generation}, Weights=${JSON.stringify(a.learnedWeights)}, Thresholds=${JSON.stringify(a.thresholdAdjustments)}`;

  return `You are an expert quantitative strategy designer. Analyze this fleet of AI training accounts and propose an optimized strategy configuration.

FLEET OVERVIEW (${fleet.length} accounts):

TOP PERFORMERS:
${topPerformers.map(formatAccount).join("\n")}

BOTTOM PERFORMERS:
${bottomPerformers.map(formatAccount).join("\n")}

${drifters.length > 0 ? `HIGH-DRIFT ACCOUNTS (evolved beyond base rules):
${drifters.map(formatAccount).join("\n")}` : ""}

The weight system uses multipliers around 1.0 (range 0.5-1.5) for these score factors: strengthScore, timeScore, freshnessScore, trendScore, curveScore, profitZoneScore.
Threshold adjustments range from -1.0 to +1.0 for: minOddsScore, minRiskReward, confidenceFloor.

Respond ONLY with a JSON object (no markdown, no code fences):
{
  "proposalName": "Descriptive name for this strategy variant",
  "proposedWeights": {
    "strengthScore": 1.0,
    "timeScore": 1.0,
    "freshnessScore": 1.0,
    "trendScore": 1.0,
    "curveScore": 1.0,
    "profitZoneScore": 1.0
  },
  "proposedThresholds": {
    "minOddsScore": 0.0,
    "minRiskReward": 0.0,
    "confidenceFloor": 0.0
  },
  "proposedPatterns": {},
  "reasoning": "Detailed paragraph explaining WHY these specific values based on the fleet data",
  "expectedImprovement": "What improvement is expected and why",
  "fleetInsights": ["insight1", "insight2", "insight3"],
  "convergenceAnalysis": "What the fleet agrees on vs where it diverges"
}`;
}
