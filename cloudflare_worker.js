/**
 * Cloudflare Worker: Reverse Proxy for Streamlit Community Cloud
 * Domain: job-finder.archevyn.dev -> job-finder-hynhe5hnkeuwvsqmxwgvvu.streamlit.app
 */

const STREAMLIT_APP_HOST = "job-finder-hynhe5hnkeuwvsqmxwgvvu.streamlit.app";

export default {
  async fetch(request) {
    try {
      const url = new URL(request.url);
      const incomingHost = url.hostname;

      // Clean hostname (remove https:// if accidentally added)
      const cleanTargetHost = STREAMLIT_APP_HOST.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
      url.hostname = cleanTargetHost;
      url.protocol = "https:";

      // Prepare headers
      const headers = new Headers(request.headers);
      headers.set("Host", cleanTargetHost);
      headers.set("X-Forwarded-Host", incomingHost);
      headers.set("X-Forwarded-Proto", "https");

      if (headers.has("Origin")) {
        headers.set("Origin", `https://${cleanTargetHost}`);
      }

      // Handle WebSocket connections (used by Streamlit for live rerun)
      if (request.headers.get("Upgrade") === "websocket") {
        return fetch(url.toString(), {
          method: request.method,
          headers: headers,
        });
      }

      // Standard HTTP fetch (GET and HEAD must NOT have a body)
      const hasBody = request.method !== "GET" && request.method !== "HEAD";
      const fetchOptions = {
        method: request.method,
        headers: headers,
        body: hasBody ? request.body : undefined,
        redirect: "follow",
      };

      const response = await fetch(url.toString(), fetchOptions);

      // Clean response headers to avoid blocking
      const newResponseHeaders = new Headers(response.headers);
      newResponseHeaders.delete("X-Frame-Options");
      newResponseHeaders.delete("Content-Security-Policy");

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: newResponseHeaders,
      });
    } catch (err) {
      return new Response(`Worker Proxy Error: ${err.message}`, { status: 500 });
    }
  },
};
