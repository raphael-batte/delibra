'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');

const ROOT = path.join(__dirname, '..');
const DATA = require('../packages/engine/data-root.js');
const DATA_ROOT = DATA.dataRoot(ROOT);
const PORT = 9876;
const SOURCE = '_template';

let proc;
let base;

function post(url, body) {
  return new Promise(function (resolve, reject) {
    const data = JSON.stringify(body);
    const req = http.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    }, function (res) {
      const chunks = [];
      res.on('data', function (c) { chunks.push(c); });
      res.on('end', function () {
        resolve({
          status: res.statusCode,
          body: JSON.parse(Buffer.concat(chunks).toString('utf8'))
        });
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function del(url) {
  return new Promise(function (resolve, reject) {
    const req = http.request(url, { method: 'DELETE' }, function (res) {
      const chunks = [];
      res.on('data', function (c) { chunks.push(c); });
      res.on('end', function () {
        resolve({ status: res.statusCode });
      });
    });
    req.on('error', reject);
    req.end();
  });
}

describe('POST /__api/brand/:id/duplicate', function () {
  before(function () {
    return new Promise(function (resolve, reject) {
      proc = spawn(process.execPath, ['packages/engine/serve.js', String(PORT)], {
        cwd: ROOT,
        stdio: ['ignore', 'pipe', 'pipe']
      });
      base = 'http://127.0.0.1:' + PORT;
      let ready = false;
      proc.stdout.on('data', function (buf) {
        if (!ready && String(buf).indexOf('gallery:') >= 0) {
          ready = true;
          resolve();
        }
      });
      proc.stderr.on('data', function (buf) { reject(new Error(String(buf))); });
      proc.on('error', reject);
      setTimeout(function () {
        if (!ready) reject(new Error('serve.js did not start'));
      }, 8000);
    });
  });

  after(function () {
    if (proc) proc.kill('SIGTERM');
  });

  it('copies all files and marks manifest as duplicate', async function () {
    const title = 'dup test ' + Date.now();
    const slug = 'dup-test-' + Date.now();
    const out = await post(base + '/__api/brand/' + SOURCE + '/duplicate', {
      title: title,
      slug: slug
    });
    assert.equal(out.status, 200);
    assert.equal(out.body.ok, true);
    const id = out.body.id;
    assert.ok(id);

    const dir = path.join(DATA_ROOT, id);
    assert.ok(fs.existsSync(dir));
    assert.ok(fs.existsSync(path.join(dir, 'sections.json')));
    assert.ok(fs.existsSync(path.join(dir, 'tokens.css')));

    const srcSections = fs.readFileSync(path.join(ROOT, 'brands', SOURCE, 'sections.json'), 'utf8');
    const dupSections = fs.readFileSync(path.join(dir, 'sections.json'), 'utf8');
    assert.equal(dupSections, srcSections, 'sections.json must be a full copy');

    const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8'));
    assert.equal(manifest.design.source, 'duplicate');
    assert.equal(manifest.design.duplicatedFrom, SOURCE);
    assert.equal(manifest.title, title);

    await del(base + '/__api/brand/' + encodeURIComponent(id));
    assert.ok(!fs.existsSync(dir));
  });
});
