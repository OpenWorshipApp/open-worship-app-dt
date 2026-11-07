// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import type {
    LongTextLanguageType,
    LongTextResolvedLanguageType,
    LongTextScreenRowType,
} from './foregroundLongTextHelpers';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const { state, mocks } = vi.hoisted(() => ({
    state: {
        settingMap: new Map<string, string>(),
        // What each lyric file "is", by its path. A `missingPart` is a part
        // its Structure names and the song does not have.
        lyricMap: new Map<
            string,
            {
                title: string;
                parts: string[];
                missingPart?: string;
                // A part's own words, where the test needs several lines.
                textMap?: { [partName: string]: string };
            }
        >(),
        // Files whose read never comes back with an answer, and files whose
        // read is held until the test lets it go.
        failingPaths: new Set<string>(),
        deferredReads: new Map<string, Promise<void>>(),
        // The update listener of each watched lyric file, by its path.
        fileListeners: new Map<string, () => void>(),
        // The session in front, and what the panel asked of the strip.
        sessionSuffix: '',
        sessionOptions: null as any,
        showingList: [] as [number, any][],
        // The rows marked on the screens holding a source's text.
        selectedKeyMap: new Map<string, string[]>(),
        // The panel's Space / arrow listener, as its latest render made it.
        keyListener: null as ((event: any) => void) | null,
        keyingAreas: [] as {
            priority: number;
            getElement: () => HTMLElement | null;
            checkHasSelected: () => boolean;
        }[],
    },
    mocks: {
        setSetting: vi.fn(),
        handleLongTextShowing: vi.fn(async (..._args: any[]) => [0]),
        hideLongText: vi.fn(),
        restyleLongText: vi.fn(),
        replaceLongText: vi.fn(),
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
        replaceLongText: mocks.replaceLongText,
        bringLongTextRowToMiddle: mocks.bringLongTextRowToMiddle,
        getLongTextSelectedSectionKeys: (sourceId: string) => {
            return state.selectedKeyMap.get(sourceId) ?? [];
        },
    },
}));
vi.mock('../event/KeyboardEventListener', () => ({
    useKeyboardRegistering: (_eventMappers: any, listener: any) => {
        state.keyListener = listener;
    },
}));
vi.mock('../keyboard-shortcut/keyingAreaHelpers', () => ({
    KEYING_AREA_PRIORITY: { longText: 9 },
    registerKeyingArea: (keyingArea: (typeof state.keyingAreas)[number]) => {
        state.keyingAreas.push(keyingArea);
        return () => {
            state.keyingAreas.splice(state.keyingAreas.indexOf(keyingArea), 1);
        };
    },
}));
vi.mock('../_screen/managers/screenEventHelpers', () => ({
    useScreenLongTextManagerEvents: mocks.useScreenLongTextManagerEvents,
}));
vi.mock('../context-menu/ContextMenuDotsButtonComp', () => ({
    default: ({
        label,
        onOpening,
    }: {
        label: string;
        onOpening: (event: any) => void;
    }) => <button type="button" aria-label={label} onClick={onOpening} />,
}));
vi.mock('./foregroundSessionHelpers', () => ({
    useForegroundSessions: (options: any) => {
        state.sessionOptions = options;
        return {
            activeId: state.sessionSuffix.replace(/^-/, ''),
            sessionIds: [''],
            suffix: state.sessionSuffix,
            prefix: '',
            element: null,
        };
    },
}));
vi.mock('./ScreensRendererComp', () => ({
    default: ({
        showingScreenIdDataList,
        genTitle,
        buttonText,
        handleForegroundHiding,
    }: any) => (
        <>
            {showingScreenIdDataList.map(([screenId, data]: [number, any]) => (
                <button
                    type="button"
                    key={screenId}
                    aria-label={`${buttonText} ${screenId}`}
                    title={genTitle?.(data)}
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
    const { genLongTextScreenTexts } =
        await import('./foregroundLongTextHelpers');
    return {
        toLongTextLanguageLabel: (langCode: string) => langCode,
        genLongTextColumnInput: async (
            language: LongTextLanguageType,
            resolved: LongTextResolvedLanguageType,
            rowIndexes: number[],
            screenRows: LongTextScreenRowType[],
        ) => {
            const texts = genLongTextScreenTexts(
                resolved,
                rowIndexes,
                screenRows,
            );
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
            const { lyricFilePath } = language;
            const deferredRead = state.deferredReads.get(lyricFilePath);
            if (deferredRead !== undefined) {
                await deferredRead;
            }
            if (state.failingPaths.has(lyricFilePath)) {
                throw new Error(`cannot read ${lyricFilePath}`);
            }
            const lyric = state.lyricMap.get(lyricFilePath);
            // As `readLyricLongText` answers a card with no file chosen.
            if (lyricFilePath === '' || lyric?.missingPart !== undefined) {
                return {
                    langCode: language.langCode,
                    source: 'lyric',
                    title: '',
                    sections: [],
                    readProblem:
                        lyric?.missingPart === undefined
                            ? { kind: 'no-file' }
                            : {
                                  kind: 'missing-part',
                                  partName: lyric.missingPart,
                              },
                };
            }
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
                        text:
                            lyric.textMap?.[partName] ??
                            (/^(Intro|Instrumental)/.test(partName)
                                ? ''
                                : `${partName} of ${lyric.title}`),
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

function setSession(languages: LongTextLanguageType[], isAtomMode = false) {
    state.settingMap.set(
        SETTING_NAME,
        JSON.stringify({
            languages,
            ...(isAtomMode ? { isAtomMode: true } : {}),
        }),
    );
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
    state.failingPaths.clear();
    state.deferredReads.clear();
    state.fileListeners.clear();
    state.sessionSuffix = '';
    state.sessionOptions = null;
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

    test("the text's look opens from the panel: the same Bible/LongText Properties a passage opens", async () => {
        await render();
        // Beside Add Language, with or without a language yet.
        await click('Bible/LongText Properties');
        expect(mocks.setSetting).toHaveBeenCalledWith(
            'bible-custom-style-floating',
            'true',
        );
    });

    test('typed languages that do not line up are refused, in words, until they do', async () => {
        setSession([
            genLanguage('km', { sections: ['✝✝✝✝', '✝✝✝♪'] }),
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
                    { num: '1', text: '✝✝✝✝', key: 'lt-1' },
                    { num: '2', text: '✝✝✝♪', key: 'lt-2' },
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
            title: '✝✝✝☀',
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
        expect(container.textContent).toContain('✝✝✝☀ · Sections: 2');

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
            title: '✝✝✝☀',
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
            ['✝✝✝☀', ['Verse 1 of ✝✝✝☀', 'Chorus of ✝✝✝☀']],
            ['Song', ['Verse 1 of Song', 'Chorus of Song']],
        ]);
    });

    test('a key press is not a file write: the session is saved when the typing stops', async () => {
        vi.useFakeTimers();
        setSession([genLanguage('km', { sections: ['a'] })]);
        await render();
        await type('Title KM', '✝✝✝♥');
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
            title: '✝✝✝♥',
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
        state.lyricMap.set('/docs/km.owl', { title: '✝✝✝☀', parts });
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
        state.lyricMap.set('/docs/km.owl', { title: '✝✝✝☀', parts });
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
        expect(container.textContent).not.toContain('Verse 1 of ✝✝✝☀');

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
        expect(container.textContent).toContain('Verse 1 of ✝✝✝☀');
        expect(getButton('Bring to Middle 1 Verse 1 KM').textContent).toBe(
            '1 Verse 1 Verse 1 of ✝✝✝☀',
        );
        expect(getButton('Bring to Middle 1 Verse 1 EN').textContent).toBe(
            '1 Verse 1',
        );
        expect(container.textContent).toContain('Chorus of ✝✝✝☀');
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
        expect(container.textContent).toContain('Verse 1 of ✝✝✝☀');
        await click('View as Text Cards KM');
        expect(container.textContent).not.toContain('Verse 1 of ✝✝✝☀');
        expect(queryButton('Bring to Middle 1 Verse 1 KM')).not.toBeNull();
    });

    test("a typed section's number is its button, and there are none while the languages do not line up", async () => {
        setSession([
            genLanguage('km', { sections: ['✝✝✝✝', '✝✝✝♪'] }),
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
        state.lyricMap.set('/docs/km.owl', { title: '✝✝✝☀', parts });
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

    describe('Space and the arrows on the lit part', () => {
        // jsdom has no layout, and so no scrolling into view.
        const scrollIntoView = vi.fn();
        beforeEach(() => {
            Element.prototype.scrollIntoView = scrollIntoView;
            state.keyListener = null;
            state.keyingAreas.length = 0;
        });

        function press(key: string, shiftKey = false) {
            const event = { key, shiftKey, preventDefault: vi.fn() };
            act(() => {
                state.keyListener?.(event);
            });
            return event;
        }

        async function renderSong() {
            // The Intro has no words, so the rows are Verse 1, Chorus,
            // Verse 2.
            const parts = ['Intro', 'Verse 1', 'Chorus', 'Verse 2'];
            state.lyricMap.set('/docs/km.owl', { title: '✝✝✝☀', parts });
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
                [
                    0,
                    {
                        longTextData: {
                            sourceId: 'long-text',
                            renderedList: [],
                        },
                    },
                ],
            ];
            await render();
        }

        test('press the next part in the same card, and focus goes with it', async () => {
            await renderSong();
            state.selectedKeyMap.set('long-text', ['lt-2']);
            await render();
            getButton('Bring to Middle 2 Chorus EN').focus();
            // The docked Show row, as tall as it is drawn.
            const dock = document.querySelector('.fg-actions-dock');
            expect(dock).not.toBeNull();
            Object.defineProperty(dock, 'offsetHeight', { value: 46 });

            const event = press('ArrowRight');
            expect(event.preventDefault).toHaveBeenCalled();
            expect(mocks.bringLongTextRowToMiddle).toHaveBeenCalledWith(
                'long-text',
                2,
            );
            // The EN card's button, not the KM one above it.
            const nextButton = getButton('Bring to Middle 3 Verse 2 EN');
            expect(document.activeElement).toBe(nextButton);
            expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest' });
            // Brought clear of the docked row, not under it.
            expect(nextButton.style.scrollMarginBottom).toBe('52px');

            // Shift+Space goes back.
            state.selectedKeyMap.set('long-text', ['lt-3']);
            press(' ', true);
            expect(mocks.bringLongTextRowToMiddle).toHaveBeenLastCalledWith(
                'long-text',
                1,
            );
            expect(document.activeElement).toBe(
                getButton('Bring to Middle 2 Chorus EN'),
            );
        });

        test('stop at the last part and at the first, without going round', async () => {
            await renderSong();
            state.selectedKeyMap.set('long-text', ['lt-3']);
            await render();
            const lastButton = getButton('Bring to Middle 3 Verse 2 KM');
            lastButton.focus();
            for (const key of [' ', 'ArrowRight', 'ArrowDown', 'PageDown']) {
                // Still the panel's key: Space must not press the last part
                // again.
                expect(press(key).preventDefault).toHaveBeenCalled();
            }
            expect(mocks.bringLongTextRowToMiddle).not.toHaveBeenCalled();
            expect(document.activeElement).toBe(lastButton);

            state.selectedKeyMap.set('long-text', ['lt-1']);
            await render();
            getButton('Bring to Middle 1 Verse 1 KM').focus();
            press('ArrowLeft');
            press('PageUp');
            expect(mocks.bringLongTextRowToMiddle).not.toHaveBeenCalled();
        });

        test('leave the key alone off the lit part', async () => {
            await renderSong();
            state.selectedKeyMap.set('long-text', ['lt-2']);
            await render();
            // A part that is not lit: Space is left to press THAT one.
            getButton('Bring to Middle 1 Verse 1 KM').focus();
            expect(press(' ').preventDefault).not.toHaveBeenCalled();
            // Anything else in the panel.
            getButton('Show Long Text').focus();
            expect(press('ArrowRight').preventDefault).not.toHaveBeenCalled();
            expect(mocks.bringLongTextRowToMiddle).not.toHaveBeenCalled();
        });

        test("a typed language's numbers step the same way", async () => {
            setSession([
                genLanguage('km', { sections: ['✝✝✝✝', '✝✝✝♪'] }),
                genLanguage('en', { sections: ['one', 'two'] }),
            ]);
            state.showingList = [
                [
                    0,
                    {
                        longTextData: {
                            sourceId: 'long-text',
                            renderedList: [],
                        },
                    },
                ],
            ];
            state.selectedKeyMap.set('long-text', ['lt-1']);
            await render();
            getButton('Bring to Middle 1 KM').focus();
            press('ArrowDown');
            expect(mocks.bringLongTextRowToMiddle).toHaveBeenCalledWith(
                'long-text',
                1,
            );
            expect(document.activeElement).toBe(
                getButton('Bring to Middle 2 KM'),
            );
        });

        test("hand the remote's keys to the lit part, and only while there is one", async () => {
            await renderSong();
            expect(state.keyingAreas).toHaveLength(1);
            const [keyingArea] = state.keyingAreas;
            expect(keyingArea.priority).toBe(9);
            expect(keyingArea.checkHasSelected()).toBe(false);
            expect(keyingArea.getElement()).toBeNull();

            state.selectedKeyMap.set('long-text', ['lt-2']);
            await render();
            expect(keyingArea.checkHasSelected()).toBe(true);
            // The first card's lit part, with the focus anywhere else...
            expect(keyingArea.getElement()).toBe(
                getButton('Bring to Middle 2 Chorus KM'),
            );
            // ...and the part that has it, so stepping from the second card
            // is never counted as a remote going unanswered.
            getButton('Bring to Middle 2 Chorus EN').focus();
            expect(keyingArea.getElement()).toBe(
                getButton('Bring to Middle 2 Chorus EN'),
            );

            act(() => root.unmount());
            expect(state.keyingAreas).toHaveLength(0);
            root = createRoot(container);
        });
    });
});

// Lets a lyric read, a pick or a Show run to its end.
async function settle() {
    await act(async () => {
        for (let i = 0; i < 6; i++) {
            await Promise.resolve();
        }
    });
}

function genLyricLanguage(langCode: string, lyricFilePath: string) {
    return genLanguage(langCode, { source: 'lyric', lyricFilePath });
}

function genShowing(screenId: number, sourceId: string, titles: string[] = []) {
    return [
        screenId,
        {
            longTextData: {
                sourceId,
                renderedList: titles.map((title) => {
                    return { title };
                }),
            },
        },
    ] as [number, any];
}

describe('Long Text Show cards', () => {
    test('a card with no file, a file that is gone and a part the song lacks each say so', async () => {
        setSession([genLyricLanguage('km', '')]);
        await render();
        expect(getProblemText()).toBe('KM: No lyric file chosen');
        // Nothing to follow on the disk yet.
        expect(state.fileListeners.size).toBe(0);

        mocks.chooseLyricFilePath.mockResolvedValueOnce('/docs/gone.owl');
        await click('Choose Lyric KM');
        await settle();
        expect(getProblemText()).toBe('KM: This lyric file could not be read');
        expect(container.querySelector('small.text-warning')!.textContent).toBe(
            'This lyric file could not be read',
        );

        state.lyricMap.set('/docs/odd.owl', {
            title: 'Odd',
            parts: ['Verse 1'],
            missingPart: 'Bridge',
        });
        mocks.chooseLyricFilePath.mockResolvedValueOnce('/docs/odd.owl');
        await click('Choose Lyric KM');
        await settle();
        expect(getProblemText()).toBe(
            'KM: This lyric file names a part it does not have (Bridge)',
        );
        expect(getButton('Show Long Text').disabled).toBe(true);
    });

    test('a typed language with no section cannot go up, by any button', async () => {
        setSession([genLanguage('km')]);
        await render();
        expect(getProblemText()).toBe('No section yet');
        expect(getButton('Show Long Text').disabled).toBe(true);
        // No screen chooser to open, and a right-click asks nothing either.
        expect(queryButton('Show on Screens')).toBeNull();
        const event = new MouseEvent('contextmenu', {
            bubbles: true,
            cancelable: true,
        });
        await act(async () => {
            getButton('Show Long Text').dispatchEvent(event);
        });
        expect(event.defaultPrevented).toBe(true);
        expect(mocks.handleLongTextShowing).not.toHaveBeenCalled();
    });

    test('right-click on Show or its dots choose the screens', async () => {
        setSession([genLanguage('km', { sections: ['a'] })]);
        await render();
        const event = new MouseEvent('contextmenu', {
            bubbles: true,
            cancelable: true,
        });
        await act(async () => {
            getButton('Show Long Text').dispatchEvent(event);
        });
        await settle();
        expect(event.defaultPrevented).toBe(true);
        expect(mocks.handleLongTextShowing).toHaveBeenCalledTimes(1);
        expect(mocks.handleLongTextShowing.mock.calls[0][2]).toBe(true);

        await click('Show on Screens');
        await settle();
        expect(mocks.handleLongTextShowing).toHaveBeenCalledTimes(2);
        expect(mocks.handleLongTextShowing.mock.calls[1][2]).toBe(true);
        expect(
            mocks.handleLongTextShowing.mock.calls[1][1].longTextData.sourceId,
        ).toBe('long-text');
    });

    test('Show waits while a text is going up, and a screen that refuses it is reported', async () => {
        setSession([genLanguage('km', { sections: ['a'] })]);
        await render();
        let refuse!: (error: Error) => void;
        mocks.handleLongTextShowing.mockImplementationOnce(() => {
            return new Promise<number[]>((_resolve, reject) => {
                refuse = reject;
            });
        });
        await click('Show Long Text');
        await settle();
        expect(getButton('Show Long Text').disabled).toBe(true);
        expect(queryButton('Show on Screens')).toBeNull();

        const error = new Error('no screen');
        await act(async () => {
            refuse(error);
        });
        await settle();
        expect(mocks.handleError).toHaveBeenCalledWith(error);
        expect(getButton('Show Long Text').disabled).toBe(false);
        expect(queryButton('Show on Screens')).not.toBeNull();
    });

    test('a card switches between typed text and a lyric file', async () => {
        setSession([genLanguage('km', { sections: ['a'] })]);
        await render();
        expect(getButton('Raw Text').getAttribute('aria-pressed')).toBe('true');
        await click('Lyric File');
        await settle();
        expect(getButton('Lyric File').getAttribute('aria-pressed')).toBe(
            'true',
        );
        expect(queryButton('Add Section KM')).toBeNull();
        expect(queryButton('Choose Lyric KM')).not.toBeNull();
        expect(getProblemText()).toBe('KM: No lyric file chosen');

        await click('Raw Text');
        // The typed words were kept for the way back.
        expect(
            container.querySelector<HTMLTextAreaElement>(
                'textarea[aria-label="Section 1 KM"]',
            )!.value,
        ).toBe('a');
        expect(getProblemText()).toBeUndefined();
    });

    test('a card changes its language, never to one the session already has', async () => {
        setSession([
            genLanguage('km', { sections: ['a'] }),
            genLanguage('en', { sections: ['x'] }),
        ]);
        await render();
        mocks.chooseLongTextLangCode.mockResolvedValueOnce(null);
        await click('Choose Language: en');
        await settle();
        expect(mocks.chooseLongTextLangCode).toHaveBeenCalledWith(
            expect.anything(),
            ['km', 'en'],
        );
        // Put away unpicked: the card is what it was.
        expect(queryButton('Add Section EN')).not.toBeNull();

        mocks.chooseLongTextLangCode.mockResolvedValueOnce('fr');
        await click('Choose Language: en');
        await settle();
        expect(queryButton('Add Section EN')).toBeNull();
        // The same card, its words kept, under its new language.
        expect(
            container.querySelector<HTMLTextAreaElement>(
                'textarea[aria-label="Section 1 FR"]',
            )!.value,
        ).toBe('x');
    });

    test('whole languages move as columns, a section moves up, and the order is saved', async () => {
        setSession([
            genLanguage('km', { sections: ['a', 'b'] }),
            genLanguage('en', { sections: ['x', 'y'] }),
        ]);
        await render();
        const readOrder = () => {
            return Array.from(
                container.querySelectorAll(
                    'button[aria-label^="Choose Language: "]',
                ),
            ).map((button) => {
                return button.getAttribute('aria-label');
            });
        };
        expect(readOrder()).toEqual([
            'Choose Language: km',
            'Choose Language: en',
        ]);
        // Neither end moves further.
        expect(getButton('Move up KM').disabled).toBe(true);
        expect(getButton('Move down EN').disabled).toBe(true);

        await click('Move down KM');
        expect(readOrder()).toEqual([
            'Choose Language: en',
            'Choose Language: km',
        ]);
        await click('Move up KM');
        await click('Move down KM');
        expect(readOrder()).toEqual([
            'Choose Language: en',
            'Choose Language: km',
        ]);

        await click('Move up 2 EN');
        expect(
            Array.from(
                container.querySelectorAll<HTMLTextAreaElement>(
                    'textarea[aria-label$=" EN"]',
                ),
            ).map((box) => {
                return box.value;
            }),
        ).toEqual(['y', 'x']);

        act(() => root.unmount());
        const saved = JSON.parse(mocks.setSetting.mock.calls.at(-1)![1]);
        expect(
            saved.languages.map((language: LongTextLanguageType) => {
                return [language.langCode, language.sections];
            }),
        ).toEqual([
            ['en', ['y', 'x']],
            ['km', ['a', 'b']],
        ]);
        root = createRoot(container);
    });

    test('a choice of file put away unpicked changes and writes nothing', async () => {
        state.lyricMap.set('/docs/km.owl', {
            title: '♪ Hymn ♪',
            parts: ['Verse 1'],
        });
        setSession([genLyricLanguage('km', '/docs/km.owl')]);
        await render();
        mocks.chooseLyricFilePath.mockResolvedValueOnce(null);
        await click('Choose Lyric KM');
        await settle();
        expect(container.textContent).toContain('♪ Hymn ♪ · Sections: 1');
        act(() => root.unmount());
        expect(mocks.setSetting).not.toHaveBeenCalled();
        root = createRoot(container);
    });

    test('each lyric card follows its own file, and two edits in the same half second refresh both', async () => {
        vi.useFakeTimers();
        mocks.useFileSourceEvents.mockImplementation(
            (
                _events: string[],
                listener: () => void,
                _deps: any[],
                filePath,
            ) => {
                state.fileListeners.set(filePath, listener);
            },
        );
        const parts = ['Verse 1', 'Chorus'];
        state.lyricMap.set('/docs/km.owl', { title: '♪ Hymn ♪', parts });
        state.lyricMap.set('/docs/en.owl', { title: 'Song', parts });
        setSession([
            genLyricLanguage('km', '/docs/km.owl'),
            genLyricLanguage('en', '/docs/en.owl'),
            // A typed card has no file to follow.
            genLanguage('fr', { sections: ['one', 'two'] }),
        ]);
        await render();
        expect(mocks.useFileSourceEvents).toHaveBeenCalledWith(
            ['update', 'delete'],
            expect.any(Function),
            [],
            '/docs/km.owl',
        );
        expect([...state.fileListeners.keys()].sort()).toEqual([
            '/docs/en.owl',
            '/docs/km.owl',
        ]);
        expect(container.textContent).toContain('♪ Hymn ♪ · Sections: 2');

        const newParts = ['Verse 1', 'Chorus', 'Verse 2'];
        state.lyricMap.set('/docs/km.owl', {
            title: '♪ Hymn ♪',
            parts: newParts,
        });
        state.lyricMap.set('/docs/en.owl', { title: 'Song', parts: newParts });
        act(() => {
            state.fileListeners.get('/docs/km.owl')!();
        });
        await act(async () => {
            await vi.advanceTimersByTimeAsync(200);
        });
        act(() => {
            state.fileListeners.get('/docs/en.owl')!();
        });
        await act(async () => {
            await vi.advanceTimersByTimeAsync(299);
        });
        // Not read again while the file is still being written.
        expect(container.textContent).toContain('♪ Hymn ♪ · Sections: 2');
        await act(async () => {
            await vi.advanceTimersByTimeAsync(1);
        });
        await settle();
        expect(container.textContent).toContain('♪ Hymn ♪ · Sections: 3');
        await act(async () => {
            await vi.advanceTimersByTimeAsync(200);
        });
        await settle();
        // The second card's own timer, not cancelled by the first.
        expect(container.textContent).toContain('Song · Sections: 3');
    });

    test('a read that comes back after the card moved to another file is dropped', async () => {
        let releaseSlowRead!: () => void;
        state.deferredReads.set(
            '/docs/slow.owl',
            new Promise<void>((resolve) => {
                releaseSlowRead = resolve;
            }),
        );
        state.lyricMap.set('/docs/slow.owl', {
            title: 'Slow song',
            parts: ['Verse 1'],
        });
        state.lyricMap.set('/docs/km.owl', {
            title: '♪ Hymn ♪',
            parts: ['Verse 1', 'Chorus'],
        });
        setSession([genLyricLanguage('km', '/docs/slow.owl')]);
        await render();
        // A file not read yet is neither right nor wrong.
        expect(container.textContent).toContain('Loading...');
        expect(getButton('Show Long Text').disabled).toBe(true);

        mocks.chooseLyricFilePath.mockResolvedValueOnce('/docs/km.owl');
        await click('Choose Lyric KM');
        await settle();
        expect(container.textContent).toContain('♪ Hymn ♪ · Sections: 2');

        await act(async () => {
            releaseSlowRead();
        });
        await settle();
        expect(container.textContent).toContain('♪ Hymn ♪ · Sections: 2');
        expect(container.textContent).not.toContain('Slow song');
        expect(getButton('Show Long Text').disabled).toBe(false);
    });

    test('a read that fails is reported, and a text that could not be checked cannot go up', async () => {
        state.failingPaths.add('/docs/broken.owl');
        setSession([genLyricLanguage('km', '/docs/broken.owl')]);
        await render();
        await settle();
        expect(mocks.handleError).toHaveBeenCalledWith(
            expect.objectContaining({
                message: 'cannot read /docs/broken.owl',
            }),
        );
        expect(getButton('Show Long Text').disabled).toBe(true);
    });

    test('a Hide chip is titled with the text it takes down', async () => {
        setSession([genLanguage('km', { sections: ['a'] })]);
        state.showingList = [
            genShowing(1, 'long-text', ['Song', '♪ Hymn ♪']),
            genShowing(2, 'long-text'),
        ];
        await render();
        expect(getButton('Hide Long Text 1').getAttribute('title')).toBe(
            'Song',
        );
        expect(getButton('Hide Long Text 2').getAttribute('title')).toBe('');
    });

    test('each session is its own text: its own words, its own screens, taken down whole', async () => {
        state.sessionSuffix = '-s2';
        state.settingMap.set(
            'long-text-setting-s2',
            JSON.stringify({
                languages: [genLanguage('km', { sections: ['session two'] })],
            }),
        );
        state.showingList = [
            genShowing(1, 'long-text'),
            genShowing(2, 'long-text-s2'),
        ];
        await render();
        expect(
            container.querySelector<HTMLTextAreaElement>(
                'textarea[aria-label="Section 1 KM"]',
            )!.value,
        ).toBe('session two');
        // Only the screen holding THIS session's text has its Hide chip.
        expect(queryButton('Hide Long Text 1')).toBeNull();
        expect(queryButton('Hide Long Text 2')).not.toBeNull();

        const options = state.sessionOptions;
        expect(options.widgetKey).toBe('long-text');
        // A removed session leaves its setting file behind for nobody.
        expect(options.toOwnSettingNames('-s3')).toEqual([
            'long-text-setting-s3',
        ]);
        expect(options.toOwnSettingNames('')).toEqual(['long-text-setting']);
        // The strip marks the sessions whose text is up, wherever it is.
        expect(options.checkIsOnScreen('', '', ['', 's2'])).toBe(true);
        expect(options.checkIsOnScreen('s2', '-s2', ['', 's2'])).toBe(true);
        expect(options.checkIsOnScreen('s3', '-s3', ['', 's2'])).toBe(false);
        // Removing a session takes its text off EVERY screen.
        options.hideSession('s3', '-s3', ['', 's2', 's3']);
        expect(mocks.hideLongText).toHaveBeenCalledTimes(1);
        expect(mocks.hideLongText.mock.calls[0]).toEqual(['long-text-s3']);

        await click('Show Long Text');
        await settle();
        expect(
            mocks.handleLongTextShowing.mock.calls[0][1].longTextData.sourceId,
        ).toBe('long-text-s2');
    });
});

describe('Long Text Show in Atom mode', () => {
    const STILL_TEXT_MAP = {
        'Verse 1':
            'Hide me now\nUnder Your wings\nCover me\nWithin Your mighty hand',
        Chorus: 'When the oceans rise\nAnd thunders roar',
    };

    function setStill(isAtomMode: boolean) {
        state.lyricMap.set('/docs/still.owl', {
            title: 'Still',
            parts: ['Intro', 'Verse 1', 'Chorus'],
            textMap: STILL_TEXT_MAP,
        });
        setSession(
            [
                genLanguage('en', {
                    source: 'lyric',
                    lyricFilePath: '/docs/still.owl',
                    sectionView: 'cards',
                }),
            ],
            isAtomMode,
        );
    }

    function readPartTexts() {
        return Array.from(
            container.querySelectorAll<HTMLButtonElement>(
                '[aria-label="Bring to Middle EN"] ' +
                    'button[aria-label^="Bring to Middle"]',
            ),
        ).map((button) => button.textContent);
    }

    function readLastSession() {
        return JSON.parse(mocks.setSetting.mock.calls.at(-1)?.[1]);
    }

    test('the toggle is off until pressed, and is kept with the session through its edits', async () => {
        setSession([genLanguage('en', { sections: ['one'] })]);
        await render();
        expect(getButton('Atom Mode').getAttribute('aria-pressed')).toBe(
            'false',
        );
        await click('Atom Mode');
        expect(getButton('Atom Mode').getAttribute('aria-pressed')).toBe(
            'true',
        );
        // An edit after it does not take it away.
        await click('Add Section EN');
        act(() => root.unmount());
        expect(readLastSession()).toEqual({
            languages: [expect.objectContaining({ sections: ['one', ''] })],
            isAtomMode: true,
        });
        root = createRoot(container);

        // Read back as written, and off again: nothing of it is kept.
        state.settingMap.set(
            SETTING_NAME,
            mocks.setSetting.mock.calls.at(-1)?.[1],
        );
        await render();
        expect(getButton('Atom Mode').getAttribute('aria-pressed')).toBe(
            'true',
        );
        await click('Atom Mode');
        act(() => root.unmount());
        expect(readLastSession()).not.toHaveProperty('isAtomMode');
        root = createRoot(container);
    });

    test("a song's part is a card per line, numbered on through the song", async () => {
        setStill(false);
        await render();
        await settle();
        expect(readPartTexts()).toEqual([
            '1 Verse 1 Hide me now / Under Your wings / Cover me / Within Your mighty hand',
            '2 Chorus When the oceans rise / And thunders roar',
        ]);

        await click('Atom Mode');
        await settle();
        expect(readPartTexts()).toEqual([
            '1 Verse 1 Hide me now',
            '2 Verse 1 Under Your wings',
            '3 Verse 1 Cover me',
            '4 Verse 1 Within Your mighty hand',
            '5 Chorus When the oceans rise',
            '6 Chorus And thunders roar',
        ]);
        // As buttons, each still says its number and its part.
        await click('View as Text Cards EN');
        expect(readPartTexts()).toEqual([
            '1 Verse 1',
            '2 Verse 1',
            '3 Verse 1',
            '4 Verse 1',
            '5 Chorus',
            '6 Chorus',
        ]);
    });

    test('a line card brings its own row up, is lit by it, and the keys step line by line', async () => {
        Element.prototype.scrollIntoView = vi.fn();
        state.keyListener = null;
        setStill(true);
        state.showingList = [genShowing(0, 'long-text')];
        await render();
        await settle();
        await click('Bring to Middle 3 Verse 1 EN');
        expect(mocks.bringLongTextRowToMiddle).toHaveBeenLastCalledWith(
            'long-text',
            2,
        );

        state.selectedKeyMap.set('long-text', ['lt-4']);
        await render();
        const lastLine = getButton('Bring to Middle 4 Verse 1 EN');
        expect(lastLine.getAttribute('aria-current')).toBe('true');
        expect(
            getButton('Bring to Middle 3 Verse 1 EN').hasAttribute(
                'aria-current',
            ),
        ).toBe(false);
        // The last line of the verse steps to the chorus's first.
        lastLine.focus();
        act(() => {
            state.keyListener?.({
                key: 'ArrowRight',
                shiftKey: false,
                preventDefault: vi.fn(),
            });
        });
        expect(mocks.bringLongTextRowToMiddle).toHaveBeenLastCalledWith(
            'long-text',
            4,
        );
        expect(document.activeElement).toBe(
            getButton('Bring to Middle 5 Chorus EN'),
        );
    });

    test('what goes up is a row per line, a blank line kept', async () => {
        setSession(
            [
                genLanguage('en', { sections: ['one\n\nthree', 'four'] }),
                genLanguage('km', { sections: ['1\n2\n3', '4'] }),
            ],
            true,
        );
        await render();
        // A typed section has a numbered button per line.
        expect(getButton('Bring to Middle 2 EN').textContent).toBe('2');
        expect(getButton('Bring to Middle 4 KM').textContent).toBe('4');
        await click('Show Long Text');
        await settle();
        const [en, km] =
            mocks.handleLongTextShowing.mock.calls[0][1].longTextData
                .renderedList;
        expect(en.sections.map(({ text }: { text: string }) => text)).toEqual([
            'one',
            '',
            'three',
            'four',
        ]);
        expect(
            km.sections.map(({ num, key }: { num: string; key: string }) => {
                return `${num} ${key}`;
            }),
        ).toEqual(['1 lt-1', '2 lt-2', '3 lt-3', '4 lt-4']);
    });

    test('languages that break a row into other numbers of lines are refused, in words', async () => {
        setSession(
            [
                genLanguage('en', { sections: ['one\ntwo', 'three'] }),
                genLanguage('km', { sections: ['1', '2'] }),
            ],
            true,
        );
        state.showingList = [genShowing(0, 'long-text')];
        await render();
        expect(getProblemText()).toBe(
            'Every language needs the same number of lines: Section 1 — EN 2 ≠ KM 1',
        );
        expect(getButton('Show Long Text').disabled).toBe(true);
        // The rows do not line up, so no number is a button to press.
        expect(getButton('Bring to Middle 1 EN').disabled).toBe(true);

        // Without Atom mode the same text goes up, row for row.
        await click('Atom Mode');
        await settle();
        expect(getProblemText()).toBeUndefined();
        expect(getButton('Show Long Text').disabled).toBe(false);
    });

    test('pressed while the text is up, it goes up again where it is, keeping its place', async () => {
        setSession([genLanguage('en', { sections: ['one\ntwo', 'three'] })]);
        state.showingList = [genShowing(0, 'long-text')];
        await render();
        await click('Atom Mode');
        await settle();
        expect(mocks.replaceLongText).toHaveBeenCalledTimes(1);
        const [sourceId, data, toSelectedKey] =
            mocks.replaceLongText.mock.calls[0];
        expect(sourceId).toBe('long-text');
        expect(
            data.longTextData.renderedList[0].sections.map(
                ({ text }: { text: string }) => text,
            ),
        ).toEqual(['one', 'two', 'three']);
        // The second section was marked: its first line is now.
        expect(toSelectedKey('lt-2')).toBe('lt-3');
        expect(toSelectedKey(null)).toBeNull();

        await click('Atom Mode');
        await settle();
        const [, plainData, toPlainKey] = mocks.replaceLongText.mock.calls[1];
        expect(
            plainData.longTextData.renderedList[0].sections.map(
                ({ text }: { text: string }) => text,
            ),
        ).toEqual(['one\ntwo', 'three']);
        expect(toPlainKey('lt-2')).toBe('lt-1');
        // Nothing was asked of a screen chooser: it stays where it is.
        expect(mocks.handleLongTextShowing).not.toHaveBeenCalled();
    });

    test('Stack puts the languages in one row on the screen, and a text that is up keeps its very mark', async () => {
        setSession(
            [
                genLanguage('en', { sections: ['one\ntwo', 'three'] }),
                genLanguage('km', { sections: ['1\n2', '3'] }),
            ],
            true,
        );
        await render();
        expect(getButton('Stack').getAttribute('aria-pressed')).toBe('false');
        await click('Stack');
        expect(getButton('Stack').getAttribute('aria-pressed')).toBe('true');
        // Atom mode is left as it was, and the panel's rows with it.
        expect(getButton('Atom Mode').getAttribute('aria-pressed')).toBe(
            'true',
        );
        expect(getButton('Bring to Middle 3 EN').textContent).toBe('3');
        await click('Show Long Text');
        await settle();
        const { longTextData } = mocks.handleLongTextShowing.mock.calls[0][1];
        expect(longTextData.isStacked).toBe(true);
        expect(longTextData.renderedList).toHaveLength(2);

        // With the text up: it goes up again, the same row still marked.
        state.showingList = [genShowing(0, 'long-text')];
        await render();
        await click('Stack');
        await settle();
        const [, data, toSelectedKey] = mocks.replaceLongText.mock.calls[0];
        expect(data.longTextData).not.toHaveProperty('isStacked');
        expect(toSelectedKey('lt-2')).toBe('lt-2');
        expect(toSelectedKey(null)).toBeNull();
        act(() => root.unmount());
        expect(readLastSession()).toEqual({
            languages: expect.any(Array),
            isAtomMode: true,
        });
        root = createRoot(container);
    });

    test('Stack waits for a second language, and the choice is back with it', async () => {
        state.settingMap.set(
            SETTING_NAME,
            JSON.stringify({
                languages: [
                    genLanguage('en', { sections: ['one'] }),
                    genLanguage('km', { sections: ['1'] }),
                ],
                isStacked: true,
            }),
        );
        await render();
        expect(getButton('Stack').disabled).toBe(false);
        expect(getButton('Stack').getAttribute('aria-pressed')).toBe('true');

        await click('Remove Language KM');
        expect(getButton('Stack').disabled).toBe(true);
        expect(getButton('Stack').getAttribute('aria-pressed')).toBe('false');
        await click('Show Long Text');
        await settle();
        const { longTextData } = mocks.handleLongTextShowing.mock.calls[0][1];
        expect(longTextData).not.toHaveProperty('isStacked');

        mocks.chooseLongTextLangCode.mockResolvedValueOnce('km');
        await click('Add Language');
        await settle();
        expect(getButton('Stack').disabled).toBe(false);
        expect(getButton('Stack').getAttribute('aria-pressed')).toBe('true');
    });

    test('Hide Number takes the numbers off the screen, not off the panel', async () => {
        setSession([genLanguage('en', { sections: ['one', 'two'] })]);
        await render();
        expect(getButton('Hide Number').getAttribute('aria-pressed')).toBe(
            'false',
        );
        await click('Hide Number');
        expect(getButton('Hide Number').getAttribute('aria-pressed')).toBe(
            'true',
        );
        // The operator still finds a part by its number.
        expect(getButton('Bring to Middle 2 EN').textContent).toBe('2');
        await click('Show Long Text');
        await settle();
        expect(
            mocks.handleLongTextShowing.mock.calls[0][1].longTextData
                .isNumberHidden,
        ).toBe(true);

        state.showingList = [genShowing(0, 'long-text')];
        await render();
        await click('Hide Number');
        await settle();
        const [, data, toSelectedKey] = mocks.replaceLongText.mock.calls[0];
        expect(data.longTextData).not.toHaveProperty('isNumberHidden');
        expect(toSelectedKey('lt-2')).toBe('lt-2');
    });

    test('pressed while the text is down, or into a text that cannot go up, no screen is touched', async () => {
        setSession([
            genLanguage('en', { sections: ['one\ntwo'] }),
            genLanguage('km', { sections: ['1'] }),
        ]);
        await render();
        await click('Atom Mode');
        await settle();
        expect(mocks.replaceLongText).not.toHaveBeenCalled();

        state.showingList = [genShowing(0, 'long-text')];
        await render();
        // Off, then on again: on, the lines do not line up.
        await click('Atom Mode');
        await settle();
        mocks.replaceLongText.mockClear();
        await click('Atom Mode');
        await settle();
        expect(mocks.replaceLongText).not.toHaveBeenCalled();
        expect(mocks.showSimpleToast).toHaveBeenLastCalledWith(
            'Long Text Show',
            'Every language needs the same number of lines: Section 1 — EN 2 ≠ KM 1',
        );
    });
});
