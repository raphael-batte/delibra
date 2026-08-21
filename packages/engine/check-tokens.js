#!/usr/bin/env node
/* ==========================================================================
   check-tokens — аудит токенов бренда.

   Находит три вещи:
     · объявлено, но нигде не используется — мёртвый вес;
     · используется, но не объявлено — фантом, который тихо резолвится
       в пустоту и роняет правило целиком;
     · объявлено дважды с разными значениями в одном контексте — дубль.

   Отложенные токены (объявлены под компоненты, которые ещё не перенесены)
   перечисляются в brands/<id>/tokens.deferred.json и не считаются мёртвыми.

   Запуск:  node packages/engine/check-tokens.js brands/sdm
   ========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');

const brandDir = path.resolve(process.argv[2] || 'brands/sdm');
if (!fs.existsSync(brandDir)) {
  console.error('нет такой папки бренда: ' + brandDir);
  process.exit(2);
}

/* Манифест читаем как текст: тащить сюда браузерный window ради двух полей
   не стоит, а формат стабильный. */
const manifestSrc = fs.readFileSync(path.join(brandDir, 'manifest.js'), 'utf8');
function field(name) {
  const m = manifestSrc.match(new RegExp(name + "\\s*:\\s*'([^']+)'"));
  return m ? m[1] : null;
}

const tokensFile = field('tokens') || 'tokens.css';
const compFile   = field('components');

const tokensCss = fs.readFileSync(path.join(brandDir, tokensFile), 'utf8');
const strip = css => css.replace(/\/\*[\s\S]*?\*\//g, '');

/* Всё, где токен может использоваться: CSS компонентов, секции, дескриптор. */
/* legacy.js сюда НЕ входит: он перечисляет имена из чужого боевого кода,
   а не токены бренда — иначе каждое старое имя выглядело бы фантомом. */
const consumers = [compFile, 'sections.js', 'token-map.js']
  .filter(Boolean)
  .map(f => path.join(brandDir, f))
  .filter(fs.existsSync);

const usageText = consumers.map(f => fs.readFileSync(f, 'utf8')).join('\n');

/* Применение компонентом ≠ упоминание в каталоге. Токен, который только
   показан свотчем, объявлен «на будущее»: рисунка он не даёт ни одному
   элементу. Такие перечисляются в tokens.deferred.json — иначе они
   неотличимы от живых, и обещание «подключим, когда переедет хедер»
   никто не проверяет. */
const appliedText = compFile
  ? strip(fs.readFileSync(path.join(brandDir, compFile), 'utf8'))
  : '';
const applied = new Set();
for (const m of appliedText.matchAll(/var\(\s*(--[\w-]+)/g)) applied.add(m[1]);
const tokensBody = strip(tokensCss);

/* ── объявления ─────────────────────────────────────────────────────── */
const declared = new Map();          // имя → сколько раз объявлен
for (const m of tokensBody.matchAll(/(--[\w-]+)\s*:/g)) {
  declared.set(m[1], (declared.get(m[1]) || 0) + 1);
}

/* ── использования ──────────────────────────────────────────────────── */
const used = new Set();
const allText = strip(usageText) + '\n' + tokensBody;
for (const m of allText.matchAll(/var\(\s*(--[\w-]+)/g)) used.add(m[1]);
// имена, названные строкой в дескрипторе
for (const m of usageText.matchAll(/'(--[\w-]+)'/g)) used.add(m[1]);

/* Дескриптор типографики называет ПРЕФИКС (--font-h1), а объявлены
   производные (--font-h1-size, --font-h1-lh). Считаем префикс использованным,
   если объявлено хоть одно имя, начинающееся с него. */
for (const name of [...used]) {
  if (declared.has(name)) continue;
  for (const d of declared.keys()) {
    if (d.startsWith(name + '-')) { used.add(d); used.delete(name); break; }
  }
}
// каналы вида --x-rgb используются как rgb(var(--x-rgb) / .8) — уже учтено выше

const deferredFile = path.join(brandDir, 'tokens.deferred.json');
const deferred = fs.existsSync(deferredFile)
  ? JSON.parse(fs.readFileSync(deferredFile, 'utf8'))
  : { tokens: [], why: {} };
const deferredSet = new Set(deferred.tokens || []);

const dead = [...declared.keys()].filter(n => !used.has(n) && !deferredSet.has(n));
/* Локальные переменные компонентов (--step-i и подобные) объявлены не в
   файле токенов и токенами бренда не являются — но и фантомами тоже. */
const localDeclared = new Set();
if (compFile) {
  const comp = strip(fs.readFileSync(path.join(brandDir, compFile), 'utf8'));
  for (const m of comp.matchAll(/(--[\w-]+)\s*:/g)) localDeclared.add(m[1]);
}

const phantom = [...used].filter(n => !declared.has(n) && !localDeclared.has(n));
/* Объявлен, показан в каталоге, но ни одним компонентом не применён. */
const unapplied = [...declared.keys()]
  .filter(n => used.has(n) && !applied.has(n) && !deferredSet.has(n))
  /* Ссылки внутри самого файла токенов (алиасы и производные) — не применение,
     но и не забытый токен: их держит тот, кто на них ссылается. */
  .filter(n => !new RegExp('var\\(\\s*' + n + '\\b').test(tokensBody));

const stillDeferred = [...deferredSet].filter(n => declared.has(n) && !applied.has(n));
const resurrected = [...deferredSet].filter(n => applied.has(n));

function list(title, arr, extra) {
  if (!arr.length) return;
  console.log('\n' + title + ' (' + arr.length + ')');
  arr.sort().forEach(n => console.log('  ' + n + (extra && extra[n] ? '   — ' + extra[n] : '')));
}

console.log('бренд: ' + path.basename(brandDir));
console.log('объявлено: ' + declared.size + ' · используется: ' + used.size +
            ' · отложено: ' + deferredSet.size);

list('МЁРТВЫЕ — объявлены, нигде не используются', dead);
list('ОБЪЯВЛЕНЫ, НО НЕ ПРИМЕНЕНЫ — только в каталоге; внести в tokens.deferred.json', unapplied);
list('ФАНТОМЫ — используются, но не объявлены', phantom);
list('отложенные, всё ещё не подключены', stillDeferred, deferred.why);
list('отложенные, которые уже применены — убрать из списка', resurrected);

const failed = dead.length + phantom.length + resurrected.length + unapplied.length;
console.log(failed ? '\nнаходок: ' + failed : '\nтокены в порядке');
process.exit(failed ? 1 : 0);
