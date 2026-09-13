import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { startServer } from '../src/server.js';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function fixture(t) {
  const dir = await mkdtemp(path.join(tmpdir(), 'board-launcher-'));
  const configFile = path.join(dir, 'config.json');
  const config = JSON.parse(await readFile(new URL('../examples/synthetic/config.json', import.meta.url)));
  config.root = new URL('../examples/synthetic/', import.meta.url).pathname;
  await writeFile(configFile, JSON.stringify(config));
  const pids = new Set();
  t.after(async () => {
    for (const pid of pids) { try { process.kill(pid, 'SIGTERM'); } catch {} }
    await delay(150);
    await rm(dir, { recursive: true, force: true });
  });
  const { launch } = await import('../src/launcher.js');
  return { configFile, config, dir, run: async (options = {}) => {
    const result = await launch({ configFile, stateDir: path.join(dir, 'runtime'), port: 0, ...options });
    if (!result.reused) pids.add(result.pid);
    return result;
  } };
}

test('concurrent manual launches start one detached viewer and subsequent launch reuses it', async (t) => {
  const f = await fixture(t);
  const results = await Promise.all(Array.from({ length: 4 }, () => f.run()));
  assert.equal(new Set(results.map((r) => r.pid)).size, 1);
  assert.equal(results.filter((r) => !r.reused).length, 1);
  assert.equal(new Set(results.map((r) => r.url)).size, 1);
  assert.match(results[0].url, /^http:\/\/127\.0\.0\.1:\d+$/);
  assert.equal((await fetch(results[0].url)).status, 200);
  const reused = await f.run();
  assert.equal(reused.reused, true);
  assert.equal(reused.pid, results[0].pid);
});

test('occupied requested port is left running and viewer uses another loopback port', async (t) => {
  const unknown = http.createServer((req, res) => res.end('unrelated service'));
  await new Promise((resolve) => unknown.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => unknown.close(resolve)));
  const f = await fixture(t);
  const original = `http://127.0.0.1:${unknown.address().port}`;
  const result = await f.run({ port: unknown.address().port });
  assert.notEqual(result.url, original);
  assert.equal(await (await fetch(original)).text(), 'unrelated service');
});

test('changed explicit configuration cannot reuse a viewer for earlier configuration', async (t) => {
  const f = await fixture(t);
  const first = await f.run();
  await writeFile(f.configFile, JSON.stringify({ ...f.config, evidenceAllowlist: [] }));
  await assert.rejects(f.run(), /configuration changed.*running/i);
  assert.equal((await fetch(first.url)).status, 200);
});

test('restart recovers the stale lock after its own viewer process exits abruptly', async (t) => {
  const f = await fixture(t);
  const first = await f.run();
  process.kill(first.pid, 'SIGKILL');
  await delay(250);
  const recovered = await Promise.all(Array.from({ length: 4 }, () => f.run()));
  assert.equal(new Set(recovered.map((r) => r.pid)).size, 1);
  assert.equal(recovered.filter((r) => !r.reused).length, 1);
  assert.notEqual(recovered[0].pid, first.pid);
});

test('launcher refuses nonlocal persisted URLs and never contacts them', async (t) => {
  const f = await fixture(t);
  const first = await f.run();
  const state = JSON.parse(await readFile(first.stateFile, 'utf8'));
  await writeFile(first.stateFile, JSON.stringify({ ...state, url: 'https://example.com' }));
  await assert.rejects(f.run(), /identity|verify/i);
  assert.equal((await fetch(first.url)).status, 200);
});

test('identity route retains session, origin, and read-only request protections', async (t) => {
  const identity = { configId: 'config-hash', instanceId: 'instance-nonce', pid: process.pid };
  const app = await startServer({}, 0, identity);
  t.after(() => app.close());
  assert.equal((await fetch(app.url + '/api/identity')).status, 401);
  const page = await fetch(app.url);
  const cookie = page.headers.get('set-cookie').split(';')[0];
  const headers = { cookie };
  const result = await fetch(app.url + '/api/identity', { headers });
  assert.equal(result.status, 200);
  assert.deepEqual(await result.json(), { service: 'delivery-board', ...identity });
  assert.equal((await fetch(app.url + '/api/identity', { headers: { ...headers, origin: 'https://evil.example' } })).status, 403);
  assert.equal((await fetch(app.url + '/api/identity', { headers, method: 'POST' })).status, 405);
});


test('launcher requires explicit configuration and validates ports before spawning', async () => {
  const { launch } = await import('../src/launcher.js');
  await assert.rejects(launch(), /explicit --config/);
  await assert.rejects(launch({ configFile: 'irrelevant', port: -1 }), /Invalid port/);
  await assert.rejects(launch({ configFile: 'irrelevant', port: 65536 }), /Invalid port/);
});


test('state publication hides partial writes from simultaneous launchers', async (t) => {
  const { publishState } = await import('../src/launcher.js');
  const dir = await mkdtemp(path.join(tmpdir(), 'board-state-publication-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const stateFile = path.join(dir, 'state.json');
  const state = { pid: 12345, instanceId: 'complete-identity', url: 'http://127.0.0.1:4317' };
  const content = JSON.stringify(state);
  let writingStarted, releaseWrite;
  const started = new Promise((resolve) => { writingStarted = resolve; });
  const release = new Promise((resolve) => { releaseWrite = resolve; });
  async function* chunks() {
    yield content.slice(0, 8);
    // writeFile requests the next chunk after the first chunk reaches disk.
    writingStarted();
    await release;
    yield content.slice(8);
  }
  const publication = publishState(stateFile, chunks());
  try {
    await started;
    await assert.rejects(readFile(stateFile, 'utf8'), { code: 'ENOENT' });
  } finally {
    releaseWrite();
    await publication;
  }
  assert.deepEqual(JSON.parse(await readFile(stateFile, 'utf8')), state);
});


test('failed state publication leaves no final state or partial temporary file', async (t) => {
  const { publishState } = await import('../src/launcher.js');
  const dir = await mkdtemp(path.join(tmpdir(), 'board-state-failure-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  async function* failingChunks() {
    yield '{"pid":';
    throw Error('interrupted state write');
  }
  await assert.rejects(publishState(path.join(dir, 'state.json'), failingChunks()), /interrupted state write/);
  assert.deepEqual(await readdir(dir), []);
});
