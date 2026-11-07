// @vitest-environment jsdom

import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const { state, mocks } = vi.hoisted(() => ({
    state: {
        // `null` is what `getLangDataAsync` answers for a locale with no data.
        langData: { numList: [] } as object | null,
        digits: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'],
    },
    mocks: {
        getLangDataAsync: vi.fn(),
        toLocaleNum: vi.fn(),
    },
}));

vi.mock('../../lang/langHelpers', () => ({
    DEFAULT_LANG_CODE: 'en',
    getLangCode: (locale: string) => (locale === 'km-KH' ? 'km' : null),
    getLangDataAsync: mocks.getLangDataAsync,
    toLocaleNum: mocks.toLocaleNum,
    tran: (text: string) => text,
}));

vi.mock('../../helper/appHooks', async () => {
    const { useEffect, useRef, useState } = await import('react');
    return {
        useAppCurrentRef: (value: unknown) => {
            const ref = useRef(value);
            ref.current = value;
            return ref;
        },
        useAppStateAsync: <T,>(
            read: () => Promise<T>,
            deps: unknown[] = [],
        ) => {
            const [value, setValue] = useState<T | undefined>(undefined);
            useEffect(() => {
                void read().then(setValue);
                // eslint-disable-next-line react-hooks/exhaustive-deps
            }, deps);
            return [value, setValue] as const;
        },
    };
});

import {
    genBibleKeyXMLInput,
    genBibleNumbersMapXMLInput,
    xmlFormatExample,
} from './bibleXMLAttributesGuessing';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

async function render(element: ReactElement) {
    await act(async () => {
        root.render(element);
    });
}

async function typeInto(input: HTMLInputElement, value: string) {
    await act(async () => {
        Object.getOwnPropertyDescriptor(
            HTMLInputElement.prototype,
            'value',
        )!.set!.call(input, value);
        input.dispatchEvent(new Event('input', { bubbles: true }));
    });
}

