import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { server as wisp } from "@mercuryworkshop/wisp-js/server";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "public");
const port = Number(process.env.PORT || 10000);

// Public relay, but never permit targets on private or loopback networks.
wisp.options.allow_private_ips = false;
wisp.options.allow_loopback_ips = false;

const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".wasm": "application/wasm",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

const app = http.createServer(async (req, res) => {
  try {
    const pathname = new URL(req.url || "/", "http://localhost").pathname;
    if (pathname === "/healthz") {
      res.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
      res.end("ok");
      return;
    }

    let requested;
    try {
      requested = decodeURIComponent(pathname);
    } catch {
      res.writeHead(400).end("Bad request");
      return;
    }

    const candidate = path.resolve(root, "." + requested);
    if (candidate !== root && !candidate.startsWith(root + path.sep)) {
      res.writeHead(403).end("Forbidden");
      return;
    }

    let file = candidate;
    try {
      const stat = await fs.stat(file);
      if (stat.isDirectory()) file = path.join(file, "index.html");
    } catch {
      // Client-side routes fall back to the demo entry point.
      if (!path.extname(requested)) file = path.join(root, "index.html");
    }

    const data = await fs.readFile(file);
    res.writeHead(200, {
      "content-type": types[path.extname(file).toLowerCase()] || "application/octet-stream",
      "x-content-type-options": "nosniff",
      "cache-control": file.endsWith("index.html") ? "no-cache" : "public, max-age=3600",
    });
    res.end(data);
  } catch {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("Not found");
  }
});

app.on("upgrade", (req, socket, head) => {
  const pathname = new URL(req.url || "/", "http://localhost").pathname;
  if (!pathname.startsWith("/wisp/")) {
    socket.destroy();
    return;
  }
  wisp.routeRequest(req, socket, head);
});

app.listen(port, "0.0.0.0", () => {
  console.log(`Public Scramjet relay listening on port ${port}`);
});
