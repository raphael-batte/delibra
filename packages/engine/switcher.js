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
      b.querySelector('.grow').textContent = R.displayName(suite.id, suite.title);
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

  /* About — про инструмент целиком: знак, имя, версия, две строки о том,
     что это. Отдельным окном, а не строкой в меню: читают редко, но целиком. */
  var about      = document.getElementById('g-about');
  var aboutScrim = document.getElementById('g-about-scrim');
  if (about && aboutScrim) {
    document.getElementById('g-about-ver').textContent =
      t('about.version', { v: B.version, c: B.contract });

    /* Знак берём из той же разметки, что и в сайдбаре, — один источник. */
    var srcPath = document.querySelector('.g-brandmark path');
    var dstPath = document.getElementById('g-about-path');
    if (srcPath && dstPath) dstPath.setAttribute('d', srcPath.getAttribute('d'));

    about.addEventListener('click', function (e) {
      e.stopPropagation();
      closeAll();
      aboutScrim.hidden = false;
    });
    function closeAbout() { aboutScrim.hidden = true; }
    document.getElementById('g-about-close').addEventListener('click', closeAbout);
    aboutScrim.addEventListener('click', function (e) {
      if (e.target === aboutScrim) closeAbout();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeAbout();
    });
  }

  /* ── Настройки сторибука ──────────────────────────────────────────
     Имя и файл для сравнения — свойства конкретной системы, поэтому живут
     здесь, а не в шапке галереи. */
  var settingsBtn   = document.getElementById('g-settings');
  var settingsScrim = document.getElementById('g-settings-scrim');
  if (settingsBtn && settingsScrim) {
    var nameInput = document.getElementById('g-settings-name');
    var nameHint  = document.getElementById('g-settings-name-hint');
    var M2 = window.BRAND_MANIFEST || {};

    var suiteId = M2.id || 'brand';
    nameInput.value = R.displayName(suiteId, M2.title);

    /* Для библиотечного бренда имя локальное: в манифест на диске браузер
       не пишет. Поэтому переименование работает, но названо тем, что оно
       есть, — а не выдаётся за правку пакета. */
    if (!B.source.writable) nameHint.textContent = t('settings.nameLibrary');

    function applyName() {
      var value = nameInput.value.trim();
      R.rename(suiteId, value);
      var shown = R.displayName(suiteId, M2.title);
      var logo = document.getElementById('g-logo');
      if (logo) logo.textContent = shown;
      document.title = shown;
      var row = document.querySelector('#g-suite-list .g-mi .tick');
      if (row && row.textContent.trim() === '✓') {
        row.parentNode.querySelector('.grow').textContent = shown;
      }
    }
    nameInput.addEventListener('input', applyName);
    nameInput.addEventListener('change', applyName);

    settingsBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      closeAll();
      settingsScrim.hidden = false;
    });
    function closeSettings() { settingsScrim.hidden = true; }
    document.getElementById('g-settings-close').addEventListener('click', closeSettings);
    settingsScrim.addEventListener('click', function (e) {
      if (e.target === settingsScrim) closeSettings();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeSettings();
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
