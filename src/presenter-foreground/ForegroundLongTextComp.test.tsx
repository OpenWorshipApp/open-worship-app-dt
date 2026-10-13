// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import type {
    LongTextLanguageType,
    LongTextResolvedLanguageType,
} from './foregroundLongTextHelpers';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const { state, mocks } = vi.hoisted(() => ({
    state: {
        settingMap: new Map<string, string>(),
        // What each lyric file "is", by its path.
        lyricMap: new Map<string, { title: string; parts: string[] }>(),
        showingList: [] as [number, any][],
        // The rows marked on the screens holding a source's text.
        selectedKeyMap: new Map<string, string[]>(),
    },
    mocks: {
        setSetting: vi.fn(),
        handleLongTextShowing: vi.fn(async (..._args: any[]) => [0]),
        hideLongText: vi.fn(),
        restyleLongText: vi.fn(),
        bringLongTextRowToMiddle: vi.fn(),
        useScreenLongTextManagerEvents: vi.fn(),
        showSimpleToast: vi.fn(),
        handleError: vi.fn(),
        chooseLongTextLangCode: vi.fn(
            async (..._args: any[]): Promise<string | null> => null,
        ),
        chooseLyricFilePath: vi.fn(
            async (..._args: any[]): Promise<string | null> => null,
        ),
        useFileSourceEvents: vi.fn(),
    },
}));

