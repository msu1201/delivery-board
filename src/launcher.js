import { fork, spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, realpath, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Source, loadConfig } from './source.js';
import { startServer } from './server.js';

const filename = fileURLToPath(import.meta.url);
const defaultStateDir = fileURLToPath(new URL('../local/runtime/', import.meta.url));
const hash = (value) => createHash('sha256').update(value).digest('hex');
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const json = async (file) => JSON.parse(await readFile(file, 'utf8'));
function alive(pid) {
  if (!Number.isSafeInteger(pid) || pid < 1) throw Error('Invalid launcher owner identity');
  try { process.kill(pid, 0); return true; } catch (error) {
    if (error.code === 'ESRCH') return false;
    return true; // Permission denied is not proof of death.
  }
}

async function verify(state, owner) {
  if (!/^http:\/\/127\.0\.0\.1:[1-9][0-9]*$/.test(state.url || '') ||
      new URL(state.url).port > 65535) throw Error('Cannot verify local viewer identity');
  const options = { redirect: 'error', signal: AbortSignal.timeout(1500) };
  const page = await fetch(state.url, options);
  await page.body?.cancel();
  const cookie = page.headers.get('set-cookie')?.split(';')[0];
  if (!page.ok || !cookie) throw Error('Cannot verify local viewer identity');
  const response = await fetch(state.url + '/api/identity', {
    ...options, signal: AbortSignal.timeout(1500), headers: { cookie },
  });
  const identity = await response.json();
  if (!response.ok || identity.service !== 'delivery-board' ||
      identity.configId !== owner.configId || identity.instanceId !== owner.instanceId ||
      identity.pid !== owner.pid || state.pid !== owner.pid)
    throw Error('Cannot verify local viewer identity; no process was stopped');
}

// The candidate directory contains its complete owner before atomic publication.
// A nested exclusive reaper prevents simultaneous stale-lock recovery from
// removing a newly acquired lock. A live but unverified owner always fails closed.
async function acquire(lock, owner) {
  const candidate = `${lock}.candidate-${owner.instanceId}`;
  await mkdir(candidate, { mode: 0o700 });
  await writeFile(path.join(candidate, 'owner.json'), JSON.stringify(owner), { mode: 0o600 });
  const deadline = Date.now() + 12000;
  try {
    while (Date.now() < deadline) {
      try { await rename(candidate, lock); return null; } catch (error) {
        if (!['EEXIST', 'ENOTEMPTY'].includes(error.code)) throw error;
      }
      let existing;
      try { existing = await json(path.join(lock, 'owner.json')); } catch (error) {
        if (error.code === 'ENOENT') { await delay(50); continue; }
        throw Error('Cannot verify launcher owner; no process was stopped');
      }
      if (alive(existing.pid)) {
        if (existing.configId !== owner.configId)
          throw Error('Configuration changed while a viewer is running. Stop the identified viewer before relaunching.');
        let state;
        try { state = await json(path.join(lock, 'state.json')); } catch (error) {
          if (error.code === 'ENOENT') { await delay(75); continue; }
          throw error;
        }
        try { await verify(state, existing); } catch {
          throw Error('Cannot verify running viewer identity; no process was stopped');
        }
        return { ...state, reused: true };
      }
      const reaper = path.join(lock, 'reap');
      try { await mkdir(reaper); } catch (error) {
        if (['EEXIST', 'ENOENT'].includes(error.code)) { await delay(75); continue; }
        throw error;
      }
      const current = await json(path.join(lock, 'owner.json'));
      if (current.instanceId !== existing.instanceId || alive(current.pid)) {
        await rm(reaper, { recursive: true, force: true });
        continue;
      }
      const retired = `${lock}.retired-${owner.instanceId}`;
      await rename(lock, retired);
      await rm(retired, { recursive: true, force: true });
    }
    throw Error('Launcher is busy or owner is unverified; no duplicate was started. Retry after the current launch finishes.');
  } finally {
    await rm(candidate, { recursive: true, force: true });
  }
}

