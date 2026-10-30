// @vitest-environment jsdom

// What BibleXMLEditorComp.test.tsx does not reach: the book-numbered line
// gutter of the books map, its live edits, the markup parse, and a save
// pressed once the text is back at its baseline.

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    monacoCalls: [] as { options: any; onContentChange: any }[],
    value: '',
    editorStore: null as any,
    store: null as any,
    languageData: null as any,
    saveMock: vi.fn(),
}));

vi.mock('monaco-editor', () => ({
    Uri: { parse: (value: string) => ({ toString: () => value }) },
}));
vi.mock('../../lang/langHelpers', () => ({
    allLocalesMap: { 'en-US': 'en', 'km-KH': 'km' },
    DEFAULT_LANG_CODE: 'en',
    getLangCode: (locale: string) => (locale === 'km-KH' ? 'km' : null),
    getLangDataAsync: async () => h.languageData,
    languageNameMap: { en: 'English', km: 'Khmer' },
    tran: (text: string) => text,
}));
vi.mock('../../helper/monacoEditorHelpers', () => ({
    useInitMonacoEditor: ({ options, onContentChange }: any) => {
        h.monacoCalls.push({ options, onContentChange });
        return h.store;
    },
}));
vi.mock('../../helper/appHooks', async () => {
    const react = await import('react');
    return {
        useAppEffect: react.useEffect,
        useAppCurrentRef: <T,>(value: T) => {
            const ref = react.useRef(value);
            ref.current = value;
            return ref;
        },
    };
});
vi.mock('../../helper/settingHelpers', async () => {
    const react = await import('react');
    return {
        useStateSettingBoolean: (_key: string, defaultValue: boolean) =>
            react.useState(defaultValue),
    };
});
vi.mock('../../helper/bible-helpers/bibleLogicHelpers1', () => ({
    getModelKeyBookMap: () => ({ GEN: 'Genesis', EXO: 'Exodus' }),
}));
vi.mock('../../helper/bible-helpers/bibleModelHelpers', () => ({
    getBibleModelInfo: () => ({ bookKeysOrder: ['GEN', 'EXO'] }),
}));
vi.mock('../../context-menu/appContextMenuHelpers', () => ({
    createMouseEvent: () => ({}),
    showAppContextMenu: vi.fn(),
}));
vi.mock('../../context-menu/contextMenuIconHelpers', () => ({
    genContextMenuItemIcon: () => null,
}));
vi.mock('../../popup-widget/popupWidgetHelpers', () => ({
    showAppInput: vi.fn(),
}));
vi.mock('./bibleXMLAttributesGuessing', () => ({
    genBibleNumbersMapXMLInput: () => null,
}));
vi.mock('./bibleEditorDirtyHelpers', () => ({
    setBibleEditorDirty: vi.fn(),
}));

import BibleXMLEditorComp, {
    genBibleBooksMapXMLInput,
} from './BibleXMLEditorComp';

let container: HTMLDivElement;
let root: Root;

function findButton(text: string) {
    return Array.from(container.querySelectorAll('button')).find((button) => {
        return button.textContent?.trim() === text;
    }) as HTMLButtonElement;
}

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    h.monacoCalls = [];
    h.value = '';
    h.languageData = null;
    h.editorStore = {
        systemContent: '',
        editorInstance: { getValue: () => h.value },
        replaceValue: vi.fn((value: string) => {
            h.value = value;
        }),
    };
    h.store = {
        editorStore: h.editorStore,
        onContainerInit: () => {},
        setNewValue: (value: string) => {
            h.value = value;
            h.editorStore.systemContent = value;
        },
    };
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
});

