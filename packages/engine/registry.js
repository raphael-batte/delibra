/* ==========================================================================
   Реестр сторибуков.

   Сторибук — это открытый в галерее экземпляр дизайн-системы. Их два вида:

     library — папка в brands/ на диске. Правится в IDE, из браузера
               read-only; переживает очистку хранилища.
     local   — пакет, созданный или импортированный в браузере. Правится
               обменом файлов, живёт только в этом браузере.

   Здесь пока только реестр и активный выбор: пакеты в памяти появятся
   вместе со вторым BrandSource. Список библиотечных читается из
   brands/index.json — браузер не может перечислить папку сам.
   ========================================================================== */
(function () {
  'use strict';

  var ACTIVE_KEY   = 'ds:active';       // какой сторибук открыт
  var SETTINGS_KEY = 'ds:settings';     // общие настройки воркспейса
  var SUITE_KEY    = 'ds:suite:';       // + id → настройки конкретного

  /* Путь к brands/index.json считаем от папки движка, а не от документа:
     тесты открывают галерею из другого места. */
  var INDEX_URL = new URL('../../brands/index.json', document.baseURI).pathname;

  function readJSON(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) || fallback; }
    catch (e) { return fallback; }
  }
  function writeJSON(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
  }

  var Registry = {
    /* Список сторибуков. Библиотечные — из index.json, локальные — из
       браузера (пока всегда пусто: импорт ещё не сделан). */
    list: function () {
      return fetch(INDEX_URL, { cache: 'no-store' })
        .then(function (r) { return r.ok ? r.json() : { brands: [] }; })
        .catch(function () { return { brands: [] }; })
        .then(function (data) {
          var library = (data.brands || []).map(function (b) {
            return {
              id: b.id,
              title: b.title || b.id,
              origin: 'library',
              /* Путь для ?brand= — относительно gallery.html, а index.json
                 перечисляет пути от корня репозитория. */
              brandPath: '../../' + b.path.replace(/^\/+/, '')
            };
          });
          return library.concat(Registry.localSuites());
        });
    },

    /* Локальные сторибуки. Пока заглушка: их источник появится вместе с
       импортом. Возвращаем массив, чтобы вызывающий код уже был готов. */
    localSuites: function () { return []; },

    activeId: function () { return localStorage.getItem(ACTIVE_KEY) || null; },

    setActive: function (id) {
      try { localStorage.setItem(ACTIVE_KEY, id); } catch (e) {}
    },

    /* Общие настройки — про инструмент: язык, масштаб, живая перезагрузка. */
    settings: function () {
      return readJSON(SETTINGS_KEY, { locale: null, scale: null, liveReload: true });
    },
    saveSettings: function (patch) {
      var next = Object.assign(Registry.settings(), patch || {});
      writeJSON(SETTINGS_KEY, next);
      return next;
    },

    /* Настройки конкретного сторибука — про систему: имя, CSS для сравнения,
       ширины превью. Для библиотечного здесь лежит ТОЛЬКО то, чего нет в
       папке: иначе состояние в браузере разъедется с диском. */
    suiteSettings: function (id) {
      return readJSON(SUITE_KEY + id, {});
    },
    saveSuiteSettings: function (id, patch) {
      var next = Object.assign(Registry.suiteSettings(id), patch || {});
      writeJSON(SUITE_KEY + id, next);
      return next;
    },

    /* Переключение = смена активного и перезагрузка галереи с новым брендом.
       ?brand= остаётся рабочим адресом: им пользуются тесты и разработчик,
       и он не должен зависеть от состояния браузера. */
    open: function (suite) {
      Registry.setActive(suite.id);
      var url = location.pathname + '?brand=' + encodeURIComponent(suite.brandPath);
      location.href = url;
    }
  };

  window.ENGINE_REGISTRY = Registry;
})();
