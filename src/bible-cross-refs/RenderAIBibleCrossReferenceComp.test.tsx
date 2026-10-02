// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('../helper/ai/bibleCrossRefHelpers', () => ({
    useBibleKeyContext: () => 'KH',
}));
vi.mock('../helper/bible-helpers/bibleStyleHelpers', () => ({
    useBibleFontFamily: () => undefined,
}));
// Marks what went through the dictionary, so an untranslated sentence shows.
vi.mock('../lang/langHelpers', () => ({
    tran: (key: string) => `«${key}»`,
}));
vi.mock('../server/appProvider', () => ({
    default: {
        appInfo: { homepage: 'https://example.org' },
        browserUtils: { openExternalURL: vi.fn() },
    },
}));
vi.mock('./BibleCrossRefAIRenderFoundItemComp', () => ({
    default: () => null,
}));

import RenderAIBibleCrossReferenceComp from './RenderAIBibleCrossReferenceComp';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
});

afterEach(() => {
    act(() => {
        root.unmount();
    });
    host.remove();
});

describe('RenderAIBibleCrossReferenceComp', () => {
    test('a translated theme heading holds its title and nothing else', () => {
        act(() => {
            root.render(
                <RenderAIBibleCrossReferenceComp
                    crossReference={{
                        title: 'ព្រះអម្ចាស់',
                        titleEn: 'The Lord',
                        verses: [],
                    }}
                />,
            );
        });
        const heading = host.querySelector('h4')!;
        const note = host.querySelector('button.app-xref-note')!;

        // The caution used to sit inside the heading and become part of
        // its name; a heading holding a control also dropped out of the
        // headings a tool lists.
        expect(heading.textContent).toBe('ព្រះអម្ចាស់');
        expect(heading.contains(note)).toBe(false);
        // Both sentences of the caution go through the dictionary.
        expect(note.getAttribute('aria-label')).toBe(
            '«Generated using Google Translate.» ' +
                '«Results may vary and may not be accurate. ' +
                'Please use with caution.»',
        );
    });

    test('an untranslated theme has no note at all', () => {
        act(() => {
            root.render(
                <RenderAIBibleCrossReferenceComp
                    crossReference={{
                        title: 'The Lord',
                        titleEn: 'The Lord',
                        verses: [],
                    }}
                />,
            );
        });

        expect(host.querySelector('button.app-xref-note')).toBeNull();
    });
});
