export async function onRequest(context) {
  const request = context.request;

  // CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders() });
  }

  const url = new URL(request.url);
  const pathname = url.pathname;
  const targetPath = pathname === '/' ? '/feed/value.json' : pathname;

  const params = new URLSearchParams(url.search);
  const API_KEY = 'c28cb22a6877c80b1c6a2611b72c25f4';
  params.set('apikey', API_KEY);

  const target = `https://emoncms.org${targetPath}?${params.toString()}`;

  try {
    const resp = await fetch(target, { cf: { cacheTtl: 10 } });
    const body = await resp.text();

    return new Response(body, {
      headers: {
        ...corsHeaders(),
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      }
    });
  } catch (e) {
    return new Response('{"error":"upstream"}', {
      status: 502,
      headers: corsHeaders()
    });
  }
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Max-Age': '86400',
  };
}