vi.mock('../lang/langHelpers', () => ({ tran: (key: string) => key }));
vi.mock('../helper/appHooks', async () => {
    const { useEffect, useRef } = await import('react');
    return {
        // The real shape: ONE ref for the life of the component, holding the
        // latest value -- callbacks made once read it long after.
        useAppCurrentRef: <T,>(value: T) => {
            const ref = useRef(value);
            ref.current = value;
            return ref;
        },
        useAppEffect: useEffect,
    };
});
vi.mock('../helper/settingHelpers', () => ({
    getSetting: (name: string) => state.settingMap.get(name) ?? null,
    setSetting: mocks.setSetting,
}));
vi.mock('../helper/dirSourceHelpers', () => ({
    useFileSourceEvents: mocks.useFileSourceEvents,
}));
vi.mock('../helper/errorHelpers', () => ({ handleError: mocks.handleError }));
vi.mock('../toast/toastHelpers', () => ({
    showSimpleToast: mocks.showSimpleToast,
}));
vi.mock('../server/fileHelpers', () => ({
    getFileName: (name: string) => name.replace(/\.[^.]+$/, ''),
    pathBasename: (filePath: string) => filePath.split(/[\\/]/).at(-1) ?? '',
}));
vi.mock('../_screen/managers/ScreenLongTextManager', () => ({
    default: {
        textStyleTextColor: '#ffffff',
        getLongTextShowingList: (sourceId?: string) => {
            return state.showingList.filter(([, data]) => {
                return (
                    sourceId === undefined ||
                    data.longTextData.sourceId === sourceId
                );
            });
        },
        handleLongTextShowing: mocks.handleLongTextShowing,
        hideLongText: mocks.hideLongText,
        restyleLongText: mocks.restyleLongText,
        bringLongTextRowToMiddle: mocks.bringLongTextRowToMiddle,
        getLongTextSelectedSectionKeys: (sourceId: string) => {
            return state.selectedKeyMap.get(sourceId) ?? [];
        },
    },
}));
vi.mock('../_screen/managers/screenEventHelpers', () => ({
    useScreenLongTextManagerEvents: mocks.useScreenLongTextManagerEvents,
}));
vi.mock('../context-menu/ContextMenuDotsButtonComp', () => ({
    default: ({ label }: { label: string }) => (
        <button type="button" aria-label={label} />
    ),
}));
vi.mock('./foregroundSessionHelpers', () => ({
    useForegroundSessions: () => ({
        activeId: '',
        sessionIds: [''],
        suffix: '',
        prefix: '',
        element: null,
    }),
}));
vi.mock('./ScreensRendererComp', () => ({
    default: ({
        showingScreenIdDataList,
        buttonText,
        handleForegroundHiding,
    }: any) => (
        <>
            {showingScreenIdDataList.map(([screenId, data]: [number, any]) => (
                <button
                    type="button"
                    key={screenId}
                    aria-label={`${buttonText} ${screenId}`}
                    onClick={() => {
                        handleForegroundHiding(screenId, data);
                    }}
                />
            ))}
        </>
    ),
}));
// The real one draws the system's font list; here it only has to say that it
// is mounted, and hand a style back.
vi.mock('./ForegroundLongTextStyleComp', () => ({
    default: ({ onChange }: { onChange: (style: any) => void }) => (
        <button
            type="button"
            aria-label="style panel"
            onClick={() => {
                onChange({ color: '#ff0000' });
            }}
        />
    ),
}));
vi.mock('./foregroundLongTextMenuHelpers', () => ({
    chooseLongTextLangCode: mocks.chooseLongTextLangCode,
    chooseLyricFilePath: mocks.chooseLyricFilePath,
}));
vi.mock('./foregroundLongTextLangHelpers', async () => {
    const { genLongTextRowTexts } = await import('./foregroundLongTextHelpers');
    return {
        toLongTextLanguageLabel: (langCode: string) => langCode,
        genLongTextColumnInput: async (
            language: LongTextLanguageType,
            resolved: LongTextResolvedLanguageType,
            rowIndexes: number[],
        ) => {
            const texts = genLongTextRowTexts(resolved, rowIndexes);
            return {
                langCode: language.langCode,
                locale: 'en-US',
                title: resolved.title,
                texts,
                nums: texts.map((_, index) => `${index + 1}`),
                ...(language.style === undefined
                    ? {}
                    : { style: language.style }),
            };
        },
    };
});
vi.mock('./foregroundLongTextLyricHelpers', async () => {
    const { toRawResolvedLanguage } =
        await import('./foregroundLongTextHelpers');
    return {
        resolveLongTextLanguage: async (
            language: LongTextLanguageType,
        ): Promise<LongTextResolvedLanguageType> => {
            if (language.source === 'raw') {
                return toRawResolvedLanguage(language);
            }
            const lyric = state.lyricMap.get(language.lyricFilePath);
            if (lyric === undefined) {
                return {
                    langCode: language.langCode,
                    source: 'lyric',
                    title: '',
                    sections: [],
                    readProblem: { kind: 'missing' },
                };
            }
            return {
                langCode: language.langCode,
                source: 'lyric',
                title: lyric.title,
                sections: lyric.parts.map((partName) => {
                    return {
                        partName,
                        // A part of chords alone has no words to sing.
                        text: /^(Intro|Instrumental)/.test(partName)
                            ? ''
                            : `${partName} of ${lyric.title}`,
                    };
                }),
            };
        },
    };
});

import ForegroundLongTextComp from './ForegroundLongTextComp';

const SETTING_NAME = 'long-text-setting';

function genLanguage(
    langCode: string,
    data: Partial<LongTextLanguageType> = {},
): LongTextLanguageType {
    return {
        langCode,
        source: 'raw',
        title: `${langCode} title`,
        sections: [],
        lyricFilePath: '',
        ...data,
    };
}

function setSession(languages: LongTextLanguageType[]) {
    state.settingMap.set(SETTING_NAME, JSON.stringify({ languages }));
}

let container: HTMLDivElement;
let root: Root;

async function render() {
    await act(async () => {
        root.render(<ForegroundLongTextComp />);
    });
    // The lyric cards read their files as they mount.
    await act(async () => {
        await Promise.resolve();
    });
}

function getButton(label: string) {
    const button = container.querySelector<HTMLButtonElement>(
        `button[aria-label="${label}"], button[title="${label}"]`,
    );
    if (button === null) {
        throw new Error(`no button named "${label}"`);
    }
    return button;
}

function queryButton(label: string) {
    return container.querySelector<HTMLButtonElement>(
        `button[aria-label="${label}"], button[title="${label}"]`,
    );
}

