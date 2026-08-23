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

const REFERENCE_BRAND_IDS = ['_template'];

function isReferenceBrand(id) {
  return REFERENCE_BRAND_IDS.indexOf(id) >= 0;
}

/* Default CLI target: DELIBRA_DATA/<id>, then brands/<id> in the repo. */
function resolveBrandDir(repoRoot, arg, defaultId) {
  defaultId = defaultId || 'sdm';
  if (arg) return path.resolve(arg);
  const dataDir = path.join(dataRoot(repoRoot), defaultId);
  if (fs.existsSync(dataDir)) return dataDir;
  const repoDir = path.join(repoBrands(repoRoot), defaultId);
  if (fs.existsSync(repoDir)) return repoDir;
  return dataDir;
}

module.exports = {
  dataRoot,
  repoBrands,
  templateDir,
  ensureDataRoot,
  BRAND_URL_PREFIX,
  REFERENCE_BRAND_IDS,
  isReferenceBrand,
  resolveBrandDir
};
