'use strict';
/* eslint-disable */
/**
 * Builds the "extra-bin" pack: the media helpers (yt-dlp, its ffmpeg, and the
 * QuickJS runtime yt-dlp needs to solve YouTube's nsig challenges) as a single
 * `bin-<version>.tar.gz` the app downloads on demand.
 *
 * They used to be copied into every package by `copy-build.mjs`, which put ~36 MB
 * into every installer for a flow most users never touch. Now the release
 * publishes this tarball beside the installers and the app fetches it from
 * Settings > Others, extracting it into `<data parent dir>/extra-bin/`.
 *
 * The staged layout is EXACTLY what `src/helper/extra-bin/extraBinHelpers.tsx`
 * resolves, so the runtime paths are the same shape they always were:
 *
 *     info.json
 *     yt/yt-dlp[.exe]
 *     ffmpeg/bin/ffmpeg[.exe]      <- a DIRECTORY: yt-dlp's --ffmpeg-location
 *     qjs/qjs[.exe]
 *
 * Hooked to the `install` npm lifecycle (package.json), so it must never throw on
 * a platform we have no committed binaries for -- that would break plain
 * `npm i`. It warns and exits 0 instead.
 */
import {
  chmodSync,
  copyFileSync,
  createReadStream,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { createHash } from 'node:crypto';
import { join, resolve } from 'node:path';
import process from 'node:process';
import { create as tarCreate } from 'tar';

import {
  findFileFullNameByPrefix,
  genBinFileName,
  getPlatformDirName,
  getPrebuiltSourceDir,
  systemUtils,
} from './buildPlatformHelpers.mjs';

const EXPERIMENT_BUILDING_DIR = resolve('./extra-work/experiment-building');
const INFO_FILE_PATH = join(EXPERIMENT_BUILDING_DIR, 'info.json');
const RELEASE_DIR = join(EXPERIMENT_BUILDING_DIR, 'release');
const STAGING_DIR = join(EXPERIMENT_BUILDING_DIR, 'tmp', 'extra-bin');

// baseName -> destination directory relative to the pack root.
const BINARIES = [
  ['yt-dlp', 'yt'],
  ['ffmpeg', join('ffmpeg', 'bin')],
  ['qjs', 'qjs'],
];

/**
 * The release dir holds the pack for the arch that was built LAST, and the
 * release script globs it. Anything left from another arch (or another version)
 * would be published under the wrong platform prefix, so clearing is part of
 * every run -- including the run that produces nothing.
 */
function clearReleaseDir(keptFileFullNames = []) {
  if (!existsSync(RELEASE_DIR)) {
    return;
  }
  for (const fileFullName of readdirSync(RELEASE_DIR)) {
    if (
      fileFullName.startsWith('bin-') &&
      !keptFileFullNames.includes(fileFullName)
    ) {
      rmSync(join(RELEASE_DIR, fileFullName), { force: true });
    }
  }
}

function genFileStamp(filePath) {
  const stats = statSync(filePath);
  return { filePath, size: stats.size, mtimeMs: stats.mtimeMs };
}

function genChecksum(filePath) {
  return new Promise((resolve_, reject) => {
    const hash = createHash('sha512');
    const stream = createReadStream(filePath);
    stream.on('error', reject);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve_(hash.digest('hex')));
  });
}

