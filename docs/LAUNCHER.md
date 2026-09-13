# Manual startup and recovery

[Documentation](README.md) · [Basic setup](SETUP.md)

Use the launcher when you already have a board configuration. Run from the tool directory and replace the sample path:

```sh
node src/launcher.js --config local/project.json --port 4317
```

The launcher opens the default browser on macOS/Linux, then exits. The viewer keeps running as a detached local process. macOS is the verified environment; other platforms still need validation.

## Options

| Option | Behavior |
| --- | --- |
| `--config` | Required. No demo configuration is selected by default. |
| `--no-open` | Print the address without opening a browser. |
| `--port 0` | Choose any available loopback port. |
| `--state-dir` | Use a separate runtime directory for isolated fixtures. |

A Finder `.command` file can invoke the same command with absolute Node, launcher and configuration paths.

## Reopen or recover

Run the same command again. It reuses a verified viewer or starts one if it has exited.

- Concurrent launches for the same canonical configuration share a lock and create one viewer.
- Port numbers are preferences. Reuse keeps the existing port; an occupied port causes a new viewer to choose another.
- The launcher never kills a process to free a port.
- Runtime state lives in ignored `local/runtime/`, keyed by the canonical configuration path.

Use the same state directory for every launch of a real configuration. A different directory creates separate coordination; do not use it to bypass a running viewer.

## If startup refuses to continue

| Situation | What to do |
| --- | --- |
| Configuration changed while the viewer is running | Identify and stop that viewer, then launch with the updated configuration. |
| A live PID cannot be verified | Inspect the process and runtime identity. A PID file alone is not enough to reuse or stop it. |
| Viewer was started with `src/cli.js` | Inspect its command and configuration, stop that viewer, then use the launcher. Legacy viewers cannot be adopted automatically. |
| Recovery was interrupted or a PID was recycled | Inspect runtime ownership and running processes. Remove an abandoned runtime directory only after confirming its viewer is stopped. |

## Stop the viewer

1. Read the PID and runtime identity file printed at launch.
2. Verify the PID still belongs to this Delivery Board viewer.
3. Send that process `SIGTERM`, or inspect and stop it in Activity Monitor.

There is no generic PID-file stop command. Normal termination cleans the lock. After abrupt termination, the next launch reclaims it only if the recorded owner PID no longer exists. Uncertain ownership stops recovery.

## How reuse is verified

The launcher checks the live loopback server's:

- Service name, PID and random instance identity.
- SHA-256 fingerprint of the full loaded configuration, canonical configuration path and resolved source root.

Source file contents are reread during use and are not part of launch identity.

Verification obtains the local session cookie and calls `GET /api/identity`. Host, origin, fetch-site, session and GET-only restrictions still apply. Runtime URLs must be literal HTTP `127.0.0.1` origins with no path, credentials or redirects.

## Availability

The viewer binds only to `127.0.0.1`. It is unavailable while the laptop sleeps or is shut down; run the launcher after restarting.

This command does not configure public hosting, remote access, login startup or scheduled tasks. It does not execute source code or change Git state.

## Verification

```sh
node --test tests/launcher.test.js tests/server.test.js
```

Tests use synthetic sources, temporary runtime directories and ephemeral ports. They stop only processes they create.

Coverage includes concurrent launch/recovery, configuration reuse and change refusal, occupied ports, nonlocal runtime-state refusal, configuration/port validation and identity-route security.
