import { beforeEach, describe, expect, test, vi } from 'vitest';

// One module instance for the whole file, on purpose: the legacy sweep and
// the data-version memo are SESSION state, so each test keeps to its own
// language codes and only the first test may see the sweep.
const h = vi.hoisted(() => {
    return {
        fileMap: new Map<string, string>(),
        createDirError: null as (Error & { code?: string }) | null,
        readNullPathSet: new Set<string>(),
        writeError: null as Error | null,
        brokenLangSet: new Set<string>(['zz']),
        beforeLock: null as ((key: string) => void) | null,
        lockKeyList: [] as string[],
        isIndexBuilt: true,
        isNeedlesBuilt: true,
        needlesCallList: [] as [string, string[]][],
        buildCount: 0,
        selectedLangCode: 'en',
        handleError: vi.fn(),
    };
});

vi.mock('../server/appProvider', () => {
    return { default: { appInfo: { version: '2.0.0' } } };
});
vi.mock('../helper/errorHelpers', () => {
    return { handleError: h.handleError };
});
vi.mock('../server/fileHelpers', () => {
    return {
        fsCheckFileExist: async (filePath: string) => {
            return h.fileMap.has(filePath);
        },
        fsCreateDir: async () => {
            if (h.createDirError !== null) {
                throw h.createDirError;
            }
        },
        fsDeleteFile: async (filePath: string) => {
            h.fileMap.delete(filePath);
        },
        fsReadFile: async (filePath: string) => {
            if (h.readNullPathSet.has(filePath)) {
                return null;
            }
            return h.fileMap.get(filePath) ?? null;
        },
        fsWriteFile: async (filePath: string, text: string) => {
            if (h.writeError !== null) {
                throw h.writeError;
            }
            h.fileMap.set(filePath, text);
            return filePath;
        },
        pathJoin: (...pathList: string[]) => {
            return pathList.join('/');
        },
    };
});
vi.mock('../setting/directory-setting/appLocalStorage', () => {
    return { appLocalStorage: { defaultStorageDirPath: '/data' } };
});
vi.mock('../server/unlockingHelpers', () => {
    return {
        unlocking: async (key: string, callback: () => Promise<unknown>) => {
            h.lockKeyList.push(key);
            h.beforeLock?.(key);
            return await callback();
        },
    };
});
vi.mock('../lang/langHelpers', () => {
    return {
        DEFAULT_LANG_CODE: 'en',
        getLangDataByCodeAsync: async (langCode: string) => {
            if (h.brokenLangSet.has(langCode)) {
                throw new Error(`no package ${langCode}`);
            }
            return {
                packageDir: `/pkg/${langCode}`,
                getLookupDataVersion: async () => {
                    return { namesMap: 7, locationsMap: 8 };
                },
            };
        },
    };
});
vi.mock('./lookupLangHelpers', () => {
    return {
        getSelectedLookupLangCode: () => {
            return h.selectedLangCode;
        },
        subscribeLookupLangCode: () => {
            return () => {};
        },
    };
});
vi.mock('./verseTextIndexBuilder', async () => {
    const { LOOKUP_TEXT_INDEX_VERSION } = (await vi.importActual(
        './verseTextIndexTypes',
    )) as { LOOKUP_TEXT_INDEX_VERSION: number };
    return {
        buildLookupTextIndex: async (labelsLangCode: string) => {
            h.buildCount += 1;
            if (!h.isIndexBuilt) {
                return null;
            }
            return {
                index: {
                    version: LOOKUP_TEXT_INDEX_VERSION,
                    ids: ['id-1', 'id-2'],
                    names: {},
                    locations: {},
                    verseNames: {},
                    verseLocations: {},
                },
                recordLabels: {
                    version: LOOKUP_TEXT_INDEX_VERSION,
                    labels: [`one-${labelsLangCode}`, `two-${labelsLangCode}`],
                    types: ['person', 'city'],
                    titles: ['', ''],
                    kjvNames: ['', ''],
                },
            };
        },
        buildLookupTextNeedles: async (langCode: string, idList: string[]) => {
            h.needlesCallList.push([langCode, idList]);
            if (!h.isNeedlesBuilt) {
                return null;
            }
            return {
                version: LOOKUP_TEXT_INDEX_VERSION,
                needles: [`needle-${langCode}`],
            };
        },
    };
});

