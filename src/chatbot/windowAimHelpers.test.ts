import { afterEach, describe, expect, it } from 'vitest';

import {
    checkIsMainWindowUrl,
    findAttachmentWindow,
    findOpenerWindowId,
    getCurrentWindowAim,
    toFocusWindowAim,
    toAttachmentWindowPage,
    toWindowPage,
    setCurrentWindowAim,
    toAimedToolArgs,
    toAppWindowList,
    toFocusOfUrl,
    toWindowAim,
    toWindowAimLabel,
} from './windowAimHelpers';

const HOST = 'https://localhost:3000';
// The user's picture: the main window on the Presenter, a Bible Reader of
// its own beside it, and this help window.
const ENTRY_LIST = [
    {
        id: 'READER-1',
        title: 'Open Worship app - Reader (📖)',
        url: `${HOST}/reader.html?uuid=reader`,
    },
    {
        id: 'CHATBOT',
        title: 'Open Worship app - Chatbot Beta (🤖)',
        url: `${HOST}/chatbot.html?uuid=chatbot`,
    },
    {
        id: 'MAIN',
        title: 'Open Worship app - Presenter (🖥️)',
        url: `${HOST}/presenter.html`,
    },
    {
        id: 'READER-2',
        title: 'Open Worship app - Reader (📖)',
        url: `${HOST}/reader.html?uuid=reader`,
    },
    {
        id: 'SCREEN',
        title: 'screen',
        url: `${HOST}/screen.html?screenId=0`,
    },
];

afterEach(() => {
    setCurrentWindowAim(null);
});

describe('toAppWindowList', () => {
    it('lists the windows help is about, the main one first, twins numbered', () => {
        const list = toAppWindowList(ENTRY_LIST);
        expect(
            list.map((item) => {
                return [item.id, item.focus, item.isMain, item.label];
            }),
        ).toEqual([
            ['MAIN', 'presenter', true, 'Presenter (🖥️) · main window'],
            ['READER-1', 'reader', false, 'Reader (📖) · own window'],
            ['READER-2', 'reader', false, 'Reader (📖) · own window 2'],
        ]);
    });

    it('names a window with no title by its kind', () => {
        expect(
            toAppWindowList([
                {
                    id: 'LYRIC',
                    title: '',
                    url: `${HOST}/lyricEditor.html?uuid=lyric-editor`,
                },
            ])[0].label,
        ).toBe('Lyric Editor · own window');
    });

    // Local Web Share is loaded by main itself, with no `uuid`, and is never
    // the main window -- taken for it, it was listed first and called "main".
    it('never takes a window of its own with no uuid for the main window', () => {
        const list = toAppWindowList([
            {
                id: 'LW-SHARE',
                title: 'Local Web Share',
                url: `${HOST}/lwShare.html`,
            },
            ...ENTRY_LIST,
        ]);
        expect(
            list.map((item) => {
                return [item.id, item.isMain];
            }),
        ).toEqual([
            ['MAIN', true],
            ['LW-SHARE', false],
            ['READER-1', false],
            ['READER-2', false],
        ]);
        expect(checkIsMainWindowUrl(`${HOST}/lwShare.html`)).toBe(false);
        expect(checkIsMainWindowUrl(`${HOST}/appDocumentEditor.html`)).toBe(
            true,
        );
        expect(checkIsMainWindowUrl(`${HOST}/chatbot.html`)).toBe(false);
    });

    // The user's story: _ask about some stuff on app-document editor page …
    // select the editor window and start interacting with it_.
    it('offers a Slide Editor of its own and aims the tools at it', () => {
        const list = toAppWindowList([
            ...ENTRY_LIST,
            {
                id: 'EDITOR',
                title: 'Open Worship app - Slide Editor (✏️)',
                url: `${HOST}/appDocumentEditor.html?file=a.ows&uuid=editor`,
            },
        ]);
        const editor = list.find((item) => {
            return item.id === 'EDITOR';
        });
        expect(editor?.label).toBe('Slide Editor (✏️) · own window');
        const aim = toWindowAim('EDITOR', list);
        expect(aim).toEqual({
            windowId: 'EDITOR',
            focus: 'appDocumentEditor',
            isSeparateWindow: true,
        });
        expect(toAimedToolArgs('owa_find_ui', { text: 'Save' }, aim).page).toBe(
            'EDITOR',
        );
    });

    it('names the chosen window in words, and the main window not at all', () => {
        const list = toAppWindowList(ENTRY_LIST);
        expect(toWindowAimLabel(toWindowAim('READER-1', list))).toBe(
            'Bible Reader',
        );
        expect(toWindowAimLabel(null)).toBeNull();
    });

    it('reads the kind of a window off its page, not its query', () => {
        expect(toFocusOfUrl(`${HOST}/appDocumentEditor.html?x=1`)).toBe(
            'appDocumentEditor',
        );
        expect(toFocusOfUrl(`${HOST}/chatbot.html`)).toBeNull();
        expect(toFocusOfUrl('not an address')).toBeNull();
    });
});

