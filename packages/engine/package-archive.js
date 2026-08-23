/* ==========================================================================
   .lbr — zip archive for libra exchange (store method, no compression).

   Same layout on disk and in the file: manifest.json, css, sections, assets/…
   Works in Node (serve.js) and in the browser (package-io.js).
   ========================================================================== */
(function (root, factory) {
  var mod = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = mod;
  else root.ENGINE_ARCHIVE = mod;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var SIG_LOCAL   = 0x04034b50;
  var SIG_CENTRAL = 0x02014b50;
  var SIG_END     = 0x06054b50;

  var TEXT_EXT = /\.(css|json|js|svg|md|html|txt)$/i;

  var CRC_TABLE = (function () {
    var t = new Uint32Array(256);
    for (var i = 0; i < 256; i++) {
      var c = i;
      for (var k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      t[i] = c >>> 0;
    }
    return t;
  })();

  function crc32(bytes) {
    var crc = 0xffffffff;
    for (var i = 0; i < bytes.length; i++) {
      crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  function normalizePath(p) {
    return String(p || '').replace(/\\/g, '/').replace(/^\.?\//, '').replace(/\/+/g, '/');
  }

  function safePath(p) {
    var n = normalizePath(p);
    if (!n || n.indexOf('..') !== -1 || n.charAt(0) === '/') return null;
    return n;
  }

  function toBytes(data) {
    if (data == null) return new Uint8Array(0);
    if (typeof Buffer !== 'undefined' && Buffer.isBuffer(data)) {
      return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    }
    if (data instanceof Uint8Array) return data;
    if (typeof data === 'string') {
      if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(data);
      /* Node without TextEncoder in very old builds */
      if (typeof Buffer !== 'undefined') return new Uint8Array(Buffer.from(data, 'utf8'));
    }
    throw new Error('unsupported data type');
  }

  function concat(chunks) {
    var len = 0;
    chunks.forEach(function (c) { len += c.length; });
    var out = new Uint8Array(len);
    var off = 0;
    chunks.forEach(function (c) {
      out.set(c, off);
      off += c.length;
    });
    return out;
  }

  function writeU16(buf, off, v) { buf[off] = v & 0xff; buf[off + 1] = (v >>> 8) & 0xff; }
  function writeU32(buf, off, v) {
    buf[off] = v & 0xff;
    buf[off + 1] = (v >>> 8) & 0xff;
    buf[off + 2] = (v >>> 16) & 0xff;
    buf[off + 3] = (v >>> 24) & 0xff;
  }
  function readU16(buf, off) { return buf[off] | (buf[off + 1] << 8); }
  function readU32(buf, off) {
    return (buf[off] | (buf[off + 1] << 8) | (buf[off + 2] << 16) | (buf[off + 3] << 24)) >>> 0;
  }

  function decodeName(bytes, flags) {
    if (flags & 0x0800) {
      return new TextDecoder('utf-8').decode(bytes);
    }
    if (typeof TextDecoder !== 'undefined') {
      try { return new TextDecoder('utf-8').decode(bytes); } catch (e) {}
    }
    if (typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('utf8');
    return String.fromCharCode.apply(null, bytes);
  }

  function pack(entries) {
    var parts = [];
    var central = [];
    var offset = 0;

    entries.forEach(function (entry) {
      var name = safePath(entry.path);
      if (!name) throw new Error('bad path: ' + entry.path);
      var nameBytes = toBytes(name);
      var data = toBytes(entry.data);
      var checksum = crc32(data);

      var local = new Uint8Array(30 + nameBytes.length + data.length);
      writeU32(local, 0, SIG_LOCAL);
      writeU16(local, 4, 20);
      writeU16(local, 6, 0x0800);
      writeU16(local, 8, 0);
      writeU32(local, 14, checksum);
      writeU32(local, 18, data.length);
      writeU32(local, 22, data.length);
      writeU16(local, 26, nameBytes.length);
      writeU16(local, 28, 0);
      local.set(nameBytes, 30);
      local.set(data, 30 + nameBytes.length);
      parts.push(local);

      var cen = new Uint8Array(46 + nameBytes.length);
      writeU32(cen, 0, SIG_CENTRAL);
      writeU16(cen, 4, 20);
      writeU16(cen, 6, 20);
      writeU16(cen, 8, 0x0800);
      writeU16(cen, 10, 0);
      writeU32(cen, 16, checksum);
      writeU32(cen, 20, data.length);
      writeU32(cen, 24, data.length);
      writeU16(cen, 28, nameBytes.length);
      writeU16(cen, 30, 0);
      writeU16(cen, 32, 0);
      writeU16(cen, 34, 0);
      writeU16(cen, 36, 0);
      writeU32(cen, 38, 0);
      writeU32(cen, 42, offset);
      cen.set(nameBytes, 46);
      central.push(cen);

      offset += local.length;
    });

    var centralBuf = concat(central);
    var end = new Uint8Array(22);
    writeU32(end, 0, SIG_END);
    writeU16(end, 8, entries.length);
    writeU16(end, 10, entries.length);
    writeU32(end, 12, centralBuf.length);
    writeU32(end, 16, offset);

    parts.push(centralBuf, end);
    var zip = concat(parts);

    if (typeof Buffer !== 'undefined') return Buffer.from(zip);
    return zip;
  }

  function findEnd(buf) {
    var start = Math.max(0, buf.length - 65557);
    for (var i = buf.length - 22; i >= start; i--) {
      if (readU32(buf, i) === SIG_END) return i;
    }
    return -1;
  }

  function unpack(input) {
    var buf = input instanceof Uint8Array ? input : toBytes(input);
    var endOff = findEnd(buf);
    if (endOff < 0) throw new Error('not a zip archive');

    var count = readU16(buf, endOff + 8);
    var centralSize = readU32(buf, endOff + 12);
    var centralOff = readU32(buf, endOff + 16);
    if (centralOff + centralSize > buf.length) throw new Error('corrupt zip');

    var out = {};
    var pos = centralOff;
    for (var i = 0; i < count; i++) {
      if (readU32(buf, pos) !== SIG_CENTRAL) throw new Error('corrupt central directory');
      var comp = readU16(buf, pos + 10);
      var flags = readU16(buf, pos + 8);
      var crc = readU32(buf, pos + 16);
      var cSize = readU32(buf, pos + 20);
      var uSize = readU32(buf, pos + 24);
      var nameLen = readU16(buf, pos + 28);
      var extraLen = readU16(buf, pos + 30);
      var commentLen = readU16(buf, pos + 32);
      var localOff = readU32(buf, pos + 42);
      var name = normalizePath(decodeName(buf.subarray(pos + 46, pos + 46 + nameLen), flags));
      if (!safePath(name)) throw new Error('bad path in archive: ' + name);
      if (name.endsWith('/')) {
        pos += 46 + nameLen + extraLen + commentLen;
        continue;
      }
      pos += 46 + nameLen + extraLen + commentLen;

      if (readU32(buf, localOff) !== SIG_LOCAL) throw new Error('corrupt local header');
      var lNameLen = readU16(buf, localOff + 26);
      var lExtraLen = readU16(buf, localOff + 28);
      var dataOff = localOff + 30 + lNameLen + lExtraLen;
      var data = buf.subarray(dataOff, dataOff + cSize);

      if (comp !== 0) throw new Error('compressed entries are not supported');
      if (crc32(data) !== crc || data.length !== uSize) throw new Error('checksum mismatch: ' + name);

      out[name] = data;
    }
    return out;
  }

  function isTextPath(path) {
    return TEXT_EXT.test(path) || path === 'manifest.json';
  }

  function bytesToBase64(bytes) {
    var bin = '';
    var step = 0x8000;
    for (var i = 0; i < bytes.length; i += step) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + step));
    }
    return btoa(bin);
  }

  var MIME = {
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
    gif: 'image/gif', webp: 'image/webp', woff2: 'font/woff2', woff: 'font/woff'
  };

  function mimeOf(path) {
    var ext = String(path).split('.').pop().toLowerCase();
    return MIME[ext] || 'application/octet-stream';
  }

  /* Map of path → string for the in-memory bundle. Text stays UTF-8; binary
     becomes a data URL so blob URLs in BrandSource keep working. */
  function entriesToFiles(entries) {
    var files = {};
    Object.keys(entries).sort().forEach(function (path) {
      var data = entries[path];
      if (isTextPath(path)) {
        files[path] = typeof TextDecoder !== 'undefined'
          ? new TextDecoder('utf-8').decode(data)
          : (typeof Buffer !== 'undefined' ? Buffer.from(data).toString('utf8') : '');
      } else {
        files[path] = 'data:' + mimeOf(path) + ';base64,' + bytesToBase64(data);
      }
    });
    return files;
  }

  function filesToEntries(files) {
    return Object.keys(files).sort().map(function (path) {
      var body = files[path];
      if (typeof body === 'string' && /^data:[^;]+;base64,/.test(body)) {
        var b64 = body.split(',')[1];
        var bin = atob(b64);
        var bytes = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        return { path: path, data: bytes };
      }
      return { path: path, data: body };
    });
  }

  return {
    EXT: '.lbr',
    LEGACY_EXT: '.dsz',
    MIME: 'application/zip',
    normalizePath: normalizePath,
    safePath: safePath,
    pack: pack,
    unpack: unpack,
    entriesToFiles: entriesToFiles,
    filesToEntries: filesToEntries,
    isTextPath: isTextPath,
    mimeOf: mimeOf,
    bytesToBase64: bytesToBase64
  };
}));
