// Development API proxy server
// Receives POST /api/llm/* requests and forwards them to the user-configured LLM API
// Port 3001 (matched by vite.config.ts proxy)

import http from 'node:http';

const PORT = 3001;

/**
 * Read the full request body as a string.
 */
function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString()));
    req.on('error', reject);
  });
}

/**
 * Forward a request to the target LLM API and pipe the response back.
 * Supports both regular JSON responses and SSE (streaming) responses.
 */
async function handleProxy(req, res) {
  try {
    const body = await readBody(req);
    const { targetUrl, headers, body: requestBody } = JSON.parse(body);

    if (!targetUrl) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing targetUrl' }));
      return;
    }

    // Build fetch options
    const fetchHeaders = { ...headers };
    // Remove host header to avoid conflicts
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
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      });

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

      res.end();
    } else {
      // Regular JSON response
      const responseBody = await targetResponse.text();
      res.writeHead(targetResponse.status, {
        'Content-Type': contentType || 'application/json',
        'Access-Control-Allow-Origin': '*',
      });
      res.end(responseBody);
    }
  } catch (error) {
    console.error('Proxy error:', error.message);
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: `Proxy error: ${error.message}` }));
  }
}

/**
 * Handle CORS preflight requests.
 */
function handleCors(req, res) {
  res.writeHead(200, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key, anthropic-version',
  });
  res.end();
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    handleCors(req, res);
    return;
  }

  // Route: POST /api/llm/proxy
  if (req.method === 'POST' && url.pathname === '/api/llm/proxy') {
    await handleProxy(req, res);
    return;
  }

  // 404 for everything else
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, () => {
  console.log(`[copy-chat-proxy] API proxy server running on http://localhost:${PORT}`);
  console.log(`[copy-chat-proxy] Forwarding /api/llm/* to configured LLM APIs`);
});
