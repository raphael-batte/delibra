'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const SCAFFOLD = require(path.join(__dirname, '../packages/engine/brand-scaffold.js'));

describe('empty scaffold', function () {
  it('writes no viewport numbers', function () {
    const m = SCAFFOLD.manifest({ title: 'X', id: 'x' });
    assert.equal(m.breakpoints, undefined);
    assert.deepEqual(m.preview, {});
    assert.equal(m.design, undefined);
  });

  it('records design source from url', function () {
    const m = SCAFFOLD.manifest({
      title: 'X',
      design: 'https://figma.com/design/abc',
      source: 'figma'
    });
    assert.equal(m.design.source, 'figma');
    assert.equal(m.design.url, 'https://figma.com/design/abc');
    assert.deepEqual(m.preview, {});
  });
});
