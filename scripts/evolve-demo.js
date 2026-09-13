#!/usr/bin/env node
import { lstat, realpath, open, rename, unlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { validateGraph } from '../src/model.js';
import { readScoped, Source } from '../src/source.js';

const fixtureRoot = fileURLToPath(new URL('../examples/travel-demo/', import.meta.url));
const projectId = 'wayfarer-fictional-demo';
const args = process.argv.slice(2);
const reset = args.includes('--reset');
const targets = args.filter(arg => arg !== '--reset');
let temporary;
try {
  if (targets.length !== 1 || args.filter(arg => arg === '--reset').length > 1 || targets[0].startsWith('--'))
    throw new Error('Usage: node scripts/evolve-demo.js <demo-directory> [--reset]');
  const targetPath = path.resolve(targets[0]);
  if ((await lstat(targetPath)).isSymbolicLink())
    throw new Error('Demo directory must not be a symbolic link');
  const requested = await realpath(targetPath);
  const config = JSON.parse((await readScoped(requested, 'config.json')).content);
  if (config.root !== '.' || config.adapter !== 'normalized' || config.git !== false ||
      JSON.stringify(config.sources) !== JSON.stringify({graph:'graph.json',context:'demo-evidence.md'}) ||
      JSON.stringify(config.evidenceAllowlist) !== JSON.stringify(['demo-evidence.md']))
    throw new Error('Expected the self-contained fictional demo configuration');
  const before = validateGraph(JSON.parse((await readScoped(fixtureRoot, 'before.graph.json')).content));
  const after = validateGraph(JSON.parse((await readScoped(fixtureRoot, 'after.graph.json')).content));
  const original = await readScoped(requested, 'graph.json');
  const current = validateGraph(JSON.parse(original.content));
  if ([current, before, after].some(graph => graph.project.id !== projectId))
    throw new Error('Refusing to change a project other than the fictional Wayfarer demo');
  if (![before, after].some(graph => JSON.stringify(graph) === JSON.stringify(current)))
    throw new Error('Demo graph has custom changes; only the packaged before/after states may be replaced');
  const source = new Source({...config, root:requested});
  const snapshot = await source.refresh();
  if (snapshot.stale) throw new Error(snapshot.error);
  const next = reset ? before : after;
  temporary = path.join(requested, `.graph-${randomUUID()}.tmp`);
  const handle = await open(temporary, 'wx', 0o600);
  try { await handle.writeFile(JSON.stringify(next, null, 2) + '\n'); await handle.sync(); }
  finally { await handle.close(); }
  const latest = await readScoped(requested, 'graph.json', requested);
  if (latest.hash !== original.hash || latest.identity !== original.identity)
    throw new Error('Demo graph changed during evolution; refusing to overwrite');
  await rename(temporary, path.join(requested, 'graph.json'));
  temporary = undefined;
  console.log(reset ? 'Fictional demo reset: 18 tasks, DAY-PLAN active.' : 'Fictional demo evolved: 19 tasks, REORDER active; dependency and journey updated.');
} catch (error) {
  if (temporary) await unlink(temporary).catch(() => {});
  console.error(error.message);
  process.exitCode = 1;
}
