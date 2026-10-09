/**
 * Cloudflare Worker: Seamless Fullscreen Custom Domain Wrapper for Streamlit Community Cloud
 * Domain: job-finder.archevyn.dev -> job-finder-dzbtuvve6sbml9ivzetcio.streamlit.app
 * 
 * Uses embed=true to bypass third-party cookie restrictions (avoiding redirect loops)
 * while seamlessly cropping out the embed footer bar for a true 100% native fullscreen experience.
 */

const STREAMLIT_APP_URL = "https://job-finder-dzbtuvve6sbml9ivzetcio.streamlit.app";

export default {
  async fetch(request) {
    const url = new URL(request.url);

    // Build target URL with embed=true to prevent 3rd-party cookie redirect loops
    const targetUrl = new URL(STREAMLIT_APP_URL);
    targetUrl.searchParams.set("embed", "true");

    // Pass through any extra query parameters from visitor
    for (const [key, value] of url.searchParams.entries()) {
      if (key !== "embed") {
        targetUrl.searchParams.set(key, value);
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
    *, *::before, *::after {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    html, body {
      width: 100vw;
      height: 100vh;
      height: 100dvh;
      overflow: hidden;
      background-color: #0e1117;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }
    /* The iframe is made 40px taller and clipped by parent overflow:hidden,
       completely hiding Streamlit's white embed footer bar while keeping native scrolling */
    #app-frame {
      position: absolute;
      top: 0;
      left: 0;
      width: 100vw;
      height: calc(100vh + 40px);
      height: calc(100dvh + 40px);
      border: 0;
      outline: none;
      display: block;
    }
  </style>
</head>
<body>
  <iframe
    id="app-frame"
    src="${targetUrl.toString()}"
    allow="clipboard-read; clipboard-write; camera; microphone; geolocation; fullscreen"
    allowfullscreen="true"
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
