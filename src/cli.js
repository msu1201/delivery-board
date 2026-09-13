import { Source, loadConfig } from "./source.js";
import { startServer } from "./server.js";
import path from "node:path";
const args = process.argv.slice(2);
const option = (name, fallback) => {
  const i = args.indexOf(name);
  return i < 0 ? fallback : args[i + 1];
};
if (args.includes("--help")) {
  console.log(
    "node src/cli.js [--config examples/synthetic/config.json] [--port 0] [--check]\nGET-only loopback viewer. Ctrl+C stops. --check reads configured sources without starting a server.",
  );
  process.exit(0);
}
try {
  const file = path.resolve(
      option("--config", "examples/synthetic/config.json"),
    ),
    config = await loadConfig(file),
    source = new Source(config);
  if (args.includes("--check")) {
    const s = await source.refresh();
    console.log(
      JSON.stringify(
        {
          valid: !s.stale,
          error: s.error,
          nodes: s.graph?.nodes.length,
          edges: s.graph?.nodes.reduce((n, x) => n + x.dependsOn.length, 0),
          hash: s.freshness?.hash,
          git: s.freshness?.git,
        },
        null,
        2,
      ),
    );
    process.exitCode = s.stale ? 1 : 0;
  } else {
    const port = Number(option("--port", "0"));
    if (!Number.isInteger(port) || port < 0 || port > 65535)
      throw Error("Invalid port");
    const app = await startServer(source, port);
    console.log(
      `Delivery Board: ${app.url}\nRead-only source: ${config.root}\nStop: Ctrl+C (PID ${process.pid})`,
    );
    for (const signal of ["SIGINT", "SIGTERM"])
      process.once(signal, async () => {
        await app.close();
        process.exit(0);
      });
  }
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
}
