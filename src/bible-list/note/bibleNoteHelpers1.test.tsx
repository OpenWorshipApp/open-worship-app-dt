// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    test,
    vi,
    type Mock,
} from 'vitest';

const h = vi.hoisted(() => ({
    openExternalURL: vi.fn(),
    getAllLangsAsync: vi.fn(),
    showBibleKeyOption: vi.fn(),
    theme: 'dark',
    initialBibleKey: 'KJV',
}));

vi.mock('../../server/appProvider', () => ({
    default: { browserUtils: { openExternalURL: h.openExternalURL } },
}));
vi.mock('../../lang/langHelpers', () => ({
    getAllLangsAsync: h.getAllLangsAsync,
    tran: (key: string) => key,
}));
vi.mock('../../server/appHelpers', async () => {
    const { useState } = await import('react');
    return { useIsOnTop: () => useState(false) };
});
vi.mock('../../bible-lookup/BibleKeySelectionComp', () => ({
    showBibleKeyOption: h.showBibleKeyOption,
}));
vi.mock('../../others/themeHelpers', () => ({
    useThemeSource: () => ({ theme: h.theme }),
}));
vi.mock('../../helper/appHooks', async () => {
    const { useEffect } = await import('react');
    return {
        useAppEffect: useEffect,
        useAppEffectAsync: (
            effect: () => Promise<unknown>,
            deps: unknown[],
        ) => {
            // eslint-disable-next-line react-hooks/exhaustive-deps
            useEffect(() => {
                void effect();
            }, deps);
        },
    };
});
vi.mock('../../helper/settingHelpers', async () => {
    const { useState } = await import('react');
    return {
        useWatchStateSettingString: (_name: string, defaultValue: string) =>
            useState(h.initialBibleKey || defaultValue),
    };
});
vi.mock('./bibleNoteHelpers', () => ({
    BIBLE_KEY_SETTING_NAME: 'bible-note-bible-key',
}));
vi.mock('./BibleNoteEditingMenuComp', () => ({
    default: () => <div className="editing-menu" />,
}));
vi.mock('../../helper/bible-helpers/bibleModelHelpers', () => ({
    BIBLE_KJV_KEY: 'KJV',
}));
vi.mock('../../helper/bible-helpers/bibleStyleHelpers', () => ({
    useBibleFontFamily: (bibleKey: string) =>
        bibleKey === 'KJV' ? 'serif' : 'monospace',
}));

import { useBibleNoteControl } from './bibleNoteHelpers1';

type FooterButtonType = {
    id: string;
    description: string;
    shortcutKey?: string;
    children: any;
};

let host: HTMLDivElement;
let root: Root;
let buttons: Map<string, FooterButtonType>;
let bibleNote: any;
let note: any;
let noteItem: any;
let setIsShowingBibleLookup: Mock<(isShowing: boolean) => void>;

function ProbeComp({ isReadOnly }: Readonly<{ isReadOnly?: boolean }>) {
    useBibleNoteControl({
        bibleNote,
        note,
        noteItem,
        setIsShowingBibleLookup,
        isReadOnly,
    });
    return null;
}

async function renderProbe(isReadOnly?: boolean) {
    await act(async () => {
        root.render(<ProbeComp isReadOnly={isReadOnly} />);
    });
}

function getButton(id: string) {
    const button = buttons.get(id);
    if (button === undefined) {
        throw new Error(`No footer button ${id}`);
    }
    return button;
}

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    h.theme = 'dark';
    h.initialBibleKey = 'KJV';
    h.getAllLangsAsync.mockResolvedValue([
        { langCode: 'km', editorLink: 'https://km.example/editor' },
        { langCode: 'en', editorLink: '' },
    ]);
    buttons = new Map();
    bibleNote = {
        prependFooterActionButton: vi.fn((button: FooterButtonType) => {
            buttons.set(button.id, button);
        }),
        setColorScheme: vi.fn(),
    };
    note = { filePath: '/notes/Default.own' };
    noteItem = { id: 3 };
    setIsShowingBibleLookup = vi.fn<(isShowing: boolean) => void>();
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
});

afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
});

describe('the note editor footer', () => {
    test('an editable note gets Save, the editors, the lookup, on-top and its Bible', async () => {
        await renderProbe();
        expect([...buttons.keys()].sort()).toEqual(
            [
                'bible-key',
                'bible-lookup',
                'editing-history',
                'khmer-markdown-editor km',
                'toggle-on-top',
            ].sort(),
        );
        const save = getButton('editing-history');
        expect(save.description).toBe('Save');
        // The menu registers Ctrl+S itself: the footer would press Undo.
        expect(save.shortcutKey).toBeUndefined();
        expect(save.children.props).toEqual({ note, noteItem, bibleNote });
        expect(bibleNote.setColorScheme).toHaveBeenCalledWith('dark');
    });

    test('a read-only note gets neither Save nor the lookup', async () => {
        await renderProbe(true);
        expect(buttons.has('editing-history')).toBe(false);
        expect(buttons.has('bible-lookup')).toBe(false);
        expect(buttons.has('khmer-markdown-editor km')).toBe(true);
        expect(buttons.has('toggle-on-top')).toBe(true);
        expect(buttons.has('bible-key')).toBe(true);
    });

    test('a language with a markdown editor opens it in the browser', async () => {
        await renderProbe();
        const editor = getButton('khmer-markdown-editor km');
        expect(editor.description).toBe('Open in Markdown Editor (km)');
        expect(editor.shortcutKey).toBe('Ctrl+Shift+Alt+K');
        expect(editor.children.props['aria-label']).toBe(
            'Open in Markdown Editor (km)',
        );
        editor.children.props.onClick();
        expect(h.openExternalURL).toHaveBeenCalledWith(
            'https://km.example/editor',
        );
    });

    test('the lookup button shows the Bible lookup', async () => {
        await renderProbe();
        const lookup = getButton('bible-lookup');
        expect(lookup.description).toBe('Open Bible Lookup');
        expect(lookup.shortcutKey).toBe('Ctrl+Shift+B');
        lookup.children.props.onClick();
        expect(setIsShowingBibleLookup).toHaveBeenCalledWith(true);
    });

    test('the on-top button toggles and says whether the window is on top', async () => {
        await renderProbe();
        let onTop = getButton('toggle-on-top');
        expect(onTop.shortcutKey).toBe('Ctrl+Shift+Alt+T');
        expect(onTop.children.props['aria-pressed']).toBe(false);
        expect(onTop.children.props.children.props.className).toBe(
            'bi bi-window-desktop',
        );
        await act(async () => onTop.children.props.onClick());
        onTop = getButton('toggle-on-top');
        expect(onTop.children.props['aria-pressed']).toBe(true);
        expect(onTop.children.props.children.props.className).toBe(
            'bi bi-window-stack',
        );
        expect(onTop.children.props.children.props.style.color).toBe('green');
    });

    test('the Bible button picks another Bible and then shows it in its face', async () => {
        await renderProbe();
        let bibleKey = getButton('bible-key');
        expect(bibleKey.description).toBe('Change Bible Key');
        let label = bibleKey.children.props.children;
        expect(label.props.children).toBe('KJV');
        expect(label.props.style.fontFamily).toBe('serif');

        const event = { type: 'click' };
        bibleKey.children.props.onClick(event);
        expect(h.showBibleKeyOption).toHaveBeenCalledTimes(1);
        const [shownEvent, onSelect, excluded] =
            h.showBibleKeyOption.mock.calls[0];
        expect(shownEvent).toBe(event);
        // The Bible already in use is not offered again.
        expect(excluded).toEqual(['KJV']);
        await act(async () => onSelect('NIV'));
        bibleKey = getButton('bible-key');
        label = bibleKey.children.props.children;
        expect(label.props.children).toBe('NIV');
        expect(label.props.style.fontFamily).toBe('monospace');
    });

    test('the editor follows the theme', async () => {
        h.theme = 'light';
        await renderProbe();
        expect(bibleNote.setColorScheme).toHaveBeenLastCalledWith('light');
    });
});
