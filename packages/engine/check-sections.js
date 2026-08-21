#!/usr/bin/env node
/* ==========================================================================
   check-sections — пакет бренда обязан состоять из данных.

   Проверяет две вещи:
     · файлы данных бренда (манифест, токен-карта, карта старых имён,
       секции) разбираются как JSON и не содержат исполняемого кода;
     · секции соответствуют контракту: у примера ровно одна форма тела —
       снимок разметки (html) либо дескриптор строк каталога (rows).

   Смысл: сторибук, приехавший файлом, открывается без выполнения чужого
   кода. Проверка ловит момент, когда в пакет снова просачивается логика.

   Запуск:  node packages/engine/check-sections.js brands/sdm
   ========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const brandDir = path.resolve(process.argv[2] || 'brands/sdm');
const rel = p => path.relative(ROOT, p);

if (!fs.existsSync(brandDir)) {
  console.error('нет такой папки бренда: ' + brandDir);
  process.exit(2);
}

const problems = [];
const fail = m => problems.push(m);

/* ── Манифест ────────────────────────────────────────────────────────── */
const manifestJson = path.join(brandDir, 'manifest.json');
const manifestJs   = path.join(brandDir, 'manifest.js');

if (!fs.existsSync(manifestJson)) {
  fail(fs.existsSync(manifestJs)
    ? `${rel(manifestJs)}: манифест ещё код — нужен manifest.json`
    : `${rel(brandDir)}: нет manifest.json`);
}

const manifest = fs.existsSync(manifestJson)
  ? JSON.parse(fs.readFileSync(manifestJson, 'utf8'))
  : {};

/* ── Ни одного исполняемого файла в пакете ───────────────────────────── */
/* tests.html и *.md — не часть пакета: это оснастка репозитория. */
const NOT_PACKAGE = new Set(['tests.html']);
fs.readdirSync(brandDir).forEach(name => {
  if (name.endsWith('.js') && !NOT_PACKAGE.has(name)) {
    fail(`${rel(path.join(brandDir, name))}: исполняемый файл в пакете бренда`);
  }
});

/* ── Данные разбираются ──────────────────────────────────────────────── */
function readData(field, target) {
  const file = manifest[field];
  if (!file) return null;
  const full = path.join(brandDir, file);
  if (!file.endsWith('.json')) {
    fail(`${field}: ${file} — данные бренда должны быть JSON`);
    return null;
  }
  if (!fs.existsSync(full)) { fail(`${field}: файла нет — ${rel(full)}`); return null; }
  try { return JSON.parse(fs.readFileSync(full, 'utf8')); }
  catch (e) { fail(`${rel(full)}: не разбирается — ${e.message}`); return null; }
}

readData('tokenMap');
readData('legacyNames');
const sections = readData('sections');

/* ── Контракт секций ─────────────────────────────────────────────────── */
/* Обязательные поля каждого вида строки. Пока их не проверяли, эмит и
   ручная правка расходились молча: строка без cls рисуется, но кликнуть
   по ней нельзя, а без text — выходит пустая кнопка. */
const ROW_FIELDS = {
  btn:  ['size', 'cls', 'text', 'heights'],
  tile: ['name', 'cls', 'meta', 'sample'],
  spec: ['name', 'cls', 'meta', 'sample'],
  gap:  []
};
const KINDS = new Set(Object.keys(ROW_FIELDS));

if (sections) {
  if (!Array.isArray(sections)) fail('секции должны быть массивом');
  else sections.forEach((s, i) => {
    const id = s.id || '#' + i;
    if (!s.id)    fail(`секция #${i}: нет id`);
    if (!s.title) fail(`${id}: нет title`);
    if (s.render) fail(`${id}: render() — рисование это дело движка, а не бренда`);
    if (!Array.isArray(s.examples) || !s.examples.length) fail(`${id}: нет примеров`);

    (s.examples || []).forEach((ex, j) => {
      const where = `${id}/${ex.label || '#' + j}`;
      if (!ex.label) fail(`${id}: пример #${j} без label`);

      const forms = ['html', 'rows'].filter(k => ex[k] !== undefined);
      if (forms.length !== 1) {
        fail(`${where}: ровно одна форма тела — html ИЛИ rows (сейчас ${forms.join(' + ') || 'ни одной'})`);
      }
      if (ex.wrap && !ex.rows) fail(`${where}: wrap допустим только вместе с rows`);

      if (typeof ex.html === 'string') {
        if (ex.html.indexOf('data-pick') < 0) fail(`${where}: нет data-pick — пример не кликабелен`);
        if (/<script/i.test(ex.html)) fail(`${where}: <script> в разметке примера`);
      }
      (ex.rows || []).forEach((r, k) => {
        if (!KINDS.has(r.kind)) {
          fail(`${where}: строка #${k} неизвестного вида «${r.kind}»`);
          return;
        }
        const missing = ROW_FIELDS[r.kind].filter(f => r[f] === undefined || r[f] === '');
        if (missing.length) fail(`${where}: строка #${k} (${r.kind}) без полей: ${missing.join(', ')}`);
      });
      /* Обёртка — оболочка, а не разметка: имя тега, классы, data-pick. */
      if (ex.wrap && ex.wrap.tag && !/^[a-z][a-z0-9]*$/.test(ex.wrap.tag)) {
        fail(`${where}: wrap.tag «${ex.wrap.tag}» — ожидается имя тега`);
      }
    });
  });
}

const name = path.basename(brandDir);
problems.forEach(p => console.log('  ✗ ' + p));
if (!problems.length) {
  const count = sections ? sections.length : 0;
  const examples = sections ? sections.reduce((n, s) => n + (s.examples || []).length, 0) : 0;
  console.log(`  ✓ ${name}: ${count} секций, ${examples} примеров — только данные`);
}
process.exit(problems.length ? 1 : 0);
