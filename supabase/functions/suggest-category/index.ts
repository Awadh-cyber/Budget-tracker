// Suggests a category for an expense using an AI model on OpenRouter.
//
// - Only logged-in users can call it: the website sends the user's JWT and we check it.
// - The OpenRouter key is a Supabase secret (OPENROUTER_API_KEY). It stays on the
//   server and is never sent to the browser.
// - The answer is always one of the app's categories.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const CATEGORIES = ["Food", "Transport", "Bills", "Shopping", "Fun", "Other"];

// Free models, tried in this order.
const MODELS = ["google/gemma-4-31b-it:free", "google/gemma-4-26b-a4b-it:free", "openrouter/free"];

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Use POST" }, 405);

  // 1. Who is asking? Reject anyone who isn't logged in.
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "Please log in first." }, 401);

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return json({ error: "Please log in first." }, 401);

  // 2. What are we categorising?
  let body: { item?: unknown; note?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Send JSON like {\"item\": \"Lunch at a café\"}" }, 400);
  }
  const item = typeof body.item === "string" ? body.item.trim().slice(0, 200) : "";
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 200) : "";
  if (!item) return json({ error: "Type what you bought first." }, 400);

  // Pasted keys sometimes pick up spaces or line breaks; keep just the key itself.
  const rawKey = Deno.env.get("OPENROUTER_API_KEY") ?? "";
  const apiKey = rawKey.trim().split(/\s+/)[0] ?? "";
  if (!apiKey) return json({ error: "The AI key isn't set up on the server." }, 500);

  // 3. Ask the AI model.
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "X-Title": "Budget Tracker",
    },
    body: JSON.stringify({
      models: MODELS,
      temperature: 0,
      max_tokens: 10,
      messages: [
        {
          role: "system",
          content:
            `You sort personal expenses in Kuwait into categories. ` +
            `Reply with exactly one word from this list and nothing else: ${CATEGORIES.join(", ")}.`,
        },
        { role: "user", content: note ? `Expense: ${item}\nNote: ${note}` : `Expense: ${item}` },
      ],
    }),
  });

  if (!response.ok) {
    // Describe the key's shape (never the key) so a bad paste is easy to spot.
    console.error("OpenRouter error", response.status, await response.text(), {
      keyLength: apiKey.length,
      startsWithSkOr: apiKey.startsWith("sk-or-"),
      skOrCount: rawKey.split("sk-or-").length - 1,
      rawHadWhitespace: /\s/.test(rawKey),
    });
    const message = response.status === 401
      ? "The AI key on the server isn't valid."
      : response.status === 429
      ? "The free AI model is busy. Try again in a minute."
      : "The AI service didn't answer. Try again.";
    return json({ error: message }, 502);
  }

  // 4. Keep the answer only if it's one of our categories.
  const result = await response.json();
  const text: string = result?.choices?.[0]?.message?.content ?? "";
  const category = CATEGORIES.find((c) => new RegExp(`\\b${c}\\b`, "i").test(text)) ?? "Other";

  return json({ category, model: result?.model ?? null });
});