export async function publishState(stateFile, content) {
  const temporary = `${stateFile}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, content, { mode: 0o600, flag: 'wx' });
    // Contending launchers see ENOENT until the whole identity is readable.
    await rename(temporary, stateFile);
  } finally {
    await rm(temporary, { force: true });
  }
}

async function worker(options) {
  const configFile = await realpath(options.configFile);
  const config = await loadConfig(configFile);
  config.root = await realpath(config.root);
  const source = new Source(config);
  const owner = {
    pid: process.pid, instanceId: randomUUID(),
    configId: hash(JSON.stringify({ configFile, config })),
  };
  await mkdir(options.stateDir, { recursive: true, mode: 0o700 });
  const lock = path.join(options.stateDir, hash(configFile));
  const stateFile = path.join(lock, 'state.json');
  const reused = await acquire(lock, owner);
  if (reused) return reused;
  let app;
  try {
    try { app = await startServer(source, options.port, owner); } catch (error) {
      if (error.code !== 'EADDRINUSE' || options.port === 0) throw error;
      app = await startServer(source, 0, owner);
    }
    const state = { ...owner, url: app.url, stateFile };
    await publishState(stateFile, JSON.stringify(state));
    let closing = false;
    for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, async () => {
      if (closing) return;
      closing = true;
      await app.close();
      await rm(lock, { recursive: true, force: true });
      process.exit(0);
    });
    return { ...state, reused: false };
  } catch (error) {
    await app?.close();
    await rm(lock, { recursive: true, force: true });
    throw error;
  }
}

export async function launch({ configFile, port = 4317, stateDir = defaultStateDir } = {}) {
  if (!configFile) throw Error('An explicit --config file is required');
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw Error('Invalid port');
  const options = { configFile: path.resolve(configFile), port, stateDir: path.resolve(stateDir) };
  return new Promise((resolve, reject) => {
    const child = fork(filename, ['--worker', JSON.stringify(options)], {
      detached: true, stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
    });
    let settled = false;
    const timer = setTimeout(() => {
      // This handle belongs to the worker created immediately above, never a
      // PID recovered from disk. It may only be interrupted before readiness.
      child.kill('SIGTERM');
      finish(Error('Launcher startup timed out'));
    }, 20000);
    function finish(error, result) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (child.connected) child.disconnect();
      child.unref();
      if (error) reject(error); else resolve(result);
    }
    child.once('message', (message) => finish(message.error ? Error(message.error) : null, message.result));
    child.once('error', (error) => finish(error));
    child.once('exit', (code) => { if (!settled) finish(Error(`Launcher exited before readiness (${code})`)); });
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === filename) {
  const args = process.argv.slice(2);
  try {
    if (args[0] === '--worker' && process.send) {
      const result = await worker(JSON.parse(args[1]));
      process.send({ result }, () => { if (process.connected) process.disconnect(); });
    } else if (args.includes('--help')) {
      console.log('node src/launcher.js --config local/project.json [--port 4317] [--no-open]\nManual detached loopback viewer; repeat to reuse or recover. No scheduled startup.');
    } else {
      const options = {};
      let open = true;
      for (let i = 0; i < args.length; i++) {
        if (args[i] === '--no-open') open = false;
        else if (['--config', '--port', '--state-dir'].includes(args[i])) {
          const key = { '--config': 'configFile', '--port': 'port', '--state-dir': 'stateDir' }[args[i]];
          if (!args[i + 1] || args[i + 1].startsWith('--')) throw Error(`Missing ${args[i]} value`);
          options[key] = key === 'port' ? Number(args[++i]) : args[++i];
        } else throw Error(`Unknown argument: ${args[i]}`);
      }
      const result = await launch(options);
      console.log(`${result.reused ? 'Reusing' : 'Started'} Delivery Board: ${result.url}\nViewer PID: ${result.pid}\nManual recovery: run this launcher again.\nRuntime identity: ${result.stateFile}`);
      if (open) {
        const command = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? null : 'xdg-open';
        if (command) {
          const browser = spawn(command, [result.url], { detached: true, stdio: 'ignore' });
          browser.on('error', () => console.error(`Open ${result.url} in your browser.`));
          browser.unref();
        }
      }
    }
  } catch (error) {
    if (process.send && process.connected) process.send({ error: error.message }, () => process.disconnect());
    else console.error(error.message);
    process.exitCode = 1;
  }
}
