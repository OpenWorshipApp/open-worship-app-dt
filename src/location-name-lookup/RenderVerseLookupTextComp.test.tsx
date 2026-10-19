// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
    index: null as null | object,
    needles: null as null | object,
    needleLangs: [] as string[],
    findEnglish: vi.fn(),
    findTranslated: vi.fn(),
    openPanel: vi.fn(),
    graphMenu: vi.fn(),
}));

vi.mock('../lang/langHelpers', () => ({ DEFAULT_LANG_CODE: 'en' }));
vi.mock('../graph-view/graphContextMenuHelpers', () => ({
    showGraphPreviewContextMenu: state.graphMenu,
}));
vi.mock('./detailPanelHelpers', () => ({ openDetailPanel: state.openPanel }));
vi.mock('./verseTextIndexHelpers', () => ({
    useLookupTextIndex: () => state.index,
    findLookupTextMatches: state.findEnglish,
    toVerseTextSegmentList: (text: string, matches: object[]) => {
        if (matches.length === 0) return null;
        return [
            { kind: 'text', text: text.slice(0, 5) },
            { kind: 'match', match: matches[0] },
            { kind: 'text', text: text.slice(-6) },
        ];
    },
}));
vi.mock('./verseTextTranslatedHelpers', () => ({
    useLookupTextNeedles: (langCode: string) => {
        state.needleLangs.push(langCode);
        return state.needles;
    },
    findTranslatedLookupMatches: state.findTranslated,
}));

import RenderVerseLookupTextComp, {
    handleMatchClicking,
} from './RenderVerseLookupTextComp';

const match = {
    start: 5,
    end: 11,
    text: 'Moses',
    kind: 'name' as const,
    recordId: 'person-7',
};
let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    state.index = null;
    state.needles = null;
    state.needleLangs = [];
    state.findEnglish.mockReset().mockReturnValue([match]);
    state.findTranslated.mockReset().mockReturnValue([match]);
    state.openPanel.mockReset();
    state.graphMenu.mockReset();
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
});

afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
});

describe('verse lookup links', () => {
    it('keeps plain verse text while the index or translated needles are loading', async () => {
        await act(async () =>
            root.render(
                <RenderVerseLookupTextComp
                    text="Moses spoke"
                    kjvShortVerse="EXO 1:1"
                    lookupLangCode="en"
                />,
            ),
        );
        expect(host.textContent).toBe('Moses spoke');
        expect(host.querySelector('span')).toBeNull();
        expect(state.findEnglish).not.toHaveBeenCalled();
        expect(state.needleLangs).toContain('');

        state.index = { id: 'index' };
        await act(async () =>
            root.render(
                <RenderVerseLookupTextComp
                    text="Moses spoke"
                    kjvShortVerse="EXO 1:1"
                    lookupLangCode="km"
                />,
            ),
        );
        expect(host.textContent).toBe('Moses spoke');
        expect(state.findTranslated).not.toHaveBeenCalled();
        expect(state.needleLangs).toContain('km');
    });

    it('opens an English match, keeps the text selectable, and offers graph preview', async () => {
        state.index = { id: 'index' };
        vi.stubGlobal('getSelection', () => ({ isCollapsed: true }));
        await act(async () =>
            root.render(
                <RenderVerseLookupTextComp
                    text="Before Moses after"
                    kjvShortVerse="EXO 1:1"
                    lookupLangCode="en"
                />,
            ),
        );
        expect(state.findEnglish).toHaveBeenCalledWith(
            state.index,
            'Before Moses after',
            'EXO 1:1',
        );
        const link = host.querySelector('span')!;
        expect(link.className).toContain('verse-lookup-link name');
        expect(link.getAttribute('role')).toBeNull();
        expect(link.textContent).toBe('Moses');
        await act(async () => link.click());
        expect(state.openPanel).toHaveBeenCalledWith({
            kind: 'name',
            target: 'person-7',
            name: 'Moses',
        });
        await act(async () =>
            link.dispatchEvent(
                new MouseEvent('contextmenu', { bubbles: true }),
            ),
        );
        expect(state.graphMenu).toHaveBeenCalledWith(expect.any(MouseEvent), {
            kind: 'name',
            recordId: 'person-7',
            name: 'Moses',
        });

        const stopPropagation = vi.fn();
        vi.stubGlobal('getSelection', () => ({ isCollapsed: false }));
        handleMatchClicking({ stopPropagation }, match);
        expect(stopPropagation).toHaveBeenCalledOnce();
        expect(state.openPanel).toHaveBeenCalledTimes(1);
    });

    // RD-92: the bible view around the verse has its own `onContextMenu`. It
    // used to hear the same right-click through React's bubbling, build the
    // generic verse menu after an await, and close the graph one to show it.
    it('keeps a right-click on a name away from the surrounding view menu', async () => {
        state.index = { id: 'index' };
        const parentMenu = vi.fn();
        await act(async () =>
            root.render(
                <div onContextMenu={parentMenu}>
                    <RenderVerseLookupTextComp
                        text="Before Moses after"
                        kjvShortVerse="EXO 1:1"
                        lookupLangCode="en"
                    />
                </div>,
            ),
        );
        const link = host.querySelector('.verse-lookup-link')!;
        const event = new MouseEvent('contextmenu', {
            bubbles: true,
            cancelable: true,
        });
        await act(async () => link.dispatchEvent(event));
        expect(state.graphMenu).toHaveBeenCalledOnce();
        expect(state.graphMenu).toHaveBeenCalledWith(event, {
            kind: 'name',
            recordId: 'person-7',
            name: 'Moses',
        });
        expect(parentMenu).not.toHaveBeenCalled();
        // The browser's own menu stays shut whatever the helper does.
        expect(event.defaultPrevented).toBe(true);

        // Anywhere else in the verse still reaches the view's menu.
        await act(async () =>
            host
                .querySelector('div')!
                .dispatchEvent(
                    new MouseEvent('contextmenu', { bubbles: true }),
                ),
        );
        expect(parentMenu).toHaveBeenCalledOnce();
        expect(state.graphMenu).toHaveBeenCalledOnce();
    });

    it('uses translated needles and leaves unmatched or empty text plain', async () => {
        state.index = { id: 'index' };
        state.needles = { id: 'needles' };
        await act(async () =>
            root.render(
                <RenderVerseLookupTextComp
                    text="Before Moses after"
                    kjvShortVerse="EXO 1:1"
                    lookupLangCode="km"
                />,
            ),
        );
        expect(state.findTranslated).toHaveBeenCalledWith(
            state.index,
            state.needles,
            'Before Moses after',
            'EXO 1:1',
        );
        expect(host.querySelector('span')?.textContent).toBe('Moses');

        state.findTranslated.mockReturnValue([]);
        await act(async () =>
            root.render(
                <RenderVerseLookupTextComp
                    text="No matches"
                    kjvShortVerse="EXO 1:1"
                    lookupLangCode="km"
                />,
            ),
        );
        expect(host.textContent).toBe('No matches');
        expect(host.querySelector('span')).toBeNull();

        await act(async () =>
            root.render(
                <RenderVerseLookupTextComp
                    text=""
                    kjvShortVerse="EXO 1:1"
                    lookupLangCode="km"
                />,
            ),
        );
        expect(host.textContent).toBe('');
    });
});
