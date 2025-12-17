/**
 * HTTP client utility that works in both browser and Node.js environments
 */

export async function httpPost(
  url: string,
  body: string,
  signal?: AbortSignal
): Promise<{status: number; statusText: string; json: () => Promise<any>}> {
  // Check if we're in a server environment
  if (typeof window === 'undefined') {
    // Server-side: use Node.js http module
    return nodeHttpPost(url, body, signal);
  } else {
    // Client-side: use fetch
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body,
      signal,
    });

    return {
      status: response.status,
      statusText: response.statusText,
      json: () => response.json(),
    };
  }
}

async function nodeHttpPost(
  url: string,
  body: string,
  signal?: AbortSignal
): Promise<{status: number; statusText: string; json: () => Promise<any>}> {
  const http = await import('http');
  const https = await import('https');
  const urlModule = await import('url');

  const parsedUrl = new urlModule.URL(url);
  const isHttps = parsedUrl.protocol === 'https:';
  const httpModule = isHttps ? https : http;

  return new Promise((resolve, reject) => {
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHttps ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = httpModule.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        resolve({
          status: res.statusCode || 500,
          statusText: res.statusMessage || 'Unknown',
          json: async () => JSON.parse(data),
        });
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (signal) {
      signal.addEventListener('abort', () => {
        req.destroy();
        reject(new Error('Request aborted'));
      });
    }

    req.write(body);
    req.end();
  });
}
