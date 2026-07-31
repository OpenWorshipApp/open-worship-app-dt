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

function getFileSuffix() {
  let suffix = '';
  if (systemUtils.isMac) {
    if (systemUtils.isMacUniversal || !systemUtils.isArm64) {
      suffix = '-int';
    }
  } else {
    if (systemUtils.isArm64) {
      suffix = '-arm64';
    } else if (!systemUtils.is64System) {
      suffix = '-i386';
    }
  }
  return suffix;
}
function getOsName() {
  if (systemUtils.isWindows) {
    return 'win';
  }
  if (systemUtils.isMac) {
    return 'mac';
  }
  if (systemUtils.isLinux) {
    return 'linux';
  }
  throw new Error(`Unsupported platform: ${platform}`);
}
const fileSuffix = getFileSuffix();
function genLibFileName(baseName) {
  let ext;
  if (systemUtils.isWindows) {
    ext = 'dll';
  } else if (systemUtils.isMac) {
    ext = 'dylib';
  } else {
    ext = 'so';
  }
  return {
    sourceFileName: `${baseName}${fileSuffix}.${ext}`,
    destFileName: `${baseName}.${ext}`,
  };
}
function genBinFileName(baseName, isWithoutSuffix = false) {
  let ext = '';
  if (systemUtils.isWindows) {
    ext = '.exe';
  }
  return {
    sourceFileName: `${baseName}${isWithoutSuffix ? '' : fileSuffix}${ext}`,
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

// Find a file by name prefix. Used for binaries whose committed file name is
// version/arch stamped (e.g. qjs-2026-06-04-arm64-minimal.exe) so a version bump
// does not need an edit here.
function findFileFullNameByPrefix(dirPath, prefix, hint = '') {
  const fileFullName = existsSync(dirPath)
    ? readdirSync(dirPath).find((child) => {
        return child.startsWith(prefix) && checkIsFile(join(dirPath, child));
      })
    : null;
  if (!fileFullName) {
    throw new Error(`No "${prefix}*" file found in "${dirPath}"${hint}`);
  }
  return fileFullName;
}

function checkIsFile(filePath) {
  const stats = existsSync(filePath) ? statSync(filePath) : null;
  return stats && stats.isFile();
}
copyFile(
  {
    source: resolve('.'),
    destination: resolve('./electron-build'),
  },
  'package-lock.json',
  'package-lock.json',
);
console.log('"package-lock.json" file is copied');

const binHelperSourceRootDir = resolve('./extra-work/bin-helper');
const binHelperDestRootDir = resolve('./electron-build/bin-helper');

const {
  sourceFileName: eot2ttfSourceFileName,
  destFileName: eot2ttfDestFileName,
} = genBinFileName('eot2ttf', true);
copyFile(
  {
    source: resolve(
      binHelperSourceRootDir,
      'tools',
      `${getOsName()}${fileSuffix}`,
    ),
    destination: resolve(
      binHelperDestRootDir,
      'ms-helpers',
      'tools',
      'eot2ttf',
    ),
  },
  eot2ttfSourceFileName,
  eot2ttfDestFileName,
);
console.log('"eot2ttf" is copied');

// The media helpers (yt-dlp, its ffmpeg, and the QuickJS runtime it needs to
// solve YouTube's nsig challenges) are NOT downloaded at install time. They are
// built per platform by extra-work/experiment-building/*-build-*.{ps1,sh} and
// committed there under version/arch-stamped names, so the tree is
// self-contained and every package ships the exact binaries that were tested.
const prebuiltSourceDir = resolve(
  './extra-work/experiment-building',
  `${getOsName()}${fileSuffix}`,
);
// Deliberately NOT wrapped in try/catch: a package built without one of these
// still installs and launches, it just silently loses media downloading, so a
// missing binary must break the build right here.
function copyPrebuiltBin(baseName, destination) {
  const { destFileName } = genBinFileName(baseName);
  copyFile(
    { source: prebuiltSourceDir, destination },
    findFileFullNameByPrefix(
      prebuiltSourceDir,
      baseName,
      `. Build it on a ${getOsName()}${fileSuffix} host with ` +
        `extra-work/experiment-building/${getOsName()}-build-${baseName}.* ` +
        'and commit the result into that dir',
    ),
    destFileName,
  );
  console.log(`"${baseName}" is copied`);
}

copyPrebuiltBin('yt-dlp', resolve(binHelperDestRootDir, 'yt'));
// Dest stays a `bin` dir: electron/client/ytUtils.ts hands the DIRECTORY to
// yt-dlp's --ffmpeg-location.
copyPrebuiltBin('ffmpeg', resolve(binHelperDestRootDir, 'ffmpeg', 'bin'));
copyPrebuiltBin('qjs', resolve(binHelperDestRootDir, 'qjs'));

const basePath = {
  source: resolve('./extra-work/db-exts'),
  destination: resolve('./electron-build/db-exts'),
};
['fts5', 'spellfix1'].forEach((baseName) => {
  const { sourceFileName, destFileName } = genLibFileName(baseName);
  copyFile(basePath, sourceFileName, destFileName);
});
console.log('"db-exts" files are copied');
