// Builds pokemon-showdown for the mobile build, which runs the game inside a
// WebView where there is no Node. The sim is written for Node: its Dex loads
// data files by working out their paths at runtime (require(somePath)), lists
// the mods folder with fs, and its lib pulls in servers, SQL and child
// processes. So this bundles it with:
//   - the runtime requires sent through a table of the data files the game
//     uses (see DATA_FILES below) - a file outside it acts as missing;
//   - Node's built-ins swapped for small stand-ins (or nothing);
// and writes one ES module to src/mobile/vendor/pokemon-showdown.js (not
// committed - run `npm run build:sim-browser`).
import { build } from 'esbuild'
import { readdirSync, readFileSync, mkdirSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const ps = join(root, 'node_modules/pokemon-showdown/dist')
const outfile = join(root, 'src/mobile/vendor/pokemon-showdown.js')

// The made-up folder the sim believes it lives in.
const VIRTUAL = '/ps'

// The mods the game needs data from: the draft's gen7 and gen8 Doubles OU
// (gen7 builds on gen8, gen8 on the base gen9 data).
const MODS = ['gen7', 'gen8']

function jsFilesIn(dir) {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.js') && statSync(join(dir, f)).isFile())
    .map((f) => join(dir, f))
}

const DATA_FILES = [
  ...jsFilesIn(join(ps, 'data')),
  ...jsFilesIn(join(ps, 'data/text')),
  ...MODS.flatMap((mod) => jsFilesIn(join(ps, 'data/mods', mod))),
  join(ps, 'data/random-battles/gen9/teams.js'),
  join(ps, 'config/formats.js')
]

// Every mod's name, so the format list (which names them all) loads.
const ALL_MODS = readdirSync(join(ps, 'data/mods')).filter((f) => statSync(join(ps, 'data/mods', f)).isDirectory())

const registry = `
var files = {
${DATA_FILES.map((file) => {
  const key = VIRTUAL + '/' + relative(ps, file).replace(/\\/g, '/').replace(/\.js$/, '')
  return `  ${JSON.stringify(key)}: function () { return require(${JSON.stringify(file.replace(/\\/g, '/'))}) },`
}).join('\n')}
};
function normalize(path) {
  var out = [];
  for (var part of path.split('/')) {
    if (part === '' || part === '.') continue;
    if (part === '..') out.pop();
    else out.push(part);
  }
  return ('/' + out.join('/')).replace(/\\.js$/, '');
}
exports.psRequire = function (path) {
  var load = files[normalize(path)];
  if (!load) {
    var e = new Error('Cannot find module ' + path);
    e.code = 'MODULE_NOT_FOUND';
    throw e;
  }
  return load();
};
`

const shims = {
  fs: `
exports.readdirSync = function (dir) {
  if (String(dir).replace(/\\/+$/, '') === ${JSON.stringify(VIRTUAL + '/data/mods')}) return ${JSON.stringify(ALL_MODS)};
  return [];
};
exports.existsSync = function () { return false; };
`,
  path: `
function normalize(path) {
  var out = [];
  for (var part of path.split('/')) {
    if (part === '' || part === '.') continue;
    if (part === '..') out.pop();
    else out.push(part);
  }
  return '/' + out.join('/');
}
exports.resolve = function () {
  var path = '';
  for (var i = 0; i < arguments.length; i++) {
    var part = String(arguments[i]);
    path = part.startsWith('/') ? part : path + '/' + part;
  }
  return normalize(path);
};
exports.join = function () { return normalize(Array.prototype.join.call(arguments, '/')); };
exports.dirname = function (p) { return normalize(p + '/..'); };
exports.basename = function (p) { return String(p).split('/').pop(); };
exports.sep = '/';
`,
  util: `
function isDeepStrictEqual(a, b) {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Object.getPrototypeOf(a) !== Object.getPrototypeOf(b)) return false;
  if (Array.isArray(a)) {
    if (a.length !== b.length) return false;
    for (var i = 0; i < a.length; i++) if (!isDeepStrictEqual(a[i], b[i])) return false;
    return true;
  }
  var ka = Object.keys(a), kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  for (var k of ka) if (!Object.prototype.hasOwnProperty.call(b, k) || !isDeepStrictEqual(a[k], b[k])) return false;
  return true;
}
exports.isDeepStrictEqual = isDeepStrictEqual;
exports.inspect = { custom: Symbol.for('nodejs.util.inspect.custom') };
`,
  // Web Crypto is already global in the WebView.
  crypto: `module.exports = globalThis.crypto;`,
  // The sim only needs these three of lib's modules; the rest are the server's.
  lib: ['dashycode', 'streams', 'utils']
    .map((m) => `exports.${m[0].toUpperCase() + m.slice(1)} = require(${JSON.stringify(join(ps, 'lib', m + '.js').replace(/\\/g, '/'))});`)
    .join('\n'),
  empty: `module.exports = {};`
}

const SHIMMED = {
  fs: 'fs',
  'node:fs': 'fs',
  path: 'path',
  'node:path': 'path',
  util: 'util',
  'node:util': 'util',
  crypto: 'crypto',
  'node:crypto': 'crypto'
}
// Only the server side of the package uses these; the sim never calls them.
const EMPTY = [
  'http', 'https', 'net', 'repl', 'child_process', 'cluster', 'os', 'url', 'zlib', 'stream', 'events', 'tty',
  'worker_threads', 'node:worker_threads', 'node:child_process', 'node:os', 'node:url', 'node:stream', 'node:events',
  'nodemailer', 'mysql2', 'pg', 'better-sqlite3', 'sql-template-strings', 'node-oom-heapdump', 'sockjs',
  'source-map-support', 'probe-image-size', 'cloud-env', 'githubhook', 'permessage-deflate', 'sqlite', 'sqlite3'
]

// The three sim files that require computed paths, and use __dirname to build them.
const PATCHED = {
  [join(ps, 'sim/dex.js')]: 'sim',
  [join(ps, 'sim/dex-formats.js')]: 'sim',
  [join(ps, 'sim/teams.js')]: 'sim'
}

const plugin = {
  name: 'sim-browser',
  setup(b) {
    b.onResolve({ filter: /^ps-registry$/ }, () => ({ path: 'ps-registry', namespace: 'sim-virtual' }))
    b.onResolve({ filter: /^ps-entry$/ }, () => ({ path: 'ps-entry', namespace: 'sim-virtual' }))
    b.onResolve({ filter: /^(\.\.\/)+lib$/ }, (args) =>
      /[\\/]pokemon-showdown[\\/]/.test(args.importer) ? { path: 'lib', namespace: 'sim-shim' } : undefined
    )
    b.onResolve({ filter: /.*/ }, (args) => {
      if (SHIMMED[args.path]) return { path: SHIMMED[args.path], namespace: 'sim-shim' }
      if (EMPTY.includes(args.path)) return { path: 'empty', namespace: 'sim-shim' }
      return undefined
    })
    b.onLoad({ filter: /.*/, namespace: 'sim-shim' }, (args) => ({ contents: shims[args.path], loader: 'js', resolveDir: root }))
    b.onLoad({ filter: /.*/, namespace: 'sim-virtual' }, (args) => {
      if (args.path === 'ps-registry') return { contents: registry, loader: 'js', resolveDir: root }
      return {
        contents: `module.exports = {
  sim: require('pokemon-showdown'),
  battleStream: require('pokemon-showdown/dist/sim/battle-stream.js'),
  gen9RandomSets: require('pokemon-showdown/dist/data/random-battles/gen9/sets.json')
};`,
        loader: 'js',
        resolveDir: root
      }
    })
    b.onLoad({ filter: /[\\/]pokemon-showdown[\\/]dist[\\/]sim[\\/](dex|dex-formats|teams)\.js$/ }, (args) => {
      const sub = PATCHED[args.path]
      if (!sub) return undefined
      let src = readFileSync(args.path, 'utf8')
      // Literal requires (require("./x")) are bundled as usual; computed ones go to
      // the table. So do teams.js's picks of a team generator (gen9ssb, afd...),
      // computed or not, made absolute first.
      const before = src
      src = src.replace(/\brequire\((["`])\.\.\/data\//g, `__psRequire($1${VIRTUAL}/data/`)
      src = src.replace(/\brequire\((?!["'])/g, '__psRequire(')
      if (src === before) throw new Error(`no computed requires found in ${args.path} - has pokemon-showdown changed?`)
      src = src.replace(/\b__dirname\b/g, JSON.stringify(`${VIRTUAL}/${sub}`))
      return { contents: 'var __psRequire = require("ps-registry").psRequire;\n' + src, loader: 'js', resolveDir: dirname(args.path) }
    })
  }
}

mkdirSync(dirname(outfile), { recursive: true })
const result = await build({
  entryPoints: ['ps-entry'],
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2020',
  outfile,
  plugins: [plugin],
  define: { global: 'globalThis' },
  logLevel: 'warning',
  metafile: true,
  legalComments: 'none'
})
const bytes = Object.values(result.metafile.outputs).reduce((sum, o) => sum + o.bytes, 0)
console.log(`sim for the browser: ${relative(root, outfile)} (${(bytes / 1024 / 1024).toFixed(1)} MB)`)
