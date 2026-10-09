/**
 * Cloudflare Worker: Cookie-Aware Reverse Proxy for Streamlit Community Cloud
 * Domain: job-finder.archevyn.dev -> job-finder-dzbtuvve6sbml9ivzetcio.streamlit.app
 * 
 * Handles Streamlit Cloud's internal session handshake by preserving cookies across redirects.
 */

const TARGET_HOST = "job-finder-dzbtuvve6sbml9ivzetcio.streamlit.app";

export default {
  async fetch(request) {
    try {
      const incomingUrl = new URL(request.url);
      const incomingHost = incomingUrl.hostname;

      // WebSocket connections (Streamlit live rerun)
      if (request.headers.get("Upgrade") === "websocket") {
        const wsUrl = new URL(request.url);
        wsUrl.hostname = TARGET_HOST;
        wsUrl.protocol = "https:";
        const wsHeaders = new Headers(request.headers);
        wsHeaders.set("Host", TARGET_HOST);
        wsHeaders.set("Origin", `https://${TARGET_HOST}`);
        return fetch(wsUrl.toString(), {
          method: request.method,
          headers: wsHeaders,
        });
      }

      // Map incoming request to target
      let currentUrl = new URL(request.url);
      currentUrl.hostname = TARGET_HOST;
      currentUrl.protocol = "https:";

      let currentMethod = request.method;
      let headers = new Headers(request.headers);
      headers.set("Host", TARGET_HOST);
      headers.set("X-Forwarded-Host", incomingHost);
      headers.set("X-Forwarded-Proto", "https");

      if (headers.has("Origin")) {
        headers.set("Origin", `https://${TARGET_HOST}`);
      }

      // Cookie store to bridge redirects
      const cookieStore = new Map();
      if (request.headers.has("Cookie")) {
        request.headers.get("Cookie").split(";").forEach(c => {
          const parts = c.trim().split("=");
          if (parts.length >= 2) cookieStore.set(parts[0], parts.slice(1).join("="));
        });
      }

      // Follow up to 5 redirects manually while collecting cookies
      let finalResponse = null;
      for (let hop = 0; hop < 5; hop++) {
        if (cookieStore.size > 0) {
          const cookieStr = Array.from(cookieStore.entries()).map(([k, v]) => `${k}=${v}`).join("; ");
          headers.set("Cookie", cookieStr);
        }

        const isGetOrHead = currentMethod === "GET" || currentMethod === "HEAD";
        const fetchOptions = {
          method: currentMethod,
          headers: headers,
          redirect: "manual",
          body: (!isGetOrHead && hop === 0) ? request.body : undefined,
        };

        const res = await fetch(currentUrl.toString(), fetchOptions);

        // Harvest Set-Cookie headers
        const rawSetCookies = res.headers.getSetCookie ? res.headers.getSetCookie() : [res.headers.get("Set-Cookie")];
        for (const sc of rawSetCookies) {
          if (sc) {
            const first = sc.split(";")[0].trim();
            const parts = first.split("=");
            if (parts.length >= 2) cookieStore.set(parts[0], parts.slice(1).join("="));
          }
        }

        // If redirect, update URL and headers for next hop
        if (res.status >= 300 && res.status < 400 && res.headers.has("Location")) {
          const redirectTarget = new URL(res.headers.get("Location"), currentUrl);
          currentUrl = redirectTarget;
          headers.set("Host", currentUrl.hostname);
          currentMethod = "GET";
          continue;
        }

        finalResponse = res;
        break;
      }

      if (!finalResponse) {
        return new Response("Too many hops in proxy handshake", { status: 500 });
      }

      // Prepare response for user browser
      const newResponseHeaders = new Headers(finalResponse.headers);
      newResponseHeaders.delete("X-Frame-Options");
      newResponseHeaders.delete("Content-Security-Policy");

      // Set cookies for user's browser
      cookieStore.forEach((v, k) => {
        newResponseHeaders.append("Set-Cookie", `${k}=${v}; Path=/; Secure; SameSite=Lax`);
      });

      return new Response(finalResponse.body, {
        status: finalResponse.status,
        statusText: finalResponse.statusText,
        headers: newResponseHeaders,
      });

    } catch (err) {
      return new Response(`Worker Proxy Error: ${err.message}`, { status: 500 });
    }
  },
};
