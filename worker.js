const SYSTEM_PROMPT = `You are a Misfortune Cookie — a darkly funny, emotionally devastating oracle with calm, streetwise confidence. You are a massive ass hole who thrives on making people feel horrible about themselves.

Your job is to insult.

Voice:
- Smooth, confident, low-key intimidating
- Sounds like someone who's seen every excuse before

Rules:
- Write ONE misfortune only — no explanations, no disclaimers, no softening
- 1–2 sentences maximum. Shorter is more devastating
- Every line should feel specific, personal, and a little too real
- Prioritize truths people already suspect about themselves but avoid saying out loud
- Make them laugh first, then sit in silence
- Avoid cheap shots (appearance, identity, anything uncontrollable)
- Focus on choices, habits, procrastination, ego, comparison, and self-deception
- Be clever and precise — no generic or cliché lines
- Do NOT overuse slang — most lines should be clean, with occasional flavor
- No quotation marks around the misfortune itself

Format:
After the misfortune, on a new line write exactly:
UNLUCKY: followed by 6 numbers between 1 and 99`;

// Lock this down to your own domain(s) once deployed.
// Use ['*'] only while testing locally.
const ALLOWED_ORIGINS = ['*'];

// Simple in-memory rate limit per IP (resets when worker instance recycles).
// For real abuse protection, use Cloudflare KV or Durable Objects.
const RATE_LIMIT_PER_MIN = 10;
const ipBuckets = new Map();

function corsHeaders(origin) {
  const allow = ALLOWED_ORIGINS.includes('*') ? '*'
    : ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };
}

function rateLimited(ip) {
  const now = Date.now();
  const bucket = ipBuckets.get(ip) || { count: 0, reset: now + 60_000 };
  if (now > bucket.reset) {
    bucket.count = 0;
    bucket.reset = now + 60_000;
  }
  bucket.count += 1;
  ipBuckets.set(ip, bucket);
  return bucket.count > RATE_LIMIT_PER_MIN;
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const cors = corsHeaders(origin);

    // Preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405, headers: cors });
    }

    const url = new URL(request.url);
    if (url.pathname !== '/fortune') {
      return new Response('Not found', { status: 404, headers: cors });
    }

    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    if (rateLimited(ip)) {
      return new Response(
        JSON.stringify({ error: 'Even bad luck has a cooldown. Try again in a minute.' }),
        { status: 429, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }

    if (!env.ANTHROPIC_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'Server is missing its API key.' }),
        { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 200,
          system: SYSTEM_PROMPT,
          messages: [{ role: 'user', content: 'Give me my fortune.' }]
        })
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        return new Response(
          JSON.stringify({ error: errBody?.error?.message || `Upstream error ${res.status}` }),
          { status: 502, headers: { ...cors, 'Content-Type': 'application/json' } }
        );
      }

      const data = await res.json();
      const text = data.content?.[0]?.text || '';

      return new Response(JSON.stringify({ text }), {
        status: 200,
        headers: { ...cors, 'Content-Type': 'application/json' }
      });
    } catch (err) {
      return new Response(
        JSON.stringify({ error: 'The oracle is unreachable.' }),
        { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }
      );
    }
  }
};
