'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

/* Where libras live on disk — outside the engine repo by default. */
function dataRoot(repoRoot) {
  if (process.env.DELIBRA_DATA) return path.resolve(process.env.DELIBRA_DATA);
  return path.join(os.homedir(), '.delibra', 'libras');
}

function repoBrands(repoRoot) {
  return path.join(repoRoot, 'brands');
}

function templateDir(repoRoot) {
  return path.join(repoBrands(repoRoot), '_template');
}

function ensureDataRoot(root) {
  fs.mkdirSync(root, { recursive: true });
  const indexFile = path.join(root, 'index.json');
  if (!fs.existsSync(indexFile)) {
    fs.writeFileSync(indexFile, JSON.stringify({ brands: [] }, null, 2) + '\n');
  }
}

const BRAND_URL_PREFIX = '/__data';

module.exports = {
  dataRoot,
  repoBrands,
  templateDir,
  ensureDataRoot,
  BRAND_URL_PREFIX
};
