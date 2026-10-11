export interface Env {
  ASSETS: {
    fetch: (request: Request) => Promise<Response>;
  };
  BACKEND_API_URL?: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // 1. Обработка на API заявки към бекенда (/api/...)
    if (url.pathname.startsWith('/api/') || url.pathname === '/docs' || url.pathname === '/openapi.json') {
      const backendUrl = env.BACKEND_API_URL;
      if (!backendUrl) {
        return new Response(
          JSON.stringify({
            error: "Backend API is not configured or offline.",
            message: "Configure BACKEND_API_URL in wrangler.jsonc or Cloudflare variables.",
            status: "service_unavailable"
          }),
          {
            status: 503,
            headers: {
              "content-type": "application/json",
              "Access-Control-Allow-Origin": "*",
            }
          }
        );
      }

      // Изграждане на целевия URL към бекенда
      const cleanBase = backendUrl.endsWith('/') ? backendUrl.slice(0, -1) : backendUrl;
      const targetUrl = new URL(url.pathname + url.search, cleanBase);

      // Клониране и препращане на заявката към бекенда (Reverse Proxy)
      const forwardRequest = new Request(targetUrl.toString(), {
        method: request.method,
        headers: request.headers,
        body: request.body,
        redirect: 'follow',
      });

      try {
        const response = await fetch(forwardRequest);
        // Добавяме CORS за сигурност
        const newHeaders = new Headers(response.headers);
        newHeaders.set("Access-Control-Allow-Origin", "*");
        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: newHeaders,
        });
      } catch (err: any) {
        return new Response(
          JSON.stringify({
            error: "Failed to connect to backend",
            details: err.message || String(err)
          }),
          {
            status: 502,
            headers: { "content-type": "application/json" }
          }
        );
      }
    }

    // 2. Всичко останало се сервира като React SPA от статичните активи на Worker-а
    return env.ASSETS.fetch(request);
  }
};
