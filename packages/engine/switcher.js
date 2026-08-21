/* ==========================================================================
   Переключатель сторибуков — поведение двух меню.

   Плитка  → воркспейс: создать, переключиться.
   Шеврон  → активный сторибук: выгрузить, скопировать ссылку, удалить.

   Пункты, за которыми ещё нет механики (создание, импорт, удаление
   локального), показаны выключенными с подписью «пока не сделано». Это
   осознанно: пустое меню не объясняет, что будет, а живой пункт, который
   ничего не делает, — врёт.
   ========================================================================== */
(function () {
  'use strict';

  var B = window.ENGINE_BRAND;
  var R = window.ENGINE_REGISTRY;
  var t = B.t;

  var mark  = document.getElementById('g-mark');
  var name  = document.getElementById('g-name');
  var menuW = document.getElementById('g-menu-workspace');
  var menuS = document.getElementById('g-menu-suite');
  if (!mark || !name) return;

  /* ── Открытие и закрытие ──────────────────────────────────────────── */
  function closeAll() {
    [menuW, menuS].forEach(function (m) { m.classList.remove('is-open'); });
    [mark, name].forEach(function (b) { b.setAttribute('aria-expanded', 'false'); });
  }

  function toggle(trigger, menu) {
    return function (e) {
      e.stopPropagation();
      var wasOpen = menu.classList.contains('is-open');
      closeAll();
      if (wasOpen) return;
      var r = trigger.getBoundingClientRect();
      menu.style.top  = (r.bottom + 6) + 'px';
      menu.style.left = r.left + 'px';
      menu.classList.add('is-open');
      trigger.setAttribute('aria-expanded', 'true');
    };
  }

  mark.addEventListener('click', toggle(mark, menuW));
  name.addEventListener('click', toggle(name, menuS));
  document.addEventListener('click', closeAll);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeAll(); });

  /* ── Список сторибуков ────────────────────────────────────────────── */
  var list = document.getElementById('g-suite-list');

  R.list().then(function (suites) {
    var current = B.source.base;      // абсолютный путь открытой папки

    suites.forEach(function (suite) {
      var suiteBase = new URL(suite.brandPath.replace(/\/+$/, '') + '/', location.href).pathname;
      var isActive = suiteBase === current;
      if (isActive) R.setActive(suite.id);

      var b = document.createElement('button');
      b.className = 'g-mi';
      b.setAttribute('role', 'menuitem');
      b.innerHTML =
        '<span class="tick">' + (isActive ? '✓' : '') + '</span>' +
        '<span class="grow"></span>' +
        '<span class="badge"></span>';
      /* Имя приходит из данных бренда — вставляем текстом, не разметкой. */
      b.querySelector('.grow').textContent = suite.title;
      b.querySelector('.badge').textContent =
        t(suite.origin === 'library' ? 'menu.library' : 'menu.local');

      if (!isActive) b.addEventListener('click', function () { R.open(suite); });
      list.appendChild(b);
    });
  });

  /* ── Действия над активным ────────────────────────────────────────── */
  function soon(el) {
    if (!el) return;
    el.disabled = true;
    el.title = t('menu.soon');
  }
  soon(document.getElementById('g-new'));
  soon(document.getElementById('g-export'));

  var del = document.getElementById('g-delete');
  if (del) del.title = t('menu.deleteLibrary');   // папку на диске браузер не удалит

  /* About — версии движка, контракта и открытого сторибука. Раньше версия
     висела подписью под логотипом: место рядом с названием читается как
     часть названия, а нужна она изредка. */
  var about = document.getElementById('g-about');
  var aboutPanel = document.getElementById('g-about-panel');
  if (about && aboutPanel) {
    var M = window.BRAND_MANIFEST || {};
    aboutPanel.innerHTML =
      '<dl>' +
        '<dt>' + t('about.engine') + '</dt><dd>' + B.version + '</dd>' +
        '<dt>' + t('about.contract') + '</dt><dd>v' + B.contract + '</dd>' +
        '<dt>' + t('about.storybook') + '</dt><dd class="js-suite-version"></dd>' +
      '</dl><p>' + t('about.http') + '</p>';
    /* Имя и версия бренда — данные, вставляем текстом. */
    aboutPanel.querySelector('.js-suite-version').textContent =
      (M.title || '—') + (M.version ? ' · ' + M.version : '');

    about.addEventListener('click', function (e) {
      e.stopPropagation();
      aboutPanel.hidden = !aboutPanel.hidden;
    });
  }

  var copy = document.getElementById('g-copylink');
  if (copy) {
    copy.addEventListener('click', function () {
      var url = location.origin + location.pathname + '?brand=' + encodeURIComponent(B.source.rel);
      var label = copy.querySelector('.grow');
      var before = label.textContent;
      navigator.clipboard.writeText(url).then(function () {
        label.textContent = t('menu.copied');
        setTimeout(function () { label.textContent = before; closeAll(); }, 900);
      });
    });
  }
})();
