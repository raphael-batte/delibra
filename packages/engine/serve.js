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

function api(req, res, url) {
  if (url.pathname === '/__api/ping') {
    return send(res, 200, JSON.stringify({ ok: true, writable: true }));
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
