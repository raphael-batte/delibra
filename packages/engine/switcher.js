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

  /* На пустом заходе манифеста нет: подставляем имя инструмента, чтобы в
     шапке не висела пустота. */
  if (!window.BRAND_MANIFEST) {
    var logoEl = document.getElementById('g-logo');
    if (logoEl) logoEl.textContent = 'Storybook Library';
    document.title = 'Storybook Library';
  }

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
    /* Показывать нечего — открываем создание сразу: пустая галерея не
       объясняет, что делать дальше. Условие именно такое: если адрес указан
       явно (?brand= или ?suite=), человек знает, куда шёл, и диалог ему
       мешает — даже если список пуст. */
    var opened = B.source.rel || B.suiteId;
    if (!opened) openNew();

    /* Адрес указывает на пакет, которого в этом браузере нет: чаще всего
       ссылку прислали с другой машины. Говорим прямо и предлагаем завести
       систему, а не показываем пустую галерею. */
    if (B.missingSuite) {
      openNew();                                   // сначала открыть,
      showError('missingSuite', { id: B.suiteId }); // потом объяснить: openNew
    }                                              // сбрасывает прежнюю ошибку

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
  /* ── Новый сторибук ────────────────────────────────────────────────
     Один диалог на три ветки: создание и импорт — это одно намерение,
     разводить их по пунктам меню значит требовать выбора до того, как
     показали варианты. Он же служит экраном пустого старта. */
  var newScrim = document.getElementById('g-new-scrim');
  var newError = document.getElementById('g-new-error');

  function openNew() {
    newError.hidden = true;
    newScrim.hidden = false;
    /* Всегда начинаем с выбора сценария: диалог, открытый на середине
       прошлого захода, — источник ошибок, а не экономия клика. */
    var choicesEl = newScrim.querySelector('.g-choices');
    var step2El = document.getElementById('g-new-step2');
    var createEl = document.getElementById('g-new-create');
    if (choicesEl) choicesEl.hidden = false;
    if (step2El) step2El.hidden = true;
    if (createEl) createEl.hidden = true;
  }
  function closeNew() { newScrim.hidden = true; }

  function showError(key, vars) {
    newError.textContent = t('new.failed', { error: t('new.err.' + key, vars || {}) });
    newError.hidden = false;
  }

  /* ── Второй шаг: имя, адрес, файл ──────────────────────────────────
     Сценарий выбран — дальше спрашиваем то, что нужно всем трём веткам, и
     показываем будущий адрес до создания, а не после. */
  var step2   = document.getElementById('g-new-step2');
  var choices = newScrim.querySelector('.g-choices');
  var nameInput2 = document.getElementById('g-new-name');
  var addressEl  = document.getElementById('g-new-address');
  var sourceRow  = document.getElementById('g-new-source');
  var srcInput   = document.getElementById('g-new-src-file');
  var srcName    = document.getElementById('g-new-src-name');
  var createBtn  = document.getElementById('g-new-create');

  var scenario = null;    // 'blank' | 'css' | 'import'
  var srcText  = null;    // содержимое выбранного файла

  function refreshAddress() {
    var slug = window.ENGINE_SLUG.slug(nameInput2.value);
    addressEl.textContent = '/' + slug;
    var needsFile = scenario !== 'blank';
    createBtn.disabled = !nameInput2.value.trim() || (needsFile && !srcText);
  }
  nameInput2.addEventListener('input', refreshAddress);

  srcInput.addEventListener('change', function (e) {
    var file = e.target.files && e.target.files[0];
    if (!file) return;
    file.text().then(function (text) {
      srcText = text;
      srcName.textContent = file.name;
      /* Имя файла — лучшая догадка о названии, чем «New storybook», но
         только пока человек не ввёл своё. */
      if (!nameInput2.__touched) {
        nameInput2.value = file.name.replace(/\.[^.]+$/, '');
      }
      refreshAddress();
    });
  });
  nameInput2.addEventListener('input', function () { nameInput2.__touched = true; });

  function step(which) {
    scenario = which;
    srcText = null;
    srcName.textContent = '';
    srcInput.value = '';
    nameInput2.__touched = false;
    nameInput2.value = which === 'blank' ? t('new.blank.name') : '';
    srcInput.accept = which === 'css' ? '.css,text/css' : '.json,application/json';

    choices.hidden = true;
    step2.hidden = false;
    sourceRow.hidden = which === 'blank';
    createBtn.hidden = false;
    newError.hidden = true;
    refreshAddress();
    nameInput2.focus();
  }

  /* Сборка файлов сторибука — по сценарию. Дальше все три ветки идут одним
     путём: отдать серверу папку, не получилось — сложить пакет в браузер. */
  function filesFor(title) {
    if (scenario === 'css') {
      var css = window.ENGINE_CSS_IMPORT.build(srcText, srcName.textContent, t, title);
      return css.error ? { error: css.error } : { files: css.pack.files };
    }
    if (scenario === 'import') {
      var res = window.ENGINE_PACKAGE.parse(srcText);
      if (res.error) return res;
      var files = Object.assign({}, res.pack.files);
      var m = JSON.parse(files['manifest.json']);
      m.title = title;
      files['manifest.json'] = JSON.stringify(m, null, 2);
      return { files: files };
    }

    /* Пустой — значит пустой: ни одного токена, ни одной секции. Раньше сюда
       копировался шаблон, и человек получал чужую палитру, принимая её за
       свою. Каркас ровно такой, чтобы галерея открылась; чем его наполняют,
       сказано в скилле движка и на экране пустого сторибука. */
    var manifest = {
      id: 'storybook',
      title: title,
      version: '0.1.0',
      engine: 1,
      css: { tokens: 'tokens.css', components: 'components.css' },
      sections: 'sections.json',
      tokenMap: 'token-map.json',
      legacyNames: null,
      assetsBase: 'assets/',
      font: { family: null, href: null },
      breakpoints: { mobile: 900, desktopMin: 901 },
      preview: { mobileWidth: 390, desktopWidth: 1440, container: 1170 },
      compare: { legacy: null }
    };
    return { files: {
      'manifest.json':  JSON.stringify(manifest, null, 2),
      'tokens.css':     ':root {\n}\n',
      'components.css': '',
      'token-map.json': '{}',
      'sections.json':  '[]'
    } };
  }

  createBtn.addEventListener('click', function () {
    var title = nameInput2.value.trim();
    var built = filesFor(title);
    if (built.error) { showError(built.error, built); return; }

    createBtn.disabled = true;
    R.serverWritable().then(function (writable) {
      if (writable) {
        return R.createBrand(window.ENGINE_SLUG.slug(title), title, built.files)
          .then(function (id) {
            R.setActive(id);
            location.href = R.addressOf({ id: id, brandPath: '../../brands/' + id });
          });
      }
      /* Статике папку не создать: складываем пакет в браузер и говорим об
         этом прямо — иначе человек будет ждать от агента невозможного. */
      var pack = window.ENGINE_BUNDLE.empty();
      pack.files = built.files;
      var id = R.newId(title);
      var problem = R.saveBundle(id, pack, title);
      if (problem) { showError(problem.error, problem); createBtn.disabled = false; return; }
      R.setActive(id);
      location.href = R.addressOf({ id: id, brandPath: null });
    }).catch(function (err) {
      showError('createFailed', { error: err.message });
      createBtn.disabled = false;
    });
  });

  document.getElementById('g-new-blank').addEventListener('click', function () { step('blank'); });
  document.getElementById('g-new-css').addEventListener('click', function () { step('css'); });
  document.getElementById('g-new-file').addEventListener('click', function () { step('import'); });

  /* ── Пустой сторибук ───────────────────────────────────────────────
     Открыт, но в нём ничего нет — вместо каталога показываем, чем его
     наполняют. Условие именно такое: не «первый заход», а «нечего
     показать»; наполнивший систему этого экрана больше не увидит. */
  (function onboardEmpty() {
    if (!window.BRAND_MANIFEST) return;
    if ((window.GALLERY || []).length) return;

    /* Шаги подставляем под конкретный сторибук: агенту нужен путь к файлам
       и путь к скиллу движка. У пакета в браузере папки нет — так и
       сказано, вместо пути. */
    var folder = B.source.kind === 'folder';
    var path = folder ? B.source.base : null;
    var skill = new URL('ENGINE_SKILL.md', location.href).pathname;

    function step(key, vars) {
      var el = document.querySelector('[data-i18n="' + key + '"]');
      if (el) el.textContent = t(key, vars);
    }
    var s1 = document.querySelector('[data-i18n="new.agent.s1"]');
    if (s1) s1.textContent = folder ? t('new.agent.s1', { path: path })
                                    : t('new.agent.noFolder');
    step('new.agent.s2', { skill: skill });
    step('new.agent.s3');

    /* Промпт отдаём кнопкой: пересказывать его по памяти в чате — верный
       способ потерять половину требований. */
    var copyBtn = document.getElementById('g-copy-prompt');
    if (copyBtn) {
      var prompt = t('new.agent.prompt', { skill: skill, path: path || '' });
      copyBtn.addEventListener('click', function () {
        navigator.clipboard.writeText(prompt).then(function () {
          var was = copyBtn.textContent;
          copyBtn.textContent = t('new.agent.copied');
          setTimeout(function () { copyBtn.textContent = was; }, 1200);
        });
      });
    }

    document.getElementById('g-onboard').hidden = false;
  })();

  /* ── Показать CSS системы ──────────────────────────────────────────
     Человек, который пользуется дизайн-системой, должен видеть её код, а не
     только результат: иначе «где это лежит» приходится спрашивать. */
  var codeScrim = document.getElementById('g-code-scrim');

  function showCode(file) {
    var body = document.getElementById('g-code-body');
    var open = document.getElementById('g-code-open');

    document.getElementById('g-code-title').textContent = file || '';
    document.getElementById('g-code-path').textContent =
      B.source.kind === 'folder' ? B.source.url(file) : t('menu.copiedLocal');

    if (!file) {
      body.textContent = t('menu.codeMissing');
      open.hidden = true;
    } else {
      Promise.resolve(B.source.text(file)).then(function (text) {
        body.textContent = text || t('menu.codeMissing');
      });
      /* Ссылка на живой файл есть только у папки: blob-адрес пакета живёт
         в этой вкладке и в чужих руках не откроется. */
      if (B.source.kind === 'folder') {
        open.hidden = false;
        open.href = B.source.url(file);
      } else {
        open.hidden = true;
      }
    }
    codeScrim.hidden = false;
  }

  function wireView(btnId, field) {
    var btn = document.getElementById(btnId);
    if (!btn) return;
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      closeAll();
      var css = (window.BRAND_MANIFEST || {}).css || {};
      showCode(css[field]);
    });
  }
  wireView('g-view-tokens', 'tokens');
  wireView('g-view-components', 'components');

  document.getElementById('g-code-close').addEventListener('click', function () {
    codeScrim.hidden = true;
  });
  codeScrim.addEventListener('click', function (e) {
    if (e.target === codeScrim) codeScrim.hidden = true;
  });
  document.getElementById('g-code-copy').addEventListener('click', function (e) {
    var btn = e.currentTarget;
    navigator.clipboard.writeText(document.getElementById('g-code-body').textContent)
      .then(function () {
        var was = btn.textContent;
        btn.textContent = t('menu.codeCopied');
        setTimeout(function () { btn.textContent = was; }, 1200);
      });
  });

  /* ── Дублировать ───────────────────────────────────────────────────
     Копия всегда пакет, даже если исходник — папка: браузер в папку не
     пишет, а править копию человек хочет сразу. Для библиотечного бренда
     это единственный путь к правкам, и он же делает осмысленным
     выключенное удаление папки. */
  document.getElementById('g-duplicate').addEventListener('click', function (e) {
    e.stopPropagation();
    closeAll();
    var M = window.BRAND_MANIFEST || {};
    var title = R.displayName(B.source.id, M.title) + t('menu.copySuffix');
    window.ENGINE_PACKAGE
      .build(B.source, M, window.BRAND_SECTIONS || [], title)
      .then(function (pack) { adopt(pack, title); });
  });

  /* ── Выгрузить файлом ──────────────────────────────────────────────── */
  document.getElementById('g-export').addEventListener('click', function (e) {
    e.stopPropagation();
    closeAll();
    var M = window.BRAND_MANIFEST || {};
    window.ENGINE_PACKAGE
      .build(B.source, M, window.BRAND_SECTIONS || [], R.displayName(B.source.id, M.title))
      .then(function (pack) {
        window.ENGINE_PACKAGE.download(pack, B.source.id + '.ds.json');
      });
  });

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
    var cssInput  = document.getElementById('g-css-file');
    var cssName   = document.getElementById('g-css-name');
    var initialName = nameInput.value;
    var pendingCss = null;      // выбранный, но ещё не сохранённый файл

    function dirty() {
      return nameInput.value.trim() !== initialName.trim() || !!pendingCss;
    }
    function refreshSave() { saveBtn.disabled = !dirty(); }
    nameInput.addEventListener('input', refreshSave);

    /* Файл только запоминается: применяется и сохраняется по «Сохранить». */
    if (cssInput) cssInput.addEventListener('change', function (e) {
      var file = e.target.files && e.target.files[0];
      if (!file) return;
      file.text().then(function (text) {
        pendingCss = { text: text, name: file.name };
        cssName.textContent = file.name;
        refreshSave();
      });
    });

    function applyName() {
      var value = nameInput.value.trim();
      /* У пакета имя — часть его самого и уезжает вместе с файлом. У папки
         в манифест на диске браузер не пишет, поэтому там имя локальное. */
      if (B.source.kind === 'bundle') {
        var pack = R.bundle(suiteId);
        if (pack) {
          var m = JSON.parse(pack.files['manifest.json']);
          m.title = value || m.title;
          pack.files['manifest.json'] = JSON.stringify(m, null, 2);
          R.saveBundle(suiteId, pack, m.title);
        }
      }
      R.rename(suiteId, value);
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

    function applyCss() {
      if (!pendingCss) return;
      window.GALLERY_API.setCompareCss(pendingCss.text, pendingCss.name);
      /* Приложенный файл принадлежит сторибуку и переживает перезагрузку. */
      var problem = R.saveCompareCss(suiteId, pendingCss.text, pendingCss.name);
      if (problem) cssName.textContent = pendingCss.name + ' — ' + t('settings.compare.tooBig');
      pendingCss = null;
    }

    saveBtn.addEventListener('click', function () {
      applyName();
      applyCss();
      refreshSave();
      settingsScrim.hidden = true;
    });
    function discard() {
      nameInput.value = initialName;   // введённое, но не сохранённое — забываем
      pendingCss = null;
      if (cssInput) cssInput.value = '';
      cssName.textContent = (R.suiteSettings(suiteId) || {}).compareName || '';
      refreshSave();
    }

    cancelBtn.addEventListener('click', function () {
      discard();
      settingsScrim.hidden = true;
    });

    /* Что именно делает кнопка, зависит от вида сторибука: папку на диске
       браузер удалить не может, поэтому для библиотечного это «убрать из
       галереи», и подпись говорит ровно это. */
    var delBtn  = document.getElementById('g-settings-delete');
    var delHint = document.getElementById('g-settings-delete-hint');
    var isLibrary = !B.source.writable;   // папка: браузер в неё не пишет

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

          /* Пакет живёт в браузере: удаление — это стереть его из хранилища,
             никакого сервера для этого не нужно. */
          if (B.source.kind === 'bundle') {
            B.source.release();
            R.deleteSuite(suiteId);
            leave();
            return;
          }
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
      discard();
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
      var bundle = B.source.kind === 'bundle';
      var url = location.origin + location.pathname +
                (bundle ? '?suite=' + encodeURIComponent(B.source.id)
                        : '?brand=' + encodeURIComponent(B.source.rel));
      var label = copy.querySelector('.grow');
      var before = label.textContent;
      navigator.clipboard.writeText(url).then(function () {
        label.textContent = t(bundle ? 'menu.copiedLocal' : 'menu.copied');
        setTimeout(function () { label.textContent = before; closeAll(); }, 900);
      });
    });
  }
})();