describe('toWindowAim', () => {
    const list = toAppWindowList(ENTRY_LIST);

    it('aims at a window of its own, and says a Reader there is separate', () => {
        expect(toWindowAim('READER-2', list)).toEqual({
            windowId: 'READER-2',
            focus: 'reader',
            isSeparateWindow: true,
        });
    });

    // The main window is the help's way of working as before; a closed
    // window is no aim.
    it('is no aim for the main window, none chosen, or one that has gone', () => {
        expect(toWindowAim('MAIN', list)).toBeNull();
        expect(toWindowAim(undefined, list)).toBeNull();
        expect(toWindowAim('CLOSED', list)).toBeNull();
    });

    it('does not call a window that is always its own "separate"', () => {
        const lyricList = toAppWindowList([
            {
                id: 'LYRIC',
                title: 'Lyric Editor',
                url: `${HOST}/lyricEditor.html?uuid=lyric-editor`,
            },
        ]);
        expect(toWindowAim('LYRIC', lyricList)?.isSeparateWindow).toBe(false);
    });
});

// Asking about Settings, a tab works in the Settings window: a model's
// walkthrough card names no window, and came up in the Reader.
describe('toFocusWindowAim', () => {
    const settingEntry = {
        id: 'SETTING',
        title: 'Open Worship app - Setting (⚙️)',
        url: `${HOST}/setting.html?uuid=setting`,
    };

    it('is the one open window of a popup kind', () => {
        const list = toAppWindowList([...ENTRY_LIST, settingEntry]);
        expect(toFocusWindowAim('setting', list)).toEqual({
            windowId: 'SETTING',
            focus: 'setting',
            isSeparateWindow: false,
        });
    });

    it('leaves the main window kinds, a closed one and two of a kind alone', () => {
        const list = toAppWindowList([...ENTRY_LIST, settingEntry]);
        expect(toFocusWindowAim('reader', list)).toBeNull();
        expect(toFocusWindowAim('presenter', list)).toBeNull();
        expect(toFocusWindowAim('bibleNote', list)).toBeNull();
        const twoList = toAppWindowList([
            settingEntry,
            { ...settingEntry, id: 'SETTING-2' },
        ]);
        expect(toFocusWindowAim('setting', twoList)).toBeNull();
    });
});

// Opened from Settings, the help works in Settings, not the main window.
describe('findOpenerWindowId', () => {
    const list = toAppWindowList([
        ...ENTRY_LIST,
        {
            id: 'SETTING',
            title: 'Open Worship app - Setting (⚙️)',
            url: `${HOST}/setting.html?uuid=setting`,
        },
    ]);

    it('names the window the help was opened from, by address or by path', () => {
        expect(
            findOpenerWindowId(`${HOST}/setting.html?uuid=setting`, list),
        ).toBe('SETTING');
        // A later press from it: main names its path alone.
        expect(findOpenerWindowId('/setting.html', list)).toBe('SETTING');
    });

    it('leaves the main window, and a path two windows share, on the old way', () => {
        expect(findOpenerWindowId(`${HOST}/presenter.html`, list)).toBeNull();
        expect(findOpenerWindowId('/reader.html', list)).toBeNull();
    });

    it('waits while the list does not name it yet', () => {
        expect(
            findOpenerWindowId(`${HOST}/setting.html?uuid=setting`, []),
        ).toBeUndefined();
    });
});

