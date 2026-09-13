# Manual startup and recovery

Run from the Delivery Board directory with the actual local configuration:

```sh
node src/launcher.js --config local/project.json --port 4317
```

The launcher opens the board in the default browser on macOS/Linux and exits. The viewer continues as a detached local process. `--no-open` suppresses browser opening; `--port 0` requests any available loopback port. Configuration is required: there is no silent synthetic-data default. A Finder `.command` entry can invoke this same command using absolute Node, launcher, and configuration paths.

Run the same entry again to reuse the verified running viewer or recover after it exits. Concurrent launches for the same canonical configuration file share one lock and produce one viewer. The requested port is only a preference: reuse retains the existing viewer's port, and an occupied port belonging to an unverified service causes a new viewer to use an available port. No process occupying a port is killed.

The runtime owner and state live under ignored `local/runtime/`, keyed by the canonical configuration-file path. `--state-dir` can select a different directory for isolated fixtures; use the same directory for all launches of a real configuration. Changing state directories creates a separate coordination scope and must not be used to work around a running viewer.

Reuse verifies all of the following against the live loopback server: service name, PID, random instance identity, and a SHA-256 fingerprint of the complete loaded configuration, canonical configuration path, and resolved source root. Verification obtains the normal local session cookie and uses `GET /api/identity`; the endpoint keeps the existing host, origin, fetch-site, session, and GET-only restrictions. Runtime URLs must be literal HTTP `127.0.0.1` origins, with no path, credentials, or redirects. Source file contents remain live reads and are not part of launch identity.

Changing configuration while its viewer is running produces an actionable error. A live PID whose identity cannot be verified also produces an error; PID files alone never authorize terminating or reusing a process. Legacy viewers started with `src/cli.js` have no launcher identity and cannot be adopted automatically. Before migrating one, inspect its command and source configuration, stop that identified viewer, then use this launcher.

For shutdown, the launcher prints the verified viewer PID and runtime identity file. Verify that PID still belongs to this Delivery Board viewer before sending it `SIGTERM` (or use Activity Monitor to inspect and stop the identified process). There is intentionally no generic PID-file stop command. Normal termination cleans the lock; after abrupt termination, the next launch reclaims a lock only if its recorded owner PID no longer exists. If a PID has been recycled, identity is unverifiable, or a recovery was interrupted inside its exclusive recovery step, the launcher fails closed instead of guessing. Inspect the saved owner and running processes before manually removing an abandoned runtime directory; do not remove it while its viewer is running.

This is manual local process startup, not a service or scheduled task. The viewer is unavailable while the laptop sleeps or is shut down. After restarting the laptop, run the launcher again. It binds only to `127.0.0.1`; it does not enable public hosting, remote access, source execution, Git mutation, login startup, or system scheduling.

## Verification

```sh
node --test tests/launcher.test.js tests/server.test.js
```

Tests use synthetic read-only source fixtures, independent temporary runtime directories, and ephemeral loopback ports. They terminate only viewer processes they created. Coverage includes concurrent launch/recovery, exact-configuration reuse, changed-configuration refusal, unrelated occupied ports, nonlocal runtime-state refusal, explicit configuration/port validation, and identity-route security.
