// @vitest-environment jsdom

import { readFileSync } from 'node:fs';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { extractDictionary } from '../../../tools/owa-devtools-mcp/tran.mjs';

const { state, mocks } = vi.hoisted(() => ({
    state: {
        value: '',
        store: null as any,
        editorStore: null as any,
        onChange: null as null | ((oldValue: string, newValue: string) => void),
        dictionaries: [] as Record<string, string>[],
        languageData: null as any,
        numbersChanged: null as null | ((values: string[]) => void),
    },
    mocks: {
        dirty: vi.fn(),
        save: vi.fn(),
        schema: vi.fn(),
        input: vi.fn(),
        menu: vi.fn(),
    },
}));

vi.mock('monaco-editor', () => ({
    Uri: { parse: (value: string) => ({ toString: () => value }) },
}));
vi.mock('../../lang/langHelpers', () => ({
    allLocalesMap: { 'en-US': 'en', 'km-KH': 'km', 'fr-FR': 'fr' },
    DEFAULT_LANG_CODE: 'en',
    getLangCode: () => 'en',
    getLangDataAsync: async () => state.languageData,
    languageNameMap: { en: 'English', km: 'Khmer', fr: 'French' },
    tran: (key: string) => {
        for (const dictionary of state.dictionaries) {
            if (dictionary[key.trim().toLowerCase()] === undefined)
                throw new Error(`Missing translation: ${key}`);
        }
        return key;
    },
}));
vi.mock('../../helper/monacoEditorHelpers', () => ({
    useInitMonacoEditor: ({ onContentChange }: any) => {
        state.onChange = onContentChange;
        return state.store;
    },
}));
vi.mock('../../helper/appHooks', async () => {
    const { useEffect, useRef } = await import('react');
    return {
        useAppEffect: useEffect,
        useAppCurrentRef: (value: any) => {
            const ref = useRef(value);
            ref.current = value;
            return ref;
        },
    };
});
vi.mock('../../helper/settingHelpers', async () => {
    const { useState } = await import('react');
    return {
        useStateSettingBoolean: (_key: string, fallback: boolean) =>
            useState(fallback),
    };
});
vi.mock('../../helper/bible-helpers/bibleLogicHelpers1', () => ({
    getModelKeyBookMap: () => ({ GEN: 'Genesis' }),
}));
vi.mock('../../helper/bible-helpers/bibleModelHelpers', () => ({
    getBibleModelInfo: () => ({ bookKeysOrder: ['GEN'] }),
}));
vi.mock('../../context-menu/appContextMenuHelpers', () => ({
    createMouseEvent: () => ({}),
    showAppContextMenu: mocks.menu,
}));
vi.mock('../../context-menu/contextMenuIconHelpers', () => ({
    genContextMenuItemIcon: () => null,
}));
vi.mock('../../popup-widget/popupWidgetHelpers', () => ({
    showAppInput: mocks.input,
}));
vi.mock('./bibleXMLAttributesGuessing', () => ({
    genBibleNumbersMapXMLInput: (
        _numbers: string[],
        _locale: string,
        changed: any,
    ) => {
        state.numbersChanged = changed;
        return 'Numbers editor';
    },
}));
vi.mock('./bibleEditorDirtyHelpers', () => ({
    setBibleEditorDirty: mocks.dirty,
}));

import BibleXMLEditorComp, {
    addMonacoBibleInfoActions,
    genBibleBooksMapXMLInput,
} from './BibleXMLEditorComp';

const dictionaries = ['km', 'fr'].map((code) =>
    extractDictionary(readFileSync(`src/lang/data/${code}/index.ts`, 'utf8')),
);
const uri = { toString: () => 'bible://KJV' } as any;
let container: HTMLDivElement;
let root: Root;

function schema(value: any) {
    mocks.schema(value);
    return typeof value?.a === 'number'
        ? { valid: true, errors: [] }
        : { valid: false, errors: ['a must be a number'] };
}

async function render(data: any = { a: 1 }) {
    await act(async () => {
        root.render(
            <BibleXMLEditorComp
                id="KJV"
                jsonData={data}
                onStore={() => {}}
                jsonDataSchema={{ validate: schema } as any}
                save={mocks.save}
                editorUri={uri}
            />,
        );
    });
}

async function edit(newValue: string) {
    const oldValue = state.editorStore.systemContent;
    state.value = newValue;
    await act(async () => state.onChange?.(oldValue, newValue));
}

async function advance() {
    await act(async () => vi.advanceTimersByTimeAsync(300));
}

