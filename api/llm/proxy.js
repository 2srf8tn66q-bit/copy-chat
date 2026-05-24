// Vercel Serverless Function for production
// Handles POST /api/llm/proxy - forwards requests to user-configured LLM APIs

/**
 * @param {import('@vercel/node').VercelRequest} req
 * @param {import('@vercel/node').VercelResponse} res
 */
export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key, anthropic-version');

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only accept POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { targetUrl, headers, body: requestBody } = req.body;

    if (!targetUrl) {
      return res.status(400).json({ error: 'Missing targetUrl' });
    }

    // Build fetch options
    const fetchHeaders = { ...headers };
    delete fetchHeaders['host'];
    delete fetchHeaders['Host'];

    const fetchOptions = {
      method: 'POST',
      headers: fetchHeaders,
      body: typeof requestBody === 'string' ? requestBody : JSON.stringify(requestBody),
    };

    const targetResponse = await fetch(targetUrl, fetchOptions);

    // Check if the response is SSE (streaming)
    const contentType = targetResponse.headers.get('content-type') || '';
    const isSSE = contentType.includes('text/event-stream');

    if (isSSE) {
      // For streaming responses, pipe the body as SSE
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      const reader = targetResponse.body.getReader();
      const decoder = new TextDecoder();

      try {
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          res.write(chunk);
        }
      } catch (streamError) {
        console.error('Stream error:', streamError.message);
      }

      return res.end();
    } else {
      // Regular JSON response
      const responseBody = await targetResponse.text();
      res.setHeader('Content-Type', contentType || 'application/json');
      return res.status(targetResponse.status).send(responseBody);
    }
  } catch (error) {
    console.error('Proxy error:', error.message);
    return res.status(502).json({ error: `Proxy error: ${error.message}` });
  }
}
