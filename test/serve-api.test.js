'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const fs = require('fs');
const { spawn } = require('child_process');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DATA = require('../packages/engine/data-root.js');
const DATA_ROOT = DATA.dataRoot(ROOT);
const INDEX = path.join(DATA_ROOT, 'index.json');
const PORT = 9877;
const GHOST_ID = 'sdm-dup-test';

function request(method, pathname) {
  return new Promise(function (resolve, reject) {
    const req = http.request({
      hostname: '127.0.0.1',
      port: PORT,
      path: pathname,
      method: method
    }, function (res) {
      let raw = '';
      res.on('data', function (c) { raw += c; });
      res.on('end', function () {
        resolve({ status: res.statusCode, body: raw });
      });
    });
    req.on('error', reject);
    req.end();
  });
}


describe('serve API — data migration guards', function () {
  var child;

  before(function () {
    return new Promise(function (resolve, reject) {
      child = spawn(process.execPath, ['packages/engine/serve.js', String(PORT)], {
        cwd: ROOT,
        stdio: ['ignore', 'pipe', 'pipe']
      });
      var ready = false;
      child.stdout.on('data', function (buf) {
        if (!ready && String(buf).indexOf('gallery:') >= 0) {
          ready = true;
          resolve();
        }
      });
      child.stderr.on('data', function (buf) { reject(new Error(String(buf))); });
      child.on('error', reject);
      setTimeout(function () {
        if (!ready) reject(new Error('serve.js did not start on ' + PORT));
      }, 10000);
    });
  });

  after(function () {
    if (child) child.kill('SIGTERM');
  });

  it('DELETE _template returns 403 read-only', function () {
    return request('DELETE', '/__api/brand/_template').then(function (r) {
      assert.equal(r.status, 403);
      assert.match(r.body, /read-only/);
    });
  });

  it('GET /README.md serves repo docs, not gallery short URL', function () {
    return request('GET', '/README.md').then(function (r) {
      assert.equal(r.status, 200);
      assert.match(r.body, /DeLibra/);
      assert.doesNotMatch(r.body, /<base href="\/packages\/engine\/">/);
    });
  });

  it('short URL /_template serves gallery', function () {
    return request('GET', '/_template').then(function (r) {
      assert.equal(r.status, 200);
      assert.match(r.body, /gallery/i);
    });
  });

  it('DELETE missing folder still clears index entry', function () {
    var data = fs.existsSync(INDEX)
      ? JSON.parse(fs.readFileSync(INDEX, 'utf8'))
      : { brands: [] };
    if (!(data.brands || []).some(function (b) { return b.id === GHOST_ID; })) {
      data.brands = (data.brands || []).concat([{ id: GHOST_ID, title: GHOST_ID }]);
      fs.writeFileSync(INDEX, JSON.stringify(data, null, 2) + '\n');
    }
    return request('DELETE', '/__api/brand/' + GHOST_ID).then(function (r) {
      assert.equal(r.status, 200);
      return request('GET', '/__api/brands');
    }).then(function (r) {
      assert.equal(r.status, 200);
      var parsed = JSON.parse(r.body);
      assert.ok(!(parsed.brands || []).some(function (b) { return b.id === GHOST_ID; }));
    });
  });

  it('GET /__api/brands omits folders that do not exist', function () {
    var data = fs.existsSync(INDEX)
      ? JSON.parse(fs.readFileSync(INDEX, 'utf8'))
      : { brands: [] };
    if (!(data.brands || []).some(function (b) { return b.id === GHOST_ID; })) {
      data.brands = (data.brands || []).concat([{ id: GHOST_ID, title: GHOST_ID }]);
      fs.writeFileSync(INDEX, JSON.stringify(data, null, 2) + '\n');
    }
    return request('GET', '/__api/brands').then(function (r) {
      assert.equal(r.status, 200);
      var parsed = JSON.parse(r.body);
      assert.ok(!(parsed.brands || []).some(function (b) { return b.id === GHOST_ID; }));
    });
  });
});
