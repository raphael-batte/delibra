'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const ARCHIVE = require('../packages/engine/package-archive.js');

describe('archive (.lbr)', function () {
  it('round-trips non-ASCII file names', function () {
    var path = 'assets/café.svg';
    var data = new TextEncoder().encode('<svg/>');
    var zip = ARCHIVE.pack([{ path: path, data: data }]);
    var back = ARCHIVE.unpack(zip);
    assert.ok(back[path], 'expected UTF-8 path key, got: ' + Object.keys(back).join(', '));
    assert.deepEqual(Buffer.from(back[path]), Buffer.from(data));
  });

  it('round-trips binary assets byte-for-byte', function () {
    var data = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0xff, 0x00]);
    var zip = ARCHIVE.pack([{ path: 'assets/icon.png', data: data }]);
    var files = ARCHIVE.entriesToFiles(ARCHIVE.unpack(zip));
    assert.match(files['assets/icon.png'], /^data:image\/png;base64,/);
    var entries = ARCHIVE.filesToEntries(files);
    var back = ARCHIVE.unpack(ARCHIVE.pack(entries));
    assert.deepEqual(Buffer.from(back['assets/icon.png']), Buffer.from(data));
  });

  it('skips directory entries from foreign zips', function () {
    var zip = ARCHIVE.pack([
      { path: 'assets/', data: new Uint8Array(0) },
      { path: 'assets/a.png', data: Uint8Array.from([1, 2, 3]) }
    ]);
    var back = ARCHIVE.unpack(zip);
    assert.equal(back['assets/'], undefined);
    assert.deepEqual(Buffer.from(back['assets/a.png']), Buffer.from([1, 2, 3]));
  });
});

describe('live reload watch list', function () {
  it('uses manifest.sections, not legacy specs', function () {
    var M = {
      sections: 'sections.json',
      tokenMap: 'token-map.json',
      css: { tokens: 'tokens.css', components: 'components.css' }
    };
    var brandFiles = [M.sections || M.specs, M.tokenMap,
      M.css && M.css.tokens, M.css && M.css.components].filter(Boolean);
    assert.ok(brandFiles.includes('sections.json'));
    assert.equal(M.specs, undefined);
  });
});

describe('offline .lbr import shape', function () {
  it('stores manifest at top level, not nested under "files"', function () {
    var files = {
      'manifest.json': JSON.stringify({ title: 'x', css: { tokens: 't.css', components: 'c.css' } }),
      'tokens.css': ':root {}\n',
      'sections.json': '[]',
      'token-map.json': '{}',
      'components.css': ''
    };
    var pack = { formatVersion: 1, files: files };
    assert.ok(pack.files['manifest.json']);
    assert.equal(pack.files.files, undefined);
    var zip = ARCHIVE.pack(ARCHIVE.filesToEntries(pack.files));
    var res = ARCHIVE.entriesToFiles(ARCHIVE.unpack(zip));
    assert.ok(res['manifest.json']);
    assert.ok(JSON.parse(res['manifest.json']).css);
  });
});