import {
    loadLookupRecordLabelsFile,
    loadLookupTextIndexFile,
    loadLookupTextNeedlesFile,
} from './lookupIndexFileHelpers';
import { LOOKUP_TEXT_INDEX_VERSION } from './verseTextIndexTypes';

const DIR = '/data/lookup-data';
const INDEX_PATH = `${DIR}/verse-text-index.json`;
const LEGACY_PATH = `${DIR}/verse-record-labels.json`;

function genEnvelope(value: unknown, dataVersion = '7-8') {
    return JSON.stringify({
        _cachingTime: 1,
        _appVersion: '2.0.0',
        _dataVersion: dataVersion,
        value,
    });
}

function readEnvelope(filePath: string) {
    return JSON.parse(h.fileMap.get(filePath) ?? 'null');
}

async function flushSweep() {
    // The sweep is fire-and-forget; let its two awaits land.
    for (let index = 0; index < 5; index++) {
        await Promise.resolve();
    }
}

beforeEach(() => {
    h.fileMap.clear();
    h.createDirError = null;
    h.readNullPathSet.clear();
    h.writeError = null;
    h.beforeLock = null;
    h.lockKeyList = [];
    h.isIndexBuilt = true;
    h.isNeedlesBuilt = true;
    h.needlesCallList = [];
    h.buildCount = 0;
    h.selectedLangCode = 'en';
});

