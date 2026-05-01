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

    const { days = 30 } = await req.json();

    const since = new Date();
    since.setDate(since.getDate() - days);

    const { data: entries } = await supabase
      .from("journal_entries")
      .select("*")
      .eq("user_id", user.id)
      .gte("trade_date", since.toISOString().split("T")[0])
      .order("trade_date", { ascending: true });

    if (!entries || entries.length === 0) {
      return new Response(
        JSON.stringify({ error: "No journal entries found for this period" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const prompt = buildJournalPrompt(entries, days);

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

    const tradeEntries = entries.filter((e: any) => e.profit_loss !== null);
    const totalPL = tradeEntries.reduce((s: number, e: any) => s + (e.profit_loss || 0), 0);
    const wins = tradeEntries.filter((e: any) => (e.profit_loss || 0) > 0).length;
    const winRate = tradeEntries.length > 0 ? (wins / tradeEntries.length) * 100 : 0;

    const result = {
      periodStart: since.toISOString().split("T")[0],
      periodEnd: new Date().toISOString().split("T")[0],
      entriesAnalyzed: entries.length,
      tradesInPeriod: tradeEntries.length,
      totalPL,
      winRate: winRate.toFixed(1),
      patterns: parsed.patterns || [],
      emotionalTrends: parsed.emotionalTrends || [],
      recommendations: parsed.recommendations || [],
      strengths: parsed.strengths || [],
      weaknesses: parsed.weaknesses || [],
      summary: parsed.summary || "",
      raw: analysisText,
    };

    await supabase.from("llm_journal_insights").insert({
      user_id: user.id,
      analysis_period_start: result.periodStart,
      analysis_period_end: result.periodEnd,
      entries_analyzed: result.entriesAnalyzed,
      patterns_found: result.patterns,
      emotional_trends: result.emotionalTrends,
      recommendations: result.recommendations,
      summary: result.summary,
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

function buildJournalPrompt(entries: any[], days: number): string {
  const entrySummaries = entries.map((e: any) => {
    const parts = [`Date: ${e.trade_date}`];
    if (e.symbol) parts.push(`Symbol: ${e.symbol}`);
    if (e.trade_type) parts.push(`Type: ${e.trade_type}`);
    if (e.profit_loss !== null) parts.push(`P&L: $${e.profit_loss.toFixed(2)}`);
    if (e.notes) parts.push(`Notes: ${e.notes}`);
    if (e.emotions) parts.push(`Emotions: ${e.emotions}`);
    if (e.lessons_learned) parts.push(`Lessons: ${e.lessons_learned}`);
    return parts.join(" | ");
  }).join("\n");

  return `You are a trading psychology expert and performance coach. Analyze these trading journal entries from the past ${days} days and identify behavioral patterns, emotional trends, and actionable improvements.

JOURNAL ENTRIES (${entries.length} total):
${entrySummaries}

Respond ONLY with a JSON object (no markdown, no code fences):
{
  "patterns": [
    {"name": "pattern name", "description": "what you observed", "frequency": "how often", "impact": "positive|negative|neutral"}
  ],
  "emotionalTrends": [
    {"emotion": "emotion name", "trigger": "what triggers it", "tradingImpact": "how it affects trading", "managementTip": "how to manage it"}
  ],
  "strengths": ["strength1", "strength2"],
  "weaknesses": ["weakness1", "weakness2"],
  "recommendations": [
    "Specific actionable recommendation 1",
    "Specific actionable recommendation 2",
    "Specific actionable recommendation 3"
  ],
  "summary": "2-3 paragraph overall assessment of trading psychology and performance"
}`;
}
