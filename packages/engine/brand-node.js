/* ==========================================================================
   Чтение манифеста бренда из node — для CLI-проверок.

   Раньше каждый скрипт вытаскивал поля регуляркой из manifest.js. После
   перевода пакета на данные манифест это JSON, и разбирать его регуляркой
   больше незачем; legacy-форма поддерживается ровно до тех пор, пока
   остаются непереехавшие бренды.
   ========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');

function readManifest(brandDir) {
  const json = path.join(brandDir, 'manifest.json');
  if (fs.existsSync(json)) return JSON.parse(fs.readFileSync(json, 'utf8'));

  const js = path.join(brandDir, 'manifest.js');
  if (!fs.existsSync(js)) throw new Error('нет манифеста в ' + brandDir);

  /* Legacy: файл присваивает объект в window. Выполняем в изоляции,
     без доступа к чему-либо, кроме подставленного window. */
  const src = fs.readFileSync(js, 'utf8');
  const sandbox = { window: {} };
  new Function('window', src).call(null, sandbox.window);
  return sandbox.window.BRAND_MANIFEST || {};
}

module.exports = { readManifest };
