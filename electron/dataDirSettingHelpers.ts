import fs from 'node:fs';
import path from 'node:path';

import {
    checkIsDataDirSettingName,
    DATA_DIR_LOCAL_STORAGE_FOLDER_NAME,
} from './dataDirSettingProtocol';

// Short-lived, like the renderer's own (`appLocalStorage`): the Screen Mirror
// asks some of these per connection, and a file read each time is a disk read
// a viewer's every request would wait on. Keyed by the whole path, so another
// data folder never answers from this one's; every write here updates it.
const CACHE_MILLISECONDS = 2000;
const cache = new Map<string, { value: string | null; at: number }>();

function remember(filePath: string, value: string | null) {
    const now = Date.now();
    // Bounded by the list's keys times the folders read in two seconds:
    // whatever has lapsed goes before a new entry comes in.
    for (const [key, entry] of cache) {
        if (now - entry.at > CACHE_MILLISECONDS) {
            cache.delete(key);
        }
    }
    cache.set(filePath, { value, at: now });
}

export function toDataDirSettingPath(dataDirPath: string, key: string) {
    return path.join(dataDirPath, DATA_DIR_LOCAL_STORAGE_FOLDER_NAME, key);
}

/** The setting's text, or null when the folder has none. */
export function readDataDirSettingFile(filePath: string): string | null {
    const cached = cache.get(filePath);
    if (cached !== undefined && Date.now() - cached.at <= CACHE_MILLISECONDS) {
        return cached.value;
    }
    let value: string | null = null;
    try {
        value = fs.readFileSync(filePath, 'utf8');
    } catch (error: any) {
        if (error?.code !== 'ENOENT') {
            console.log('Error reading a data folder setting', error);
        }
    }
    remember(filePath, value);
    return value;
}

/**
 * Written whole or not at all: every window reads these files, and the
 * renderer writes its own the same way (`fsWriteFileAtomicSync`).
 */
export function writeDataDirSettingFile(filePath: string, value: string) {
    try {
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        const tempPath = `${filePath}.${process.pid}.tmp`;
        fs.writeFileSync(tempPath, value, 'utf8');
        fs.renameSync(tempPath, filePath);
        remember(filePath, value);
        return true;
    } catch (error) {
        console.log('Error saving a data folder setting', error);
        return false;
    }
}

export function deleteDataDirSettingFile(filePath: string) {
    try {
        fs.unlinkSync(filePath);
    } catch (error: any) {
        if (error?.code !== 'ENOENT') {
            console.log('Error removing a data folder setting', error);
        }
    }
    remember(filePath, null);
}

/** Which of the list's settings the data folder holds. */
export function listDataDirSettingNames(dataDirPath: string): string[] {
    try {
        return fs
            .readdirSync(
                path.join(dataDirPath, DATA_DIR_LOCAL_STORAGE_FOLDER_NAME),
            )
            .filter((name) => {
                return checkIsDataDirSettingName(name);
            });
    } catch (_error) {
        return [];
    }
}

/** For tests: nothing here may outlive one. */
export function forgetDataDirSettingCache() {
    cache.clear();
}
