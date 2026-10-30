// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    openExternalURL: vi.fn(),
    themeClick: vi.fn(),
    verseKeys: [] as string[],
}));

vi.mock('../helper/ai/bibleCrossRefHelpers', () => ({
    useBibleKeyContext: () => 'KHM',
}));
vi.mock('../helper/bible-helpers/bibleStyleHelpers', () => ({
    useBibleFontFamily: (bibleKey: string) => `${bibleKey} Font`,
}));
vi.mock('../lang/langHelpers', () => ({ tran: (key: string) => key }));
vi.mock('../server/appProvider', () => ({
    default: {
        appInfo: { homepage: 'https://openworship.app' },
        browserUtils: { openExternalURL: h.openExternalURL },
    },
}));
vi.mock('./BibleCrossRefAIRenderFoundItemComp', () => ({
    default: ({ bibleVersesKey }: { bibleVersesKey: string }) => {
        h.verseKeys.push(bibleVersesKey);
        return <div className="test-verse">{bibleVersesKey}</div>;
    },
}));

import RenderAIBibleCrossReferenceComp from './RenderAIBibleCrossReferenceComp';

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    h.verseKeys = [];
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
});

afterEach(() => {
    act(() => {
        root.unmount();
    });
    host.remove();
    vi.unstubAllGlobals();
});

async function render(crossReference: any) {
    await act(async () => {
        root.render(
            // A theme sits in a clickable list in the panel.
            <div onClick={h.themeClick}>
                <RenderAIBibleCrossReferenceComp
                    crossReference={crossReference}
                />
            </div>,
        );
    });
}

describe('RenderAIBibleCrossReferenceComp', () => {
    test('lists a row per verse of the theme, in order', async () => {
        await render({
            title: '<b>Love</b>',
            titleEn: 'Love',
            verses: ['ROM 5:8', '1JN 4:9', 'ROM 5:8'],
        });
        expect(
            Array.from(
                host.querySelectorAll('.app-xref-verses .test-verse'),
            ).map((row) => row.textContent),
        ).toEqual(['ROM 5:8', '1JN 4:9', 'ROM 5:8']);
        const heading = host.querySelector<HTMLHeadingElement>('h4')!;
        // Html in the title is kept, cleaned, in the bible's face.
        expect(heading.querySelector('b')!.textContent).toBe('Love');
        expect(heading.style.fontFamily).toBe('KHM Font');
    });

    test('the translation note opens the page about it, and nothing else', async () => {
        await render({
            title: 'សេចក្ដីស្រឡាញ់',
            titleEn: 'Love',
            verses: [],
        });
        const note = host.querySelector<HTMLButtonElement>(
            'button.app-xref-note',
        )!;
        // The English heading rides along on the tooltip.
        expect(note.title).toBe(
            'Generated using Google Translate. Results may vary and may not ' +
                'be accurate. Please use with caution.\nLove',
        );
        await act(async () => {
            note.click();
        });
        expect(h.openExternalURL).toHaveBeenCalledWith(
            'https://openworship.app/google-translate-vigilant',
        );
        expect(h.themeClick).not.toHaveBeenCalled();
    });

    test('a theme with no English title is not marked as translated', async () => {
        await render({ title: 'Love', verses: ['ROM 5:8'] });
        expect(host.querySelector('button.app-xref-note')).toBeNull();
    });
});
