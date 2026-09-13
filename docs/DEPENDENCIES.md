# Dependencies and distribution

[Documentation](README.md) · [Dependency notices](../THIRD-PARTY-NOTICES.md)

| Dependency | Version | Use | License |
| --- | --- | --- | --- |
| Node.js | 22+ | Runtime | See Node.js distribution |
| Cytoscape.js | 3.33.1 | Graph rendering | MIT |
| Playwright | 1.58.2 | Browser tests | Apache-2.0 |

Exact package versions and integrity hashes are pinned in [package-lock.json](../package-lock.json). Delivery Board uses the [MIT license](../LICENSE).

## Network access

- Installation needs registry access or a populated npm cache.
- Viewing reads local files. Visible pages can refresh about every five seconds.
- External evidence links open only when the user selects them.
- Rendering uses no CDN, model SDK or telemetry.

## Distribution

Download the GitHub preview and install from source. `package.json` uses `private: true` to prevent accidental npm publication; the MIT license still applies.

There is no npm registry package or hosted demo.
