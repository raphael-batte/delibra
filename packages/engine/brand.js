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

  /* Дефолтного бренда нет. Раньше пустой заход молча открывал шаблон, и
     человек видел чужую систему вместо предложения завести свою. Без
     параметров галерея показывает экран создания; ?brand= и ?suite=
     по-прежнему открывают систему напрямую — ими пользуются тесты и ссылки. */

  /* Версия движка и версия контракта — разные вещи.
     ENGINE_VERSION растёт с каждым релизом движка (SemVer).
     CONTRACT_MAJOR меняется только когда ломается формат манифеста:
     бренд объявляет `engine: 1`, и движок отказывается его открывать,
     если цифры разошлись. Это дешевле, чем ловить пустой экран. */
  var ENGINE_VERSION = '1.0.0';
  var CONTRACT_MAJOR = 1;

  /* Откуда открыт сторибук, в порядке убывания «человечности»:

       /sdm            — короткий адрес, его и видит пользователь;
       ?brand=<путь>   — служебный вход: тесты, ссылки, статический сервер,
                         где короткие адреса невозможны;
       ?suite=<id>     — пакет, живущий в браузере.

     Короткий адрес узнаём по <base>: сервер вставляет его, когда отдаёт
     галерею не по её собственному пути. Без base мы открыты напрямую, и
     путь в адресе — это путь к файлу движка, а не имя сторибука. */
  var qs = new URLSearchParams(location.search);
  var suiteId = qs.get('suite');
  var rel = qs.get('brand') || null;

  var short = null;
  if (!rel && !suiteId) {
    var servedShort = document.querySelector('base') &&
                      location.pathname.indexOf('/packages/') !== 0;
    var m = servedShort && location.pathname.match(/^\/([A-Za-z0-9._-]+)\/?$/);
    if (m) {
      short = m[1];
      rel = '../../brands/' + short;
    }
  }

  window.ENGINE_SHORT_URLS = !!document.querySelector('base');

  function brandBase() {
    if (!rel) return '';
    // нормализуем к абсолютному пути с завершающим слэшем
    var url = new URL(rel.replace(/\/+$/, '') + '/', location.href);
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

    /* Синхронное чтение данных бренда. Нужно потому, что галерея собирает
       себя одним проходом при загрузке документа, а не по промисам; для
       локального файла это десятки миллисекунд. У пакета в памяти на этом
       месте окажется чтение из объекта — без запроса вовсе.
       Возвращает null, если файла нет: необязательные части бренда
       (карта старых имён, дескриптор токенов) отсутствуют штатно. */
    json: function (p, bust) {
      if (!p) return null;
      var xhr = new XMLHttpRequest();
      xhr.open('GET', SOURCE.url(p) + (bust || ''), false);
      try { xhr.send(); } catch (e) { return null; }
      if (xhr.status && xhr.status >= 400) return null;
      try { return JSON.parse(xhr.responseText); }
      catch (e) {
        throw new Error('не разобрался JSON: ' + SOURCE.url(p) + ' — ' + e.message);
      }
    },

    manifest: function () { return window.BRAND_MANIFEST || null; },

    /* Можно ли править этот сторибук из браузера. Папку — нельзя: её
       правят в IDE, и запись из галереи разошлась бы с диском. */
    writable: false
  };

  /* Пакет из хранилища подменяет собой папку целиком: интерфейс тот же,
     поэтому дальше по коду разницы нет. Читаем пакет здесь, чтобы к моменту
     загрузки данных бренда источник уже был готов. */
  var missingSuite = false;
  if (suiteId && window.ENGINE_BUNDLE && window.ENGINE_REGISTRY) {
    var pack = window.ENGINE_REGISTRY.bundle(suiteId);
    if (pack) SOURCE = window.ENGINE_BUNDLE.source(suiteId, pack);
    /* Ссылка на пакет живёт только в том браузере, где он лежит. Открытая
       в другом месте, она должна сказать об этом, а не показать пустоту. */
    else missingSuite = true;
  }

  window.ENGINE_VERSION = ENGINE_VERSION;

  window.ENGINE_BRAND = {
    version:  ENGINE_VERSION,
    suiteId:  suiteId,
    missingSuite: missingSuite,
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

    get base() { return SOURCE.base; },
    get rel()  { return SOURCE.rel; },

    /* путь внутри бренда → абсолютный.
       Тонкая обёртка над source.url(): оставлена, потому что ею пользуются
       загрузчики и брендовые секции. */
    path: function (p) { return SOURCE.url(p); },

    /* Источник бренда: папка на сервере или пакет в памяти. Интерфейс один,
       поэтому весь остальной движок про разницу не знает.
       См. BRAND-PACKAGE.md. */
    get source() { return SOURCE; },

    /* ключ localStorage, разведённый по сторибукам (по папке или id пакета) */
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
