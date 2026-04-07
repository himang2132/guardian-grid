import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { description } = await req.json();

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not configured");

    const systemPrompt = `You are an emergency medical triage AI. Given a patient's symptom description, classify the emergency.

You MUST respond using the suggest_triage tool. Analyze the symptoms and determine:
- case_type: One of these exact values: "Cardiac Arrest", "Severe Heart Attack", "Severe Accident / Heavy Bleeding", "Stroke", "Asthma Attack", "Burns", "Breathing Difficulty", "Fracture"
- severity: "critical", "serious", or "minor"
- confidence: a number 0-100 indicating your confidence
- reasoning: a brief 1-sentence explanation of why you classified it this way
- recommended_action: a brief instruction for the patient while waiting for the ambulance`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Patient symptoms: ${description}` },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "suggest_triage",
              description: "Classify the emergency based on symptoms",
              parameters: {
                type: "object",
                properties: {
                  case_type: {
                    type: "string",
                    enum: [
                      "Cardiac Arrest",
                      "Severe Heart Attack",
                      "Severe Accident / Heavy Bleeding",
                      "Stroke",
                      "Asthma Attack",
                      "Burns",
                      "Breathing Difficulty",
                      "Fracture",
                    ],
                  },
                  severity: {
                    type: "string",
                    enum: ["critical", "serious", "minor"],
                  },
                  confidence: {
                    type: "number",
                  },
                  reasoning: {
                    type: "string",
                  },
                  recommended_action: {
                    type: "string",
                  },
                },
                required: [
                  "case_type",
                  "severity",
                  "confidence",
                  "reasoning",
                  "recommended_action",
                ],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "suggest_triage" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again shortly." }),
          {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const text = await response.text();
      console.error("OpenAI error:", response.status, text);

      return new Response(JSON.stringify({ error: "AI triage failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall) {
      return new Response(JSON.stringify({ error: "AI did not return triage data" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const triage = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(triage), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("triage error:", e);

    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});