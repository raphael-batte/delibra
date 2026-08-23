#!/usr/bin/env node
/* ==========================================================================
   Локальный сервер галереи.

   Статика плюс несколько операций над папками брендов. Нужен потому, что
   страница сама по себе файлы на диске не создаёт и не удаляет: в браузере
   такого API нет. Пока галерею отдаёт python3 -m http.server, «удалить
   сторибук» может означать только «убрать из списка» — с этим сервером
   удаление настоящее.

   Запуск:  node packages/engine/serve.js [порт]

   Сервер намеренно локальный: слушает только 127.0.0.1 и работает строго
   внутри папки brands/. Открывать его наружу нельзя — это инструмент
   разработчика, а не сервис.
   ========================================================================== */
'use strict';

const http = require('http');
const fs   = require('fs');
const path = require('path');
const SLUG = require('./slug.js');
const ADAPTERS = require('./figma-adapters.js');
const { spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const BRANDS = path.join(ROOT, 'brands');
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

/* Путь бренда: только прямое имя папки внутри brands/. Ни слэшей, ни
   «..», ни симлинков наружу — иначе DELETE становится оружием. */
function brandDir(id) {
  if (!/^[A-Za-z0-9._-]+$/.test(id) || id === '.' || id === '..') return null;
  const dir = path.join(BRANDS, id);
  const real = fs.existsSync(dir) ? fs.realpathSync(dir) : dir;
  if (path.dirname(real) !== fs.realpathSync(BRANDS)) return null;
  return dir;
}

/* Тело запроса целиком. Файлы бренда — десятки килобайт, поток собираем
   в память: это локальный инструмент разработчика, не сервис. */
function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', chunk => {
      raw += chunk;
      if (raw.length > 8 * 1024 * 1024) reject(new Error('too large'));
    });
    req.on('end', () => resolve(raw));
    req.on('error', reject);
  });
}

/* Занятые имена: и папки на диске, и записи в index.json — второе может
   опережать первое, если бренд подключён симлинком. */
function takenIds() {
  const dirs = fs.existsSync(BRANDS)
    ? fs.readdirSync(BRANDS).filter(n => fs.statSync(path.join(BRANDS, n)).isDirectory())
    : [];
  let listed = [];
  const indexFile = path.join(BRANDS, 'index.json');
  if (fs.existsSync(indexFile)) {
    try { listed = (JSON.parse(fs.readFileSync(indexFile, 'utf8')).brands || []).map(b => b.id); }
    catch (e) { listed = []; }
  }
  return dirs.concat(listed);
}

/* Слова, занятые интерфейсом: /new — экран создания, /brands и /packages —
   настоящие пути. Бренд с таким именем сделал бы адрес неоднозначным. */
const RESERVED = ['new', 'brands', 'packages', 'index'];

function createBrand(res, data) {
  const id = SLUG.unique(data.slug || data.title, takenIds().concat(RESERVED));
  const dir = brandDir(id);
  if (!dir) return send(res, 400, JSON.stringify({ error: 'bad slug' }));
  if (fs.existsSync(dir)) return send(res, 409, JSON.stringify({ error: 'exists' }));

  const files = data.files || {};
  try {
    fs.mkdirSync(dir, { recursive: true });
    /* Папка ассетов создаётся всегда: сторибук заводят, чтобы его наполнили,
       и агенту нужно место, куда класть иконки, а не инструкция «создай
       папку сам». */
    fs.mkdirSync(path.join(dir, 'assets'), { recursive: true });

    Object.keys(files).forEach(rel => {
      const target = path.join(dir, rel);
      if (!path.resolve(target).startsWith(path.resolve(dir))) throw new Error('bad path: ' + rel);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, files[rel]);
    });

    /* Личность бренда — имя папки. В манифесте она тоже должна стоять
       верная: следующий читатель поверит именно ей. */
    const manifestFile = path.join(dir, 'manifest.json');
    if (fs.existsSync(manifestFile)) {
      const m = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
      m.id = id;
      fs.writeFileSync(manifestFile, JSON.stringify(m, null, 2) + '\n');
    }

    const indexFile = path.join(BRANDS, 'index.json');
    const index = fs.existsSync(indexFile)
      ? JSON.parse(fs.readFileSync(indexFile, 'utf8'))
      : { brands: [] };
    index.brands = (index.brands || []).filter(b => b.id !== id);
    index.brands.push({ id: id, path: 'brands/' + id, title: data.title || id });
    fs.writeFileSync(indexFile, JSON.stringify(index, null, 2) + '\n');

    console.log('создан бренд:', id);
    return send(res, 200, JSON.stringify({ ok: true, id: id }));
  } catch (e) {
    /* Недоделанную папку убираем: полусозданный бренд хуже отсутствующего —
       он попадёт в список и будет открываться пустым. */
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e2) {}
    return send(res, 500, JSON.stringify({ error: String(e.message || e) }));
  }
}

