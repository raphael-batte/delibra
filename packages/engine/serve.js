#!/usr/bin/env node
/* ==========================================================================
   Local gallery server.

   Static files plus a few operations on brand folders. Needed because the
   page alone cannot create or delete files on disk: the browser has no such
   API. While the gallery is served by python3 -m http.server, "delete
   storybook" can only mean "remove from the list" — with this server,
   deletion is real.

   Run:  node packages/engine/serve.js [port]

   The server is intentionally local: it listens only on 127.0.0.1 and works
   strictly inside DELIBRA_DATA. Do not expose it — this is a developer tool, not
   a service.

   Environment:
     DELIBRA_DATA  — folder for index.json and libra directories
                     (default: ~/.delibra/libras)
   ========================================================================== */
'use strict';

const http = require('http');
const fs   = require('fs');
const path = require('path');
const SLUG = require('./slug.js');
const SCAFFOLD = require('./brand-scaffold.js');
const ADAPTERS = require('./figma-adapters.js');
const ARCHIVE = require('./package-archive.js');
const { spawn } = require('child_process');
const DATA = require('./data-root.js');

const ROOT = path.resolve(__dirname, '..', '..');
const DATA_ROOT = DATA.dataRoot(ROOT);
DATA.ensureDataRoot(DATA_ROOT);
const REPO_BRANDS = DATA.repoBrands(ROOT);
const BRAND_URL_PREFIX = DATA.BRAND_URL_PREFIX;
const PORT = Number(process.argv[2]) || 8777;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.woff2': 'font/woff2',
  '.md':   'text/markdown; charset=utf-8'
};

function send(res, code, body, type) {
  res.writeHead(code, {
    'Content-Type': type || 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(body);
}

/* Brand folder: library libras live in DELIBRA_DATA; _template stays in the repo
   for engine tests only. */
function brandDir(id) {
  if (!/^[A-Za-z0-9._-]+$/.test(id) || id === '.' || id === '..') return null;
  if (id === '_template') {
    const dir = path.join(REPO_BRANDS, '_template');
    return fs.existsSync(dir) ? dir : null;
  }
  const root = fs.realpathSync(DATA_ROOT);
  const dir = path.join(DATA_ROOT, id);
  const real = fs.existsSync(dir) ? fs.realpathSync(dir) : dir;
  if (path.dirname(real) !== root) return null;
  return dir;
}

function indexFile() { return path.join(DATA_ROOT, 'index.json'); }

function pushIndexEntry(index, id, title) {
  index.brands = (index.brands || []).filter(b => b.id !== id);
  index.brands.push({ id: id, title: title || id });
}

const MAX_JSON_BODY = 8 * 1024 * 1024;
const MAX_ZIP_BODY  = 128 * 1024 * 1024;

/* Read the full request body. Brand files are tens of kilobytes; we
   buffer the stream in memory: this is a local developer tool, not a service. */
function readBody(req, maxBytes) {
  const limit = maxBytes || MAX_JSON_BODY;
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', chunk => {
      raw += chunk;
      if (raw.length > limit) reject(new Error('too large'));
    });
    req.on('end', () => resolve(raw));
    req.on('error', reject);
  });
}

