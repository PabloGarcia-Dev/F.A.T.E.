// Netlify Function: /api/gemini-recipes (see netlify.toml redirect)
// Runs server-side so the Gemini API key is never exposed to the browser.

// Using the "latest" alias instead of a pinned dated model (e.g. gemini-2.5-flash)
// on purpose: Google can retire a specific pinned model without much warning
// (that's exactly what just happened here), but "latest" auto-updates to
// whatever the current best Flash model is, with 2 weeks' notice by email
// before it ever changes underneath you.
const GEMINI_MODEL = "gemini-flash-latest";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

export default async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("GEMINI_API_KEY is not set in the environment.");
    return new Response(JSON.stringify({ error: "Server is missing GEMINI_API_KEY" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  let pantryContext;
  try {
    pantryContext = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { expiringItems = [], otherItems = [] } = pantryContext || {};

  if (expiringItems.length === 0 && otherItems.length === 0) {
    return new Response(JSON.stringify({ recipes: [] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const prompt = buildPrompt(expiringItems, otherItems);

  try {
    const geminiResponse = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              recipes: {
                type: "ARRAY",
                items: {
                  type: "OBJECT",
                  properties: {
                    title: { type: "STRING" },
                    usesItems: { type: "ARRAY", items: { type: "STRING" } },
                    instructions: { type: "ARRAY", items: { type: "STRING" } },
                  },
                  required: ["title", "usesItems", "instructions"],
                },
              },
            },
            required: ["recipes"],
          },
        },
      }),
    });

    if (!geminiResponse.ok) {
      const errorBody = await geminiResponse.text();
      console.error("Gemini API error:", geminiResponse.status, errorBody);
      return new Response(JSON.stringify({ error: "Gemini API request failed" }), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      });
    }

    const geminiData = await geminiResponse.json();
    const rawText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawText) {
      console.error("Unexpected Gemini response shape:", JSON.stringify(geminiData));
      return new Response(JSON.stringify({ error: "No content returned by Gemini" }), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      });
    }

    const parsed = JSON.parse(rawText);

    return new Response(JSON.stringify(parsed), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    return new Response(JSON.stringify({ error: "Unexpected server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};

function buildPrompt(expiringItems, otherItems) {
  const expiringList = expiringItems
    .map((item) => `- ${item.name} (${item.daysLeft ?? "?"} days left, eco-score ${item.ecoScore})`)
    .join("\n") || "None";

  const otherList = otherItems
    .map((item) => `- ${item.name} (eco-score ${item.ecoScore})`)
    .join("\n") || "None";

  return `You are a recipe assistant for a food-waste-reduction app. Suggest 2 recipes that prioritize using up the items that are expiring soon. Prefer recipes that use as many of the expiring items as possible.

Items expiring soon (prioritize these):
${expiringList}

Other pantry items (use if helpful, not required):
${otherList}

Return JSON matching this shape: { "recipes": [ { "title": string, "usesItems": string[], "instructions": string[] } ] }. Keep instructions to 3-5 concise steps each. Only reference item names from the lists above.`;
}