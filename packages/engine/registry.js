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
  var HIDDEN_KEY   = 'ds:hidden';       // библиотечные, убранные из списка
  var SETTINGS_KEY = 'ds:settings';     // общие настройки воркспейса
  var SUITE_KEY    = 'ds:suite:';       // + id → настройки конкретного
  var BUNDLE_KEY   = 'ds:bundle:';      // + id → сам пакет
  var LOCAL_KEY    = 'ds:local';        // список локальных сторибуков

  /* Порог на пакет. Хранилище браузера — рабочая копия, а не архив: то, что
     не помещается, должно уехать файлом, а не потеряться молча. */
  var MAX_BUNDLE_KB = 1024;

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

  /* Умеет ли сервер, который отдаёт галерею, работать с папками.
     python3 -m http.server — нет; packages/engine/serve.js — да.
     Проверяем один раз и запоминаем обещание. */
  var pingPromise = null;
  function ping() {
    if (!pingPromise) {
      pingPromise = fetch('/__api/ping', { cache: 'no-store' })
        .then(function (r) { return r.ok ? r.json() : { writable: false }; })
        .catch(function () { return { writable: false }; });
    }
    return pingPromise;
  }
  function serverWritable() {
    return ping().then(function (d) { return !!d.writable; });
  }

  var Registry = {
    serverWritable: serverWritable,
    ping: ping,

    /* Создание папки бренда. Доступно только через свой сервер: страница
       сама файлы на диске не создаёт. Возвращает финальный id — сервер мог
       развести коллизию и назвать папку иначе, чем предсказал браузер. */
    createBrand: function (slug, title, files) {
      return fetch('/__api/brand', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: slug, title: title, files: files })
      }).then(function (r) {
        return r.json().then(function (d) {
          if (!r.ok) throw new Error(d.error || r.status);
          return d.id;
        });
      });
    },

    /* Отвечает ли рядом мост к макету. Спрашиваем один раз: ответ не
       меняется в пределах сессии, а ходить в сеть на каждый шаг диалога
       незачем. */
    designSource: function () {
      if (!Registry.__design) {
        Registry.__design = fetch('/__api/design/source', { cache: 'no-store' })
          .then(function (r) { return r.ok ? r.json() : { connected: false }; })
          .catch(function () { return { connected: false }; });
      }
      return Registry.__design;
    },

    designFiles: function () {
      return fetch('/__api/design/files', { method: 'POST' })
        .then(function (r) { return r.json(); })
        .catch(function () { return { connected: false }; });
    },

    designVariables: function (fileKey) {
      return fetch('/__api/design/variables', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileKey: fileKey })
      }).then(function (r) { return r.json(); });
    },

    /* Записать поля в манифест. У папки — через сервер, у пакета — прямо в
       нём: браузер в файлы на диске не пишет, а в своё хранилище пишет. */
    saveManifest: function (id, fields, isFolder) {
      if (!isFolder) {
        var pack = Registry.bundle(id);
        if (!pack) return Promise.resolve(false);
        var m = JSON.parse(pack.files['manifest.json']);
        Object.assign(m, fields);
        pack.files['manifest.json'] = JSON.stringify(m, null, 2);
        var problem = Registry.saveBundle(id, pack, m.title);
        return Promise.resolve(!problem);
      }
      return fetch('/__api/brand/' + encodeURIComponent(id) + '/manifest', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields)
      }).then(function (r) { return r.ok; }).catch(function () { return false; });
    },

    /* Открыть файл в проводнике — только через свой сервер: страница сама
       ничего на диске не показывает. */
    reveal: function (relPath) {
      return fetch('/__api/reveal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: relPath })
      }).then(function (r) { return r.ok; });
    },

    /* Настоящее удаление папки бренда. Доступно только через свой сервер:
       страница сама файлы на диске не трогает. */
    deleteBrand: function (id) {
      return fetch('/__api/brand/' + encodeURIComponent(id), { method: 'DELETE' })
        .then(function (r) {
          if (!r.ok) return r.json().then(function (d) { throw new Error(d.error || r.status); });
          Registry.forget(id);
          return true;
        });
    },

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
          var hidden = Registry.hidden();
          return library
            .filter(function (b) { return hidden.indexOf(b.id) < 0; })
            .concat(Registry.localSuites());
        });
    },

    /* ── Локальные сторибуки: пакеты, живущие в этом браузере ─────────── */

    localSuites: function () {
      return readJSON(LOCAL_KEY, []).map(function (rec) {
        return {
          id: rec.id,
          title: Registry.displayName(rec.id, rec.title),
          origin: 'local',
          brandPath: null            // пути на диске нет — открывается по ?suite=
        };
      });
    },

    bundle: function (id) { return readJSON(BUNDLE_KEY + id, null); },

    /* Сохранение возвращает описание проблемы строкой или null. Тихо терять
       пакет нельзя: человек считает, что система у него есть. */
    saveBundle: function (id, pack, title) {
      var size = window.ENGINE_BUNDLE.sizeKb(pack);
      if (size > MAX_BUNDLE_KB) return { error: 'tooBig', sizeKb: size, maxKb: MAX_BUNDLE_KB };
      try {
        localStorage.setItem(BUNDLE_KEY + id, JSON.stringify(pack));
      } catch (e) {
        return { error: 'quota', sizeKb: size };
      }
      var list = readJSON(LOCAL_KEY, []);
      if (!list.some(function (r) { return r.id === id; })) {
        list.push({ id: id, title: title || id });
        writeJSON(LOCAL_KEY, list);
      } else if (title) {
        writeJSON(LOCAL_KEY, list.map(function (r) {
          return r.id === id ? { id: id, title: title } : r;
        }));
      }
      return null;
    },

    deleteSuite: function (id) {
      try { localStorage.removeItem(BUNDLE_KEY + id); } catch (e) {}
      writeJSON(LOCAL_KEY, readJSON(LOCAL_KEY, []).filter(function (r) { return r.id !== id; }));
      Registry.forget(id);
    },

    /* Свежий id: человекочитаемый корень плюс время — сортируется и не
       сталкивается с папками в brands/. */
    newId: function (title) {
      var root = String(title || 'storybook').toLowerCase()
        .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24) || 'storybook';
      return root + '-' + Date.now().toString(36);
    },

    /* Библиотечный сторибук нельзя удалить: он лежит папкой на диске.
       Убрать его можно только из ЭТОЙ галереи — список скрытых живёт
       здесь, а сама папка остаётся нетронутой. */
    hidden: function () { return readJSON(HIDDEN_KEY, []); },
    hide: function (id) {
      var list = Registry.hidden();
      if (list.indexOf(id) < 0) list.push(id);
      writeJSON(HIDDEN_KEY, list);
    },
    unhideAll: function () { writeJSON(HIDDEN_KEY, []); },

    /* Локальные данные сторибука: имя, приложенный CSS. */
    forget: function (id) {
      try {
        localStorage.removeItem(SUITE_KEY + id);
        localStorage.removeItem(SUITE_KEY + id + ':css');
      } catch (e) {}
    },

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

    /* Имя, под которым сторибук показан в этой галерее.
       Для библиотечного бренда это ЛОКАЛЬНОЕ имя: в манифест на диске
       браузер не пишет, поэтому переименование живёт в реестре и
       перекрывает title манифеста только на этой машине. */
    displayName: function (id, fallback) {
      var own = (Registry.suiteSettings(id) || {}).name;
      return (own && own.trim()) || fallback || id;
    },
    rename: function (id, name) {
      Registry.saveSuiteSettings(id, { name: (name || '').trim() || null });
    },

    /* CSS для сравнения — часть сторибука, а не сессии: приложили один раз,
       и он там же при следующем открытии. Файл может весить сотни килобайт,
       поэтому запись отдельно и с явной ошибкой при переполнении квоты:
       молча потерять приложенный файл хуже, чем сказать, что не поместился. */
    saveCompareCss: function (id, text, name) {
      try {
        localStorage.setItem(SUITE_KEY + id + ':css', text || '');
        Registry.saveSuiteSettings(id, { compareName: name || null });
        return null;
      } catch (e) {
        return e && e.name === 'QuotaExceededError' ? 'quota' : 'failed';
      }
    },
    compareCss: function (id) {
      try { return localStorage.getItem(SUITE_KEY + id + ':css') || null; }
      catch (e) { return null; }
    },
    clearCompareCss: function (id) {
      try { localStorage.removeItem(SUITE_KEY + id + ':css'); } catch (e) {}
      Registry.saveSuiteSettings(id, { compareName: null });
    },
    saveSuiteSettings: function (id, patch) {
      var next = Object.assign(Registry.suiteSettings(id), patch || {});
      writeJSON(SUITE_KEY + id, next);
      return next;
    },

    /* Переключение = смена активного и перезагрузка галереи с новым брендом.
       У пакета пути на диске нет, поэтому он открывается по ?suite=.
       ?brand= остаётся рабочим адресом: им пользуются тесты и разработчик,
       и он не должен зависеть от состояния браузера. */
    open: function (suite) {
      /* Blob-ссылки живут, пока жива вкладка: уходя со сторибука, отпускаем
         их сразу, иначе за сессию переключений в памяти повиснут сотни. */
      var src = window.ENGINE_BRAND && window.ENGINE_BRAND.source;
      if (src && src.release) src.release();
      Registry.setActive(suite.id);
      location.href = Registry.addressOf(suite);
    },

    /* Адрес сторибука. Короткий (/sdm) — когда галерея отдаётся своим
       сервером; иначе прежняя форма с параметром. У пакета папки нет, он
       всегда открывается по ?suite=. */
    addressOf: function (suite) {
      if (!suite.brandPath) {
        return (window.ENGINE_SHORT_URLS ? '/packages/engine/gallery.html' : location.pathname) +
               '?suite=' + encodeURIComponent(suite.id);
      }
      if (window.ENGINE_SHORT_URLS) return '/' + suite.id;
      return location.pathname + '?brand=' + encodeURIComponent(suite.brandPath);
    }
  };

  window.ENGINE_REGISTRY = Registry;
})();
