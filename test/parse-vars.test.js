'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const PARSE = require(path.join(__dirname, '../packages/engine/parse-vars.js'));
const BUILD = require(path.join(__dirname, '../packages/engine/token-build.js'));

describe('parseVars media widths', function () {
  it('records the largest max-width and collects those tokens', function () {
    const css = [
      ':root { --a: 1px; }',
      '@media (max-width: 768px) { :root { --a: 2px; } }',
      '@media (max-width: 900px) { :root { --b: 3px; } }'
    ].join('\n');
    const vars = PARSE.parseVars(css);
    assert.equal(vars.mobileMax, 900);
    assert.equal(vars.mobile['--a'], '2px');
    assert.equal(vars.mobile['--b'], '3px');
    assert.equal(vars.base['--a'], '1px');
  });

  it('leaves mobileMax unset when there is no max-width media', function () {
    const vars = PARSE.parseVars(':root { --a: 1px; }');
    assert.equal(vars.mobileMax, undefined);
    assert.deepEqual(vars.mobile, {});
  });
});

describe('buildPackage viewport', function () {
  it('writes breakpoint from parsed max-width', function () {
    const css = ':root { --a: #111; }\n@media (max-width: 900px) { :root { --a: #000; } }';
    const vars = PARSE.parseVars(css);
    const built = BUILD.buildPackage(vars, { title: 'From CSS', source: 'css', css: css });
    const m = JSON.parse(built.files['manifest.json']);
    assert.equal(m.breakpoints.mobile, 900);
    assert.equal(m.breakpoints.desktopMin, 901);
    assert.equal(m.preview.mobileWidth, 900);
    assert.equal(m.preview.desktopWidth, undefined);
    assert.equal(m.preview.container, undefined);
  });

  it('keeps preview empty when the stylesheet has no mobile media', function () {
    const css = ':root { --a: #111; }';
    const vars = PARSE.parseVars(css);
    const built = BUILD.buildPackage(vars, { title: 'Desktop', source: 'css', css: css });
    const m = JSON.parse(built.files['manifest.json']);
    assert.deepEqual(m.preview, {});
    assert.equal(m.breakpoints, undefined);
  });
});
