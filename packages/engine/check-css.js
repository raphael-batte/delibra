#!/usr/bin/env node
/* ==========================================================================
   check-css — компоненты бренда обязаны быть написаны токенами.

   Ловит два вида сырых значений в файле компонентов:
     · hex-цвет — цвет всегда обязан приходить из палитры;
     · px вне var() — размер обязан приходить из шкалы.

   Разрешено осознанно:
     0 и none                     — отсутствие величины, токенизировать нечего;
     1px / 2px в border и outline — толщина линии, своей шкалы у неё нет;
     значения внутри @media       — это сами брейкпоинты;
     объявления --*: …            — файл компонентов вправе завести локальную
                                     переменную (--step-i и подобные);
     всё, что перечислено в css.allow.json бренда, с объяснением.

   Запуск:  node packages/engine/check-css.js brands/sdm
   ========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');

const brandDir = path.resolve(process.argv[2] || 'brands/sdm');
const manifestSrc = fs.readFileSync(path.join(brandDir, 'manifest.js'), 'utf8');
const compFile = (manifestSrc.match(/components\s*:\s*'([^']+)'/) || [])[1];
if (!compFile) {
  console.error('в манифесте не объявлен css.components');
  process.exit(2);
}

const allowFile = path.join(brandDir, 'css.allow.json');
const allow = fs.existsSync(allowFile)
  ? JSON.parse(fs.readFileSync(allowFile, 'utf8'))
  : { lines: {} };

const src = fs.readFileSync(path.join(brandDir, compFile), 'utf8');
const lines = src.split('\n');

/* Комментарии вырезаем построчно, чтобы номера строк остались настоящими. */
let inComment = false;
const clean = lines.map(line => {
  let out = '', i = 0;
  while (i < line.length) {
    if (inComment) {
      const end = line.indexOf('*/', i);
      if (end < 0) { i = line.length; break; }
      inComment = false; i = end + 2;
    } else {
      const start = line.indexOf('/*', i);
      if (start < 0) { out += line.slice(i); break; }
      out += line.slice(i, start); inComment = true; i = start + 2;
    }
  }
  return out;
});

const problems = [];
let mediaDepth = 0;

clean.forEach((line, i) => {
  const n = i + 1;
  if (/@media/.test(line)) mediaDepth = 1;
  if (mediaDepth && /\{/.test(line)) mediaDepth++;
  if (mediaDepth && /\}/.test(line)) mediaDepth--;

  const why = allow.lines && allow.lines[String(n)];
  if (why) return;                                   // разрешено явно

  if (/^\s*--[\w-]+\s*:/.test(line)) return;         // локальная переменная

  const hex = line.match(/#[0-9a-fA-F]{3,8}\b/);
  if (hex) problems.push([n, 'сырой цвет ' + hex[0], line]);

  /* px вне var(): вырезаем содержимое var(), чтобы фолбэки не считались. */
  const noVars = line.replace(/var\([^)]*\)/g, 'var()');
  if (/@media/.test(line)) return;                   // брейкпоинты — это и есть px
  const pxs = [...noVars.matchAll(/(-?\d*\.?\d+)px/g)].map(m => m[0]);
  pxs.forEach(v => {
    const num = parseFloat(v);
    const isHairline = (num === 1 || num === 2) && /border|outline|inset/.test(noVars);
    if (num === 0 || isHairline) return;
    problems.push([n, 'сырой размер ' + v, line]);
  });
});

const rel = path.join(path.basename(brandDir), compFile);
problems.forEach(([n, what, line]) =>
  console.log(`  ✗ ${rel}:${n}  ${what}\n      ${line.trim().slice(0, 90)}`));

const allowed = Object.keys(allow.lines || {}).length;
console.log(problems.length
  ? `\nнаходок: ${problems.length}` + (allowed ? ` · разрешено явно: ${allowed}` : '')
  : `\nкомпоненты написаны токенами` + (allowed ? ` · разрешено явно: ${allowed}` : ''));
process.exit(problems.length ? 1 : 0);
