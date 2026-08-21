#!/usr/bin/env node
/* ==========================================================================
   Сборка секций бренда: логика → данные.

   Авторский слой (tools/sections/<brand>.js) описывает секции сборщиками
   разметки. Этот скрипт выполняет его один раз и кладёт результат в
   brands/<brand>/sections.json — файл, который читает галерея.

   Зачем так: пакет бренда должен состоять только из данных. Тогда сторибук,
   присланный файлом, открывается без выполнения чужого кода, а вся логика
   остаётся в репозитории, где её видно и можно проверить.

   Запуск:  node tools/emit-sections.js sdm
   ========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const brand = process.argv[2];

if (!brand) {
  console.error('нужно имя бренда:\n  node tools/emit-sections.js sdm');
  process.exit(2);
}

const srcFile = path.join(ROOT, 'tools', 'sections', brand + '.js');
const outFile = path.join(ROOT, 'brands', brand, 'sections.json');

if (!fs.existsSync(srcFile)) {
  console.error('нет авторского слоя: ' + path.relative(ROOT, srcFile));
  process.exit(2);
}
if (!fs.existsSync(path.dirname(outFile))) {
  console.error('нет папки бренда: ' + path.relative(ROOT, path.dirname(outFile)));
  process.exit(2);
}

const sections = require(srcFile)();

/* Проверяем то же, что потом проверит check-sections: пусть ошибка всплывёт
   на сборке, а не в браузере через полчаса. */
const problems = [];
sections.forEach((s, i) => {
  if (!s.id)    problems.push(`секция #${i}: нет id`);
  if (!s.title) problems.push(`${s.id || '#' + i}: нет title`);
  (s.examples || []).forEach((ex, j) => {
    const where = `${s.id}/${ex.label || '#' + j}`;
    if (!ex.label) problems.push(`${s.id}: пример #${j} без label`);
    const forms = ['html', 'rows'].filter(k => ex[k] !== undefined);
    if (forms.length !== 1) problems.push(`${where}: должна быть ровно одна форма тела, а не ${forms.join('+') || 'ни одной'}`);
    if (ex.wrap && !ex.rows) problems.push(`${where}: wrap допустим только вместе с rows`);
    if (ex.html && ex.html.indexOf('data-pick') < 0) problems.push(`${where}: в разметке нет data-pick`);
    if (typeof ex.html === 'function' || typeof ex.rows === 'function') problems.push(`${where}: функция вместо данных`);
  });
});

if (problems.length) {
  problems.forEach(p => console.error('  ✗ ' + p));
  console.error('\nне записано: ' + problems.length + ' проблем(ы)');
  process.exit(1);
}

fs.writeFileSync(outFile, JSON.stringify(sections, null, 2) + '\n');

const examples = sections.reduce((n, s) => n + (s.examples || []).length, 0);
const size = (fs.statSync(outFile).size / 1024).toFixed(1);
console.log(`${path.relative(ROOT, outFile)} — ${sections.length} секций, ${examples} примеров, ${size} КБ`);
