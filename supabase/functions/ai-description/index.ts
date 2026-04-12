import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "ANTHROPIC_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { vehicle } = await req.json();
    if (!vehicle) {
      return new Response(
        JSON.stringify({ error: "vehicle data required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const prompt = `Write a professional, SEO-optimized vehicle description for a car dealership listing. Be factual, confident, and compelling. 2-3 short paragraphs, under 150 words total. Do not use exclamation marks. Do not make claims you can't verify from the data provided.

Vehicle data:
- Year: ${vehicle.year || "Unknown"}
- Make: ${vehicle.make || "Unknown"}
- Model: ${vehicle.model || "Unknown"}
- Trim: ${vehicle.trim || ""}
- Condition: ${vehicle.condition || "Pre-owned"}
- Mileage: ${vehicle.mileage || "Unknown"}
- Exterior Color: ${vehicle.color || ""}
- Engine: ${vehicle.engine || ""}
- Transmission: ${vehicle.transmission || ""}
- Drivetrain: ${vehicle.driveType || ""}
- Fuel Type: ${vehicle.fuelType || ""}
- Body Style: ${vehicle.bodyStyle || ""}
- Price: ${vehicle.price || "Contact for pricing"}

Write the description now:`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 300,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return new Response(
        JSON.stringify({ error: `Claude API error: ${response.status}`, details: errorText }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const description = data.content?.[0]?.text || "";

    return new Response(
      JSON.stringify({ success: true, description }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