async function click(element: Element) {
    await act(async () => {
        element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
}

function getButtons() {
    return Array.from(container.querySelectorAll('button'));
}

beforeEach(() => {
    state.langData = { numList: [] };
    mocks.getLangDataAsync.mockImplementation(async () => state.langData);
    mocks.toLocaleNum.mockImplementation(
        async (_locale: string, num: number) => state.digits[num],
    );
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(async () => {
    await act(async () => {
        root.unmount();
    });
    container.remove();
});

describe('the Bible key input', () => {
    test('typing reports the key and flags one that is already taken', async () => {
        const onChange = vi.fn();
        await render(genBibleKeyXMLInput('NEW', onChange, ['KJV']));
        const input = container.querySelector('input')!;
        const group = container.querySelector('.input-group')!;
        expect(input.value).toBe('NEW');
        expect(input.className).not.toContain('is-invalid');

        // Compared case and space insensitively: " kjv " is KJV.
        await typeInto(input, ' kjv ');
        expect(onChange).toHaveBeenLastCalledWith(' kjv ');
        expect(input.className).toContain('is-invalid');
        expect(group.getAttribute('title')).toBe('Key is already taken');

        await typeInto(input, 'KJV2');
        expect(onChange).toHaveBeenLastCalledWith('KJV2');
        expect(input.className).not.toContain('is-invalid');
        expect(group.getAttribute('title')).toBe('');
    });

    test('offers only guesses that are free and not already typed, and a press uses one', async () => {
        const onChange = vi.fn();
        await render(
            genBibleKeyXMLInput(
                'ESV',
                onChange,
                ['KJV'],
                ['kjv', 'ESV', 'NIV'],
            ),
        );
        expect(container.textContent).toContain('Guessing keys:');
        expect(getButtons().map((button) => button.textContent)).toEqual([
            'NIV',
        ]);

        await click(getButtons()[0]);
        expect(onChange).toHaveBeenLastCalledWith('NIV');
        expect(container.querySelector('input')!.value).toBe('NIV');
        // Now NIV is typed, so it is no longer offered and ESV is.
        expect(getButtons().map((button) => button.textContent)).toEqual([
            'ESV',
        ]);
    });

    test('no guess list at all without guesses', async () => {
        await render(genBibleKeyXMLInput('ESV', vi.fn(), [], []));
        expect(container.textContent).not.toContain('Guessing keys:');
        expect(getButtons()).toHaveLength(0);
    });
});

describe('the numbers map input', () => {
    test('splits the typed digits and asks for exactly ten', async () => {
        const onChange = vi.fn();
        await render(
            genBibleNumbersMapXMLInput(['0', '1'], 'km-KH' as any, onChange),
        );
        const input = container.querySelector('input')!;
        const group = container.querySelector('.input-group')!;
        expect(input.value).toBe('0 1');
        expect(container.textContent).toContain('Define numbers map for km');

        await typeInto(input, '0 1 2');
        expect(onChange).toHaveBeenLastCalledWith(['0', '1', '2']);
        expect(group.getAttribute('title')).toBe('Must have 10 numbers');
        expect(input.className).toContain('is-invalid');

        await typeInto(input, '0 1 2 3 4 5 6 7 8 9');
        expect(onChange).toHaveBeenLastCalledWith([
            '0',
            '1',
            '2',
            '3',
            '4',
            '5',
            '6',
            '7',
            '8',
            '9',
        ]);
        expect(group.getAttribute('title')).toBe('');
        expect(input.className).not.toContain('is-invalid');
    });

    test('links to a translation of the ten digits in the locale language', async () => {
        await render(genBibleNumbersMapXMLInput([], 'km-KH' as any, vi.fn()));
        const link = container.querySelector('a')!;
        expect(link.getAttribute('href')).toBe(
            'https://translate.google.com/?sl=en&tl=km&' +
                'text=0%201%202%203%204%205%206%207%208%209&op=translate',
        );
        expect(link.textContent).toBe('Translate (km)');
    });

    test('an unknown locale falls back to the default language code', async () => {
        await render(genBibleNumbersMapXMLInput([], 'xx' as any, vi.fn()));
        expect(container.querySelector('a')!.getAttribute('href')).toContain(
            'tl=en&',
        );
    });

    test('offers the locale digits once they are known and a press fills all ten', async () => {
        state.digits = [
            '０',
            '１',
            '２',
            '３',
            '４',
            '５',
            '６',
            '７',
            '８',
            '９',
        ];
        const onChange = vi.fn();
        await render(genBibleNumbersMapXMLInput([], 'km-KH' as any, onChange));
        const useButton = getButtons()[0];
        expect(useButton.textContent).toBe('Use １ ２ ３');

        await click(useButton);
        expect(onChange).toHaveBeenLastCalledWith(state.digits);
        expect(container.querySelector('input')!.value).toBe(
            state.digits.join(' '),
        );
        expect(
            container.querySelector('.input-group')!.getAttribute('title'),
        ).toBe('');
        expect(mocks.toLocaleNum).toHaveBeenCalledWith('km-KH', 9);
    });

    test('a press does nothing once the locale data has gone', async () => {
        const onChange = vi.fn();
        await render(genBibleNumbersMapXMLInput([], 'km-KH' as any, onChange));
        state.langData = null;
        await click(getButtons()[0]);
        expect(onChange).not.toHaveBeenCalled();
        expect(container.querySelector('input')!.value).toBe('');
    });

    test('no digit button for a locale with no language data', async () => {
        state.langData = null;
        await render(genBibleNumbersMapXMLInput([], 'km-KH' as any, vi.fn()));
        expect(getButtons()).toHaveLength(0);
        expect(mocks.toLocaleNum).not.toHaveBeenCalled();
    });
});

describe('the XML format example', () => {
    test('shows the attributes and the maps a Bible file is read by', () => {
        for (const part of [
            'key="EBTV"',
            'locale="en"',
            '<map>',
            '<book-map',
            '<number-map',
        ]) {
            expect(xmlFormatExample).toContain(part);
        }
    });

    // Found by UT-83 (2026-11-03): the line for 1 read
    // `<number-map value="0" value="1"/>` -- an attribute written twice,
    // which no XML parser reads, and no key at all.
    test('maps each digit 0-9 once, by its key and its value', () => {
        const numberMaps = xmlFormatExample
            .split('\n')
            .map((line) => {
                return line.trim();
            })
            .filter((line) => {
                return line.startsWith('<number-map');
            });
        expect(
            numberMaps.map((line) => {
                return [...line.matchAll(/(\w+)="([^"]*)"/g)].map(
                    ([, name, value]) => {
                        return `${name}=${value}`;
                    },
                );
            }),
        ).toEqual(
            Array.from({ length: 10 }, (_, digit) => {
                return [`key=${digit}`, `value=${digit}`];
            }),
        );
    });
});
