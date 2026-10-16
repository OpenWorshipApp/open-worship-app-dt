// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    shortToVerseDataMock: vi.fn(),
    shortToVerseSectionListMock: vi.fn(),
}));

vi.mock('./bibleVerseHelpers', () => ({
    shortToVerseData: h.shortToVerseDataMock,
    shortToVerseSectionList: h.shortToVerseSectionListMock,
    useLookupVerseBibleKey: () => 'KJV',
}));
vi.mock('../helper/appHooks', async () => {
    const React = await import('react');
    return {
        useAppCurrentRef: (value: unknown) => {
            const ref = React.useRef(value);
            ref.current = value;
            return ref;
        },
        useAppEffect: React.useEffect,
        useAppStateAsync: (callee: () => unknown, deps: unknown[]) => {
            const [value, setValue] = React.useState<unknown>(undefined);
            React.useEffect(() => {
                Promise.resolve(callee()).then(setValue);
                // eslint-disable-next-line react-hooks/exhaustive-deps
            }, deps);
            return [value, setValue];
        },
    };
});
vi.mock('../lang/langHelpers', () => ({ tran: (text: string) => text }));
vi.mock('../others/LoadingComp', () => ({ default: () => null }));
vi.mock('./lookupLangHelpers', () => ({
    useLookupLangPresentation: () => ({ translate: (text: string) => text }),
}));
vi.mock('./lookupManagersContext', () => ({
    useLookupManagersContext: () => null,
}));
vi.mock('./LookupDetailPartsComp', () => ({}));
vi.mock('./lookupRecordHelpers', () => ({}));
vi.mock('../helper/errorHelpers', () => ({
    handleError: (error: unknown) => {
        throw error;
    },
}));
vi.mock('../bible-reader/view-extra/RenderBibleChapterDividerComp', () => ({
    default: ({ localeChapter }: { localeChapter: string }) => (
        <div className="divider">{localeChapter}</div>
    ),
}));
vi.mock('../bible-reader/view-extra/RenderShowNextChapterButtonComp', () => ({
    default: ({ onClick }: { onClick: () => void }) => (
        <button type="button" className="more" onClick={onClick}>
            ...
        </button>
    ),
}));

import { RenderVerseDetailComp } from './RenderDetailBodyComp';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

function genSection(chapter: number) {
    return {
        chapter,
        localeChapter: `${chapter}`,
        title: `John ${chapter}`,
        text: `text ${chapter}`,
    };
}

async function flush() {
    await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
    });
}

describe('RenderVerseDetailComp', () => {
    let host: HTMLDivElement;
    let root: Root;
    beforeEach(() => {
        h.shortToVerseDataMock.mockReset();
        h.shortToVerseSectionListMock.mockReset();
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

    function read() {
        return {
            dividers: [...host.querySelectorAll('.divider')].map((element) => {
                return element.textContent;
            }),
            texts: [...host.querySelectorAll('p')].map((element) => {
                return element.textContent;
            }),
            isMore: host.querySelector('.more') !== null,
        };
    }

    test('a one-chapter passage is its text alone', async () => {
        h.shortToVerseDataMock.mockResolvedValue({
            bibleKey: 'KJV',
            title: 'John 3:16',
            text: '(16): For God so loved',
            style: {},
            sectionList: null,
            chapterCount: 1,
            shownChapterCount: 1,
        });
        act(() => {
            root.render(
                <RenderVerseDetailComp
                    shortVerse="JHN 3:16"
                    onResolved={() => {}}
                />,
            );
        });
        await flush();
        expect(read()).toEqual({
            dividers: [],
            texts: ['(16): For God so loved'],
            isMore: false,
        });
    });

    // JHN 18:33-23:2: three chapters, each under its divider, then one more
    // per `...` until the passage is whole.
    test('a passage across chapters reads on one chapter per press', async () => {
        h.shortToVerseDataMock.mockResolvedValue({
            bibleKey: 'KJV',
            title: 'John 18:33-23:2',
            text: '',
            style: {},
            sectionList: [18, 19, 20].map(genSection),
            chapterCount: 6,
            shownChapterCount: 3,
        });
        h.shortToVerseSectionListMock.mockImplementation(
            async (_bibleKey: string, _shortVerse: string, start: number) => {
                return [genSection(18 + start)];
            },
        );
        const onResolved = vi.fn();
        act(() => {
            root.render(
                <RenderVerseDetailComp
                    shortVerse="JHN 18:33-23:2"
                    onResolved={onResolved}
                />,
            );
        });
        await flush();
        expect(read()).toEqual({
            dividers: ['18', '19', '20'],
            texts: ['text 18', 'text 19', 'text 20'],
            isMore: true,
        });
        expect(onResolved).toHaveBeenCalledOnce();

        for (const chapter of [21, 22, 23]) {
            act(() => {
                (host.querySelector('.more') as HTMLButtonElement).click();
            });
            await flush();
            expect(h.shortToVerseSectionListMock).toHaveBeenLastCalledWith(
                'KJV',
                'JHN 18:33-23:2',
                chapter - 18,
            );
            expect(read().dividers.at(-1)).toBe(`${chapter}`);
        }
        expect(read()).toEqual({
            dividers: ['18', '19', '20', '21', '22', '23'],
            texts: [18, 19, 20, 21, 22, 23].map((chapter) => {
                return `text ${chapter}`;
            }),
            isMore: false,
        });
    });
});
