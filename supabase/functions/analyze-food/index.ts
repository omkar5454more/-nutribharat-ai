// Supabase Edge Function (Deno): identifies the dishes in a meal photo and estimates their weight.
// It does NOT return calories or nutrients — the app computes those from its own food table.
// The Anthropic key lives only here, as a Supabase secret (ANTHROPIC_API_KEY); it is never shipped in the app.
import Anthropic from 'npm:@anthropic-ai/sdk';
import { zodOutputFormat } from 'npm:@anthropic-ai/sdk/helpers/zod';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { z } from 'npm:zod';

const DAILY_LIMIT = Number(Deno.env.get('SCANS_PER_DAY') ?? '20');
const MODEL = Deno.env.get('ANALYZE_MODEL') ?? 'claude-opus-5-5';
const MAX_BASE64_CHARS = 6_000_000; // ~4.5 MB of image after the app has resized it

const Result = z.object({
  is_food: z.boolean(),
  items: z.array(z.object({
    name: z.string(),
    estimated_grams: z.number(),
    confidence: z.number(),
    notes: z.string().optional(),
  })),
  uncertain: z.string().optional(),
});

const SYSTEM = `You identify food in photos for an Indian nutrition app.
List each separate dish or food item you can see, using the common Indian name (e.g. "chapati", "dal tadka", "kanda poha", "vada pav").
For every item estimate the weight in grams of the portion visible, and give a confidence from 0 to 1.
Do NOT give calories or nutrients. If the image is not food, set is_food to false and return no items.
Mention anything you cannot tell from a photo (oil, sugar, hidden ingredients) in "uncertain".`;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info', 'Access-Control-Allow-Methods': 'POST' } });
  }
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  // Supabase already rejects requests without a valid JWT; here we act as that user so row level security applies.
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return json({ error: 'Please sign in again.' }, 401);

  let body: { image_base64?: string; media_type?: string };
  try { body = await req.json(); } catch { return json({ error: 'Bad request.' }, 400); }
  const media = body.media_type ?? 'image/jpeg';
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(media)) return json({ error: 'Use a JPEG, PNG or WebP photo.' }, 400);
  if (!body.image_base64 || body.image_base64.length > MAX_BASE64_CHARS) return json({ error: 'Photo missing or too large.' }, 400);

  // per-user daily cap, to keep AI cost predictable
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { count } = await supabase.from('scan_usage').select('id', { count: 'exact', head: true }).gte('created_at', since);
  if ((count ?? 0) >= DAILY_LIMIT) return json({ error: `Daily limit of ${DAILY_LIMIT} photo scans reached. You can still add foods manually.` }, 429);
  await supabase.from('scan_usage').insert({ user_id: auth.user.id });

  try {
    const client = new Anthropic(); // reads ANTHROPIC_API_KEY
    const response = await client.messages.parse({
      model: MODEL,
      max_tokens: 2000,
      output_config: { effort: 'low', format: zodOutputFormat(Result) },
      system: SYSTEM,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: media as 'image/jpeg', data: body.image_base64 } },
          { type: 'text', text: 'What foods are in this photo?' },
        ],
      }],
    });
    if (response.stop_reason === 'refusal' || !response.parsed_output) {
      return json({ error: 'The photo could not be analysed. Try another photo or add the food manually.' }, 422);
    }
    return json(response.parsed_output);
  } catch (e) {
    console.error('analyze-food failed', e instanceof Error ? e.message : e);
    return json({ error: 'The food scanner is unavailable right now. You can add foods manually.' }, 502);
  }
});