function button(text: string) {
    const found = [...container.querySelectorAll('button')].find(
        (node) => node.textContent?.trim() === text,
    );
    if (!found) throw new Error(`Missing button: ${text}`);
    return found as HTMLButtonElement;
}

beforeEach(() => {
    vi.useFakeTimers();
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    state.value = '';
    state.dictionaries = dictionaries;
    state.onChange = null;
    state.languageData = null;
    state.numbersChanged = null;
    state.editorStore = {
        systemContent: '',
        editorInstance: { getValue: () => state.value },
        replaceValue: vi.fn((value: string) => {
            state.value = value;
        }),
    };
    state.store = {
        editorStore: state.editorStore,
        onContainerInit: () => {},
        setNewValue: vi.fn((value: string) => {
            state.value = value;
            state.editorStore.systemContent = value;
        }),
    };
    mocks.input.mockResolvedValue(false);
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
});

afterEach(async () => {
    await act(async () => root.unmount());
    vi.clearAllTimers();
    vi.useRealTimers();
    container.remove();
});

describe('Bible XML JSON editor', () => {
    test('loads its baseline and starts clean with saving and reset disabled', async () => {
        await render();
        expect(JSON.parse(state.value)).toEqual({ a: 1 });
        expect(button('Save').disabled).toBe(true);
        expect(button('Reset').disabled).toBe(true);
        expect(mocks.dirty).toHaveBeenCalledWith('KJV', 'bible://KJV', false);
        expect(mocks.schema).not.toHaveBeenCalled();
    });

    test('marks a keystroke dirty immediately and validates only after debounce', async () => {
        await render();
        await edit('{"a":2}');
        expect(container.textContent).toContain('Unsaved changes');
        expect(button('Reset').disabled).toBe(false);
        expect(button('Save').disabled).toBe(true);
        expect(mocks.dirty).toHaveBeenLastCalledWith(
            'KJV',
            'bible://KJV',
            true,
        );
        expect(mocks.schema).not.toHaveBeenCalled();
        await advance();
        expect(button('Save').disabled).toBe(false);
        expect(mocks.schema).toHaveBeenCalledWith({ a: 2 });
    });

    test.each(['{broken', '{"a":"wrong"}', '{\n "a": 1\n}'])(
        'does not offer saving for invalid or equivalent JSON: %s',
        async (value) => {
            await render();
            await edit(value);
            await advance();
            expect(button('Save').disabled).toBe(true);
            expect(button('Reset').disabled).toBe(false);
        },
    );

    test('returning to the baseline cancels pending validation and clears dirty state', async () => {
        await render();
        const original = state.value;
        await edit('{"a":2}');
        await edit(original);
        await advance();
        expect(button('Save').disabled).toBe(true);
        expect(button('Reset').disabled).toBe(true);
        expect(mocks.schema).not.toHaveBeenCalled();
        expect(mocks.dirty).toHaveBeenLastCalledWith(
            'KJV',
            'bible://KJV',
            false,
        );
    });

    test('saves valid changed JSON and makes it the new reset baseline', async () => {
        await render();
        await edit('{"a":2}');
        await advance();
        await act(async () => button('Save').click());
        expect(mocks.save).toHaveBeenCalledWith({ a: 2 });
        expect(state.editorStore.systemContent).toBe('{"a":2}');
        expect(button('Save').disabled).toBe(true);
        expect(button('Reset').disabled).toBe(true);
        expect(mocks.dirty).toHaveBeenLastCalledWith(
            'KJV',
            'bible://KJV',
            false,
        );
        await edit('{"a":3}');
        await act(async () => button('Reset').click());
        expect(state.value).toBe('{"a":2}');
        expect(mocks.save).toHaveBeenCalledOnce();
    });

    test('reset discards an unsaved edit before its pending validation can run', async () => {
        await render();
        const baseline = state.value;
        await edit('{"a":2}');
        await act(async () => button('Reset').click());
        await advance();
        expect(state.value).toBe(baseline);
        expect(mocks.schema).not.toHaveBeenCalled();
        expect(button('Save').disabled).toBe(true);
    });

    test('full view toggles without changing the edit and a new prop reseeds it', async () => {
        await render();
        await edit('{"a":2}');
        await act(async () => button('Full view').click());
        expect(container.querySelector('.app-full-view')).not.toBeNull();
        await act(async () => button('Exit full view').click());
        expect(container.querySelector('.app-full-view')).toBeNull();
        await render({ a: 3 });
        expect(JSON.parse(state.value)).toEqual({ a: 3 });
        expect(button('Reset').disabled).toBe(true);
    });

    test('an absent Bible removes the editor and unmount clears its dirty flag', async () => {
        await render(null);
        expect(container.querySelector('.card')).toBeNull();
        await render();
        await edit('{"a":2}');
        await act(async () => root.unmount());
        expect(mocks.dirty).toHaveBeenLastCalledWith(
            'KJV',
            'bible://KJV',
            false,
        );
        root = createRoot(container);
    });
});

