// Netlify Function: Bot API proxy with CORS
// Reads BOT_API_BASE from env and forwards requests to it
// Adds permissive CORS headers

const ALLOWED_HEADERS = 'Content-Type, Authorization, X-Requested-With'

exports.handler = async (event) => {
  // CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
        'Access-Control-Allow-Headers': ALLOWED_HEADERS,
        'Access-Control-Max-Age': '86400',
      },
      body: '',
    }
  }

  const base = process.env.BOT_API_BASE
  if (!base) {
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'BOT_API_BASE is not configured' }),
    }
  }

  try {
    const { path, rawQuery, httpMethod, headers, body, isBase64Encoded } = event
    const prefix = '/.netlify/functions/bot-proxy'
    const suffix = path.startsWith(prefix) ? path.substring(prefix.length) : path
    const targetUrl = `${base}${suffix}${rawQuery ? `?${rawQuery}` : ''}`

    const forwardHeaders = { ...headers }
    delete forwardHeaders.host
    delete forwardHeaders.connection
    delete forwardHeaders['content-length']

    const resp = await fetch(targetUrl, {
      method: httpMethod,
      headers: forwardHeaders,
      body: body && ['GET', 'HEAD'].includes(httpMethod) ? undefined : (isBase64Encoded ? Buffer.from(body, 'base64') : body),
    })

    const respBody = await resp.arrayBuffer()
    const respHeaders = {}
    resp.headers.forEach((v, k) => (respHeaders[k] = v))

    return {
      statusCode: resp.status,
      headers: {
        ...respHeaders,
        'Access-Control-Allow-Origin': '*',
      },
      body: Buffer.from(respBody).toString('base64'),
      isBase64Encoded: true,
    }
  } catch (e) {
    return {
      statusCode: 502,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'Proxy error', message: e?.message || String(e) }),
    }
  }
}


