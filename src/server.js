import http from "node:http";
import { readFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
const staticFiles = new Map([
  ["/", ["../public/index.html", "text/html"]],
  ["/auto-refresh.js", ["../public/auto-refresh.js", "text/javascript"]],
  ["/app.js", ["../public/app.js", "text/javascript"]],
  ["/routing.js", ["../public/routing.js", "text/javascript"]],
  ["/resize-panel.js", ["../public/resize-panel.js", "text/javascript"]],
  ["/layout.js", ["../public/layout.js", "text/javascript"]],
  ["/graph.js", ["../public/graph.js", "text/javascript"]],
  ["/client-state.js", ["../public/client-state.js", "text/javascript"]],
  ["/current-work.js", ["./current-work.js", "text/javascript"]],
  ["/progress.js", ["./progress.js", "text/javascript"]],
  ["/model.js", ["./model.js", "text/javascript"]],
  ["/style.css", ["../public/style.css", "text/css"]],
  [
    "/vendor/cytoscape.js",
    ["../node_modules/cytoscape/dist/cytoscape.min.js", "text/javascript"],
  ],
]);
export async function startServer(source, port = 0, identity = null) {
  const token = randomBytes(32).toString("hex");
  let origin;
  const server = http.createServer(async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
    );
    const send = (status, body, type = "application/json") => {
      res.writeHead(status, { "Content-Type": type + "; charset=utf-8" });
      res.end(type === "application/json" ? JSON.stringify(body) : body);
    };
    try {
      if (
        req.headers.host !== new URL(origin).host ||
        (req.headers.origin && req.headers.origin !== origin) ||
        (req.headers["sec-fetch-site"] &&
          !["same-origin", "none"].includes(req.headers["sec-fetch-site"]))
      )
        return send(403, { error: "Untrusted request origin" });
      if (req.method !== "GET")
        return send(405, { error: "Read-only GET interface" });
      if (/%2e|%2f|%5c|\\/i.test(req.url))
        return send(400, { error: "Invalid route" });
      const url = new URL(req.url, origin);
      if (url.pathname === "/") {
        res.setHeader(
          "Set-Cookie",
          `board_session=${token}; HttpOnly; SameSite=Strict; Path=/`,
        );
        return send(
          200,
          await readFile(
            new URL("../public/index.html", import.meta.url),
            "utf8",
          ),
          "text/html",
        );
      }
      const cookies = (req.headers.cookie || "")
        .split(";")
        .map((x) => x.trim());
      if (
        url.pathname.startsWith("/api/") &&
        !cookies.includes(`board_session=${token}`)
      )
        return send(401, { error: "Open the local board to start a session" });
      if (url.pathname === "/api/identity" && identity)
        return send(200, { service: "delivery-board", ...identity });
      if (url.pathname === "/api/snapshot") {
        const snapshot = await source.refresh();
        return send(200, {
          ...snapshot,
          evidenceRefs: source
            .references()
            .map((ref) => ({ ref, id: source.evidenceId(ref) })),
        });
      }
      if (url.pathname === "/api/evidence") {
        const id = url.searchParams.get("id");
        if (!/^[a-f0-9]{64}$/.test(id || ""))
          return send(400, { error: "Invalid evidence ID" });
        try {
          return send(200, await source.evidence(id));
        } catch {
          return send(404, {
            error: "Evidence unavailable or outside allowlist",
          });
        }
      }
      if (staticFiles.has(url.pathname)) {
        const [file, type] = staticFiles.get(url.pathname);
        return send(
          200,
          await readFile(new URL(file, import.meta.url), "utf8"),
          type,
        );
      }
      send(404, { error: "Unknown route" });
    } catch {
      send(500, { error: "Local service could not complete the read" });
    }
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });
  origin = `http://127.0.0.1:${server.address().port}`;
  return {
    server,
    url: origin,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}
