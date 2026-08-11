'use strict';
/* eslint-disable */
// Platform resolution shared by `copy-build.mjs` (what goes INTO the package) and
// `build-extra-bin.mjs` (what goes into the separately downloaded media pack).
// They must agree exactly on the platform directory name and on how a
// version-stamped file name is found, or a package and its pack can silently
// come from different builds.
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import process from 'node:process';

const { platform, arch } = process;

export const systemUtils = {
  isWindows: platform === 'win32',
  isMac: platform === 'darwin',
  isLinux: platform === 'linux',
  is64System: process.env.FORCE_ARCH_32 == 'true' ? false : arch === 'x64',
  isArm64: arch === 'arm64',
  isMacUniversal: process.env.FORCE_UNIVERSAL == 'true',
};

export function getFileSuffix() {
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

export function getOsName() {
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

export function getPlatformDirName() {
  return `${getOsName()}${getFileSuffix()}`;
}

/**
 * Where the committed, source-built media binaries for THIS platform live. Only
 * some platform dirs exist (there is no `win-i386` or `linux-arm64` today), so
 * callers must handle a missing directory rather than assume it is there.
 */
export function getPrebuiltSourceDir() {
  return resolve('./extra-work/experiment-building', getPlatformDirName());
}

export function genBinFileName(baseName, isWithoutSuffix = false) {
  const ext = systemUtils.isWindows ? '.exe' : '';
  return {
    sourceFileName: `${baseName}${isWithoutSuffix ? '' : getFileSuffix()}${ext}`,
    destFileName: `${baseName}${ext}`,
  };
}

export function checkIsFile(filePath) {
  const stats = existsSync(filePath) ? statSync(filePath) : null;
  return stats && stats.isFile();
}

// Find a file by name prefix. Used for binaries whose committed file name is
// version/arch stamped (e.g. qjs-2026-06-04-arm64-minimal.exe) so a version bump
// does not need an edit here.
export function findFileFullNameByPrefix(dirPath, prefix, hint = '') {
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