describe('BibleXMLEditorComp save', () => {
    test('a save pressed once the text is back at its baseline writes nothing', async () => {
        vi.useFakeTimers();
        try {
            await act(async () =>
                root.render(
                    <BibleXMLEditorComp
                        id="KJV"
                        jsonData={{ a: 1 }}
                        onStore={() => {}}
                        jsonDataSchema={
                            {
                                validate: () => ({ valid: true, errors: [] }),
                            } as any
                        }
                        save={h.saveMock}
                        editorUri={{ toString: () => 'bible-info' } as any}
                    />,
                ),
            );
            const baseline = h.value;
            const { onContentChange } = h.monacoCalls.at(-1)!;
            h.value = '{"a":2}';
            await act(async () => onContentChange(baseline, h.value));
            await act(async () => vi.advanceTimersByTimeAsync(300));
            expect(findButton('Save').disabled).toBe(false);

            // Undone in the editor before the change was seen.
            h.value = baseline;
            await act(async () => findButton('Save').click());

            expect(h.saveMock).not.toHaveBeenCalled();
            expect(h.editorStore.systemContent).toBe(baseline);
        } finally {
            vi.clearAllTimers();
            vi.useRealTimers();
        }
    });
});

describe('genBibleBooksMapXMLInput', () => {
    async function renderBooksMap(onChange = vi.fn(), locale = 'km-KH') {
        await act(async () =>
            root.render(
                genBibleBooksMapXMLInput(
                    ['Genesis', 'Exodus'],
                    locale as any,
                    'KJV',
                    onChange,
                ),
            ),
        );
        return onChange;
    }

    test('numbers each line with the book it stands for', async () => {
        await renderBooksMap();
        const { options } = h.monacoCalls.at(-1)!;
        expect(options.value).toBe('Genesis\nExodus');
        expect(options.lineNumbers(1)).toBe('Genesis (GEN) 01');
        expect(options.lineNumbers(2)).toBe('Exodus (EXO) 02');
        // Past the last book there is only the number.
        expect(options.lineNumbers(3)).toBe('03');
        expect(options.lineNumbers(66)).toBe('66');
    });

    test('hands every edit on as one name per line', async () => {
        const onChange = await renderBooksMap();
        const { onContentChange } = h.monacoCalls.at(-1)!;

        onContentChange('', 'Genèse\nExode');

        expect(onChange).toHaveBeenCalledWith(['Genèse', 'Exode']);
    });

    test('links the translation of the book names for the locale', async () => {
        await renderBooksMap(vi.fn(), 'km-KH');
        expect(
            (container.querySelector('a') as HTMLAnchorElement).href,
        ).toContain('tl=km&');
        await renderBooksMap(vi.fn(), 'xx-XX');
        expect(container.querySelector('a')!.textContent).toBe(
            'Translate (en)',
        );
    });

    describe('Parse Markup String', () => {
        // jsdom has no `innerText`. The parse marks its own line ends before
        // reading it, so the text content stands in for it faithfully.
        beforeEach(() => {
            Object.defineProperty(HTMLElement.prototype, 'innerText', {
                configurable: true,
                get() {
                    return this.textContent;
                },
            });
        });
        afterEach(() => {
            delete (HTMLElement.prototype as any).innerText;
        });

        test('turns a pasted list into one name per line', async () => {
            const onChange = await renderBooksMap();
            h.value =
                '<ul>\n  <li>Genesis   one</li>\n\n  <li> Exodus</li>\n</ul>';

            await act(async () =>
                findButton('Parse Markup String (HTML|XML)').click(),
            );

            expect(onChange).toHaveBeenCalledWith(['Genesis one', 'Exodus']);
            expect(h.editorStore.replaceValue).toHaveBeenLastCalledWith(
                'Genesis one\nExodus',
            );
        });

        test("cleans the names with the locale's own sanitizer when it has one", async () => {
            h.languageData = {
                sanitizeText: (text: string) => text.toUpperCase(),
            };
            const onChange = await renderBooksMap();
            h.value = '<p>Genesis</p><p>Exodus</p>';

            await act(async () =>
                findButton('Parse Markup String (HTML|XML)').click(),
            );

            expect(onChange).toHaveBeenCalledWith(['GENESIS', 'EXODUS']);
        });
    });
});
