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
function genBinFileName(baseName) {
  let ext = '';
  if (systemUtils.isWindows) {
    ext = '.exe';
  }
  return {
    sourceFileName: `${baseName}${fileSuffix}${ext}`,
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
const binHelperSourceDistRootDir = resolve(`${binHelperSourceRootDir}/dist`);
const binHelperDestRootDir = resolve('./electron-build/bin-helper');

copyFile(
  {
    source: binHelperSourceRootDir,
    destination: resolve(binHelperDestRootDir, 'ms-helpers'),
  },
  'PptxToHtml.dll',
  'PptxToHtml.dll',
);
console.log('"PptxToHtml.dll" is copied');

const {
  sourceFileName: eot2ttfSourceFileName,
  destFileName: eot2ttfDestFileName,
} = genBinFileName('eot2ttf');
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

copyAllChildren(
  resolve(binHelperSourceDistRootDir, 'net8.0'),
  resolve(binHelperDestRootDir, 'ms-helpers'),
);
console.log('"MSHelpers" files are copied');

copyAllChildren(
  resolve(binHelperSourceDistRootDir, `bin${fileSuffix}`),
  resolve(binHelperDestRootDir, 'dotnet-bin'),
);
console.log('"dotnet-bin" files are copied');

const { sourceFileName: ytSourceFileName, destFileName: ytDestFileName } =
  genBinFileName('yt-dlp');
copyFile(
  {
    source: resolve(binHelperSourceDistRootDir, 'yt'),
    destination: resolve(binHelperDestRootDir, 'yt'),
  },
  ytSourceFileName,
  ytDestFileName,
);
console.log('"yt-dlp" files are copied');

// TODO: copy only needed files
copyAllChildren(
  resolve('./node_modules/node-api-dotnet'),
  resolve(binHelperDestRootDir, 'node-api-dotnet'),
);
console.log('"node-api-dotnet" files are copied');

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
    resolve(binHelperSourceDistRootDir, 'ffmpeg'),
    resolve(binHelperDestRootDir, 'ffmpeg'),
  );
}
console.log('"ffmpeg" files are copied');

const { sourceFileName: denoSourceFileName, destFileName: denoDestFileName } =
  genBinFileName('deno');
try {
  copyFile(
    {
      source: resolve(binHelperSourceDistRootDir, 'deno'),
      destination: resolve(binHelperDestRootDir, 'deno'),
    },
    denoSourceFileName,
    denoDestFileName,
  );
  console.log('"deno" files are copied');
} catch (error) {
  console.error('Failed to copy "deno" files:', error);
}

const basePath = {
  source: resolve('./extra-work/db-exts'),
  destination: resolve('./electron-build/db-exts'),
};
['fts5', 'spellfix1'].forEach((baseName) => {
  const { sourceFileName, destFileName } = genLibFileName(baseName);
  copyFile(basePath, sourceFileName, destFileName);
});
console.log('"db-exts" files are copied');
