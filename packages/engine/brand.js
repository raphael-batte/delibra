/* ──────────────────────────────────────────────────────────────────────────
   Резолюция бренда.

   Движок нигде не знает имени дизайн-системы: она приходит параметром
   ?brand=<путь>, и все пути манифеста приводятся к абсолютным ОТ ПАПКИ
   БРЕНДА, а не от папки движка. Это принципиально: gallery.html и
   _frame.html лежат в packages/engine, а tokens.css — в brands/<id>,
   поэтому любой относительный путь из манифеста без этого шага порвётся.

   Бренд обязан отдаваться тем же http-сервером, что и галерея: движок
   читает CSS через fetch и вкидывает его в iframe. Для бренда из чужого
   репозитория достаточно симлинка внутрь brands/.
   ────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  /* Дефолт нарочно нейтральный: движок не должен предпочитать один бренд
     другому. Открывать сразу нужную систему — задача index.html в корне
     репозитория, где перечислены все бренды. */
  var DEFAULT_BRAND = '../../brands/_template';

  /* Версия движка и версия контракта — разные вещи.
     ENGINE_VERSION растёт с каждым релизом движка (SemVer).
     CONTRACT_MAJOR меняется только когда ломается формат манифеста:
     бренд объявляет `engine: 1`, и движок отказывается его открывать,
     если цифры разошлись. Это дешевле, чем ловить пустой экран. */
  var ENGINE_VERSION = '1.0.0';
  var CONTRACT_MAJOR = 1;

  var rel = new URLSearchParams(location.search).get('brand') || DEFAULT_BRAND;

  function brandBase() {
    var p = rel;
    // нормализуем к абсолютному пути с завершающим слэшем
    var url = new URL(p.replace(/\/+$/, '') + '/', location.href);
    return url.pathname;
  }

  var base = brandBase();

  /* ── BrandSource: папка на сервере ─────────────────────────────────
     url(p)      → адрес, который браузер может загрузить
     text(p)     → содержимое файла строкой
     manifest()  → разобранный манифест
     Для папки манифест приходит тегом <script> из загрузчика галереи,
     поэтому здесь он просто отдаётся; у пакета в памяти на этом месте
     будет разбор bundle. */
  var SOURCE = {
    kind: 'folder',
    base: base,
    rel:  rel,

    /* Идентификатор сторибука — имя ПАПКИ, а не manifest.id. Копия бренда
       уносит с собой чужой id, и по нему настройки, приложенный CSS и
       удаление уходили бы в исходный бренд. Папка уникальна по определению. */
    id: base.replace(/\/+$/, '').split('/').pop(),

    url: function (p) {
      if (!p) return null;
      if (/^(https?:)?\/\//.test(p) || p.charAt(0) === '/') return p;
      return base + String(p).replace(/^\.\//, '');
    },

    text: function (p) {
      return fetch(SOURCE.url(p), { cache: 'no-store' }).then(function (r) {
        if (!r.ok) throw new Error(r.status + ' ' + SOURCE.url(p));
        return r.text();
      });
    },

    manifest: function () { return window.BRAND_MANIFEST || null; },

    /* Можно ли править этот сторибук из браузера. Папку — нельзя: её
       правят в IDE, и запись из галереи разошлась бы с диском. */
    writable: false
  };

  window.ENGINE_VERSION = ENGINE_VERSION;

  window.ENGINE_BRAND = {
    version:  ENGINE_VERSION,
    contract: CONTRACT_MAJOR,

    /* Несовместимость возвращается строкой-объяснением, null — если всё в порядке. */
    incompatible: function (m) {
      if (!m) return 'Brand manifest not found.';
      var need = m.engine;
      if (need === undefined) return null;          // старые бренды не блокируем
      if (Number(need) === CONTRACT_MAJOR) return null;
      return 'Brand "' + (m.id || '?') + '" targets engine contract v' + need +
             ', this engine speaks v' + CONTRACT_MAJOR + '.';
    },

    base: base,      // абсолютный путь: /brands/sdm/
    rel:  rel,       // как бренд был указан — это и передаём фрейму

    /* путь внутри бренда → абсолютный.
       Тонкая обёртка над source.url(): оставлена, потому что ею пользуются
       загрузчики и брендовые секции. */
    path: function (p) { return SOURCE.url(p); },

    /* Источник бренда. Сегодня он один — папка на сервере; интерфейс
       выделен затем, чтобы вторая реализация (пакет в памяти, приехавший
       файлом) подключалась, не трогая остальной движок.
       См. BRAND-PACKAGE.md — там записано, почему транспортов будет
       несколько, а контракт один. */
    source: SOURCE,

    /* ключ localStorage, разведённый по сторибукам (по папке, не по манифесту) */
    key: function (name) { return SOURCE.id + ':' + name; },

    /* Язык интерфейса. Это язык хрома, а не бренда, поэтому решает
       настройка воркспейса; manifest.locale — лишь значение по умолчанию
       для того, кто ничего не выбирал. Иначе две дизайн-системы в одной
       галерее говорили бы на разных языках. */
    locale: function () {
      var chosen = window.ENGINE_REGISTRY && window.ENGINE_REGISTRY.settings().locale;
      if (chosen) return chosen;
      return (window.BRAND_MANIFEST && window.BRAND_MANIFEST.locale) || 'en';
    },

    /* строка локали с подстановками: t('pane.mobile', {w: 390}) */
    t: function (key, vars) {
      var packs = window.ENGINE_I18N || {};
      var loc = window.ENGINE_BRAND.locale();
      var s = (packs[loc] && packs[loc][key]);
      if (s === undefined) s = (packs.en && packs.en[key]);   // фолбэк на английский
      if (s === undefined) return key;                         // видно, что ключа нет
      return vars ? s.replace(/\{(\w+)\}/g, function (m, n) {
        return vars[n] !== undefined ? vars[n] : m;
      }) : s;
    }
  };
})();