describe('Bible book names editor and Monaco actions', () => {
    test('starts with the selected names and resets to the model names', async () => {
        const changed = vi.fn();
        await act(async () =>
            root.render(
                genBibleBooksMapXMLInput(
                    ['First', 'Second'],
                    'en-US',
                    'KJV',
                    changed,
                ),
            ),
        );
        expect(state.value).toBe('First\nSecond');
        expect(container.textContent).toContain('Bible Key: KJV');
        await act(async () => button('Reset').click());
        expect(state.value).toBe('Genesis');
    });

    test('offers a disabled choice when the locale has no bundled book list', async () => {
        await act(async () =>
            root.render(
                genBibleBooksMapXMLInput(['First'], 'en-US', 'KJV', vi.fn()),
            ),
        );
        await act(async () => button('Guessing Names').click());
        expect(mocks.menu.mock.calls[0][1][0]).toMatchObject({
            disabled: true,
        });
    });

    test('puts the current Bible book list first and applies the chosen names', async () => {
        const changed = vi.fn();
        state.languageData = {
            bibleBooks: [
                { keys: ['OTHER'], books: ['Other Genesis', 'Other Exodus'] },
                { keys: ['KJV'], books: ['Genesis', 'Exodus'] },
            ],
        };
        await act(async () =>
            root.render(
                genBibleBooksMapXMLInput(['Old'], 'en-US', 'kjv', changed),
            ),
        );
        await act(async () => button('Guessing Names').click());
        const choices = mocks.menu.mock.calls[0][1];
        expect(choices[0].title).toBe('KJV');
        await act(async () => choices[0].onSelect());
        expect(changed).toHaveBeenCalledWith(['Genesis', 'Exodus']);
        expect(state.value).toBe('Genesis\nExodus');
    });

    test('does not parse plain text as markup', async () => {
        state.languageData = { sanitizeText: vi.fn() };
        const changed = vi.fn();
        await act(async () =>
            root.render(
                genBibleBooksMapXMLInput(['Genesis'], 'en-US', 'KJV', changed),
            ),
        );
        await act(async () => button('Parse Markup String (HTML|XML)').click());
        expect(changed).not.toHaveBeenCalled();
        expect(state.languageData.sanitizeText).not.toHaveBeenCalled();
    });

    test('adds number, locale and book actions that apply confirmed choices', async () => {
        const actions = new Map<string, any>();
        const setInfo = vi.fn();
        const info = {
            key: 'KJV',
            locale: 'en-US',
            numbersMap: { '0': '0', '1': '1' },
            keyBookMap: { GEN: 'Genesis', EXO: 'Exodus' },
        };
        addMonacoBibleInfoActions(
            {
                editorInstance: {
                    addAction: (action: any) => actions.set(action.id, action),
                },
                lastMouseClickPos: { x: 20, y: 30 },
            } as any,
            () => info as any,
            setInfo,
        );
        expect([...actions.keys()]).toEqual([
            'edit-numbers-map',
            'choose-locale',
            'edit-books-map',
        ]);
        mocks.input.mockImplementationOnce(async () => {
            state.numbersChanged?.(['០', '១']);
            return true;
        });
        await actions.get('edit-numbers-map').run();
        expect(setInfo).toHaveBeenCalledWith({
            numbersMap: { '0': '០', '1': '១' },
        });
        await actions.get('choose-locale').run();
        const locales = mocks.menu.mock.calls[0][1];
        await locales
            .find((item: any) => item.menuElement.startsWith('km-KH'))
            .onSelect();
        expect(setInfo).toHaveBeenCalledWith({ locale: 'km-KH' });
        mocks.input.mockImplementationOnce(
            async (_label: string, element: any) => {
                element.props.onChange('New Genesis\nNew Exodus');
                return true;
            },
        );
        await actions.get('edit-books-map').run();
        expect(setInfo).toHaveBeenCalledWith({
            ...info,
            keyBookMap: { GEN: 'New Genesis', EXO: 'New Exodus' },
        });
    });
});
