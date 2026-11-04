(() => {
  "use strict";
  // Deadline covers both the network request and reading its response body.
  async function json(url, options = {}, timeoutMs = 15000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { ...options, signal: controller.signal, cache: "no-store", credentials: "omit", referrerPolicy: "no-referrer" });
      const body = response.status === 204 ? null : await response.json();
      return { response, body };
    } finally {
      clearTimeout(timer);
    }
  }
  window.CotivantaHTTP = Object.freeze({ json });
})();
