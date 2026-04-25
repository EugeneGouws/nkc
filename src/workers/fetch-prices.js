/**
 * src/workers/fetch-prices.js
 *
 * Cloudflare Worker — proxy to Apify Checkers scraper.
 * Receives POST with pantryItem, calls Apify actor, returns products.
 */

export default {
  async fetch(request, env, context) {
    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    let body;
    try {
      body = await request.json();
    } catch (e) {
      return new Response('Invalid JSON', { status: 400 });
    }

    const { pantryItem } = body;
    if (!pantryItem || !pantryItem.canonicalName) {
      return new Response('Missing pantryItem.canonicalName', { status: 400 });
    }

    const apiKey = env.APIFY_KEY;
    if (!apiKey) {
      return new Response('Apify API key not configured', { status: 500 });
    }

    try {
      const hint = pantryItem.searchHints?.[0] ?? '';
      const searchTerm = hint
        ? `${pantryItem.canonicalName} ${hint}`
        : pantryItem.canonicalName;
      const maxItems = pantryItem.priceOptionCount ?? 5;
      const searchUrl = `https://www.checkers.co.za/search?Search=${encodeURIComponent(searchTerm)}`;

      console.log(`[Worker] Apify fetch: "${searchTerm}" (maxItems: ${maxItems})`);
      console.log(`[Worker] Search URL: ${searchUrl}`);
      console.log(`[Worker] Apify actor: tXYgrsQcGx4ReKqdW`);

      const apifyUrl = new URL(
        'https://api.apify.com/v2/acts/tXYgrsQcGx4ReKqdW/run-sync-get-dataset-items'
      );
      apifyUrl.searchParams.append('token', apiKey);
      apifyUrl.searchParams.append('timeout', '20');
      apifyUrl.searchParams.append('memory', '256');

      const resp = await fetch(apifyUrl.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ maxItems, startUrl: searchUrl }),
      });

      console.log(`[Worker] Apify response status: ${resp.status}`);

      if (!resp.ok) {
        const errorText = await resp.text();
        console.error(`[Worker] Apify error ${resp.status}: ${errorText}`);
        return new Response(`Apify returned ${resp.status}: ${errorText}`, {
          status: resp.status,
        });
      }

      const products = await resp.json();
      console.log(`[Worker] Apify returned ${Array.isArray(products) ? products.length : 0} products`);

      if (!Array.isArray(products)) {
        return new Response(JSON.stringify([]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify(products), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (err) {
      console.error('[Worker] fetch-prices error:', err.message);
      return new Response(`Error: ${err.message}`, { status: 500 });
    }
  },
};
