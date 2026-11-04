// No framework or runtime dependencies: publish only the generated site directory.
const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");
const digest = content => createHash("sha256").update(content).digest("hex");
function build(source, destination) {
  source = path.resolve(source); destination = path.resolve(destination);
  if (destination === source || destination.startsWith(source + path.sep)) throw new Error("Build output must not be inside the source site");
  const entries = fs.readdirSync(source, { recursive: true });
  for (const file of entries) if (fs.lstatSync(path.join(source, file)).isSymbolicLink()) throw new Error(`Refusing symbolic link: ${file}`);
  const files = entries.filter(file => fs.statSync(path.join(source, file)).isFile());
  const output = new Map();
  for (const file of files) {
    if (file.startsWith(".") || /(?:^|[\\/])\./.test(file) || /(?:\.env(?:\.|$)|\.local\.|\.(pem|key|bak)$)/i.test(file)) throw new Error(`Refusing to publish local/private configuration: ${file}`);
    const content = fs.readFileSync(path.join(source, file));
    const text = content.toString();
    if (/\bsb_secret_[A-Za-z0-9_-]+|\bservice_role\s*[=:]\s*["'][^"']+["']|-----BEGIN[^\n]*PRIVATE KEY-----/.test(text)) throw new Error(`Potential private credential in ${file}`);
    for (const token of text.match(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g) || []) {
      try { if (JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString()).role === "service_role") throw new Error("private JWT"); }
      catch (error) { if (error.message === "private JWT") throw new Error(`Private service JWT in ${file}`); }
    }
    if (!file.endsWith(".html")) { output.set(file, content); continue; }
    const html = text.replace(/((?:src|href)=")([^"#]+)(")/g, (match, prefix, url, suffix) => {
      if (/^(?:https?:|mailto:|data:)/.test(url)) return match;
      const original = url.split(/[?#]/)[0];
      if (!/\.(js|css|svg)$/.test(original)) return match;
      const asset = path.resolve(path.dirname(path.join(source, file)), original);
      if (!asset.startsWith(source + path.sep)) throw new Error("Asset outside public site");
      return prefix + original + "?v=" + digest(fs.readFileSync(asset)).slice(0, 16) + suffix;
    });
    output.set(file, Buffer.from(html));
  }
  // Only replace/delete artifacts that a prior build owned. Preserve unfamiliar/user-modified output.
  const manifest = path.join(path.dirname(destination), "site-build-manifest.json");
  const previous = fs.existsSync(manifest) ? JSON.parse(fs.readFileSync(manifest, "utf8")) : {};
  if (fs.existsSync(destination)) for (const file of fs.readdirSync(destination, { recursive: true })) {
    const target = path.join(destination, file);
    if (fs.lstatSync(target).isSymbolicLink()) throw new Error(`Unexpected output link: ${file}`);
    if (!fs.statSync(target).isFile()) continue;
    const actual = digest(fs.readFileSync(target));
    if (previous[file] !== actual && (!output.has(file) || digest(output.get(file)) !== actual)) throw new Error(`Preserving unknown or modified output: ${file}`);
  }
  for (const file of Object.keys(previous)) {
    const target = path.resolve(destination, file);
    if (!target.startsWith(destination + path.sep)) throw new Error("Invalid build manifest");
    if (!output.has(file) && fs.existsSync(target)) fs.unlinkSync(target);
  }
  for (const [file, content] of output) {
    fs.mkdirSync(path.dirname(path.join(destination, file)), { recursive: true });
    fs.writeFileSync(path.join(destination, file), content);
  }
  fs.writeFileSync(manifest, JSON.stringify(Object.fromEntries([...output].map(([file, content]) => [file, digest(content)])), null, 2));
  return files.length;
}
module.exports = { build };
if (require.main === module) console.log(`Built ${build(path.resolve(__dirname, "../site"), path.resolve(__dirname, "../dist/site"))} files in dist/site. Publish this directory only.`);
