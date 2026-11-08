import { beforeEach, describe, expect, it, vi } from 'vitest';

const { state } = vi.hoisted(() => ({
    state: {
        settings: new Map<string, string>(),
        isOnOwnFolder: false,
    },
}));

vi.mock('../helper/settingHelpers', () => ({
    getSetting: (name: string) => state.settings.get(name) ?? null,
    setSetting: (name: string, value: string) => {
        state.settings.set(name, value);
    },
}));
vi.mock('../helper/DirSource', () => ({
    default: {
        getDirPathBySettingName: (settingName: string) => {
            if (state.isOnOwnFolder) {
                return null;
            }
            return state.settings.get(settingName) || null;
        },
    },
}));
vi.mock('../server/fileHelpers', () => ({
    pathDirname: (filePath: string) => {
        return filePath.slice(0, filePath.lastIndexOf('\\'));
    },
    pathResolve: (dirPath: string) => dirPath.replace(/\\+$/, ''),
    pathSeparator: '\\',
}));

import { pickActiveSession, resolveActiveSessionId } from './mediaSessionData';
import {
    FOLDER_SESSION_BASE_NAMES,
    getActiveDirSourceSettingName,
    toSessionDirSourceSettingName,
    toSessionDirSourceSettingNameFromParam,
} from './folderSessionHelpers';
import {
    findNonDefaultSessionIdByFilePath,
    findSessionIdByFilePath,
} from './folderSessionPathHelpers';

const BASE = 'select-dir-app-document';

function setSessions(sessions: { id: string; name: string }[], active = '') {
    state.settings.set(`${BASE}-sessions`, JSON.stringify(sessions));
    state.settings.set(`${BASE}-active-session`, active);
}

beforeEach(() => {
    state.settings.clear();
    state.isOnOwnFolder = false;
});

describe('the active session of a list', () => {
    it('is the stored one while it exists, else the first', () => {
        const sessions = [
            { id: '', name: 'Default' },
            { id: 's1', name: 'Easter' },
        ];
        expect(pickActiveSession(sessions, 's1').id).toBe('s1');
        expect(pickActiveSession(sessions, 'gone').id).toBe('');
        // Nothing stored at all: Default, as before sessions existed.
        expect(resolveActiveSessionId(BASE)).toBe('');
        setSessions(sessions, 's1');
        expect(resolveActiveSessionId(BASE)).toBe('s1');
        // A session removed in another window leaves a stale id behind.
        setSessions([{ id: '', name: 'Default' }], 's1');
        expect(resolveActiveSessionId(BASE)).toBe('');
    });

    it("names its folder setting, Default keeping the list's own key", () => {
        expect(toSessionDirSourceSettingName(BASE, '')).toBe(BASE);
        expect(toSessionDirSourceSettingName(BASE, 's1')).toBe(`${BASE}-s1`);
        expect(getActiveDirSourceSettingName(BASE)).toBe(BASE);
        setSessions(
            [
                { id: '', name: 'Default' },
                { id: 's1', name: 'Easter' },
            ],
            's1',
        );
        expect(getActiveDirSourceSettingName(BASE)).toBe(`${BASE}-s1`);
        // A key with no session list -- a media folder -- is itself.
        expect(getActiveDirSourceSettingName('select-dir-image-bg')).toBe(
            'select-dir-image-bg',
        );
    });

    it('covers the four lists, the Reader keeping its Bibles apart', () => {
        expect(FOLDER_SESSION_BASE_NAMES).toEqual([
            'select-dir-app-document',
            'select-dir-presenting-flow',
            'select-dir-bible-presenter',
            'select-dir-bible-read',
            'select-dir-bible-notes',
        ]);
    });
});

describe("an editor window's session", () => {
    it('reads the session its opener named while it still exists', () => {
        setSessions([
            { id: '', name: 'Default' },
            { id: 's1', name: 'Easter' },
        ]);
        expect(toSessionDirSourceSettingNameFromParam(BASE, 's1')).toBe(
            `${BASE}-s1`,
        );
        expect(toSessionDirSourceSettingNameFromParam(BASE, null)).toBe(BASE);
        expect(toSessionDirSourceSettingNameFromParam(BASE, '')).toBe(BASE);
        // Removed since the window was opened: the list's own folder.
        expect(toSessionDirSourceSettingNameFromParam(BASE, 's9')).toBe(BASE);
    });

    it('finds which session holds a file by its folder, the active one first', () => {
        setSessions(
            [
                { id: '', name: 'Default' },
                { id: 's1', name: 'Easter' },
                { id: 's2', name: 'Same folder' },
            ],
            's2',
        );
        state.settings.set(BASE, 'C:\\data\\documents');
        state.settings.set(`${BASE}-s1`, 'D:\\Easter\\');
        state.settings.set(`${BASE}-s2`, 'd:\\easter');
        // Windows paths compare without case and without a trailing slash;
        // two sessions on one folder answer the one being looked at.
        expect(findSessionIdByFilePath(BASE, 'D:\\Easter\\song.owl')).toBe(
            's2',
        );
        expect(
            findSessionIdByFilePath(BASE, 'C:\\data\\documents\\a.ows'),
        ).toBe('');
        expect(findSessionIdByFilePath(BASE, 'E:\\elsewhere\\a.ows')).toBe(
            null,
        );
        expect(
            findNonDefaultSessionIdByFilePath(
                BASE,
                'C:\\data\\documents\\a.ows',
            ),
        ).toBe(null);
        expect(
            findNonDefaultSessionIdByFilePath(BASE, 'D:\\Easter\\song.owl'),
        ).toBe('s2');
        // A session with no folder yet holds nothing.
        state.settings.delete(`${BASE}-s2`);
        state.settings.delete(`${BASE}-s1`);
        expect(findSessionIdByFilePath(BASE, 'D:\\Easter\\song.owl')).toBe(
            null,
        );
    });
});
