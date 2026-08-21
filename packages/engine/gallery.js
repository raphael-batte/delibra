/* ==========================================================================
   Storybook engine
   --------------------------------------------------------------------------
   Секции описаны в gallery-specs.js (window.GALLERY).
   Каждый пример рендерится в iframe _frame.html: мобильный 390px и
   десктопный — по ширине контейнера бренда (ужимается трансформом). Реальный @media срабатывает сам —
   никаких !important-зеркал.
   ========================================================================== */
(function () {
  'use strict';

  /* Каталог = секции токенов (движок рисует их по дескриптору бренда)
     плюс компонентные секции самого бренда. Композиция здесь, а не в бренде:
     иначе каждый новый бренд обязан помнить, что токены надо приклеить. */
  var SPECS = window.ENGINE_SPECS.tokenSections(window.BRAND_TOKENS)
                .concat(window.BRAND_SECTIONS || []);
  window.GALLERY = SPECS;
  var B = window.ENGINE_BRAND;
  var M = window.BRAND_MANIFEST || {};
  var t = B.t;

  /* Десктопный фрейм — настоящий вьюпорт бренда: только в нём контейнер
     получает свою ширину и 3-колоночная сетка даёт честные колонки.
     Значение приходит из манифеста, движок своего не знает. */
  var PREVIEW = M.preview || {};
  var DESKTOP_W = PREVIEW.desktopWidth || 1440;
  var MOBILE_W  = PREVIEW.mobileWidth  || 390;
  var CONTAINER = PREVIEW.container    || 1170;

  /* Масштаб превью — свой у каждой панели: 50 / 75 / 100 %.
     Общий по умолчанию берём из localStorage (стартовое значение 75%),
     но выбор в конкретной панели меняет только её. */
  var SCALE_KEY = B.key('gallery-scale');   // ключи разведены по брендам
  var defaultScale = parseFloat(localStorage.getItem(SCALE_KEY) || '0.75');
  if (!(defaultScale > 0)) defaultScale = 0.75;

  /* Галерея всегда рендерит дизайн-систему (tokens.css + sdm.css).
     Переключателя «Новый ДС / Текущий сайт» больше нет: он менял стили внутри
     превью, но токен-секции от него не зависят, а у компонентов, которых в
     styles.css нет вовсе, режим давал голую разметку — это выглядело поломкой,
     а не сравнением. Для сравнения есть тоггл «Сравнить с кодом». */
  var mode = 'new';

  /* ── Реестр фреймов ────────────────────────────────────────────────── */
  var frames = [];
  var frameSeq = 0;

  function post(iframe, msg) {
    if (iframe.contentWindow) iframe.contentWindow.postMessage(msg, '*');
  }

  /* ── Единственная точка, где создаётся превью ─────────────────────────
     Любой рендер объекта — мобильный, десктопный или скрытый эталон для
     сравнения — это один и тот же _frame.html. Отличаются только ширина и
     набор CSS. Ниже собрана вся обвязка: адрес с cache-buster'ом и
     рукопожатие g:css → g:render. Дублировать её нельзя: разъедется. */
  function mountFrame(opts) {
    var id = opts.id || ('f' + (++frameSeq));
    var iframe = document.createElement('iframe');
    // brand — единственное, что делает фрейм брендовым: он сам подтянет
    // манифест и соберёт из него ссылки на токены и компоненты.
    iframe.src = '_frame.html?brand=' + encodeURIComponent(B.rel) +
                 '&css=' + opts.cssMode + '&id=' + id +
                 (window.GALLERY_BUST ? '&' + window.GALLERY_BUST.slice(1) : '');
    iframe.setAttribute('scrolling', 'no');
    iframe.setAttribute('title', opts.title || 'preview');
    iframe.style.width = opts.width + 'px';

    var rec = { id: id, iframe: iframe, width: opts.width, ready: false };

    iframe.addEventListener('load', function () {
      var w = iframe.contentWindow;
      if (!w) return;
      if (opts.userCss) w.postMessage({ type: 'g:usercss', text: opts.userCss }, '*');
      else w.postMessage({ type: 'g:css', mode: opts.cssMode }, '*');
      w.postMessage({ type: 'g:render', html: opts.html }, '*');
      // даём кадр на применение стилей, потом сообщаем о готовности
      setTimeout(function () {
        rec.ready = true;
        if (rec.onready) rec.onready(rec);
      }, opts.settle || 0);
    });
    return rec;
  }

  /* Видимое превью в колонке галереи */
  function makeFrame(html, width, isDesktop) {
    var wrap = document.createElement('div');
    wrap.className = 'g-frame-wrap';

    var rec = mountFrame({ html: html, width: width, cssMode: mode });
    rec.iframe.className = 'g-frame' + (isDesktop ? ' g-frame--desktop' : '');
    wrap.appendChild(rec.iframe);

    rec.wrap = wrap;
    rec.html = html;
    rec.desktop = isDesktop;
    rec.scale = defaultScale;
    frames.push(rec);
    return rec;
  }

  /* Единый масштаб для ОБЕИХ панелей.
     Раньше мобильный фрейм рисовался 1:1, а десктопный ужимался трансформом
     под ширину колонки. При узком окне десктоп сжимался до ~60%, и кнопка
     52px выглядела МЕНЬШЕ мобильной 48px — сравнивать размеры было нельзя.
     Теперь обе панели масштабируются одинаково, коэффициент показан в
     подписи, а кнопка «1:1» отключает ужимание совсем. */
  /* Масштаб выбирается вручную: 50 / 75 / 100 %. На 100% широкая десктопная
     панель может не влезть в колонку — тогда правый край просто обрезается
     (overflow: hidden), а высота остаётся по содержимому. Ужимать
     автоматически нельзя: панели съезжали бы в разные масштабы и сравнивать
     размеры было бы невозможно — ровно та ошибка, что была раньше. */
  /* Применяем масштаб одной панели. На 100% широкий десктопный фрейм может
     не влезть в колонку — правый край режется overflow:hidden, высота идёт
     по содержимому. */
  function applyFrameScale(f) {
    var k = f.scale || defaultScale;
    f.iframe.style.transform = k === 1 ? 'none' : 'scale(' + k + ')';
    // коробка всегда во всю ширину панели: иначе справа от узкого мобильного
    // фрейма просвечивал фон страницы и заливка выглядела обрезанной.
    // Сам фрейм прижат к левому краю, лишнее по ширине режется.
    f.wrap.style.width = '100%';
    f.wrap.style.overflow = 'hidden';
    if (f.contentH) f.wrap.style.height = (f.contentH * k) + 'px';
  }

  function applyScale() { frames.forEach(applyFrameScale); }


  /* ── Сообщения из фреймов ──────────────────────────────────────────── */
  window.addEventListener('message', function (e) {
    var d = e.data || {};
    var rec = frames.filter(function (f) { return f.id === d.frameId; })[0];

    if (d.type === 'g:height' && rec) {
      rec.contentH = d.height;
      rec.iframe.style.height = d.height + 'px';
      rec.wrap.style.height = d.height * (rec.scale || defaultScale) + 'px';
    }
    else if (d.type === 'g:pick') openOverlay(d);
  });

  /* ── Оверлей с кодом ───────────────────────────────────────────────── */
  var ov = document.getElementById('g-overlay');
  var ovBody = document.getElementById('g-ov-body');
  var current = null, tab = 'html';

  function openOverlay(d) {
    current = d;
    document.getElementById('g-ov-title').textContent = d.name || t('overlay.component');
    document.getElementById('g-ov-sel').textContent = d.selector || '';
    ov.classList.add('is-open');
    document.body.classList.add('g-no-scroll');
    paintTab();
  }
  function closeOverlay() {
    ov.classList.remove('is-open');
    document.body.classList.remove('g-no-scroll');
  }

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function paintTab() {
    if (!current) return;
    Array.prototype.forEach.call(document.querySelectorAll('#g-ov-tabs button'), function (b) {
      b.classList.toggle('is-on', b.dataset.tab === tab);
    });

    if (tab === 'html') {
      ovBody.innerHTML =
        '<button class="g-copy" data-copy>' + t('overlay.copyHtml') + '</button>' +
        '<pre class="g-code">' + esc(current.html) + '</pre>';
    } else {
      var body = '';
      if (current.cssBlocked) {
        body += '<div class="g-hint">' + t('overlay.fileProtocol') + '</div>';
      } else if (!current.css) {
        body += '<div class="g-hint">' + t('overlay.noRules') + '</div>';
      } else {
        body += '<button class="g-copy" data-copy>' + t('overlay.copyCss') + '</button>' +
                '<pre class="g-code">' + esc(current.css) + '</pre>';
      }
      if (current.tokens && current.tokens.length) {
        body += '<div class="g-token-list"><h4>' + t('overlay.tokens') + '</h4><table class="g-table">' +
          current.tokens.map(function (t) {
            return '<tr><td><code>' + esc(t.name) + '</code></td><td><code>' + esc(t.value) + '</code></td></tr>';
          }).join('') + '</table></div>';
      }
      ovBody.innerHTML = body;
    }
  }

  document.getElementById('g-ov-tabs').addEventListener('click', function (e) {
    var b = e.target.closest('button[data-tab]');
    if (b) { tab = b.dataset.tab; paintTab(); }
  });
  document.getElementById('g-ov-close').addEventListener('click', closeOverlay);
  ov.addEventListener('click', function (e) { if (e.target === ov) closeOverlay(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeOverlay(); });
  ovBody.addEventListener('click', function (e) {
    if (!e.target.closest('[data-copy]')) return;
    var text = tab === 'html' ? current.html : current.css;
    navigator.clipboard.writeText(text).then(function () {
      e.target.textContent = t('overlay.copied');
      setTimeout(function () {
        e.target.textContent = t(tab === 'html' ? 'overlay.copyHtml' : 'overlay.copyCss');
      }, 1400);
    });
  });

  /* ── Рендер секций ─────────────────────────────────────────────────── */
  var host = document.getElementById('g-sections');
  var nav = document.getElementById('g-nav');
  var tokenSections = [];

  /* Шапка панели: слева что за вьюпорт, справа выбор масштаба.
     Селекты во всех панелях показывают одно значение и меняют его глобально. */
  function paneLabel(text, rec) {
    var box = el('div', 'g-pane-label');
    box.appendChild(el('span', null, text));

    var sel = document.createElement('select');
    sel.className = 'g-scale';
    sel.title = t('pane.scale.title');
    [['0.5', '50%'], ['0.75', '75%'], ['1', '100%']].forEach(function (o) {
      var opt = document.createElement('option');
      opt.value = o[0];
      opt.textContent = o[1];
      sel.appendChild(opt);
    });
    sel.value = String(rec.scale || defaultScale);
    sel.addEventListener('change', function () {
      rec.scale = parseFloat(sel.value) || defaultScale;
      // запоминаем как стартовое значение для следующих загрузок
      localStorage.setItem(SCALE_KEY, String(rec.scale));
      applyFrameScale(rec);
    });
    box.appendChild(sel);
    return box;
  }

  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }

  var lastGroup = null;
  SPECS.forEach(function (spec) {
    if (spec.group && spec.group !== lastGroup) {
      nav.appendChild(el('div', 'g-sidebar-group', spec.group));
      lastGroup = spec.group;
    }
    var a = el('a', null, spec.title);
    a.href = '#' + spec.id;
    nav.appendChild(a);

    var sec = el('section', 'g-section');
    sec.id = spec.id;
    sec.appendChild(el('div', 'g-section-head',
      '<h2>' + spec.title + '</h2>' +
      (spec.code ? '<code>' + spec.code + '</code>' : '') +
      (spec.note ? '<span class="g-note">' + spec.note + '</span>' : '')));
    if (spec.desc) sec.appendChild(el('div', 'g-section-desc', spec.desc));

    if (spec.render) {
      var slot = el('div');
      sec.appendChild(slot);
      tokenSections.push({ spec: spec, slot: slot });
    }

    (spec.examples || []).forEach(function (ex) {
      var box = el('div', 'g-example');
      box.__html = ex.htmlDesktop || ex.html;   // нужна режиму «Фигма ↔ код»
      if (ex.label) box.appendChild(el('p', 'g-example-label', ex.label));
      if (ex.note) box.appendChild(el('p', 'g-example-note', ex.note));

      var split = el('div', 'g-split' + (ex.wide ? ' g-split--wide' : ''));

      if (!ex.wide) {
        var mp = el('div', 'g-pane g-pane--mobile');
        /* Ширину мобильного фрейма можно задать примеру.
           Для блоков это 390 — настоящий телефон. Для примитивов (кнопки,
           плитки), где рядом идёт колонка метаданных, узкий вьюпорт только
           мешает: важен размер самого компонента, а не устройства. Ставим
           900 — это всё ещё мобильная ветка @media (max-width: 900px),
           но места хватает и раскладка совпадает с десктопной. */
        var mw = ex.mobileWidth || 390;
        var mRec = makeFrame(ex.html, mw, false);
        mp.appendChild(paneLabel(t('pane.mobile', { w: mw >= 900 ? '≤900' : mw }), mRec));
        mp.appendChild(mRec.wrap);
        split.appendChild(mp);
      }

      var dp = el('div', 'g-pane g-pane--desktop');
      var dRec = makeFrame(ex.htmlDesktop || ex.html, DESKTOP_W, true);
      dp.appendChild(paneLabel(t('pane.desktop', { w: DESKTOP_W, c: CONTAINER }), dRec));
      dp.appendChild(dRec.wrap);
      split.appendChild(dp);

      box.appendChild(split);
      sec.appendChild(box);
    });

    host.appendChild(sec);
  });

  function renderTokenSections() {
    tokenSections.forEach(function (t) { t.slot.innerHTML = t.spec.render(mode); });
  }
  // спеки перерисовывают токен-секции, когда догрузят и распарсят CSS-файлы
  window.GALLERY_REFRESH = renderTokenSections;

  /* ── Скролл-спай ───────────────────────────────────────────────────
     Одна точка правды: при смене активного раздела обновляем подсветку в
     сайдбаре, заголовок в шапке и якорь в адресной строке.

     Считаем по геометрии на скролл, а не через IntersectionObserver: IO не
     срабатывает во фрейме, обрезанном родителем (так устроен tests.html), и
     промахивается, когда секция выше вьюпорта. Обход всех секций дешёвый —
     их два десятка — и throttled через requestAnimationFrame. */
  var DEFAULT_TITLE = M.defaultTitle || t('topbar.defaultTitle');
  var titleEl = document.getElementById('g-current');
  var activeId;          // undefined, а не null: первый setActive(null) должен отрисоваться
  var spyTick = false;

  function sectionTitle(id) {
    var head = document.querySelector('#' + id + ' .g-section-head h2');
    return head ? head.textContent : '';
  }

  function setActive(id) {
    if (id === activeId) return;
    activeId = id;

    Array.prototype.forEach.call(nav.querySelectorAll('a'), function (a) {
      a.classList.toggle('is-active', !!id && a.getAttribute('href') === '#' + id);
    });
    titleEl.textContent = id ? sectionTitle(id) : DEFAULT_TITLE;

    // replaceState, а не pushState: иначе «Назад» отматывал бы по разделу за клик
    if (id) {
      if (location.hash !== '#' + id) history.replaceState(null, '', '#' + id);
    } else if (location.hash) {
      // вернулись к самому верху — якорь тоже снимаем
      history.replaceState(null, '', location.pathname + location.search);
    }
  }

  function pickActive() {
    // у самого верха раздел ещё не выбран — показываем общий заголовок
    if ((window.scrollY || document.documentElement.scrollTop) < 8) { setActive(null); return; }

    var secs = document.querySelectorAll('.g-section');
    var found = null;
    for (var i = 0; i < secs.length; i++) {
      if (secs[i].offsetParent === null) continue;      // скрытая секция
      // граница чуть ниже шапки: раздел считается текущим, как только дошёл до неё
      if (secs[i].getBoundingClientRect().top <= 80) found = secs[i].id;
      else break;
    }
    setActive(found);
  }

  /* Троттлим по времени, а не через requestAnimationFrame: rAF тормозится
     в почти невидимом фрейме (так открыт tests.html), и спай замолкал. */
  function scheduleSpy() {
    if (spyTick) return;
    spyTick = true;
    setTimeout(function () { spyTick = false; pickActive(); }, 80);
  }

  window.addEventListener('scroll', scheduleSpy, { passive: true });
  window.addEventListener('resize', scheduleSpy);

  // стартовое состояние: из хеша, иначе по текущей позиции
  (function initSpy() {
    var id = (location.hash || '').replace('#', '');
    if (id && document.getElementById(id)) setActive(id);
    else { setActive(null); pickActive(); }
  })();

  /* ── Живая перезагрузка ────────────────────────────────────────────
     Сторибук правится часто, а открытая вкладка легко остаётся на старой
     версии: cache-buster работает только при настоящей загрузке документа.
     Раз в 2 секунды спрашиваем Last-Modified у исходников и перезагружаем
     страницу, как только что-то изменилось. */
  (function watch() {
    /* Движковые файлы лежат рядом, брендовые — в папке бренда. */
    var WATCH = ['gallery.html', 'gallery.js', '_frame.html', 'brand.js']
      .concat([M.specs, M.tokenMap, M.legacyNames,
               M.css && M.css.tokens, M.css && M.css.components]
        .filter(Boolean).map(B.path));
    var stamps = {}, dirty = false, quiet = 0, note = null;

    /* Стеклянный оверлей на всю страницу: правка стилей на лету перерисовывает
       десятки iframe, и полусобранное состояние мелькает заметнее, чем плашка
       в углу. Матовое стекло гасит эту рябь и честно показывает, что галерея
       занята. Хром берёт цвета из токенов бренда, с фолбэком на нейтральный. */
    function banner(text) {
      if (!note) {
        note = document.createElement('div');
        note.className = 'g-reload';
        note.innerHTML = '<div class="g-reload__card">' +
                           '<span class="g-reload__spin"></span>' +
                           '<span class="g-reload__text"></span>' +
                         '</div>';
        document.body.appendChild(note);
        // reflow: без него браузер схлопывает начальное состояние с конечным
        //  и появление происходит рывком, без перехода
        void note.offsetWidth;
        note.classList.add('is-on');
      }
      note.querySelector('.g-reload__text').textContent = text;
    }

    function head(url) {
      return fetch(url + '?w=' + Date.now(), { method: 'HEAD', cache: 'no-store' })
        .then(function (r) { return r.headers.get('Last-Modified') || ''; })
        .catch(function () { return ''; });
    }

    function tick() {
      Promise.all(WATCH.map(head)).then(function (vals) {
        var changed = false;
        WATCH.forEach(function (f, i) {
          if (!vals[i]) return;
          if (stamps[f] && stamps[f] !== vals[i]) changed = true;
          stamps[f] = vals[i];
        });
        // Правки идут пачками (токены → css → спеки). Перезагружаться на
        // первом же изменении — значит поймать середину пачки и показать
        // полусобранную галерею. Ждём, пока файлы не «успокоятся».
        if (changed) {
          dirty = true;
          quiet = 0;
          banner(t('reload.changed'));
        } else if (dirty) {
          quiet++;
          if (quiet >= 2) {          // ~4 секунды без изменений
            banner(t('reload.reloading'));
            setTimeout(function () { location.reload(); }, 200);
            return;
          }
        }
        setTimeout(tick, 2000);
      });
    }
    tick();
  })();


  /* ══════════════════════════════════════════════════════════════════════
     Режим «Фигма ↔ код»
     ----------------------------------------------------------------------
     Под каждым примером показываем, чем текущая вёрстка (styles.css)
     отличается от дизайн-системы (токены + компоненты бренда). Одну и ту же
     разметку рендерим во втором, скрытом фрейме со вторым набором стилей
     и сравниваем вычисленные значения — руками ничего не описано.
     ══════════════════════════════════════════════════════════════════ */
  /* ── CSS для сравнения ──────────────────────────────────────────────
     Галерея — референс ДС. С чем сравнивать, приносит сам разработчик:
     прикладывает свой файл, и тоггл становится доступен. Пока файла нет,
     сравнивать не с чем — тоггл заблокирован. */
  var compareCss = null;
  var diffOn = false;
  var diffBtn = document.getElementById('g-diff');   // checkbox-тоггл
  var diffLabel = document.getElementById('g-diff-label');
  var cssName = document.getElementById('g-css-name');

  function setCompareCss(text, label) {
    compareCss = text || null;
    cssName.textContent = compareCss ? label : '';
    diffBtn.disabled = !compareCss;
    diffLabel.classList.toggle('is-disabled', !compareCss);
    if (compareCss) {
      diffLabel.title = t('topbar.compare.title', { file: label });
      diffLabel.removeAttribute('data-hint');
    } else {
      diffLabel.removeAttribute('title');
      diffLabel.setAttribute('data-hint', t('topbar.compare.hint'));
    }

    // приложили другой файл — прежние расчёты недействительны
    if (diffOn) setDiff(false);
    Array.prototype.forEach.call(document.querySelectorAll('.g-example'), function (box) {
      if (box.__probes) {
        box.__probes.ds.host.remove();
        box.__probes.code.host.remove();
        box.__probes = null;
      }
    });
    if (window.GALLERY_SET_SITE_CSS) window.GALLERY_SET_SITE_CSS(compareCss);
  }

  var cssFile = document.getElementById('g-css-file');
  if (cssFile) cssFile.addEventListener('change', function (e) {
    var file = e.target.files && e.target.files[0];
    if (!file) return;
    file.text().then(function (text) {
      setCompareCss(text, file.name);
      /* Приложенный файл принадлежит сторибуку и переживает перезагрузку. */
      var R = window.ENGINE_REGISTRY;
      var id = B.source.id;
      var problem = R && R.saveCompareCss(id, text, file.name);
      if (problem) cssName.textContent = file.name + ' — ' + t('settings.compare.tooBig');
    });
  });

  /* Восстановление приложенного CSS: делаем это после первой отрисовки,
     чтобы не задерживать показ каталога разбором чужого файла. */
  (function restoreCompareCss() {
    var R = window.ENGINE_REGISTRY;
    if (!R) return;
    var id = B.source.id;
    var text = R.compareCss(id);
    if (!text) return;
    var name = (R.suiteSettings(id) || {}).compareName || 'CSS';
    setTimeout(function () { setCompareCss(text, name); }, 0);
  })();


  var DIFF_PROPS = [
    /* Подписи берутся из языкового пака по ключу prop.<свойство>. */
    'fontSize', 'fontWeight', 'lineHeight', 'color', 'backgroundColor',
    'borderTopLeftRadius', 'boxShadow', 'paddingTop', 'paddingLeft',
    'columnGap', 'rowGap', 'height', 'minHeight'
  ];

  function selectorOf(el) {
    var cls = (el.getAttribute('class') || '').split(/\s+/)
      .filter(function (c) { return c && c !== 'g-pick'; });
    return cls.length ? '.' + cls.join('.') : null;
  }

  function computeDiff(docNew, docOld) {
    var rows = [], seen = {};
    var nodes = docNew.querySelectorAll('[class]');
    for (var i = 0; i < nodes.length; i++) {
      var sel = selectorOf(nodes[i]);
      if (!sel || seen[sel]) continue;
      seen[sel] = 1;

      var a, b;
      try {
        a = docNew.querySelectorAll(sel);
        b = docOld.querySelectorAll(sel);
      } catch (e) { continue; }
      if (!b.length || a.length !== b.length) continue;

      var ca = docNew.defaultView.getComputedStyle(a[0]);
      var cb = docOld.defaultView.getComputedStyle(b[0]);
      DIFF_PROPS.forEach(function (p) {
        var va = ca[p], vb = cb[p];
        if (!va || !vb || va === vb) return;
        // высоту сравниваем только при заметной разнице — она плавает от текста
        if ((p === 'height' || p === 'minHeight') &&
            Math.abs(parseFloat(va) - parseFloat(vb)) < 4) return;
        rows.push({ sel: sel, prop: t('prop.' + p), now: va, was: vb });
      });
    }
    return rows;
  }

  /* state: 'loading' | 'ready' | 'error' */
  function renderDiff(box, rows, state) {
    var old = box.querySelector('.g-diff');
    if (old) old.remove();
    var el = document.createElement('div');
    el.className = 'g-diff';
    if (state === 'loading') {
      el.innerHTML = '<div class="g-diff-head">' + t('diff.computing') + '</div>';
    } else if (state === 'error') {
      el.innerHTML = '<div class="g-diff-head">' + t('diff.failed') + '</div>';
    } else if (!rows.length) {
      el.innerHTML = '<div class="g-diff-head is-clean">' + t('diff.clean') + '</div>';
    } else {
      el.innerHTML = '<div class="g-diff-head">' + t('diff.count', { n: rows.length }) + '</div>' +
        '<table><tbody>' + rows.map(function (r) {
          return '<tr><td class="sel">' + r.sel + '</td><td class="prop">' + r.prop + '</td>' +
            '<td><span class="was">' + r.was + '</span> → <span class="now">' + r.now + '</span></td></tr>';
        }).join('') + '</tbody></table>';
    }
    box.appendChild(el);
  }

  /* Сравнение НЕ зависит от переключателя вида: держим два собственных
     скрытых фрейма — один с CSS бренда, другой с приложенным — и сравниваем их
     между собой. Раньше эталоном служил основной фрейм, и в режиме
     «Текущий сайт» кнопка сравнивала код сам с собой. */
  /* Скрытый эталон для сравнения — тот же mountFrame, только за экраном */
  function makeProbe(html, cssMode) {
    var host = document.createElement('div');
    host.style.cssText = 'position:absolute;left:-99999px;top:0;width:' + DESKTOP_W +
                         'px;height:1400px;overflow:hidden;pointer-events:none';

    var rec = mountFrame({
      html: html, width: DESKTOP_W, cssMode: cssMode,
      userCss: cssMode === 'current' ? compareCss : null,
      id: 'probe' + (++frameSeq), title: 'diff probe', settle: 350
    });
    rec.iframe.style.height = '1400px';
    rec.iframe.style.border = '0';
    rec.iframe.setAttribute('aria-hidden', 'true');

    host.appendChild(rec.iframe);
    document.body.appendChild(host);
    rec.host = host;
    rec.frame = rec.iframe;   // имя, под которым его знает buildDiffFor
    return rec;
  }

  function buildDiffFor(box, done) {
    var pr = box.__probes = {
      ds:   makeProbe(box.__html, 'new'),
      code: makeProbe(box.__html, 'current')
    };
    var finished = false;

    function finish() {
      if (finished) return;
      finished = true;
      // скрытые фреймы больше не нужны — освобождаем память
      pr.ds.host.remove();
      pr.code.host.remove();
      if (done) done();
    }

    function paint() {
      if (!diffOn) { finish(); return; }
      if (!pr.ds.ready || !pr.code.ready) return;
      try {
        renderDiff(box, computeDiff(pr.ds.frame.contentDocument,
                                    pr.code.frame.contentDocument), 'ready');
      } catch (e) {
        renderDiff(box, [], 'error');
      }
      finish();
    }

    pr.ds.onready = pr.code.onready = paint;

    // страховка: если фрейм не догрузился, не держим очередь вечно
    setTimeout(function () {
      if (finished) return;
      if (!pr.ds.ready || !pr.code.ready) {
        renderDiff(box, [], 'error');   // честно, а не молчаливое «совпадает»
      } else { paint(); }
      finish();
    }, 8000);
  }

  /* Сборка ленивая и по очереди.
     Раньше на каждый пример сразу создавалась пара скрытых фреймов — на
     42 примерах это больше 80 iframe одновременно, каждый со своими
     токены, компоненты и приложенный CSS. Часть просто не успевала загрузиться,
     и панели навсегда зависали на «Считаю различия…».
     Теперь считаем только то, что попало в поле зрения, и не больше двух
     примеров одновременно. */
  var diffQueue = [], diffBusy = 0, diffIO = null;
  var DIFF_PARALLEL = 2;

  function pump() {
    while (diffBusy < DIFF_PARALLEL && diffQueue.length) {
      var box = diffQueue.shift();
      if (!diffOn || box.__probes) continue;
      diffBusy++;
      buildDiffFor(box, function () { diffBusy--; pump(); });
    }
  }

  function enqueue(box) {
    if (!diffOn || box.__probes || diffQueue.indexOf(box) >= 0) return;
    renderDiff(box, [], 'loading');
    diffQueue.push(box);
    pump();
  }

  function setDiff(on) {
    if (on && !compareCss) return;   // сравнивать не с чем
    diffOn = on;
    diffBtn.checked = on;

    if (!on) {
      if (diffIO) { diffIO.disconnect(); diffIO = null; }
      diffQueue.length = 0;
      Array.prototype.forEach.call(document.querySelectorAll('.g-example'), function (box) {
        var d = box.querySelector('.g-diff');
        if (d) d.remove();
        if (box.__probes) {
          box.__probes.ds.host.remove();
          box.__probes.code.host.remove();
          box.__probes = null;
        }
      });
      diffBusy = 0;
      return;
    }

    diffIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) enqueue(en.target); });
    }, { rootMargin: '200px 0px' });
    Array.prototype.forEach.call(document.querySelectorAll('.g-example'), function (box) {
      diffIO.observe(box);
    });
  }

  diffBtn.addEventListener('change', function () { setDiff(diffBtn.checked); });

  /* Небольшой публичный API — им пользуются тесты (tests.html) и он же
     удобен из консоли: сборка панелей ленивая и завязана на прокрутку,
     а так можно попросить конкретный раздел посчитаться прямо сейчас. */
  window.GALLERY_API = {
    setDiff: setDiff,
    isDiffOn: function () { return diffOn; },
    spy: function () { pickActive(); return activeId || null; },
    setCompareCss: setCompareCss,
    hasCompareCss: function () { return !!compareCss; },
    diffSection: function (id) {
      if (!diffOn) setDiff(true);
      var boxes = document.querySelectorAll('#' + id + ' .g-example');
      Array.prototype.forEach.call(boxes, enqueue);
      return boxes.length;
    },
    frames: function () {
      return frames.map(function (f) {
        return { id: f.id, w: f.width, desktop: !!f.desktop, contentH: f.contentH || null };
      });
    },
    sections: function () {
      return Array.prototype.map.call(document.querySelectorAll('.g-section'),
        function (s) { return s.id; });
    }
  };
  // выбор раздела сбрасывает режим
  nav.addEventListener('click', function () { if (diffOn) setDiff(false); });

  /* Первый проход: до этого токен-секции рисовал setMode, которого больше нет.
     Спеки дёрнут GALLERY_REFRESH ещё раз, когда догрузят и разберут CSS. */
  renderTokenSections();

  setTimeout(applyScale, 300);
  setTimeout(applyScale, 1200);
})();
