'use strict';
/* eslint-disable */
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  unlinkSync,
  readdirSync,
  statSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import process from 'node:process';

const { platform, arch } = process;
const systemUtils = {
  isWindows: platform === 'win32',
  isMac: platform === 'darwin',
  isLinux: platform === 'linux',
  is64System: process.env.FORCE_ARCH_32 == 'true' ? false : arch === 'x64',
  isArm64: arch === 'arm64',
  isMacUniversal: process.env.FORCE_UNIVERSAL == 'true',
};

function getFileSuffix(isIntOnly = false) {
  let suffix = '';
  if (systemUtils.isMac) {
    if (systemUtils.isMacUniversal || !systemUtils.isArm64) {
      suffix = '-int';
    }
  } else {
    if (systemUtils.isArm64) {
      if (!isIntOnly) {
        suffix = '-arm64';
      }
    } else if (!systemUtils.is64System) {
      suffix = '-i386';
    }
  }
  return suffix;
}
function genLibFileName(baseName, isIntOnly = false) {
  let ext;
  if (systemUtils.isWindows) {
    ext = 'dll';
  } else if (systemUtils.isMac) {
    ext = 'dylib';
  } else {
    ext = 'so';
  }
  const suffix = getFileSuffix(isIntOnly);
  return {
    sourceFileName: `${baseName}${suffix}.${ext}`,
    destFileName: `${baseName}.${ext}`,
  };
}
function genBinFileName(baseName, isIntOnly = false) {
  let ext = '';
  if (systemUtils.isWindows) {
    ext = '.exe';
  }
  const suffix = getFileSuffix(isIntOnly);
  return {
    sourceFileName: `${baseName}${suffix}${ext}`,
    destFileName: `${baseName}${ext}`,
  };
}

function copyFile(basePath, fileFullName, destFileFullName) {
  if (!existsSync(basePath.destination)) {
    mkdirSync(basePath.destination, { recursive: true });
  }
  const destFilePath = join(basePath.destination, destFileFullName);
  if (existsSync(destFilePath)) unlinkSync(destFilePath);
  copyFileSync(join(basePath.source, fileFullName), destFilePath);
}

const basePath = {
  source: resolve('./extra-work/db-exts'),
  destination: resolve('./electron-build/db-exts'),
};
['fts5', 'spellfix1'].forEach((baseName) => {
  const { sourceFileName, destFileName } = genLibFileName(baseName, true);
  console.log('Copy:', sourceFileName, destFileName);
  copyFile(basePath, sourceFileName, destFileName);
});

function checkIsFile(filePath) {
  const stats = existsSync(filePath) ? statSync(filePath) : null;
  return stats && stats.isFile();
}
function copyAllChildren(source, dest) {
  if (!existsSync(dest)) {
    mkdirSync(dest, { recursive: true });
  }
  const children = readdirSync(source);
  for (const child of children) {
    const sourceChild = join(source, child);
    const destChild = join(dest, child);
    if (checkIsFile(sourceChild)) {
      copyFileSync(sourceChild, destChild);
    } else {
      copyAllChildren(sourceChild, destChild);
    }
  }
}

const binHelperSourceRootDir = resolve('./extra-work/bin-helper/dist');
const binHelperDestRootDir = resolve('./electron-build/bin-helper');

copyAllChildren(
  resolve(binHelperSourceRootDir, 'net8.0'),
  resolve(binHelperDestRootDir, 'net8.0'),
);
console.log('PowerPoint lib files are copied');
copyAllChildren(
  resolve(binHelperSourceRootDir, `bin${getFileSuffix()}`),
  resolve(binHelperDestRootDir, 'bin'),
);
console.log('PowerPoint bin files are copied');

const { sourceFileName, destFileName } = genBinFileName('yt-dlp');
copyFile(
  {
    source: resolve(binHelperSourceRootDir, 'yt'),
    destination: resolve(binHelperDestRootDir, 'yt'),
  },
  sourceFileName,
  destFileName,
);
console.log('yt-dlp file is copied');

// TODO: copy only needed files
copyAllChildren(
  resolve('./node_modules/node-api-dotnet'),
  resolve(binHelperDestRootDir, 'node-api-dotnet'),
);
console.log('node-api-dotnet files are copied');

if (systemUtils.isMac) {
  copyAllChildren(
    resolve(
      './extra-work/ffmpeg/mac' +
      (systemUtils.isMacUniversal || !systemUtils.isArm64 ? '-intel' : ''),
    ),
    resolve(binHelperDestRootDir, 'ffmpeg', 'bin'),
  );
} else {
  copyAllChildren(
    resolve(binHelperSourceRootDir, 'ffmpeg'),
    resolve(binHelperDestRootDir, 'ffmpeg'),
  );
}
console.log('ffmpeg file is copied');