describe('derived lookup files on a session-long module', () => {
    // Must stay the FIRST test: the sweep runs once per session.
    test('sweeps the legacy sidecar once, and never again that session', async () => {
        h.fileMap.set(LEGACY_PATH, 'stale');
        await loadLookupTextIndexFile();
        await flushSweep();
        expect(h.fileMap.has(LEGACY_PATH)).toBe(false);
        h.fileMap.set(LEGACY_PATH, 'stale again');
        await loadLookupTextIndexFile();
        await flushSweep();
        expect(h.fileMap.get(LEGACY_PATH)).toBe('stale again');
    });

    test('English bibles need no needles file at all', async () => {
        expect(await loadLookupTextNeedlesFile('en')).toBeNull();
        expect(h.fileMap.size).toBe(0);
        expect(h.lockKeyList).toEqual([]);
    });

    test('a needles file is built from the index ids, stamped, then reused', async () => {
        const needles = await loadLookupTextNeedlesFile('xx');
        expect(needles).toEqual({
            version: LOOKUP_TEXT_INDEX_VERSION,
            needles: ['needle-xx'],
        });
        // No index on disk yet, so it was built first and its ids handed on.
        expect(h.buildCount).toBe(1);
        expect(h.needlesCallList).toEqual([['xx', ['id-1', 'id-2']]]);
        expect(h.lockKeyList).toEqual([
            'lookup-verse-text-index-needles-xx',
            'lookup-verse-text-index',
        ]);
        const written = readEnvelope(`${DIR}/verse-text-needles-xx.json`);
        expect(written).toMatchObject({
            _appVersion: '2.0.0',
            _dataVersion: '7-8',
            value: { needles: ['needle-xx'] },
        });

        expect(await loadLookupTextNeedlesFile('xx')).toEqual(needles);
        expect(h.needlesCallList).toHaveLength(1);
        expect(h.buildCount).toBe(1);
    });

    test('needles another loader wrote while this one waited are used as is', async () => {
        const otherNeedles = {
            version: LOOKUP_TEXT_INDEX_VERSION,
            needles: ['written-by-the-winner'],
        };
        h.beforeLock = (key) => {
            if (key.endsWith('-needles-yy')) {
                h.fileMap.set(
                    `${DIR}/verse-text-needles-yy.json`,
                    genEnvelope(otherNeedles),
                );
            }
        };
        expect(await loadLookupTextNeedlesFile('yy')).toEqual(otherNeedles);
        expect(h.needlesCallList).toEqual([]);
        expect(h.buildCount).toBe(0);
    });

    test('no index, or a builder with no needles, writes no needles file', async () => {
        h.isIndexBuilt = false;
        expect(await loadLookupTextNeedlesFile('de')).toBeNull();
        expect(h.needlesCallList).toEqual([]);

        h.isIndexBuilt = true;
        h.isNeedlesBuilt = false;
        expect(await loadLookupTextNeedlesFile('es')).toBeNull();
        expect(h.needlesCallList).toEqual([['es', ['id-1', 'id-2']]]);
        expect(h.fileMap.has(`${DIR}/verse-text-needles-es.json`)).toBe(false);
    });

    test('a data folder that cannot be made yields nothing and is reported', async () => {
        const failure = Object.assign(new Error('permission denied'), {
            code: 'EACCES',
        });
        h.createDirError = failure;
        expect(await loadLookupTextIndexFile()).toBeNull();
        expect(await loadLookupTextNeedlesFile('xx')).toBeNull();
        expect(h.handleError).toHaveBeenCalledTimes(2);
        expect(h.handleError).toHaveBeenCalledWith(failure);
        expect(h.buildCount).toBe(0);
    });

    test('a data folder that already exists is not an error', async () => {
        h.createDirError = Object.assign(new Error('exists'), {
            code: 'EEXIST',
        });
        expect((await loadLookupTextIndexFile())?.ids).toEqual([
            'id-1',
            'id-2',
        ]);
        h.createDirError = new Error('Cannot create: file already exists');
        expect((await loadLookupTextIndexFile())?.ids).toEqual([
            'id-1',
            'id-2',
        ]);
        expect(h.handleError).not.toHaveBeenCalled();
    });

    test('a corrupted or unreadable index is rebuilt', async () => {
        h.fileMap.set(INDEX_PATH, '{not json');
        expect((await loadLookupTextIndexFile())?.ids).toEqual([
            'id-1',
            'id-2',
        ]);
        expect(h.buildCount).toBe(1);
        // Reported, and only ever as the parse failure it is.
        expect(h.handleError).toHaveBeenCalled();
        for (const [error] of h.handleError.mock.calls) {
            expect(error).toBeInstanceOf(SyntaxError);
        }
        const reportCount = h.handleError.mock.calls.length;

        // On disk, but the read comes back empty-handed: no error, a rebuild.
        h.readNullPathSet.add(INDEX_PATH);
        expect((await loadLookupTextIndexFile())?.ids).toEqual([
            'id-1',
            'id-2',
        ]);
        expect(h.buildCount).toBe(2);
        expect(h.handleError).toHaveBeenCalledTimes(reportCount);
    });

    test('a write that fails is reported and the built value still returned', async () => {
        const failure = new Error('disk full');
        h.writeError = failure;
        const labels = await loadLookupRecordLabelsFile();
        expect(labels?.labels).toEqual(['one-en', 'two-en']);
        // Both files of the pair were attempted.
        expect(h.handleError).toHaveBeenCalledTimes(2);
        expect(h.handleError).toHaveBeenCalledWith(failure);
        expect(h.fileMap.size).toBe(0);
    });

    test('a build that yields nothing returns null and writes nothing', async () => {
        h.isIndexBuilt = false;
        expect(await loadLookupTextIndexFile()).toBeNull();
        expect(h.buildCount).toBe(1);
        expect(h.fileMap.has(INDEX_PATH)).toBe(false);
    });

    test('an index another loader wrote while this one waited is not rebuilt', async () => {
        const otherIndex = {
            version: LOOKUP_TEXT_INDEX_VERSION,
            ids: ['from-the-winner'],
            names: {},
            locations: {},
            verseNames: {},
            verseLocations: {},
        };
        h.beforeLock = (key) => {
            if (key === 'lookup-verse-text-index') {
                h.fileMap.set(INDEX_PATH, genEnvelope(otherIndex));
            }
        };
        expect((await loadLookupTextIndexFile())?.ids).toEqual([
            'from-the-winner',
        ]);
        expect(h.buildCount).toBe(0);
    });

    test('a language package whose version cannot be read counts as unknown', async () => {
        h.selectedLangCode = 'zz';
        const labels = await loadLookupRecordLabelsFile();
        expect(labels?.labels).toEqual(['one-zz', 'two-zz']);
        expect(h.handleError).toHaveBeenCalledWith(
            expect.objectContaining({ message: 'no package zz' }),
        );
        expect(
            readEnvelope(`${DIR}/verse-record-labels-zz.json`)._dataVersion,
        ).toBe('');
        // The English index keeps English's own version.
        expect(readEnvelope(INDEX_PATH)._dataVersion).toBe('7-8');
    });
});
