// Local static server with the same security headers as the Cloudflare Pages deployment.
const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");
const types = { ".html": "text/html; charset=utf-8", ".js": "application/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".txt": "text/plain; charset=utf-8" };
async function createSiteServer(root = path.resolve(__dirname, "../site")) {
  const rules = [];
  for (const line of (await fs.readFile(path.join(root, "_headers"), "utf8")).split(/\r?\n/)) {
    if (line.startsWith("/")) rules.push({ route: line.trim(), headers: {} });
    else if (/^\s+[^:]+:/.test(line)) {
      const index = line.indexOf(":");
      rules.at(-1).headers[line.slice(0, index).trim()] = line.slice(index + 1).trim();
    }
  }
  return http.createServer(async (request, response) => {
    let pathname;
    try { pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname); }
    catch { response.writeHead(400).end(); return; }
    const headers = Object.assign({}, ...rules.filter(rule => rule.route === "/*" || rule.route === pathname).map(rule => rule.headers));
    if (!["GET", "HEAD"].includes(request.method)) { response.writeHead(405, { ...headers, Allow: "GET, HEAD" }).end(); return; }
    if (pathname.split("/").some(part => part.startsWith(".") || part === "_headers") || pathname.includes("\\")) { response.writeHead(404, headers).end(); return; }
    const file = path.resolve(root, "." + (pathname.endsWith("/") ? pathname + "index.html" : pathname));
    if (!file.startsWith(root + path.sep)) { response.writeHead(403, headers).end(); return; }
    try {
      const content = await fs.readFile(file);
      response.writeHead(200, { ...headers, "Content-Type": types[path.extname(file)] || "application/octet-stream", "Content-Length": content.length });
      response.end(request.method === "HEAD" ? undefined : content);
    } catch { response.writeHead(404, headers).end(); }
  });
}
module.exports = { createSiteServer };
if (require.main === module) createSiteServer().then(server => server.listen(Number(process.env.PORT) || 8080, "127.0.0.1", () => console.log(`Cotivanta: http://127.0.0.1:${server.address().port}`)));
