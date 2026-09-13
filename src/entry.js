#!/usr/bin/env node
import { mkdir, realpath, stat, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch } from './launcher.js';
import { Source, loadConfig } from './source.js';

export const help = `Delivery Board — read-only local project viewer
  node src/entry.js demo [--no-open] [--port N]
  node src/entry.js init [project directory]
  node src/entry.js open [project directory] [--no-open] [--port N]
  node src/entry.js check [project directory]
  node src/entry.js --help
init creates .delivery-board/config.json, graph.json, and WORKFLOW.md only.
open and demo launch a detached loopback viewer; repeat to reuse it.
Stop the displayed viewer PID with your operating system's process tools.`;

export function parseArgs(args) {
  if (!args.length || args.includes('--help')) return { command: 'help' };
  const [command, ...rest] = args;
  if (!['demo', 'init', 'open', 'check'].includes(command)) throw Error(`Unknown command: ${command}. Run --help.`);
  const options = { command, project: '.', port: 4317, open: true };
  let projectSet = false;
  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i];
    if (arg === '--no-open' && ['demo', 'open'].includes(command)) options.open = false;
    else if (arg === '--port' && ['demo', 'open'].includes(command)) {
      const value = rest[++i];
      if (!value || !/^\d+$/.test(value) || Number(value) > 65535) throw Error('Invalid port: use an integer from 0 to 65535.');
      options.port = Number(value);
    } else if (!arg.startsWith('-') && command !== 'demo' && !projectSet) {
      options.project = arg;
      projectSet = true;
    } else throw Error(`Unexpected argument: ${arg}. Run --help.`);
  }
  return options;
}

export async function initProject(project = '.') {
  const root = path.resolve(project);
  if (!(await stat(root)).isDirectory()) throw Error(`Project directory is not a directory: ${root}`);
  const board = path.join(root, '.delivery-board');
  // Non-recursive creation refuses files and all symlinks, including dangling links.
  try { await mkdir(board); } catch (error) {
    if (error.code === 'EEXIST') throw Error(`Refusing to overwrite: ${board} already exists.`);
    throw error;
  }
  const config = { root: '.', adapter: 'normalized', sources: { graph: 'graph.json' }, git: false, evidenceAllowlist: [] };
  const graph = {
    schemaVersion: 1, project: { id: 'project', name: path.basename(root) || 'My project' },
    groups: [{ id: 'work', title: 'Project work' }],
    views: [{ id: 'all', title: 'All work', mode: 'all' }], nodes: [],
  };
  const workflow = `# Delivery Board workflow

This is an empty project board. Edit graph.json to describe your real work.
Add nodes with unique IDs, a groupId, and dependsOn IDs; record acceptance criteria,
verification, human decisions, and delivery evidence separately. Do not claim
acceptance or delivery without evidence. Use the packaged examples as a schema guide.

Run the CLI check command with this project directory after editing, then open it.
The viewer reads these files and does not update project source files.
Evidence access is disabled until you explicitly add relative paths to
config.json's evidenceAllowlist. Paths resolve inside this .delivery-board directory.
`;
  for (const [name, value] of [['config.json', JSON.stringify(config, null, 2) + '\n'], ['graph.json', JSON.stringify(graph, null, 2) + '\n'], ['WORKFLOW.md', workflow]]) {
    await writeFile(path.join(board, name), value, { flag: 'wx' });
  }
  return board;
}

async function projectConfig(project) {
  const file = path.resolve(project, '.delivery-board/config.json');
  try { await stat(file); } catch (error) {
    if (error.code === 'ENOENT') throw Error(`No Delivery Board config at ${file}. Run init for this project first.`);
    throw error;
  }
  return file;
}

export async function checkProject(project = '.') {
  const config = await loadConfig(await projectConfig(project));
  const snapshot = await new Source(config).refresh();
  return {
    valid: !snapshot.stale, error: snapshot.error,
    nodes: snapshot.graph?.nodes.length ?? 0,
    edges: snapshot.graph?.nodes.reduce((total, node) => total + node.dependsOn.length, 0) ?? 0,
    hash: snapshot.freshness?.hash ?? null,
  };
}

function openBrowser(url) {
  const command = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? null : 'xdg-open';
  if (!command) { console.log(`Open ${url} in your browser.`); return; }
  const child = spawn(command, [url], { detached: true, stdio: 'ignore' });
  child.on('error', () => console.error(`Open ${url} in your browser.`));
  child.unref();
}

export async function main(args = process.argv.slice(2)) {
  const options = parseArgs(args);
  if (options.command === 'help') { console.log(help); return 0; }
  if (options.command === 'init') {
    console.log(`Created ${await initProject(options.project)}`);
    return 0;
  }
  if (options.command === 'check') {
    const result = await checkProject(options.project);
    console.log(JSON.stringify(result, null, 2));
    return result.valid ? 0 : 1;
  }
  const configFile = options.command === 'demo'
    ? fileURLToPath(new URL('../examples/travel-demo/config.json', import.meta.url))
    : await projectConfig(options.project);
  const result = await launch({ configFile, port: options.port });
  console.log(`${result.reused ? 'Reusing' : 'Started'} Delivery Board: ${result.url}\nViewer PID: ${result.pid}\nRuntime identity: ${result.stateFile}`);
  if (options.open) openBrowser(result.url);
  return 0;
}

if (process.argv[1] && await realpath(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { process.exitCode = await main(); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
