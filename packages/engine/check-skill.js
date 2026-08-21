#!/usr/bin/env node
/* ==========================================================================
   check-skill — читает markdown скиллов и падает на том, чего в них быть
   не должно, либо чего не хватает.

   Смысл проверки: скилл — это контракт поведения агента, и он тихо гниёт.
   В прежнем SKILL.md шапка отправляла читателя в styles.css как в источник
   правды, пока changelog внизу описывал уже другую архитектуру. Кто читал
   сверху — верстал по устаревшему коду. Regex ловит ровно это.

   Запуск:  node packages/engine/check-skill.js [пути…]
   Без аргументов проверяет движковый скилл и все брендовые.
   ========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');

/* Общие правила: действуют на любой скилл в репозитории. */
const COMMON = {
  forbidden: [
    [/\b20\d\d-\d\d-\d\d\b/, 'дата в файле — история живёт в git, не в тексте'],
    [/\/Users\/[a-z]/i,      'абсолютный путь с чьей-то машины'],
    [/v\d+\.\d+\s+20\d\d/,   'проштампованный датой changelog']
  ],
  required: [
    [/^---\r?\n[\s\S]*?^name:/m, 'фронтматтер с полем name'],
    [/description:/,           'поле description — по нему скилл находят']
  ]
};

const RULES = {
  'packages/engine/ENGINE_SKILL.md': {
    required: [
      [/manifest/i,                  'раздел про манифест'],
      [/token-map|descriptor/i,      'как описываются токен-секции'],
      [/data-pick/,                  'требование data-pick в примерах'],
      [/http:\/\//,                  'требование запускать по http'],
      [/i18n|language pack/i,        'раздел про языковые паки'],
      [/Forbidden|forbidden/,        'список запретов']
    ],
    forbidden: [
      [/styles\.css[^\n]{0,40}source of truth/i, 'styles.css назван источником правды'],
      [/\bSDM\b(?![^\n]*(example|e\.g))/,        'движковый скилл не должен знать про SDM']
    ]
  },

  'brands/*/SKILL.md': {
    required: [
      [/source of truth/i,               'явно названный источник правды'],
      [/tokens\.css/,                    'ссылка на файл токенов'],
      [/get_selection|Figma/,            'блок про съём с макета'],
      [/bridge is not answering|not answering|no connection/i, 'таблица «нет коннекта»'],
      [/Mismatch protocol|mismatch protocol/i, 'протокол несоответствий'],
      [/three options|3 options/i,       'требование предложить три варианта'],
      [/Not in the system yet|not in the system/i, 'список того, чего в ДС ещё нет'],
      [/Changelog/i,                     'changelog']
    ],
    forbidden: [
      [/styles\.css\s+(wins|is right|главнее)/i, 'styles.css объявлен главнее ДС'],
      /* Старые тинты упоминать можно — но только как расхождение.
         Строка без слова-отрицания читается как «вот текущее значение». */
      [/(#CDE1F4|#CBCFE7|#BCE3ED)(?![^\n]*\b(not|no longer|replaced|old|was|instead|styles\.css)\b)/i,
       'старый тинт подан как текущий'],
      [/using (existing )?classes from `?styles\.css/i, 'отправляет верстать по styles.css']
    ]
  }
};

function rulesFor(rel) {
  for (const pattern of Object.keys(RULES)) {
    const rx = new RegExp('^' + pattern.replace(/\*/g, '[^/]+') + '$');
    if (rx.test(rel)) return RULES[pattern];
  }
  return null;
}

function check(file) {
  const rel = path.relative(ROOT, file);
  const text = fs.readFileSync(file, 'utf8');
  const own = rulesFor(rel) || {};
  const problems = [];

  /* Запрещённые строки ищем в контексте абзаца, а не строки: markdown
     переносит предложение по словам, и оговорка «это не текущее значение»
     регулярно оказывается на соседней строке от самого значения.
     Номер строки при этом сообщаем точный — искать глазами в 150 строках
     ровно тот труд, ради которого проверка и написана. */
  const lines = text.split('\n');
  const paraOf = [];              // для каждой строки — текст её абзаца
  let start = 0;
  lines.forEach((line, i) => {
    if (line.trim() === '' || i === lines.length - 1) {
      const para = lines.slice(start, i + 1).join(' ');
      for (let k = start; k <= i; k++) paraOf[k] = para;
      start = i + 1;
    }
  });

  [].concat(COMMON.forbidden, own.forbidden || []).forEach(([rx, why]) => {
    lines.forEach((line, i) => {
      if (!rx.test(line)) return;
      if (paraOf[i] && !rx.test(paraOf[i])) return;   // оговорка рядом — не нарушение
      problems.push(`${rel}:${i + 1}  ${why}\n      ${line.trim().slice(0, 90)}`);
    });
  });

  [].concat(COMMON.required, own.required || []).forEach(([rx, what]) => {
    if (!rx.test(text)) problems.push(`${rel}  нет обязательного: ${what}`);
  });

  return problems;
}

function findSkills() {
  const out = [];
  const engine = path.join(ROOT, 'packages/engine/ENGINE_SKILL.md');
  if (fs.existsSync(engine)) out.push(engine);
  const brands = path.join(ROOT, 'brands');
  if (fs.existsSync(brands)) {
    fs.readdirSync(brands).forEach(b => {
      const f = path.join(brands, b, 'SKILL.md');
      if (fs.existsSync(f)) out.push(f);
    });
  }
  return out;
}

const files = process.argv.length > 2
  ? process.argv.slice(2).map(f => path.resolve(f))
  : findSkills();

if (!files.length) {
  console.error('нечего проверять: скиллы не найдены');
  process.exit(1);
}

let failed = 0;
files.forEach(f => {
  const problems = check(f);
  if (problems.length) {
    failed += problems.length;
    problems.forEach(p => console.log('  ✗ ' + p));
  } else {
    console.log('  ✓ ' + path.relative(ROOT, f));
  }
});

console.log(failed ? `\n${failed} нарушени(й)` : '\nскиллы в порядке');
process.exit(failed ? 1 : 0);