function readBodyBinary(req, maxBytes) {
  const limit = maxBytes || MAX_ZIP_BODY;
  return new Promise((resolve, reject) => {
    const chunks = [];
    let len = 0;
    req.on('data', chunk => {
      len += chunk.length;
      if (len > limit) reject(new Error('too large'));
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

/* Taken names: both folders on disk and entries in index.json — the latter
   may lead the former if the brand is linked via symlink. */
function takenIds() {
  const dirs = fs.existsSync(DATA_ROOT)
    ? fs.readdirSync(DATA_ROOT).filter(n => {
      const p = path.join(DATA_ROOT, n);
      return fs.statSync(p).isDirectory();
    })
    : [];
  let listed = [];
  const idx = indexFile();
  if (fs.existsSync(idx)) {
    try { listed = (JSON.parse(fs.readFileSync(idx, 'utf8')).brands || []).map(b => b.id); }
    catch (e) { listed = []; }
  }
  return dirs.concat(listed);
}

/* Words reserved by the UI: /new is the creation screen, /brands and
   /packages are real paths. A brand with such a name would make the URL
   ambiguous. */
const RESERVED = ['new', 'brands', 'packages', 'index', '__api', '__data'];

/* Write a map of files into a brand folder. Paths are confined to the folder:
   a package is data, and data must not reach outside its own directory. */
function writeFiles(dir, files) {
  Object.keys(files).forEach(rel => {
    if (String(rel).endsWith('/')) return;
    const safe = ARCHIVE.safePath(rel);
    if (!safe) throw new Error('bad path: ' + rel);
    const target = path.join(dir, safe);
    if (!path.resolve(target).startsWith(path.resolve(dir))) throw new Error('bad path: ' + rel);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const body = files[rel];
    fs.writeFileSync(target, Buffer.isBuffer(body) ? body : String(body));
  });
}

/* Every file under a brand folder — export is the whole tree, not a scrape. */
function listBrandFiles(dir, base, out) {
  fs.readdirSync(dir).forEach(name => {
    if (name === '.DS_Store') return;
    const full = path.join(dir, name);
    const rel = base ? base + '/' + name : name;
    if (fs.statSync(full).isDirectory()) listBrandFiles(full, rel, out);
    else out.push({ path: rel, data: fs.readFileSync(full) });
  });
}

function exportBrand(id) {
  const dir = brandDir(id);
  if (!dir || !fs.existsSync(dir)) return null;
  const entries = [];
  listBrandFiles(dir, '', entries);
  if (!entries.some(e => e.path === 'manifest.json')) return null;
  return ARCHIVE.pack(entries);
}

/* Full tree copy on disk — duplicate must not re-scaffold or drop files. */
function copyDirSync(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  fs.readdirSync(src).forEach(name => {
    if (name === '.DS_Store') return;
    const from = path.join(src, name);
    const to = path.join(dest, name);
    if (fs.statSync(from).isDirectory()) copyDirSync(from, to);
    else fs.copyFileSync(from, to);
  });
}

function duplicateBrand(sourceId, title, slugHint) {
  const srcDir = brandDir(sourceId);
  if (!srcDir || !fs.existsSync(srcDir)) return { error: 'not found' };

  const id = SLUG.unique(slugHint || title || sourceId, takenIds().concat(RESERVED));
  const dir = brandDir(id);
  if (!dir) return { error: 'bad slug' };
  if (fs.existsSync(dir)) return { error: 'exists' };

  try {
    copyDirSync(srcDir, dir);

    const manifestFile = path.join(dir, 'manifest.json');
    if (fs.existsSync(manifestFile)) {
      const m = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
      m.id = id;
      m.title = title || m.title || id;
      m.design = Object.assign({}, m.design || {}, {
        source: 'duplicate',
        duplicatedFrom: sourceId
      });
      fs.writeFileSync(manifestFile, JSON.stringify(m, null, 2) + '\n');
    }

    const idx = indexFile();
    const index = fs.existsSync(idx)
      ? JSON.parse(fs.readFileSync(idx, 'utf8'))
      : { brands: [] };
    const finalTitle = title || (fs.existsSync(manifestFile)
      ? JSON.parse(fs.readFileSync(manifestFile, 'utf8')).title
      : id);
    pushIndexEntry(index, id, finalTitle);
    fs.writeFileSync(idx, JSON.stringify(index, null, 2) + '\n');

    console.log('brand duplicated:', sourceId, '→', id);
    return { ok: true, id: id };
  } catch (e) {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e2) {}
    return { error: String(e.message || e) };
  }
}

function importBrand(zipBody, title, slugHint) {
  let entries;
  try { entries = ARCHIVE.unpack(zipBody); }
  catch (e) { return { error: 'notArchive', detail: String(e.message || e) }; }

  if (!entries['manifest.json']) return { error: 'notPackage' };

  let manifest;
  try { manifest = JSON.parse(Buffer.from(entries['manifest.json']).toString('utf8')); }
  catch (e) { return { error: 'badManifest', detail: e.message }; }
  if (!manifest || !manifest.css) return { error: 'badManifest' };

  const files = {};
  Object.keys(entries).forEach(rel => {
    files[rel] = ARCHIVE.isTextPath(rel)
      ? Buffer.from(entries[rel]).toString('utf8')
      : Buffer.from(entries[rel]);
  });

  const id = SLUG.unique(slugHint || title || manifest.title || 'storybook', takenIds().concat(RESERVED));
  const dir = brandDir(id);
  if (!dir) return { error: 'bad slug' };

  try {
    fs.mkdirSync(dir, { recursive: true });
    writeFiles(dir, files);

    const manifestFile = path.join(dir, 'manifest.json');
    if (fs.existsSync(manifestFile)) {
      const m = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
      m.id = id;
      m.title = title || m.title || id;
      m.design = Object.assign({}, m.design || {}, { source: 'import' });
      fs.writeFileSync(manifestFile, JSON.stringify(m, null, 2) + '\n');
    }

    const idx = indexFile();
    const index = fs.existsSync(idx)
      ? JSON.parse(fs.readFileSync(idx, 'utf8'))
      : { brands: [] };
    const finalTitle = title || manifest.title || id;
    pushIndexEntry(index, id, finalTitle);
    fs.writeFileSync(idx, JSON.stringify(index, null, 2) + '\n');

    console.log('brand imported:', id);
    return { ok: true, id: id };
  } catch (e) {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e2) {}
    return { error: String(e.message || e) };
  }
}

function createBrand(res, data) {
  const id = SLUG.unique(data.slug || data.title, takenIds().concat(RESERVED));
  const dir = brandDir(id);
  if (!dir) return send(res, 400, JSON.stringify({ error: 'bad slug' }));
  if (fs.existsSync(dir)) return send(res, 409, JSON.stringify({ error: 'exists' }));

  /* No files means an empty storybook: the shell comes from the same scaffold
     the gallery uses, so a folder created over the API is never half-formed. */
  const files = (data.files && Object.keys(data.files).length)
    ? data.files
    : SCAFFOLD.emptyPackage({ title: data.title, id: id, design: data.design, source: data.source }).files;
  try {
    fs.mkdirSync(dir, { recursive: true });
    /* Assets folder is always created: a storybook is started to be filled,
       and the agent needs a place to put icons, not an instruction to
       "create the folder yourself". */
    fs.mkdirSync(path.join(dir, 'assets'), { recursive: true });

    writeFiles(dir, files);

    /* Brand identity is the folder name. The manifest must list the same
       name: the next reader will trust it. */
    const manifestFile = path.join(dir, 'manifest.json');
    if (fs.existsSync(manifestFile)) {
      const m = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
      m.id = id;
      fs.writeFileSync(manifestFile, JSON.stringify(m, null, 2) + '\n');
    }

    const idx = indexFile();
    const index = fs.existsSync(idx)
      ? JSON.parse(fs.readFileSync(idx, 'utf8'))
      : { brands: [] };
    pushIndexEntry(index, id, data.title || id);
    fs.writeFileSync(idx, JSON.stringify(index, null, 2) + '\n');

    console.log('brand created:', id);
    return send(res, 200, JSON.stringify({ ok: true, id: id }));
  } catch (e) {
    /* Remove an incomplete folder: a half-created brand is worse than none —
       it would appear in the list and open empty. */
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e2) {}
    return send(res, 500, JSON.stringify({ error: String(e.message || e) }));
  }
}

/* Single request to the bridge. Uses http.request, not fetch: the server must
   start on older Node versions where global fetch does not exist. */
function askBridge(target, payload, timeoutMs) {
  return new Promise((resolve, reject) => {
    const dest = new URL(target);
    const body = payload == null ? null : JSON.stringify(payload);
    const request = http.request({
      hostname: dest.hostname,
      port: dest.port,
      path: dest.pathname,
      method: body ? 'POST' : 'GET',
      headers: body ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } : {}
    }, response => {
      let raw = '';
      response.on('data', chunk => { raw += chunk; });
      response.on('end', () => {
        try { resolve(JSON.parse(raw)); }
        catch (e) { reject(new Error('bad response')); }
      });
    });
    request.on('error', reject);
    request.setTimeout(timeoutMs || 4000, () => request.destroy(new Error('timeout')));
    if (body) request.write(body);
    request.end();
  });
}

/* First adapter that responded. No response is not an error: the user may
   have the official MCP or another approach entirely. */
function resolveRevealTarget(relPath) {
  const raw = String(relPath || '').trim();
  if (!raw) return null;

  const web = raw.match(/^\/__data\/([A-Za-z0-9._-]+)\/(.*)$/);
  if (web) {
    const dir = brandDir(web[1]);
    return dir ? path.join(dir, web[2]) : null;
  }

  if (path.isAbsolute(raw)) {
    const real = fs.existsSync(raw) ? fs.realpathSync(raw) : raw;
    const dataReal = fs.realpathSync(DATA_ROOT);
    const rootReal = fs.realpathSync(ROOT);
    if (real.startsWith(dataReal + path.sep) || real === dataReal) return real;
    if (real.startsWith(rootReal + path.sep) || real === rootReal) return real;
    return null;
  }

  const target = path.resolve(ROOT, '.' + path.posix.normalize('/' + raw));
  if (!target.startsWith(fs.realpathSync(ROOT))) return null;
  return fs.existsSync(target) ? target : null;
}

function serveDataFile(req, res, url) {
  const m = url.pathname.match(/^\/__data\/([A-Za-z0-9._-]+)(\/.*)?$/);
  if (!m) return false;

  const dir = brandDir(m[1]);
  if (!dir || !fs.existsSync(dir)) {
    send(res, 404, 'not found', 'text/plain');
    return true;
  }

  const rel = decodeURIComponent((m[2] || '/manifest.json').replace(/^\//, ''));
  let file = path.join(dir, rel);
  const realDir = fs.realpathSync(dir);
  const resolved = path.resolve(file);
  if (resolved !== realDir && !resolved.startsWith(realDir + path.sep)) {
    send(res, 403, 'forbidden', 'text/plain');
    return true;
  }

  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!fs.existsSync(file)) {
    send(res, 404, 'not found', 'text/plain');
    return true;
  }

  const body = fs.readFileSync(file);
  res.writeHead(200, {
    'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream',
    'Content-Length': body.length,
    'Last-Modified': fs.statSync(file).mtime.toUTCString(),
    'Cache-Control': 'no-store'
  });
  res.end(req.method === 'HEAD' ? undefined : body);
  return true;
}

function findAdapter() {
  let chain = Promise.resolve(null);
  ADAPTERS.forEach(adapter => {
    chain = chain.then(found => found ? found :
      askBridge(adapter.ping, null, 1500).then(() => adapter, () => null));
  });
  return chain;
}

function api(req, res, url) {
  if (url.pathname === '/__api/ping') {
    return send(res, 200, JSON.stringify({
      ok: true,
      writable: true,
      root: ROOT,
      dataRoot: DATA_ROOT,
      brandsRoot: DATA_ROOT,
      brandUrlPrefix: BRAND_URL_PREFIX,
      indexUrl: '/__api/brands'
    }));
  }

  if (url.pathname === '/__api/brands' && req.method === 'GET') {
    const idx = indexFile();
    if (!fs.existsSync(idx)) return send(res, 200, JSON.stringify({ brands: [] }));
    try {
      return send(res, 200, fs.readFileSync(idx, 'utf8'));
    } catch (e) {
      return send(res, 500, JSON.stringify({ error: String(e.message || e) }));
    }
  }

  /* Reveal a file in the file manager. Lets the user open tokens in an editor
     and edit by hand: the gallery shows the system, but edits happen in files.
     Path is validated against the repo root — the page must not open arbitrary
     locations on disk. */
  if (url.pathname === '/__api/reveal' && req.method === 'POST') {
    return readBody(req).then(raw => {
      let data;
      try { data = JSON.parse(raw); } catch (e) { return send(res, 400, JSON.stringify({ error: 'bad json' })); }

      const target = resolveRevealTarget(data.path || '');
      if (!target || !fs.existsSync(target)) {
        return send(res, 400, JSON.stringify({ error: 'bad path' }));
      }

      /* Each OS has its own way: macOS can highlight the file, Windows too;
         for the rest we open the folder — the best we can do without guessing
         the file manager. */
      let cmd, args;
      if (process.platform === 'darwin')      { cmd = 'open';     args = ['-R', target]; }
      else if (process.platform === 'win32')  { cmd = 'explorer'; args = ['/select,' + target]; }
      else                                    { cmd = 'xdg-open'; args = [path.dirname(target)]; }

      try {
        spawn(cmd, args, { detached: true, stdio: 'ignore' }).unref();
        return send(res, 200, JSON.stringify({ ok: true }));
      } catch (e) {
        return send(res, 500, JSON.stringify({ error: String(e.message || e) }));
      }
    }, () => send(res, 400, JSON.stringify({ error: 'bad request' })));
  }

  /* Write files into an existing storybook. For quick start on the empty
     screen: tokens land in the folder the user already created. */
  const putFiles = url.pathname.match(/^\/__api\/brand\/([^/]+)\/files$/);
  if (putFiles && (req.method === 'POST' || req.method === 'PATCH')) {
    return readBody(req).then(raw => {
      const id = decodeURIComponent(putFiles[1]);
      const dir = brandDir(id);
      if (!dir) return send(res, 400, JSON.stringify({ error: 'bad brand id' }));
      if (!fs.existsSync(dir)) return send(res, 404, JSON.stringify({ error: 'not found' }));

      let files;
      try { files = JSON.parse(raw).files || {}; }
      catch (e) { return send(res, 400, JSON.stringify({ error: 'bad json' })); }

      try {
        writeFiles(dir, files);
        /* Storybook identity is the folder: an incoming manifest must not change it. */
        const manifestFile = path.join(dir, 'manifest.json');
        if (files['manifest.json'] && fs.existsSync(manifestFile)) {
          const m = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
          m.id = id;
          fs.writeFileSync(manifestFile, JSON.stringify(m, null, 2) + '\n');
        }
        return send(res, 200, JSON.stringify({ ok: true, written: Object.keys(files).length }));
      } catch (e) {
        return send(res, 500, JSON.stringify({ error: String(e.message || e) }));
      }
    }, () => send(res, 400, JSON.stringify({ error: 'bad request' })));
  }

  /* Patch brand manifest on disk. Needed for the design link: the browser
     keeps a display name for the storybook, but the link must travel with the
     package. */
  const patch = url.pathname.match(/^\/__api\/brand\/([^/]+)\/manifest$/);
  if (patch && (req.method === 'PATCH' || req.method === 'POST')) {
    return readBody(req).then(raw => {
      const dir = brandDir(decodeURIComponent(patch[1]));
      if (!dir) return send(res, 400, JSON.stringify({ error: 'bad brand id' }));

      const file = path.join(dir, 'manifest.json');
      if (!fs.existsSync(file)) return send(res, 404, JSON.stringify({ error: 'not found' }));

      let fields;
      try { fields = JSON.parse(raw); }
      catch (e) { return send(res, 400, JSON.stringify({ error: 'bad json' })); }

      try {
        const manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
        /* Never change id: it is the folder name and the URL. */
        delete fields.id;
        Object.keys(fields).forEach(function (k) {
          if (fields[k] === null) delete manifest[k];
          else manifest[k] = fields[k];
        });
        fs.writeFileSync(file, JSON.stringify(manifest, null, 2) + '\n');
        return send(res, 200, JSON.stringify({ ok: true }));
      } catch (e) {
        return send(res, 500, JSON.stringify({ error: String(e.message || e) }));
      }
    }, () => send(res, 400, JSON.stringify({ error: 'bad request' })));
  }

  /* Is a bridge nearby. The gallery only asks this: how the agent reaches
     Figma is not its concern. */
  if (url.pathname === '/__api/design/source') {
    return findAdapter().then(adapter => send(res, 200, JSON.stringify(
      adapter ? { connected: true, adapter: adapter.id, label: adapter.label }
              : { connected: false })));
  }

  /* Proxy to the bridge: the browser cannot reach it — different port, CORS. */
  if (url.pathname === '/__api/design/files' && req.method === 'POST') {
    return findAdapter().then(adapter => {
      if (!adapter) return send(res, 200, JSON.stringify({ connected: false }));
      return askBridge(adapter.rpc, { tool: 'list_files' }, 8000)
        .then(out => send(res, 200, JSON.stringify({ connected: true, files: out.data || [] })),
              err => send(res, 502, JSON.stringify({ error: String(err.message || err) })));
    });
  }

  if (url.pathname === '/__api/design/variables' && req.method === 'POST') {
    return readBody(req).then(raw => {
      let ask;
      try { ask = JSON.parse(raw); } catch (e) { return send(res, 400, JSON.stringify({ error: 'bad json' })); }
      return findAdapter().then(adapter => {
        if (!adapter) return send(res, 200, JSON.stringify({ connected: false }));
        /* There may be many variables, and the plugin does not respond instantly. */
        return askBridge(adapter.rpc, { tool: 'get_variable_defs', fileKey: ask.fileKey }, 60000)
          .then(out => send(res, 200, JSON.stringify(out.error ? { error: out.error } : { data: out.data })),
                err => send(res, 502, JSON.stringify({ error: String(err.message || err) })));
      });
    }, () => send(res, 400, JSON.stringify({ error: 'bad request' })));
  }

  if (url.pathname === '/__api/brand' && req.method === 'POST') {
    return readBody(req).then(raw => {
      let data;
      try { data = JSON.parse(raw); }
      catch (e) { return send(res, 400, JSON.stringify({ error: 'bad json' })); }
      createBrand(res, data);
    }, () => send(res, 413, JSON.stringify({ error: 'too large' })));
  }

  if (url.pathname === '/__api/brand/import' && req.method === 'POST') {
    return readBodyBinary(req).then(raw => {
      const title = url.searchParams.get('title') || '';
      const slug = url.searchParams.get('slug') || title;
      const out = importBrand(raw, title.trim(), slug.trim());
      if (out.error) return send(res, 400, JSON.stringify(out));
      return send(res, 200, JSON.stringify(out));
    }, () => send(res, 413, JSON.stringify({ error: 'too large' })));
  }

  const dupMatch = url.pathname.match(/^\/__api\/brand\/([^/]+)\/duplicate$/);
  if (dupMatch && req.method === 'POST') {
    return readBody(req).then(raw => {
      let data;
      try { data = JSON.parse(raw); }
      catch (e) { return send(res, 400, JSON.stringify({ error: 'bad json' })); }
      const sourceId = decodeURIComponent(dupMatch[1]);
      const title = (data.title || '').trim();
      const slug = (data.slug || title || '').trim();
      if (!title) return send(res, 400, JSON.stringify({ error: 'title required' }));
      const out = duplicateBrand(sourceId, title, slug);
      if (out.error) {
        const code = out.error === 'not found' ? 404 : 400;
        return send(res, code, JSON.stringify(out));
      }
      return send(res, 200, JSON.stringify(out));
    }, () => send(res, 400, JSON.stringify({ error: 'bad request' })));
  }

  const exportMatch = url.pathname.match(/^\/__api\/brand\/([^/]+)\/export$/);
  if (exportMatch && req.method === 'GET') {
    const id = decodeURIComponent(exportMatch[1]);
    const zip = exportBrand(id);
    if (!zip) return send(res, 404, JSON.stringify({ error: 'not found' }));
    res.writeHead(200, {
      'Content-Type': 'application/zip',
      'Content-Disposition': 'attachment; filename="' + id + ARCHIVE.EXT + '"',
      'Content-Length': zip.length,
      'Cache-Control': 'no-store'
    });
    return res.end(zip);
  }

  const m = url.pathname.match(/^\/__api\/brand\/([^/]+)$/);
  if (m && req.method === 'DELETE') {
    const id = decodeURIComponent(m[1]);
    const dir = brandDir(id);
    if (!dir) return send(res, 400, JSON.stringify({ error: 'bad brand id' }));
    if (!fs.existsSync(dir)) return send(res, 404, JSON.stringify({ error: 'not found' }));
    try {
      fs.rmSync(dir, { recursive: true, force: true });
      /* Brand is listed in brands/index.json — remove it there too, otherwise
         the gallery list would point at nothing. */
      const idx = indexFile();
      if (fs.existsSync(idx)) {
        const data = JSON.parse(fs.readFileSync(idx, 'utf8'));
        data.brands = (data.brands || []).filter(b => b.id !== id);
        fs.writeFileSync(idx, JSON.stringify(data, null, 2) + '\n');
      }
      console.log('brand deleted:', id);
      return send(res, 200, JSON.stringify({ ok: true }));
    } catch (e) {
      return send(res, 500, JSON.stringify({ error: String(e.message || e) }));
    }
  }

  return send(res, 404, JSON.stringify({ error: 'unknown api' }));
}

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');

  if (url.pathname.startsWith('/__api/')) return api(req, res, url);

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return send(res, 405, JSON.stringify({ error: 'method not allowed' }));
  }

  if (serveDataFile(req, res, url)) return;

  /* Short storybook URL: /sdm instead of
     /packages/engine/gallery.html?brand=/__data/sdm. The user does not
     need to see the engine path — the system should have its own address. */
  const short = url.pathname.match(/^\/([A-Za-z0-9._-]+)\/?$/);
  /* /new — same gallery screen but without a storybook: the creation dialog
     opens on it. A separate URL so the home screen can link to it. */
  if (short && (short[1] === 'new' || fs.existsSync(path.join(DATA_ROOT, short[1])))) {
    const html = fs.readFileSync(path.join(ROOT, 'packages/engine/gallery.html'), 'utf8')
      .replace('<head>', '<head>\n<base href="/packages/engine/">');
    return send(res, 200, html, TYPES['.html']);
  }

  let file = path.join(ROOT, decodeURIComponent(url.pathname));
  if (!path.resolve(file).startsWith(ROOT)) return send(res, 403, 'forbidden', 'text/plain');
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!fs.existsSync(file)) return send(res, 404, 'not found', 'text/plain');

  const body = fs.readFileSync(file);
  res.writeHead(200, {
    'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream',
    'Content-Length': body.length,
    'Last-Modified': fs.statSync(file).mtime.toUTCString(),
    'Cache-Control': 'no-store'
  });
  res.end(req.method === 'HEAD' ? undefined : body);
}).listen(PORT, '127.0.0.1', () => {
  console.log('gallery:  http://localhost:' + PORT + '/');
  console.log('engine:   ' + ROOT);
  console.log('data:     ' + DATA_ROOT);
});
