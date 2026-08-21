/* ==========================================================================
   Строки каталога — разметка, которой движок показывает примеры.

   Это хром движка, а не компоненты бренда: слева колонка метаданных, справа
   образец. Живёт отдельным модулем, потому что нужен в двух местах — в
   галерее (engine-specs.js) и в скрипте сборки данных бренда
   (tools/emit-sections.js), а дублировать разметку значит однажды
   поправить её только в одном.

   Работает и в браузере, и в node: наружу отдаётся через window.ENGINE_ROWS
   либо module.exports.
   ========================================================================== */
(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ENGINE_ROWS = api;
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function row(items, gap) {
    return '<div style="display:flex;flex-wrap:wrap;align-items:center;gap:' +
      (gap || 12) + 'px;margin-bottom:12px">' + items.join('') + '</div>';
  }

  /* Единая строка каталога: слева колонка метаданных, справа образец.
     Одна сетка (.g-row) на оба брейкпоинта — и для кнопок, и для плиток,
     чтобы подписи в мобильной и десктопной панелях стояли на одной вертикали. */
  function specRow(name, cls, meta, sample) {
    return '<div class="g-row">' +
      '<div class="g-row__meta">' +
        '<div class="g-row__name">' + name + '</div>' +
        '<div class="g-row__cls">' + cls + '</div>' +
        '<div class="g-row__meta-val">' + meta + '</div>' +
      '</div>' +
      '<div class="g-row__sample" data-pick="' + cls + '">' + sample + '</div>' +
    '</div>';
  }

  function btnRow(size, cls, text, heights) {
    var h = heights.split(' / ');
    return specRow(size, cls, 'M ' + h[0] + ' · D ' + h[1],
      '<a href="#" class="' + cls.replace(/^\./, 'btn ').replace(/\./g, ' ') + '">' + text + '</a>');
  }

  /* Иконки берём из assets/icons — это те же файлы, что в вёрстке
     (.perk — i-ban-01…03, .service — i-01…i-05,
     .perk — i-ban-01…03), но с приведённым к квадрату канвасом:
     в оригиналах он разный (37×50, 30×39, 47×37…), из-за чего иконки
     одной высоты выглядели разными по величине. Пути не менялись,
     только рамка viewBox. */
  function tileRow(name, cls, size, sample) {
    return specRow(name, cls, size,
      '<span style="display:inline-flex;align-items:center;gap:12px;padding:12px 16px;' +
      'border-radius:12px;background:var(--card-gray)">' + sample + '</span>');
  }

  /* Распорка между семействами примеров: называем её тем, что она есть,
     вместо атрибута на соседней строке. */
  function gap(size) {
    return '<div style="height:' + (size || 8) + 'px"></div>';
  }

  /* Строка каталога из дескриптора. kind решает, какой из хелперов выше
     вызвать: бренд отдаёт данные, разметку выбирает движок. */
  function renderRow(r) {
    switch (r.kind) {
      case 'btn':  return btnRow(r.size, r.cls, r.text, r.heights);
      case 'tile': return tileRow(r.name, r.cls, r.meta, r.sample);
      case 'spec': return specRow(r.name, r.cls, r.meta, r.sample);
      case 'gap':  return gap(r.size);
      default:     throw new Error('неизвестный вид строки: ' + r.kind);
    }
  }

  /* Пример целиком: строки плюс необязательная обёртка бренда вокруг них
     (тёмный контекст, цветная подложка). Обёртка — только оболочка: тег,
     классы и data-pick, никакой логики. */
  function renderRows(example) {
    var inner = (example.rows || []).map(renderRow).join('');
    var w = example.wrap;
    if (!w) return inner;
    var tag = w.tag || 'div';
    return '<' + tag + ' class="' + (w.class || '') + '"' +
           (w.pick ? ' data-pick="' + w.pick + '"' : '') + '>' + inner + '</' + tag + '>';
  }

  return {
    row: row, specRow: specRow, btnRow: btnRow, tileRow: tileRow,
    gap: gap, renderRow: renderRow, renderRows: renderRows
  };
}));
