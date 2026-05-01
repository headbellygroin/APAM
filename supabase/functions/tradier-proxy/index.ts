import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const TRADIER_API_KEY = Deno.env.get("TRADIER_API_KEY") || "";
const TRADIER_ACCOUNT_ID = Deno.env.get("TRADIER_ACCOUNT_ID") || "";
const TRADIER_USE_SANDBOX = Deno.env.get("TRADIER_USE_SANDBOX") === "true";

const TRADIER_BASE_URL = TRADIER_USE_SANDBOX
  ? "https://sandbox.tradier.com/v1"
  : "https://api.tradier.com/v1";

const TRADING_BLOCKED_ENDPOINTS = [
  "/accounts/{account_id}/orders",
  "/v1/accounts/{account_id}/orders"
];

interface RequestBody {
  endpoint: string;
  method?: string;
  body?: string;
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
        JSON.stringify({
          error: "Tradier API key not configured",
          message: "Please set TRADIER_API_KEY in edge function secrets",
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { endpoint, method = "GET", body }: RequestBody = await req.json();

    if (!endpoint) {
      return new Response(
        JSON.stringify({ error: "Missing endpoint parameter" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // BLOCK ALL TRADING OPERATIONS - Data feed only
    const isOrderEndpoint = TRADING_BLOCKED_ENDPOINTS.some(blocked =>
      endpoint.includes(blocked.replace("/v1", ""))
    );

    if (isOrderEndpoint && method !== "GET") {
      return new Response(
        JSON.stringify({
          error: "Trading operations blocked",
          message: "This system uses Tradier for data feed only (15-min delayed). All trades are executed internally via paper trading simulation.",
        }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    let processedEndpoint = endpoint;
    if (endpoint.includes("{account_id}")) {
      if (!TRADIER_ACCOUNT_ID) {
        return new Response(
          JSON.stringify({
            error: "Account ID not configured",
            message: "Please set TRADIER_ACCOUNT_ID in edge function secrets",
          }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      processedEndpoint = endpoint.replace("{account_id}", TRADIER_ACCOUNT_ID);
    }

    const url = `${TRADIER_BASE_URL}${processedEndpoint}`;

    const headers: Record<string, string> = {
      Authorization: `Bearer ${TRADIER_API_KEY}`,
      Accept: "application/json",
    };

    if (method === "POST" || method === "PUT") {
      headers["Content-Type"] = "application/x-www-form-urlencoded";
    }

    const fetchOptions: RequestInit = {
      method,
      headers,
    };

    if (body && (method === "POST" || method === "PUT")) {
      fetchOptions.body = body;
    }

    const response = await fetch(url, fetchOptions);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Tradier API error: ${response.status} - ${errorText}`);
      return new Response(
        JSON.stringify({
          error: `Tradier API error: ${response.status}`,
          details: errorText,
        }),
        {
          status: response.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const data = await response.json();

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Edge function error:", error);
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