async function click(label: string) {
    await act(async () => {
        getButton(label).click();
    });
}

// React reads a controlled box through the element's own setter.
async function type(label: string, value: string) {
    const box = container.querySelector<HTMLInputElement | HTMLTextAreaElement>(
        `[aria-label="${label}"]`,
    );
    if (box === null) {
        throw new Error(`no box named "${label}"`);
    }
    const prototype =
        box instanceof HTMLTextAreaElement
            ? HTMLTextAreaElement.prototype
            : HTMLInputElement.prototype;
    await act(async () => {
        Object.getOwnPropertyDescriptor(prototype, 'value')?.set?.call(
            box,
            value,
        );
        box.dispatchEvent(new Event('input', { bubbles: true }));
    });
}

function getProblemText() {
    return container.querySelector('[role="status"]')?.textContent?.trim();
}

beforeEach(() => {
    vi.clearAllMocks();
    state.settingMap.clear();
    state.lyricMap.clear();
    state.showingList = [];
    state.selectedKeyMap.clear();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.useRealTimers();
});

describe('Long Text Show', () => {
    test('an empty session has a language to add and nothing to show', async () => {
        await render();
        expect(container.textContent).toContain('No language yet');
        expect(getButton('Show Long Text').disabled).toBe(true);

        mocks.chooseLongTextLangCode.mockResolvedValueOnce('km');
        await click('Add Language');
        // Nothing of the session is in use yet, so nothing is left out.
        expect(mocks.chooseLongTextLangCode).toHaveBeenCalledWith(
            expect.anything(),
            [],
        );
        expect(container.textContent).not.toContain('No language yet');
        expect(queryButton('Add Section KM')).not.toBeNull();

        // The next pick is offered without the language already there.
        await click('Add Language');
        expect(mocks.chooseLongTextLangCode).toHaveBeenLastCalledWith(
            expect.anything(),
            ['km'],
        );
    });

    test('typed languages that do not line up are refused, in words, until they do', async () => {
        setSession([
            genLanguage('km', { sections: ['មួយ', 'ពីរ'] }),
            genLanguage('en', { sections: ['one'] }),
        ]);
        await render();
        expect(getButton('Show Long Text').disabled).toBe(true);
        expect(getProblemText()).toBe(
            'Every language needs the same number of sections: EN 1 ≠ 2',
        );

        await click('Add Section EN');
        // The new box is there and empty: still not showable, and the reason
        // is now the empty one.
        expect(getButton('Show Long Text').disabled).toBe(true);
        expect(getProblemText()).toBe('EN Section 2: This section is empty');

        await type('Section 2 EN', 'two');
        expect(getProblemText()).toBeUndefined();
        expect(getButton('Show Long Text').disabled).toBe(false);

        await click('Show Long Text');
        expect(mocks.handleLongTextShowing).toHaveBeenCalledTimes(1);
        const [, data, isForceChoosing] =
            mocks.handleLongTextShowing.mock.calls[0];
        expect(isForceChoosing).toBe(false);
        expect(data.type).toBe('long-text');
        expect(data.longTextData.sourceId).toBe('long-text');
        expect(
            data.longTextData.renderedList.map((column: any) => {
                return [column.code, column.sections];
            }),
        ).toEqual([
            [
                'KM',
                [
                    { num: '1', text: 'មួយ', key: 'lt-1' },
                    { num: '2', text: 'ពីរ', key: 'lt-2' },
                ],
            ],
            [
                'EN',
                [
                    { num: '1', text: 'one', key: 'lt-1' },
                    { num: '2', text: 'two', key: 'lt-2' },
                ],
            ],
        ]);
    });

    test('a section can be removed and moved, and a language taken out', async () => {
        setSession([
            genLanguage('km', { sections: ['a', 'b', 'c'] }),
            genLanguage('en', { sections: ['x'] }),
        ]);
        await render();
        const readSections = () => {
            return Array.from(
                container.querySelectorAll<HTMLTextAreaElement>(
                    'textarea[aria-label$=" KM"]',
                ),
            ).map((box) => box.value);
        };
        expect(readSections()).toEqual(['a', 'b', 'c']);
        await click('Move down 1 KM');
        expect(readSections()).toEqual(['b', 'a', 'c']);
        await click('Remove Section 2 KM');
        expect(readSections()).toEqual(['b', 'c']);
        expect(getButton('Move up 1 KM').disabled).toBe(true);
        expect(getButton('Move down 2 KM').disabled).toBe(true);

        await click('Remove Language EN');
        expect(queryButton('Add Section EN')).toBeNull();
        // One language of two sections, both with words: nothing in the way.
        expect(getButton('Show Long Text').disabled).toBe(false);
    });

    test('two lyric files sung in another order are named, and nothing goes up', async () => {
        state.lyricMap.set('/docs/km.owl', {
            title: 'ចម្រៀង',
            parts: ['Verse 1', 'Chorus'],
        });
        state.lyricMap.set('/docs/en.owl', {
            title: 'Song',
            parts: ['Verse 1', 'Bridge 1'],
        });
        setSession([
            genLanguage('km', {
                source: 'lyric',
                lyricFilePath: '/docs/km.owl',
            }),
            genLanguage('en', {
                source: 'lyric',
                lyricFilePath: '/docs/en.owl',
            }),
        ]);
        await render();
        expect(getProblemText()).toBe(
            'The songs do not have the same structure: ' +
                '2. KM Chorus ≠ EN Bridge 1',
        );
        expect(getButton('Show Long Text').disabled).toBe(true);
        // Each card says what its file came to.
        expect(container.textContent).toContain('ចម្រៀង · Sections: 2');

        // Pointing the second card at a song of the same order clears it.
        state.lyricMap.set('/docs/en2.owl', {
            title: 'Song two',
            parts: ['Verse 1', 'Chorus'],
        });
        mocks.chooseLyricFilePath.mockResolvedValueOnce('/docs/en2.owl');
        await click('Choose Lyric EN');
        await act(async () => {
            await Promise.resolve();
        });
        expect(mocks.chooseLyricFilePath).toHaveBeenCalledWith(
            expect.anything(),
            '/docs/en.owl',
        );
        expect(getProblemText()).toBeUndefined();
        expect(getButton('Show Long Text').disabled).toBe(false);
    });

    test('what goes up is checked against the files as they ARE when Show is pressed', async () => {
        const matchingParts = ['Verse 1', 'Chorus'];
        state.lyricMap.set('/docs/km.owl', {
            title: 'ចម្រៀង',
            parts: matchingParts,
        });
        state.lyricMap.set('/docs/en.owl', {
            title: 'Song',
            parts: matchingParts,
        });
        setSession([
            genLanguage('km', {
                source: 'lyric',
                lyricFilePath: '/docs/km.owl',
            }),
            genLanguage('en', {
                source: 'lyric',
                lyricFilePath: '/docs/en.owl',
            }),
        ]);
        await render();
        expect(getButton('Show Long Text').disabled).toBe(false);

        // The English song is edited after the panel read it.
        state.lyricMap.set('/docs/en.owl', {
            title: 'Song',
            parts: ['Verse 1', 'Chorus', 'Outro'],
        });
        await click('Show Long Text');
        expect(mocks.handleLongTextShowing).not.toHaveBeenCalled();
        expect(mocks.showSimpleToast).toHaveBeenCalledWith(
            'Long Text Show',
            'The songs do not have the same structure: ' + '3. KM — ≠ EN Outro',
        );

        // And once it lines up again, the lyric's own title and parts go up.
        state.lyricMap.set('/docs/en.owl', {
            title: 'Song',
            parts: matchingParts,
        });
        await click('Show Long Text');
        expect(mocks.handleLongTextShowing).toHaveBeenCalledTimes(1);
        const [, data] = mocks.handleLongTextShowing.mock.calls[0];
        expect(
            data.longTextData.renderedList.map((column: any) => {
                return [
                    column.title,
                    column.sections.map((section: any) => section.text),
                ];
            }),
        ).toEqual([
            ['ចម្រៀង', ['Verse 1 of ចម្រៀង', 'Chorus of ចម្រៀង']],
            ['Song', ['Verse 1 of Song', 'Chorus of Song']],
        ]);
    });

    test('a key press is not a file write: the session is saved when the typing stops', async () => {
        vi.useFakeTimers();
        setSession([genLanguage('km', { sections: ['a'] })]);
        await render();
        await type('Title KM', 'ចំណងជើង');
        await type('Section 1 KM', 'ab');
        expect(mocks.setSetting).not.toHaveBeenCalled();

        await act(async () => {
            vi.advanceTimersByTime(500);
        });
        expect(mocks.setSetting).toHaveBeenCalledTimes(1);
        const [name, value] = mocks.setSetting.mock.calls[0];
        expect(name).toBe(SETTING_NAME);
        expect(JSON.parse(value).languages[0]).toMatchObject({
            langCode: 'km',
            title: 'ចំណងជើង',
            sections: ['ab'],
        });
    });

    test('closing the panel inside that half second still saves what was typed', async () => {
        vi.useFakeTimers();
        setSession([genLanguage('km', { sections: ['a'] })]);
        await render();
        await type('Section 1 KM', 'last words');
        expect(mocks.setSetting).not.toHaveBeenCalled();
        act(() => root.unmount());
        expect(mocks.setSetting).toHaveBeenCalledTimes(1);
        expect(
            JSON.parse(mocks.setSetting.mock.calls[0][1]).languages[0].sections,
        ).toEqual(['last words']);
        // The timer that was waiting has nothing left to write.
        await act(async () => {
            vi.advanceTimersByTime(1000);
        });
        expect(mocks.setSetting).toHaveBeenCalledTimes(1);
        root = createRoot(container);
    });

    test("a card's Properties are mounted only while open, and reach a showing text after the hand stops", async () => {
        vi.useFakeTimers();
        setSession([
            genLanguage('km', { sections: ['a'] }),
            genLanguage('en', { sections: ['x'] }),
        ]);
        await render();
        // Closed: the font list behind the picker is not asked for.
        expect(queryButton('style panel')).toBeNull();
        await click('Properties EN');
        expect(queryButton('style panel')).not.toBeNull();

        await click('style panel');
        expect(mocks.restyleLongText).not.toHaveBeenCalled();
        await act(async () => {
            vi.advanceTimersByTime(500);
        });
        expect(mocks.restyleLongText).toHaveBeenCalledTimes(1);
        expect(mocks.restyleLongText).toHaveBeenCalledWith('long-text', {
            KM: undefined,
            EN: { color: '#ff0000' },
        });
        // The words are not what changed, so typing restyles nothing.
        mocks.restyleLongText.mockClear();
        await type('Section 1 EN', 'xy');
        await act(async () => {
            vi.advanceTimersByTime(500);
        });
        expect(mocks.restyleLongText).not.toHaveBeenCalled();

        await click('Properties EN');
        expect(queryButton('style panel')).toBeNull();
    });

    test('a lyric card offers its sung parts as buttons that bring a row to the middle', async () => {
        const parts = ['Intro', 'Verse 1', 'Chorus', 'Verse 2', 'Chorus'];
        state.lyricMap.set('/docs/km.owl', { title: 'ចម្រៀង', parts });
        state.lyricMap.set('/docs/en.owl', { title: 'Song', parts });
        setSession([
            genLanguage('km', {
                source: 'lyric',
                lyricFilePath: '/docs/km.owl',
            }),
            genLanguage('en', {
                source: 'lyric',
                lyricFilePath: '/docs/en.owl',
            }),
        ]);
        await render();
        const readPartButtons = (code: string) => {
            return Array.from(
                // The group's first button switches the view; the rest are
                // the parts.
                container.querySelectorAll<HTMLButtonElement>(
                    `[aria-label="Bring to Middle ${code}"] ` +
                        'button[aria-label^="Bring to Middle"]',
                ),
            );
        };
        // The Intro has no words, so it is no row and has no button; the
        // Chorus is sung twice and has two, numbered as the screen is.
        expect(
            readPartButtons('KM').map((button) => button.textContent),
        ).toEqual(['1 Verse 1', '2 Chorus', '3 Verse 2', '4 Chorus']);
        expect(readPartButtons('EN')).toHaveLength(4);
        // On no screen yet: there is nothing to bring anywhere.
        expect(readPartButtons('KM').every((button) => button.disabled)).toBe(
            true,
        );

        state.showingList = [
            [0, { longTextData: { sourceId: 'long-text', renderedList: [] } }],
        ];
        await render();
        expect(readPartButtons('KM').some((button) => button.disabled)).toBe(
            false,
        );
        // The second Chorus is the FOURTH row, not the second.
        await click('Bring to Middle 4 Chorus EN');
        expect(mocks.bringLongTextRowToMiddle).toHaveBeenCalledWith(
            'long-text',
            3,
        );
    });

    test('a lyric card switches its parts between buttons and text cards', async () => {
        const parts = ['Intro', 'Verse 1', 'Chorus'];
        state.lyricMap.set('/docs/km.owl', { title: 'ចម្រៀង', parts });
        state.lyricMap.set('/docs/en.owl', { title: 'Song', parts });
        setSession([
            genLanguage('km', {
                source: 'lyric',
                lyricFilePath: '/docs/km.owl',
            }),
            genLanguage('en', {
                source: 'lyric',
                lyricFilePath: '/docs/en.owl',
            }),
        ]);
        state.showingList = [
            [0, { longTextData: { sourceId: 'long-text', renderedList: [] } }],
        ];
        await render();
        // As buttons, the card holds the names of the parts and none of
        // their words.
        expect(
            getButton('View as Text Cards KM').getAttribute('aria-pressed'),
        ).toBe('false');
        expect(container.textContent).not.toContain('Verse 1 of ចម្រៀង');

        await click('View as Text Cards KM');
        await act(async () => {
            await Promise.resolve();
        });
        expect(
            getButton('View as Text Cards KM').getAttribute('aria-pressed'),
        ).toBe('true');
        // Each part's words are on its button now -- the sung parts only,
        // so not the Intro -- and for THIS language only. The whole card
        // IS the button: the words are what an operator presses.
        expect(container.textContent).toContain('Verse 1 of ចម្រៀង');
        expect(getButton('Bring to Middle 1 Verse 1 KM').textContent).toBe(
            '1 Verse 1 Verse 1 of ចម្រៀង',
        );
        expect(getButton('Bring to Middle 1 Verse 1 EN').textContent).toBe(
            '1 Verse 1',
        );
        expect(container.textContent).toContain('Chorus of ចម្រៀង');
        expect(container.textContent).not.toContain('Verse 1 of Song');
        // A card still brings its row to the middle.
        await click('Bring to Middle 2 Chorus KM');
        expect(mocks.bringLongTextRowToMiddle).toHaveBeenCalledWith(
            'long-text',
            1,
        );

        // The view is the session's: it is there again when the panel is.
        act(() => root.unmount());
        expect(
            JSON.parse(mocks.setSetting.mock.calls.at(-1)?.[1]).languages.map(
                (language: any) => language.sectionView,
            ),
        ).toEqual(['cards', undefined]);
        root = createRoot(container);

        // Back to buttons, and the words are let go of.
        await render();
        await click('View as Text Cards KM');
        expect(container.textContent).toContain('Verse 1 of ចម្រៀង');
        await click('View as Text Cards KM');
        expect(container.textContent).not.toContain('Verse 1 of ចម្រៀង');
        expect(queryButton('Bring to Middle 1 Verse 1 KM')).not.toBeNull();
    });

    test("a typed section's number is its button, and there are none while the languages do not line up", async () => {
        setSession([
            genLanguage('km', { sections: ['មួយ', 'ពីរ'] }),
            genLanguage('en', { sections: ['one', 'two'] }),
        ]);
        state.showingList = [
            [0, { longTextData: { sourceId: 'long-text', renderedList: [] } }],
        ];
        await render();
        expect(getButton('Bring to Middle 2 KM').textContent).toBe('2');
        await click('Bring to Middle 2 KM');
        expect(mocks.bringLongTextRowToMiddle).toHaveBeenCalledWith(
            'long-text',
            1,
        );

        // A third Khmer section with no English one: the rows of the
        // panel are no longer the rows on the screen.
        await click('Add Section KM');
        expect(getButton('Bring to Middle 2 KM').disabled).toBe(true);
        expect(getButton('Bring to Middle 1 EN').disabled).toBe(true);
    });

    test('the row marked on a screen is lit on its button in every language, and only while the text is up', async () => {
        const parts = ['Intro', 'Verse 1', 'Chorus'];
        state.lyricMap.set('/docs/km.owl', { title: 'ចម្រៀង', parts });
        setSession([
            genLanguage('km', {
                source: 'lyric',
                lyricFilePath: '/docs/km.owl',
            }),
            genLanguage('en', { sections: ['one', 'two'] }),
        ]);
        state.showingList = [
            [0, { longTextData: { sourceId: 'long-text', renderedList: [] } }],
        ];
        // Another session's mark is not this panel's to show.
        state.selectedKeyMap.set('long-text-s1', ['lt-1']);
        const readLit = () => {
            return Array.from(
                container.querySelectorAll<HTMLButtonElement>(
                    'button.fg-part-on',
                ),
            ).map((button) => button.getAttribute('aria-label'));
        };
        await render();
        // The panel is redrawn when a row is marked: by one of its own
        // buttons, or by a click on the text in the mini screen.
        expect(mocks.useScreenLongTextManagerEvents).toHaveBeenCalledWith([
            'selected',
        ]);
        expect(readLit()).toEqual([]);

        // The second ROW: the Chorus of the lyric card (its Intro is no
        // row) and section 2 of the typed one.
        state.selectedKeyMap.set('long-text', ['lt-2']);
        await render();
        expect(readLit()).toEqual([
            'Bring to Middle 2 Chorus KM',
            'Bring to Middle 2 EN',
        ]);
        expect(
            getButton('Bring to Middle 2 Chorus KM').getAttribute(
                'aria-current',
            ),
        ).toBe('true');
        expect(
            getButton('Bring to Middle 1 Verse 1 KM').hasAttribute(
                'aria-current',
            ),
        ).toBe(false);

        // The mark moves with the song...
        state.selectedKeyMap.set('long-text', ['lt-1']);
        await render();
        expect(readLit()).toEqual([
            'Bring to Middle 1 Verse 1 KM',
            'Bring to Middle 1 EN',
        ]);
        // ...as a text card it is the card that is lit...
        await click('View as Text Cards KM');
        await act(async () => {
            await Promise.resolve();
        });
        expect(readLit()).toEqual([
            'Bring to Middle 1 Verse 1 KM',
            'Bring to Middle 1 EN',
        ]);

        // ...and a text that is on no screen has no row marked anywhere.
        state.showingList = [];
        await render();
        expect(readLit()).toEqual([]);
    });

    test("a screen holding this session's text has a Hide chip that takes down only its own", async () => {
        setSession([genLanguage('km', { sections: ['a'] })]);
        state.showingList = [
            [2, { longTextData: { sourceId: 'long-text', renderedList: [] } }],
            // Another session's text is not this panel's to hide.
            [
                3,
                {
                    longTextData: {
                        sourceId: 'long-text-s1',
                        renderedList: [],
                    },
                },
            ],
        ];
        await render();
        expect(queryButton('Hide Long Text 3')).toBeNull();
        expect(getButton('Show Long Text').getAttribute('aria-pressed')).toBe(
            'true',
        );
        await click('Hide Long Text 2');
        expect(mocks.hideLongText).toHaveBeenCalledWith('long-text', 2);
    });
});
