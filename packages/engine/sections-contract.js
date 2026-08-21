/* ==========================================================================
   Контракт секций — общий для CLI и браузера.

   Одни и те же правила проверяют пакет в репозитории (check-sections.js) и
   файл, который пользователь принёс через «Импорт». Разъехаться они не
   должны: тогда импорт принимал бы то, что проверка отвергает.

   Работает и в node (module.exports), и в браузере (window.…CONTRACT).
   ========================================================================== */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ENGINE_SECTIONS_CONTRACT = api;
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* Обязательные поля каждого вида строки каталога. Строка без cls
     отрисуется, но кликнуть по ней будет нельзя; без text выйдет пустая
     кнопка — то есть брак, который виден только глазами. */
  var ROW_FIELDS = {
    btn:  ['size', 'cls', 'text', 'heights'],
    tile: ['name', 'cls', 'meta', 'sample'],
    spec: ['name', 'cls', 'meta', 'sample'],
    gap:  []
  };
  var KINDS = Object.keys(ROW_FIELDS);

  /* Возвращает список проблем строками. Пустой список — секции годны. */
  function check(sections) {
    var problems = [];
    var fail = function (m) { problems.push(m); };

    if (!Array.isArray(sections)) return ['секции должны быть массивом'];

    sections.forEach(function (s, i) {
      var id = s.id || '#' + i;
      if (!s.id)    fail('секция #' + i + ': нет id');
      if (!s.title) fail(id + ': нет title');
      if (s.render) fail(id + ': render() — рисование это дело движка, а не бренда');
      if (!Array.isArray(s.examples) || !s.examples.length) fail(id + ': нет примеров');

      (s.examples || []).forEach(function (ex, j) {
        var where = id + '/' + (ex.label || '#' + j);
        if (!ex.label) fail(id + ': пример #' + j + ' без label');

        var forms = ['html', 'rows'].filter(function (k) { return ex[k] !== undefined; });
        if (forms.length !== 1) {
          fail(where + ': ровно одна форма тела — html ИЛИ rows (сейчас ' +
               (forms.join(' + ') || 'ни одной') + ')');
        }
        if (ex.wrap && !ex.rows) fail(where + ': wrap допустим только вместе с rows');

        if (typeof ex.html === 'string') {
          if (ex.html.indexOf('data-pick') < 0) fail(where + ': нет data-pick — пример не кликабелен');
          if (/<script/i.test(ex.html)) fail(where + ': <script> в разметке примера');
        }
        (ex.rows || []).forEach(function (r, k) {
          if (KINDS.indexOf(r.kind) < 0) {
            fail(where + ': строка #' + k + ' неизвестного вида «' + r.kind + '»');
            return;
          }
          var missing = ROW_FIELDS[r.kind].filter(function (f) {
            return r[f] === undefined || r[f] === '';
          });
          if (missing.length) {
            fail(where + ': строка #' + k + ' (' + r.kind + ') без полей: ' + missing.join(', '));
          }
        });
        /* Обёртка — оболочка, а не разметка: имя тега, классы, data-pick. */
        if (ex.wrap && ex.wrap.tag && !/^[a-z][a-z0-9]*$/.test(ex.wrap.tag)) {
          fail(where + ': wrap.tag «' + ex.wrap.tag + '» — ожидается имя тега');
        }
      });
    });

    return problems;
  }

  return { check: check, ROW_FIELDS: ROW_FIELDS, KINDS: KINDS };
}));
