/**
 * Cloudflare Worker: Reverse Proxy for Streamlit Community Cloud
 * Maps your custom subdomain (e.g. jobs.yourdomain.com) to your Streamlit Cloud app.
 *
 * How to deploy:
 * 1. In Cloudflare Dashboard, go to Workers & Pages -> Create Application -> Create Worker.
 * 2. Paste this code into the editor.
 * 3. Replace STREAMLIT_APP_HOST below with your actual Streamlit Cloud app hostname
 *    (e.g., 'your-job-finder.streamlit.app').
 * 4. In Cloudflare Dashboard -> Workers -> Triggers / Custom Domains:
 *    Add your custom domain (e.g., jobs.yourdomain.com).
 */

const STREAMLIT_APP_HOST = "YOUR-APP-NAME.streamlit.app"; // <-- Замени с твоя Streamlit URL

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const originHost = url.hostname;

    // Rewrite request URL to point to Streamlit Cloud host
    url.hostname = STREAMLIT_APP_HOST;
    url.protocol = "https:";
    url.port = "";

    // Clone headers and rewrite Host & Origin
    const newHeaders = new Headers(request.headers);
    newHeaders.set("Host", STREAMLIT_APP_HOST);
    newHeaders.set("X-Forwarded-Host", originHost);
    newHeaders.set("X-Forwarded-Proto", "https");

    if (newHeaders.has("Origin")) {
      newHeaders.set("Origin", `https://${STREAMLIT_APP_HOST}`);
    }

    const modifiedRequest = new Request(url.toString(), {
      method: request.method,
      headers: newHeaders,
      body: request.body,
      redirect: "follow",
    });

    // Handle WebSocket connections (used by Streamlit for realtime rerun / status)
    if (request.headers.get("Upgrade") === "websocket") {
      return fetch(modifiedRequest);
    }

    // Standard HTTP response
    const response = await fetch(modifiedRequest);
    const newResponseHeaders = new Headers(response.headers);

    // Ensure cookies and redirects stay on your custom domain
    newResponseHeaders.delete("X-Frame-Options");
    return new Response(response.body, {
      status: response.status,
      status_statusText: response.statusText,
      headers: newResponseHeaders,
    });
  },
};
