// Which files `owa_drop_files` may drop into the app (2026-10-22).
//
// A drop COPIES what it carries into the user's folders -- a picture into
// Images, a song into Documents, a folder onto the Resources list -- so the
// files a caller may hand over are fixtures, never anything else on the disk:
// the repository's own gitignored `test-results/` (where a robot run keeps
// its scratch) and the system's temp folder (where an agent's scratch is).
// Everything is resolved first and checked again after following links, so
// a link out of a fixture folder is not a way round it.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const MAX_DROP_FILE_COUNT = 20;

const REPO_ROOT = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    '..',
    '..',
);

/** The folders a dropped file has to be in. */
export function getDropFileRootList() {
    return [path.join(REPO_ROOT, 'test-results'), os.tmpdir()];
}

function toCompareKey(filePath, platform) {
    const resolved = path.resolve(filePath);
    // Windows and macOS file systems are case-insensitive by default.
    return platform === 'linux' ? resolved : resolved.toLowerCase();
}

/** Is `filePath` the root itself or anything under it? */
export function checkIsUnderRoot(
    filePath,
    rootPath,
    platform = process.platform,
) {
    const fileKey = toCompareKey(filePath, platform);
    const rootKey = toCompareKey(rootPath, platform);
    if (fileKey === rootKey) {
        return true;
    }
    const withSeparator = rootKey.endsWith(path.sep)
        ? rootKey
        : rootKey + path.sep;
    return fileKey.startsWith(withSeparator);
}

/**
 * The paths as the drop will carry them, or the sentence saying why not.
 * `fileSystem` and `rootList` are seams for the tests.
 */
export function checkDropFilePaths(
    pathList,
    {
        rootList = getDropFileRootList(),
        fileSystem = fs,
        platform = process.platform,
    } = {},
) {
    if (!Array.isArray(pathList) || pathList.length === 0) {
        return { refusal: 'Pass at least one file or folder to drop.' };
    }
    if (pathList.length > MAX_DROP_FILE_COUNT) {
        return {
            refusal:
                `Drop at most ${MAX_DROP_FILE_COUNT} files at a time; ` +
                `${pathList.length} were passed.`,
        };
    }
    const resolvedList = [];
    for (const filePath of pathList) {
        if (typeof filePath !== 'string' || !path.isAbsolute(filePath)) {
            return {
                refusal: `Give each file as an absolute path: ${filePath}`,
            };
        }
        let realPath;
        try {
            realPath = fileSystem.realpathSync(filePath);
        } catch {
            return { refusal: `There is no file or folder at ${filePath}` };
        }
        const isInRoot = rootList.some((rootPath) => {
            let realRoot = rootPath;
            try {
                realRoot = fileSystem.realpathSync(rootPath);
            } catch {
                // A root that is not there yet still bounds the path.
            }
            return (
                checkIsUnderRoot(filePath, rootPath, platform) &&
                checkIsUnderRoot(realPath, realRoot, platform)
            );
        });
        if (!isInRoot) {
            return {
                refusal:
                    `Only test fixtures can be dropped -- files under ` +
                    `${rootList.join(' or ')}. ${filePath} is not.`,
            };
        }
        resolvedList.push(realPath);
    }
    return { pathList: resolvedList };
}
