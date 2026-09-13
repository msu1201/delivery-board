import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, readdir, writeFile, symlink, cp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const exec = promisify(execFile);
const packageRoot = fileURLToPath(new URL('../', import.meta.url));
const entry = path.join(packageRoot, 'src/entry.js');
async function temporary(t) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'delivery-entry-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return dir;
}
const run = (args, cwd, file = entry) => exec(process.execPath, [file, ...args], { cwd });

test('init creates exactly three isolated starter files and check validates the empty graph', async t => {
  const dir = await temporary(t);
  await writeFile(path.join(dir, 'keep.txt'), 'original');
  await run(['init'], dir);
  assert.deepEqual((await readdir(dir)).sort(), ['.delivery-board', 'keep.txt']);
  const board = path.join(dir, '.delivery-board');
  assert.deepEqual((await readdir(board)).sort(), ['WORKFLOW.md', 'config.json', 'graph.json']);
  assert.deepEqual(JSON.parse(await readFile(path.join(board, 'config.json'))), {
    root: '.', adapter: 'normalized', sources: { graph: 'graph.json' }, git: false, evidenceAllowlist: [],
  });
  const graph = JSON.parse(await readFile(path.join(board, 'graph.json')));
  assert.equal(graph.nodes.length, 0);
  assert.equal(graph.groups.length, 1);
  assert.equal(graph.views.length, 1);
  const checked = JSON.parse((await run(['check', dir], os.tmpdir())).stdout);
  assert.equal(checked.valid, true);
  assert.equal(checked.nodes, 0);
  await assert.rejects(run(['init', dir], os.tmpdir()), /already exists/);
  assert.equal(await readFile(path.join(dir, 'keep.txt'), 'utf8'), 'original');
});

test('init refuses existing files, directories, and dangling or live symlinks without writes', async t => {
  const base = await temporary(t);
  const target = path.join(base, 'target');
  await mkdir(target);
  for (const kind of ['file', 'directory', 'live-link', 'dangling-link']) {
    const dir = path.join(base, kind);
    await mkdir(dir);
    const dest = path.join(dir, '.delivery-board');
    if (kind === 'file') await writeFile(dest, 'keep');
    else if (kind === 'directory') await mkdir(dest);
    else await symlink(kind === 'live-link' ? target : path.join(base, 'missing'), dest);
    await assert.rejects(run(['init', dir], base), /already exists/);
  }
  assert.deepEqual(await readdir(target), []);
});

test('check reports invalid graph and missing project clearly', async t => {
  const dir = await temporary(t);
  await assert.rejects(run(['check'], dir), /init/);
  await run(['init'], dir);
  await writeFile(path.join(dir, '.delivery-board/graph.json'), '{}');
  await assert.rejects(run(['check'], dir), error => {
    assert.equal(JSON.parse(error.stdout).valid, false);
    return error.code === 1;
  });
});

test('help and argument failures do not create files', async t => {
  const dir = await temporary(t);
  assert.match((await run(['--help'], dir)).stdout, /demo.*\n.*init.*\n.*open.*\n.*check/);
  for (const args of [['demo', '--port', 'NaN'], ['open', '--port'], ['init', '--no-open'], ['bogus']]) {
    await assert.rejects(run(args, dir));
  }
  assert.deepEqual(await readdir(dir), []);
});

test('copied package demo and project open work from an unrelated cwd without npm', async t => {
  const dir = await temporary(t);
  const copy = path.join(dir, 'package');
  await mkdir(copy);
  await cp(path.join(packageRoot, 'src'), path.join(copy, 'src'), { recursive: true });
  await cp(path.join(packageRoot, 'public'), path.join(copy, 'public'), { recursive: true });
  await writeFile(path.join(copy, 'package.json'), '{"type":"module"}');
  await mkdir(path.join(copy, 'examples'), { recursive: true });
  await cp(path.join(packageRoot, 'examples/travel-demo'), path.join(copy, 'examples/travel-demo'), { recursive: true });
  const copiedEntry = path.join(copy, 'src/entry.js');
  await run(['init'], dir, copiedEntry);
  for (const args of [['demo'], ['open', dir]]) {
    const result = await run([...args, '--no-open', '--port', '0'], os.tmpdir(), copiedEntry);
    const pid = Number(result.stdout.match(/Viewer PID: (\d+)/)?.[1]);
    assert.ok(pid > 0);
    t.after(() => { try { process.kill(pid, 'SIGTERM'); } catch {} });
    const url = result.stdout.match(/http:\/\/127\.0\.0\.1:\d+/)?.[0];
    assert.ok(url);
    const response = await fetch(url);
    assert.equal(response.status, 200);
    await response.body.cancel();
    process.kill(pid, 'SIGTERM');
  }
});
