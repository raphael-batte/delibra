/* Секции шаблона: одна кнопка в двух вариантах.
   Формат тот же, что у большого бренда, — если движок отрисует это,
   он отрисует и SDM. */
(function () {
  'use strict';

  window.GALLERY = [{
    id: 'buttons',
    group: 'Primitives',
    title: 'Button',
    code: 'components.css',
    examples: [{
      name: 'Button',
      html: '<div style="display:flex; gap:12px; align-items:center">' +
              '<button class="t-btn" data-pick>Primary</button>' +
              '<button class="t-btn t-btn--ghost" data-pick>Ghost</button>' +
            '</div>'
    }]
  }];
})();
