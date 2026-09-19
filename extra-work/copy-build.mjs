'use strict';
/* eslint-disable */
import { copyFileSync, existsSync, mkdirSync, unlinkSync } from 'node:fs';
import { join, resolve } from 'node:path';

import {
  genBinFileName,
  getFileSuffix,
  getOsName,
  systemUtils,
} from './buildPlatformHelpers.mjs';

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

function copyFile(basePath, fileFullName, destFileFullName) {
  if (!existsSync(basePath.destination)) {
    mkdirSync(basePath.destination, { recursive: true });
  }
  const destFilePath = join(basePath.destination, destFileFullName);
  if (existsSync(destFilePath)) unlinkSync(destFilePath);
  copyFileSync(join(basePath.source, fileFullName), destFilePath);
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
// solve YouTube's nsig challenges) are deliberately NOT copied in here: they are
// ~36 MB per platform that only the media-download flow ever runs, so they ship
// as a separately downloaded pack instead. See extra-work/build-extra-bin.mjs
// (builds the pack) and src/helper/extra-bin/ (installs and resolves it).

const basePath = {
  source: resolve('./extra-work/db-exts'),
  destination: resolve('./electron-build/db-exts'),
};
['fts5', 'spellfix1'].forEach((baseName) => {
  const { sourceFileName, destFileName } = genLibFileName(baseName);
  copyFile(basePath, sourceFileName, destFileName);
});
console.log('"db-exts" files are copied');
