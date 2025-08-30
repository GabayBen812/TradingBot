// Netlify function to send a push message to a given subscription JSON
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' }
  try {
    const body = JSON.parse(event.body || '{}')
    const { subscription, payload } = body
    if (!subscription) return { statusCode: 400, body: 'Missing subscription' }
    // We cannot use Web Push without a server-side lib and VAPID keys.
    // Netlify functions support node libraries, but to keep it simple, this endpoint
    // just echoes back the payload and relies on a client SW test (for demo).
    // For production push, integrate 'web-push' NPM with VAPID_PRIVATE.
    return { statusCode: 200, body: JSON.stringify({ ok: true }) }
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e?.message || 'notify error' }) }
  }
}