/* Один запрос к мосту. Пишем на http.request, а не на fetch: сервер должен
   заводиться на старых node, где глобального fetch ещё нет. */
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

/* Первый адаптер, который отозвался. Отсутствие ответа — не ошибка: у
   человека может быть официальный MCP или вообще другой способ. */
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
    /* brandsRoot — путь на диске, а не URL: онбординг показывает его агенту,
       а тому нужно место в файловой системе, а не адрес в браузере. */
    return send(res, 200, JSON.stringify({
      ok: true, writable: true, root: ROOT, brandsRoot: BRANDS
    }));
  }

  /* Показать файл в проводнике. Смысл в том, чтобы человек мог открыть
     токены редактором и править их руками: галерея показывает систему, но
     правят её в файлах. Путь проверяем по корню — открывать произвольное
     место на диске по просьбе страницы нельзя. */
  if (url.pathname === '/__api/reveal' && req.method === 'POST') {
    return readBody(req).then(raw => {
      let data;
      try { data = JSON.parse(raw); } catch (e) { return send(res, 400, JSON.stringify({ error: 'bad json' })); }

      const target = path.resolve(ROOT, '.' + path.posix.normalize('/' + (data.path || '')));
      if (!target.startsWith(ROOT) || !fs.existsSync(target)) {
        return send(res, 400, JSON.stringify({ error: 'bad path' }));
      }

      /* У каждой системы свой способ: macOS умеет подсветить сам файл,
         Windows тоже, у остальных открываем папку — это лучшее, на что
         можно рассчитывать без догадок про файловый менеджер. */
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

  /* Правка манифеста бренда на диске. Нужна ссылке на макет: имя сторибука
     браузер держит псевдонимом, а ссылка обязана уехать вместе с пакетом. */
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
        /* id не меняем никогда: он же имя папки и адрес. */
        delete fields.id;
        Object.assign(manifest, fields);
        fs.writeFileSync(file, JSON.stringify(manifest, null, 2) + '\n');
        return send(res, 200, JSON.stringify({ ok: true }));
      } catch (e) {
        return send(res, 500, JSON.stringify({ error: String(e.message || e) }));
      }
    }, () => send(res, 400, JSON.stringify({ error: 'bad request' })));
  }

  /* Есть ли рядом мост. Галерея спрашивает только это: как именно агент
     ходит в Figma — не её дело. */
  if (url.pathname === '/__api/design/source') {
    return findAdapter().then(adapter => send(res, 200, JSON.stringify(
      adapter ? { connected: true, adapter: adapter.id, label: adapter.label }
              : { connected: false })));
  }

  /* Прокси к мосту: браузеру туда нельзя — другой порт, CORS. */
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
        /* Переменных может быть много, а плагин отвечает не мгновенно. */
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

  const m = url.pathname.match(/^\/__api\/brand\/([^/]+)$/);
  if (m && req.method === 'DELETE') {
    const id = decodeURIComponent(m[1]);
    const dir = brandDir(id);
    if (!dir) return send(res, 400, JSON.stringify({ error: 'bad brand id' }));
    if (!fs.existsSync(dir)) return send(res, 404, JSON.stringify({ error: 'not found' }));
    try {
      fs.rmSync(dir, { recursive: true, force: true });
      /* Бренд перечислен в brands/index.json — убираем и оттуда, иначе
         список в галерее ссылался бы на пустоту. */
      const indexFile = path.join(BRANDS, 'index.json');
      if (fs.existsSync(indexFile)) {
        const data = JSON.parse(fs.readFileSync(indexFile, 'utf8'));
        data.brands = (data.brands || []).filter(b => b.id !== id);
        fs.writeFileSync(indexFile, JSON.stringify(data, null, 2) + '\n');
      }
      console.log('удалён бренд:', id);
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

  /* Короткий адрес сторибука: /sdm вместо
     /packages/engine/gallery.html?brand=../../brands/sdm. Пользователю
     незачем видеть путь к движку и папке брендов — у системы должен быть
     свой адрес, а внутри него только якоря разделов.

     Отдаём ту же галерею, вставив <base>: одной строкой чинятся все
     относительные пути движка, и сам движок из адреса исчезает. */
  const short = url.pathname.match(/^\/([A-Za-z0-9._-]+)\/?$/);
  /* /new — тот же экран галереи, но без сторибука: на нём открывается
     диалог создания. Отдельный адрес нужен, чтобы на него можно было
     сослаться с домашнего экрана. */
  if (short && (short[1] === 'new' || fs.existsSync(path.join(BRANDS, short[1])))) {
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
  console.log('галерея:  http://localhost:' + PORT + '/');
  console.log('корень:   ' + ROOT);
});
