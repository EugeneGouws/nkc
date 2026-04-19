/**
 * netlify/functions/fetch-prices.js
 *
 * Thin proxy to Apify Checkers scraper.
 * Reads APIFY_KEY from process.env (server-side, not exposed in browser).
 * Takes a pantry item and returns raw products from Apify.
 * Browser (pricer.js) handles scoring, ranking, and costPerUnit computation.
 */

exports.handler = async (event) => {
  // CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'Content-Type' },
    }
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' }
  }

  let pantryItem
  try {
    pantryItem = JSON.parse(event.body).pantryItem
  } catch (e) {
    return { statusCode: 400, body: 'Invalid JSON body' }
  }

  if (!pantryItem || !pantryItem.canonicalName) {
    return { statusCode: 400, body: 'Missing pantryItem.canonicalName' }
  }

  const apiKey = process.env.APIFY_KEY
  if (!apiKey) {
    return { statusCode: 500, body: 'Apify API key not configured on server' }
  }

  try {
    const hint = pantryItem.searchHints?.[0] ?? ''
    const searchTerm = hint ? `${pantryItem.canonicalName} ${hint}` : pantryItem.canonicalName
    const maxItems = pantryItem.priceOptionCount ?? 5
    const searchUrl = `https://www.checkers.co.za/search?Search=${encodeURIComponent(searchTerm)}`

    console.log(`[Netlify] Apify fetch: "${searchTerm}" (maxItems: ${maxItems})`);
    console.log(`[Netlify] Search URL: ${searchUrl}`);
    console.log(`[Netlify] Apify actor: tXYgrsQcGx4ReKqdW`);
    console.log(`[Netlify] API key set: ${!!apiKey}`);

    const resp = await fetch(
      `https://api.apify.com/v2/acts/tXYgrsQcGx4ReKqdW/run-sync-get-dataset-items?token=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ maxItems, startUrl: searchUrl }),
      }
    )

    console.log(`[Netlify] Apify response status: ${resp.status}`);

    if (!resp.ok) {
      const errorBody = await resp.text();
      console.error(`[Netlify] Apify error ${resp.status}: ${errorBody}`);
      return { statusCode: resp.status, body: `Apify returned ${resp.status}: ${errorBody}` }
    }

    const products = await resp.json()
    console.log(`[Netlify] Apify returned ${Array.isArray(products) ? products.length : 0} products`)

    if (!Array.isArray(products)) {
      return { statusCode: 200, body: JSON.stringify([]) }
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(products),
    }
  } catch (err) {
    console.error('[Netlify] fetch-prices error:', err.message)
    return { statusCode: 500, body: `Error: ${err.message}` }
  }
}