async function main() {
  const platformDirName = getPlatformDirName();
  const sourceDir = getPrebuiltSourceDir();
  if (!existsSync(sourceDir)) {
    // Not an error: only some platforms have committed binaries, and this runs
    // on every `npm i`. Still clear the dir -- publishing another arch's pack
    // under this platform's prefix would be worse than publishing none.
    clearReleaseDir();
    console.warn(
      `No prebuilt media binaries for "${platformDirName}" ` +
        `("${sourceDir}" does not exist); skipping the extra-bin pack.`,
    );
    return;
  }

  const { version } = JSON.parse(readFileSync(INFO_FILE_PATH, 'utf-8'));
  if (!version) {
    throw new Error(`No "version" in "${INFO_FILE_PATH}"`);
  }

  const sources = BINARIES.map(([baseName, destDirName]) => {
    const fileFullName = findFileFullNameByPrefix(
      sourceDir,
      baseName,
      `. Build it on a ${platformDirName} host with ` +
        `extra-work/experiment-building/*-build-${baseName}.* ` +
        'and commit the result into that dir',
    );
    return {
      baseName,
      destDirName,
      fileFullName,
      filePath: join(sourceDir, fileFullName),
    };
  });

  const outFileFullName = `bin-${version}.tar.gz`;
  const outFilePath = join(RELEASE_DIR, outFileFullName);
  const stampFilePath = `${outFilePath}.stamp.json`;
  const stamp = {
    version,
    platformDirName,
    sources: [
      ...sources.map(({ filePath }) => genFileStamp(filePath)),
      genFileStamp(INFO_FILE_PATH),
    ],
  };

  // `npm i` runs often (`release:version` runs it too) and re-gzipping ~36 MB
  // every time is minutes of pure waste. The stamp carries `platformDirName` so
  // building a second arch in the same tree still rebuilds.
  if (existsSync(outFilePath) && existsSync(stampFilePath)) {
    const previousStamp = readFileSync(stampFilePath, 'utf-8');
    if (previousStamp === JSON.stringify(stamp, null, 2)) {
      console.log(`"${outFileFullName}" is up to date`);
      return;
    }
  }

  rmSync(STAGING_DIR, { recursive: true, force: true });
  mkdirSync(STAGING_DIR, { recursive: true });
  for (const { baseName, destDirName, filePath } of sources) {
    const { destFileName } = genBinFileName(baseName);
    const destDirPath = join(STAGING_DIR, destDirName);
    mkdirSync(destDirPath, { recursive: true });
    const destFilePath = join(destDirPath, destFileName);
    copyFileSync(filePath, destFilePath);
    if (!systemUtils.isWindows) {
      // `copyFileSync` preserves the mode and git tracks the exec bit, but a
      // pack whose binaries are not executable extracts into an app that fails
      // with EACCES while the settings panel still reads "installed".
      chmodSync(destFilePath, 0o755);
    }
    console.log(`"${baseName}" is staged`);
  }
  writeFileSync(
    join(STAGING_DIR, 'info.json'),
    JSON.stringify(
      {
        version,
        platform: platformDirName,
        builtAt: new Date().toISOString(),
        binaries: Object.fromEntries(
          sources.map(({ baseName, fileFullName }) => [baseName, fileFullName]),
        ),
      },
      null,
      2,
    ),
  );

  mkdirSync(RELEASE_DIR, { recursive: true });
  clearReleaseDir([
    outFileFullName,
    `${outFileFullName}.stamp.json`,
    'bin-info.json',
  ]);

  // Write through a temp name: an interrupted install must not leave a
  // truncated archive behind for the release script to happily ship.
  const tempOutFilePath = `${outFilePath}.tmp`;
  rmSync(tempOutFilePath, { force: true });
  await tarCreate(
    {
      cwd: STAGING_DIR,
      file: tempOutFilePath,
      gzip: true,
      // Strips uid/gid/atime but KEEPS the mode bits, which is what makes the
      // extracted binaries executable on macOS/Linux.
      portable: true,
    },
    ['info.json', 'yt', 'ffmpeg', 'qjs'],
  );
  rmSync(outFilePath, { force: true });
  renameSync(tempOutFilePath, outFilePath);
  rmSync(STAGING_DIR, { recursive: true, force: true });

  const checksum = await genChecksum(outFilePath);
  writeFileSync(
    join(RELEASE_DIR, 'bin-info.json'),
    JSON.stringify(
      { version, fileFullName: outFileFullName, checksum },
      null,
      2,
    ),
  );
  writeFileSync(stampFilePath, JSON.stringify(stamp, null, 2));

  const sizeMB = (statSync(outFilePath).size / 1024 / 1024).toFixed(1);
  console.log(`"${outFilePath}" is created (${sizeMB}MB)`);
}

main().catch((error) => {
  console.error('Error building the extra-bin pack:', error);
  process.exit(1);
});
