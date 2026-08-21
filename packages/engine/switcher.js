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

  /* Пункт меню ведёт в опасную зону настроек: подтверждение и объяснение
     последствий живут в одном месте, а не дублируются. */
  var del = document.getElementById('g-delete');
  if (del) {
    del.disabled = false;
    del.querySelector('.grow').textContent =
      t(B.source.writable ? 'settings.delete' : 'settings.remove');
    del.addEventListener('click', function (e) {
      e.stopPropagation();
      closeAll();
      /* Ищем диалог по месту, а не по переменной выше: этот обработчик
         объявлен раньше блока настроек, и связывать их порядком объявления
         значит поставить мину под перестановку кода. */
      document.getElementById('g-settings-scrim').hidden = false;
      document.getElementById('g-settings-delete').focus();
    });
  }

  /* ── Общие настройки ──────────────────────────────────────────────
     Язык — свойство инструмента, а не системы: иначе, открыв рядом две
     дизайн-системы, пользователь получил бы галерею на двух языках. */
  var wsBtn   = document.getElementById('g-ws-settings');
  var wsScrim = document.getElementById('g-ws-scrim');
  if (wsBtn && wsScrim) {
    var select = document.getElementById('g-ws-locale');
    var packs = Object.keys(window.ENGINE_I18N || {});
    var manifestLoc = (window.BRAND_MANIFEST || {}).locale || 'en';
    var saved = R.settings().locale || '';

    /* Пустое значение — «как в сторибуке»: движок берёт locale манифеста.
       Это не то же самое, что явно выбранный английский. */
    var auto = document.createElement('option');
    auto.value = '';
    auto.textContent = t('ws.language.auto', { loc: manifestLoc });
    select.appendChild(auto);

    packs.forEach(function (code) {
      var o = document.createElement('option');
      o.value = code;
      o.textContent = code.toUpperCase();
      select.appendChild(o);
    });
    select.value = saved;

    select.addEventListener('change', function () {
      R.saveSettings({ locale: select.value || null });
      /* Строки хрома проставлены при загрузке — перерисовываем страницу
         целиком, вместо того чтобы разыскивать их по одной. */
      location.reload();
    });

    /* Скрытые библиотечные сторибуки возвращаются отсюда — иначе «убрать»
       превращается в одностороннюю дверь. */
    var hiddenRow = document.getElementById('g-ws-hidden');
    function paintHidden() {
      var n = R.hidden().length;
      /* Пустая строка «ничего не скрыто» — сообщение ни о чём: настройка
         существует, только когда есть что возвращать. */
      hiddenRow.hidden = !n;
      if (!n) return;
      hiddenRow.querySelector('.js-count').textContent = t('ws.hidden', { n: n });
    }
    hiddenRow.querySelector('button').textContent = t('ws.hidden.show');
    hiddenRow.querySelector('button').addEventListener('click', function () {
      R.unhideAll();
      location.reload();
    });
    paintHidden();

    wsBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      closeAll();
      wsScrim.hidden = false;
    });
    function closeWs() { wsScrim.hidden = true; }
    document.getElementById('g-ws-close').addEventListener('click', closeWs);
    wsScrim.addEventListener('click', function (e) { if (e.target === wsScrim) closeWs(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeWs(); });
  }

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

  /* Подтверждение вводом слова. «Вы уверены?» нажимают не глядя, поэтому
     необратимое действие требует набрать слово руками. */
  function confirmWord(opts) {
    var scrim = document.getElementById('g-confirm-scrim');
    var input = document.getElementById('g-confirm-input');
    var ok    = document.getElementById('g-confirm-ok');
    var word  = t('confirm.word');

    document.getElementById('g-confirm-title').textContent = opts.title;
    document.getElementById('g-confirm-lead').textContent =
      t('confirm.lead', { word: word });
    document.getElementById('g-confirm-label').textContent = t('confirm.label');
    ok.textContent = opts.action;
    input.value = '';
    ok.disabled = true;
    scrim.hidden = false;
    input.focus();

    function check() { ok.disabled = input.value.trim().toLowerCase() !== word; }
    function close() {
      scrim.hidden = true;
      input.removeEventListener('input', check);
      ok.removeEventListener('click', accept);
    }
    function accept() { close(); opts.onConfirm(); }

    input.addEventListener('input', check);
    ok.addEventListener('click', accept);
    document.getElementById('g-confirm-cancel').onclick = close;
    scrim.onclick = function (e) { if (e.target === scrim) close(); };
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

    var suiteId = B.source.id;      // папка, а не manifest.id — см. brand.js
    nameInput.value = R.displayName(suiteId, M2.title);

    /* Для библиотечного бренда имя локальное: в манифест на диске браузер
       не пишет. Поэтому переименование работает, но названо тем, что оно
       есть, — а не выдаётся за правку пакета. */
    if (!B.source.writable) nameHint.textContent = t('settings.nameLibrary');

    /* Правки применяются по «Сохранить», а не на каждое нажатие клавиши:
       иначе диалог меняет систему, пока человек ещё думает, и отменить
       нечего. Кнопка мертва, пока ничего не изменилось. */
    var saveBtn   = document.getElementById('g-settings-save');
    var cancelBtn = document.getElementById('g-settings-cancel');
    var initialName = nameInput.value;

    function dirty() { return nameInput.value.trim() !== initialName.trim(); }
    function refreshSave() { saveBtn.disabled = !dirty(); }
    nameInput.addEventListener('input', refreshSave);

    function applyName() {
      R.rename(suiteId, nameInput.value.trim());
      var shown = R.displayName(suiteId, M2.title);
      var logo = document.getElementById('g-logo');
      if (logo) logo.textContent = shown;
      document.title = shown;
      var row = document.querySelector('#g-suite-list .g-mi .tick');
      if (row && row.textContent.trim() === '✓') {
        row.parentNode.querySelector('.grow').textContent = shown;
      }
      initialName = nameInput.value;
      refreshSave();
    }

    saveBtn.addEventListener('click', function () {
      applyName();
      settingsScrim.hidden = true;
    });
    cancelBtn.addEventListener('click', function () {
      nameInput.value = initialName;   // введённое, но не сохранённое — забываем
      refreshSave();
      settingsScrim.hidden = true;
    });

    /* Что именно делает кнопка, зависит от вида сторибука: папку на диске
       браузер удалить не может, поэтому для библиотечного это «убрать из
       галереи», и подпись говорит ровно это. */
    var delBtn  = document.getElementById('g-settings-delete');
    var delHint = document.getElementById('g-settings-delete-hint');
    var isLibrary = !B.source.writable;

    /* Что кнопка делает, решает сервер, а не догадки: со своим сервером
       папка удаляется по-настоящему, под статикой — только пропадает из
       списка. Подпись меняется вместе с поведением, чтобы не обещать
       того, чего не будет. */
    var canDelete = false;
    delBtn.textContent  = t(isLibrary ? 'settings.remove' : 'settings.delete');
    delHint.textContent = t(isLibrary ? 'settings.remove.hint' : 'settings.delete.hint');

    if (isLibrary) {
      R.serverWritable().then(function (writable) {
        canDelete = writable;
        if (!writable) return;
        delBtn.textContent  = t('settings.delete');
        delHint.textContent = t('settings.deleteFolder.hint');
      });
    }

    delBtn.addEventListener('click', function () {
      settingsScrim.hidden = true;
      confirmWord({
        title:  t(isLibrary && !canDelete ? 'confirm.removeTitle' : 'confirm.deleteTitle',
                  { name: R.displayName(suiteId, M2.title) }),
        action: t(isLibrary && !canDelete ? 'settings.remove' : 'settings.delete'),
        onConfirm: function () {
          /* Уходим на нейтральный адрес: остаться в удалённом сторибуке
             нельзя, а гадать, какой открыть следующим, — не наше дело. */
          function leave() { location.href = location.pathname; }

          if (canDelete) {
            R.deleteBrand(suiteId).then(leave, function (err) {
              delHint.textContent = t('settings.deleteFailed', { error: err.message });
              settingsScrim.hidden = false;
            });
            return;
          }
          if (isLibrary) R.hide(suiteId);
          R.forget(suiteId);
          leave();
        }
      });
    });

    settingsBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      closeAll();
      settingsScrim.hidden = false;
    });
    function closeSettings() {
      nameInput.value = initialName;
      refreshSave();
      settingsScrim.hidden = true;
    }
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
