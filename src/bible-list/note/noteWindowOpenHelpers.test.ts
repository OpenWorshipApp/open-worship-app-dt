import { beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    sessionId: null as string | null,
    openPopup: vi.fn(),
}));

vi.mock('../../server/appProvider', () => ({
    default: { bibleNoteHomePage: '/bibleNote.html' },
}));
vi.mock('../../helper/constants', () => ({
    dirSourceSettingNames: { BIBLE_NOTES: 'bible-notes' },
}));
vi.mock('../../helper/domHelpers', () => {
    const setParam = (page: string, key: string, value: string) => {
        const url = new URL(page, 'http://localhost');
        url.searchParams.set(key, value);
        return `${url.pathname}${url.search}`;
    };
    return {
        openPopupWindow: h.openPopup,
        setParamFileFullName: (page: string, name: string) => {
            return setParam(page, 'file', name);
        },
        setParamIdNum: (page: string, id: number) => {
            return setParam(page, 'id', String(id));
        },
        setParamKeyValue: setParam,
    };
});
vi.mock('../../media-sessions/folderSessionHelpers', () => ({
    SESSION_URL_PARAM_NAME: 'session',
}));
vi.mock('../../media-sessions/folderSessionPathHelpers', () => ({
    findNonDefaultSessionIdByFilePath: (settingName: string) => {
        return settingName === 'bible-notes' ? h.sessionId : null;
    },
}));

import { genNoteWindowPathname, openNoteWindow } from './noteWindowOpenHelpers';

beforeEach(() => {
    h.sessionId = null;
    h.openPopup.mockReset();
});

describe('a note in its own window', () => {
    test('its file and id; a Bible Notes session that is not the default', () => {
        expect(
            genNoteWindowPathname('Default.own', 'C:\\n\\Default.own', 8),
        ).toBe('/bibleNote.html?file=Default.own&id=8');
        h.sessionId = 's2';
        expect(genNoteWindowPathname('Study.own', 'D:\\s2\\Study.own', 0)).toBe(
            '/bibleNote.html?file=Study.own&id=0&session=s2',
        );
    });

    test('opened as a note row opens it: its own frame, 870 wide', () => {
        openNoteWindow('Default.own', 'C:\\n\\Default.own', 8);
        expect(h.openPopup).toHaveBeenCalledWith(
            '/bibleNote.html?file=Default.own&id=8',
            expect.stringMatching(/^Default\.own-8_\d+$/),
            expect.any(String),
            { width: 870 },
        );
    });
});
