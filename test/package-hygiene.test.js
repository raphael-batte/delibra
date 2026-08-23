'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const { checkPackage } = require('../packages/engine/check-package.js');

const ROOT = path.join(__dirname, '..');

describe('package hygiene', function () {
  it('engine repo has no libra data, junk, personal paths, or stray Cyrillic', function () {
    const problems = checkPackage(ROOT);
    assert.equal(problems.length, 0, problems.map(function (p) {
      return p.file + ': ' + p.detail;
    }).join('\n'));
  });

  it('flags libra folder and home path in a temp tree', function () {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'delibra-hygiene-'));
    try {
      fs.mkdirSync(path.join(tmp, 'brands', 'sdm'), { recursive: true });
      fs.writeFileSync(path.join(tmp, 'brands', 'sdm', 'manifest.json'), '{}');
      fs.mkdirSync(path.join(tmp, 'packages', 'engine'), { recursive: true });
      fs.writeFileSync(
        path.join(tmp, 'packages', 'engine', 'note.md'),
        'path: /Users/alice/project\n'
      );
      fs.writeFileSync(path.join(tmp, 'README.md'), '# x');
      fs.writeFileSync(path.join(tmp, 'index.html'), '<!-- -->');

      const problems = checkPackage(tmp);
      assert.ok(problems.some(function (p) { return p.file.indexOf('brands/sdm') >= 0; }));
      assert.ok(problems.some(function (p) { return p.kind === 'personal'; }));

      fs.writeFileSync(path.join(tmp, 'packages', 'engine', 'bad.js'), 'var x = "\u043f\u0440\u0438\u0432\u0435\u0442";\n');
      const withCyrillic = checkPackage(tmp);
      assert.ok(withCyrillic.some(function (p) { return p.kind === 'locale'; }));
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});
