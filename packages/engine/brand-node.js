/* ==========================================================================
   Reading a brand manifest from node — for the CLI checks.

   The manifest is JSON now, so no regex digging; the legacy .js form is kept
   only while brands that have not moved over still exist.
   ========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');

function readManifest(brandDir) {
  const json = path.join(brandDir, 'manifest.json');
  if (fs.existsSync(json)) return JSON.parse(fs.readFileSync(json, 'utf8'));

  const js = path.join(brandDir, 'manifest.js');
  if (!fs.existsSync(js)) throw new Error('no manifest in ' + brandDir);

  /* Legacy: the file assigns an object to window. Run it in isolation with
     nothing but that window in scope. */
  const src = fs.readFileSync(js, 'utf8');
  const sandbox = { window: {} };
  new Function('window', src).call(null, sandbox.window);
  return sandbox.window.BRAND_MANIFEST || {};
}

module.exports = { readManifest };