// The 📷 and the ◎ keep which window they were taken in, by its id for
// this launch and by its page and popup `uuid` for after it.
describe('the window an attachment is of', () => {
    const list = toAppWindowList(ENTRY_LIST);

    it('is the window the tab works in, else the main window', () => {
        expect(
            findAttachmentWindow(toWindowAim('READER-2', list), list),
        ).toEqual({
            id: 'READER-2',
            page: 'reader.html?uuid=reader',
            label: 'Bible Reader',
            isMain: false,
        });
        expect(findAttachmentWindow(null, list)).toEqual({
            id: 'MAIN',
            page: 'presenter.html',
            label: 'Presenter',
            isMain: true,
        });
        expect(findAttachmentWindow(null, [])).toBeNull();
    });

    it('is reached by its id while open, by its page after a relaunch', () => {
        const reader = findAttachmentWindow(
            toWindowAim('READER-1', list),
            list,
        )!;
        expect(toAttachmentWindowPage(reader, list)).toBe('READER-1');
        const relaunched = toAppWindowList([
            {
                id: 'NEW-MAIN',
                title: 'Open Worship app - Presenter',
                url: `${HOST}/presenter.html`,
            },
        ]);
        expect(toAttachmentWindowPage(reader, relaunched)).toBe(
            'reader.html?uuid=reader',
        );
        const main = findAttachmentWindow(null, list)!;
        expect(toAttachmentWindowPage(main, relaunched)).toBe('NEW-MAIN');
        expect(toAttachmentWindowPage(main, [])).toBeUndefined();
    });

    it('writes a page with its uuid, and a main window without one', () => {
        expect(
            toWindowPage(`${HOST}/appDocumentEditor.html?file=a.ows&uuid=x y`),
        ).toBe('appDocumentEditor.html?uuid=x%20y');
        expect(toWindowPage(`${HOST}/presenter.html`)).toBe('presenter.html');
    });
});

describe('toAimedToolArgs', () => {
    const aim = {
        windowId: 'READER-2',
        focus: 'reader' as const,
        isSeparateWindow: true,
    };

    it('sends a UI tool with no window, or the bare kind, to the chosen one', () => {
        expect(toAimedToolArgs('owa_find_ui', { text: 'Font' }, aim)).toEqual({
            text: 'Font',
            page: 'READER-2',
        });
        expect(
            toAimedToolArgs(
                'owa_click',
                { find: 'A', page: 'reader.html' },
                aim,
            ),
        ).toEqual({ find: 'A', page: 'READER-2' });
        expect(toAimedToolArgs('owa_app_state', undefined, aim)).toEqual({
            page: 'READER-2',
        });
    });

    it('leaves a window asked for on purpose, other tools and no aim alone', () => {
        const presenter = { find: 'Clear All', page: 'presenter.html' };
        expect(toAimedToolArgs('owa_click', presenter, aim)).toBe(presenter);
        const search = { query: 'font' };
        expect(toAimedToolArgs('owa_help_search', search, aim)).toBe(search);
        const data = { action: 'list', page: 'reader.html' };
        expect(toAimedToolArgs('owa_bible_note', data, aim)).toBe(data);
        const plain = { text: 'Font' };
        expect(toAimedToolArgs('owa_find_ui', plain, null)).toBe(plain);
    });

    it('holds the aim of the tab in front for the calls that run in it', () => {
        expect(getCurrentWindowAim()).toBeNull();
        setCurrentWindowAim(aim);
        expect(getCurrentWindowAim()).toBe(aim);
    });
});
