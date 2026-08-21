/* ==========================================================================
   Обмен пакетами: собрать сторибук в файл и разобрать файл обратно.

   Работает одинаково с папкой и с пакетом в памяти — читает через
   BrandSource, а не через файловую систему. Ради этого источник и
   выделялся: экспорт написан один раз.

   Формат — BRAND-PACKAGE.md: манифест плюс словарь файлов. Приложенный для
   сравнения CSS в пакет НЕ входит: это чужой боевой код, а не часть системы.
   ========================================================================== */
(function () {
  'use strict';

  var BUNDLE = window.ENGINE_BUNDLE;

  /* Файлы, которые составляют пакет. Ассеты перечислены в самих секциях —
     их пути собираем из разметки, а не гадаем по папке: браузер не умеет
     читать содержимое каталога, и «взять всё из assets/» невозможно. */
  function assetPaths(sections) {
    var found = {};
    JSON.stringify(sections || []).replace(/(?:src|href)=\\"([^"\\\\]+)/g, function (all, p) {
      if (!/^(https?:|data:|blob:|#|\/)/.test(p)) found[p] = 1;
      return all;
    });
    return Object.keys(found);
  }

  function readAll(source, manifest, sections) {
    var files = {};
    var wanted = [
      ['manifest.json', JSON.stringify(manifest, null, 2)],
      [manifest.css.tokens, null],
      [manifest.css.components, null],
      [manifest.sections || 'sections.json', null],
      [manifest.tokenMap, null],
      [manifest.legacyNames, null]
    ];

    var jobs = wanted.filter(function (w) { return w[0]; }).map(function (w) {
      if (w[1] != null) { files[w[0]] = w[1]; return Promise.resolve(); }
      return Promise.resolve(source.text(w[0])).then(function (text) {
        if (text != null) files[w[0]] = text;
      });
    });

    assetPaths(sections).forEach(function (p) {
      jobs.push(Promise.resolve(source.text(p)).then(function (text) {
        if (text != null) files[p] = text;
      }));
    });

    return Promise.all(jobs).then(function () { return files; });
  }

  window.ENGINE_PACKAGE = {
    /* Сторибук → объект пакета. */
    build: function (source, manifest, sections, name) {
      var m = JSON.parse(JSON.stringify(manifest));
      if (name) m.title = name;
      return readAll(source, m, sections).then(function (files) {
        files['manifest.json'] = JSON.stringify(m, null, 2);
        return { formatVersion: BUNDLE.FORMAT_VERSION, files: files };
      });
    },

    /* Пакет → файл на диске пользователя. */
    download: function (pack, filename) {
      var blob = new Blob([JSON.stringify(pack, null, 2)], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      /* Ссылку отпускаем не сразу: Safari успевает начать скачивание
         только после возврата в цикл событий. */
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    },

    /* Файл → пакет. Возвращает { pack } либо { error } — импорт обязан
       объясниться, а не положить галерею. */
    parse: function (text) {
      var data;
      try { data = JSON.parse(text); }
      catch (e) { return { error: 'notJson', detail: e.message }; }

      if (!data || typeof data !== 'object' || !data.files) return { error: 'notPackage' };
      if (data.formatVersion > BUNDLE.FORMAT_VERSION) {
        return { error: 'newerFormat', detail: data.formatVersion };
      }

      var manifest;
      try { manifest = JSON.parse(data.files['manifest.json'] || 'null'); }
      catch (e) { return { error: 'badManifest', detail: e.message }; }
      if (!manifest || !manifest.css) return { error: 'badManifest' };

      /* Секции проверяем теми же правилами, что и CLI: иначе битый файл
         откроется пустым каталогом вместо внятного отказа. */
      var sectionsFile = manifest.sections || 'sections.json';
      var sections = null;
      if (data.files[sectionsFile]) {
        try { sections = JSON.parse(data.files[sectionsFile]); }
        catch (e) { return { error: 'badSections', detail: e.message }; }
        var problems = window.ENGINE_SECTIONS_CONTRACT.check(sections);
        if (problems.length) return { error: 'badSections', detail: problems[0] };
      }

      return { pack: data, manifest: manifest, sections: sections };
    }
  };
})();
