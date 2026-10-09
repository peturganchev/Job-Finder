/**
 * Cloudflare Worker: Custom Domain Wrapper for Streamlit Community Cloud
 * Domain: job-finder.archevyn.dev -> job-finder-dzbtuvve6sbml9ivzetcio.streamlit.app
 * 
 * Embeds the Streamlit application seamlessly in full-screen (100dvh) without redirect loops,
 * preserving clean URL in the address bar and native websocket performance.
 */

const STREAMLIT_APP_URL = "https://job-finder-dzbtuvve6sbml9ivzetcio.streamlit.app";

export default {
  async fetch(request) {
    const url = new URL(request.url);

    // Build embed URL
    const embedUrl = new URL(STREAMLIT_APP_URL);
    embedUrl.searchParams.set("embed", "true");

    // Pass through any extra query parameters from visitor
    for (const [key, value] of url.searchParams.entries()) {
      if (key !== "embed") {
        embedUrl.searchParams.set(key, value);
      }
    }

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
  <title>Job Finder | AI Dashboard</title>
  <meta name="description" content="AI Job Finder & Aggregator Dashboard">
  <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>💼</text></svg>">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    html, body {
      width: 100%;
      height: 100%;
      height: 100dvh;
      overflow: hidden;
      background-color: #0e1117;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }
    #app-frame {
      width: 100%;
      height: 100%;
      height: 100dvh;
      border: none;
      display: block;
    }
  </style>
</head>
<body>
  <iframe
    id="app-frame"
    src="${embedUrl.toString()}"
    allow="clipboard-read; clipboard-write; camera; microphone; geolocation"
    title="Job Finder"
  ></iframe>
</body>
</html>`;

    return new Response(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
      },
    });
  },
};
