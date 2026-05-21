const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function normalizeVersion(version) {
  const parts = String(version || '1.0.0')
    .split('.')
    .map((part) => Number.parseInt(part, 10) || 0);

  while (parts.length < 4) parts.push(0);
  return parts.slice(0, 4).join('.');
}

function findCachedRcedit() {
  const cacheRoot = path.join(process.env.LOCALAPPDATA || '', 'electron-builder', 'Cache', 'winCodeSign');
  if (!cacheRoot || !fs.existsSync(cacheRoot)) return null;

  const candidates = fs
    .readdirSync(cacheRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(cacheRoot, entry.name, 'rcedit-x64.exe'))
    .filter((candidate) => fs.existsSync(candidate))
    .map((candidate) => ({
      path: candidate,
      mtime: fs.statSync(candidate).mtimeMs
    }))
    .sort((a, b) => b.mtime - a.mtime);

  return candidates[0]?.path || null;
}

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'win32') return;

  const rceditPath = findCachedRcedit();
  if (!rceditPath) {
    throw new Error('Unable to find cached rcedit-x64.exe for Windows icon stamping.');
  }

  const appInfo = context.packager.appInfo;
  const productName = appInfo.productName;
  const productFilename = appInfo.productFilename;
  const exePath = path.join(context.appOutDir, `${productFilename}.exe`);
  const iconPath = path.join(context.packager.projectDir, 'build', 'icon.ico');
  const version = normalizeVersion(appInfo.version);

  execFileSync(rceditPath, [
    exePath,
    '--set-icon',
    iconPath,
    '--set-version-string',
    'FileDescription',
    productName,
    '--set-version-string',
    'ProductName',
    productName,
    '--set-version-string',
    'InternalName',
    productFilename,
    '--set-version-string',
    'OriginalFilename',
    `${productFilename}.exe`,
    '--set-version-string',
    'CompanyName',
    'Resource Command Center',
    '--set-version-string',
    'LegalCopyright',
    'Copyright (C) 2026 Resource Command Center',
    '--set-file-version',
    version,
    '--set-product-version',
    version
  ], { stdio: 'inherit' });
};
