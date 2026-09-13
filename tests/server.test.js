import http from "node:http";
import test from "node:test";
import assert from "node:assert/strict";
import { startServer } from "../src/server.js";
const source = {
  config: {},
  refresh: async () => ({ graph: null, stale: true, error: "no source" }),
  references: () => [],
  evidence: async () => {
    throw Error("Evidence not allowlisted");
  },
};
test("local session and origin protect read APIs; no arbitrary file or command route", async (t) => {
  const app = await startServer(source, 0);
  t.after(() => app.close());
  const base = app.url;
  assert.equal((await fetch(base + "/api/snapshot")).status, 401);
  const page = await fetch(base);
  assert.equal(page.status, 200);
  const cookie = page.headers.get("set-cookie").split(";")[0];
  assert.match(page.headers.get("set-cookie"), /HttpOnly/);
  assert.match(
    page.headers.get("content-security-policy"),
    /default-src 'self'/,
  );
  const headers = { cookie };
  assert.equal((await fetch(base + "/api/snapshot", { headers })).status, 200);
  for (const h of [
    { ...headers, origin: "https://evil.example" },
    { ...headers, "sec-fetch-site": "cross-site" },
  ])
    assert.equal(
      (await fetch(base + "/api/snapshot", { headers: h })).status,
      403,
      JSON.stringify(h),
    );
  assert.equal(
    await new Promise((resolve) =>
      http.get(
        base + "/api/snapshot",
        { headers: { ...headers, host: "evil.example" } },
        (r) => {
          r.resume();
          resolve(r.statusCode);
        },
      ),
    ),
    403,
  );
  assert.equal(
    (await fetch(base + "/api/snapshot", { headers, method: "POST" })).status,
    405,
  );
  for (const route of [
    "/api/command",
    "/api/file?path=/etc/passwd",
    "/api/evidence?id=../../a",
    "/package.json",
    "/local/project.json",
    "/%2e%2e%2fpackage.json",
  ])
    assert.ok(
      [400, 404].includes((await fetch(base + route, { headers })).status),
    );
  assert.equal(
    (await fetch(base, { headers: { origin: "https://evil.example" } })).status,
    403,
  );
  assert.equal(
    (await fetch(base + "/api/snapshot", { headers })).headers.get(
      "cache-control",
    ),
    "no-store",
  );
});
