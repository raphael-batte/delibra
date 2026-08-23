/* Sync read of /__api/ping before brand.js — only when serve.js is running.
   Sets brand URL prefix so library libras load from /__data/<id>/, not repo brands/. */
(function () {
  'use strict';
  try {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', '/__api/ping', false);
    xhr.send(null);
    if (xhr.status !== 200) return;
    var d = JSON.parse(xhr.responseText);
    if (!d || !d.ok) return;
    window.ENGINE_CONFIG = {
      brandUrlPrefix: d.brandUrlPrefix || null,
      brandsRoot: d.brandsRoot || null,
      dataRoot: d.dataRoot || null,
      indexUrl: d.indexUrl || null
    };
  } catch (e) {}
})();
