'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(
  path.join(__dirname, '../packages/engine/gallery.html'),
  'utf8'
);

function gScriptIndex(file) {
  const needle = "gScript('" + file + "')";
  const i = html.indexOf(needle);
  assert.ok(i >= 0, 'missing ' + needle);
  return i;
}

describe('gallery.html script order', function () {
  it('loads gallery-diff.js before gallery.js', function () {
    assert.ok(gScriptIndex('gallery-diff.js') < gScriptIndex('gallery.js'));
  });

  it('loads switcher-settings.js before switcher.js', function () {
    assert.ok(gScriptIndex('switcher-settings.js') < gScriptIndex('switcher.js'));
  });
});
