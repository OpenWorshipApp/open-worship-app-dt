// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    langCodeMap: { 'en-US': 'en', 'km-KH': 'km' } as Record<string, string>,
    // The digits each language pack writes; a locale missing here has no
    // pack to read.
    numListMap: {} as Record<string, string[]>,
}));

vi.mock('../../lang/langHelpers', () => ({
    DEFAULT_LANG_CODE: 'en',
    getLangCode: (locale: string) => h.langCodeMap[locale] ?? null,
    getLangDataAsync: async (locale: string) => {
        const numList = h.numListMap[locale];
        return numList === undefined ? null : { numList };
    },
    toLocaleNum: async (locale: string, n: number) => {
        return h.numListMap[locale]?.[n] ?? `${n}`;
    },
    tran: (text: string) => text,
}));

vi.mock('../../helper/appHooks', async () => {
    const react = await import('react');
    return {
        useAppCurrentRef: <T,>(value: T) => {
            const ref = react.useRef(value);
            ref.current = value;
            return ref;
        },
        // The real hook: undefined until the callee settles, then its value.
        useAppStateAsync: <T,>(callee: () => Promise<T>, deps: any[] = []) => {
            const [value, setValue] = react.useState<T | undefined>();
            react.useEffect(() => {
                let isActive = true;
                callee().then((newValue) => {
                    if (isActive) {
                        setValue(newValue);
                    }
                });
                return () => {
                    isActive = false;
                };
                // eslint-disable-next-line react-hooks/exhaustive-deps
            }, deps);
            return [value, setValue];
        },
    };
});

import {
    genBibleKeyXMLInput,
    genBibleNumbersMapXMLInput,
    xmlFormatExample,
} from './bibleXMLAttributesGuessing';

const KHMER_DIGITS = ['០', '១', '២', '៣', '៤', '៥', '៦', '៧', '៨', '៩'];

let container: HTMLDivElement;
let root: Root;

function getInput() {
    return container.querySelector('input') as HTMLInputElement;
}

function findButton(text: string) {
    return (
        Array.from(container.querySelectorAll('button')).find((button) => {
            return button.textContent === text;
        }) ?? null
    );
}

// React listens for `input` events on text boxes; the value setter has to be
// the prototype's, or React's own tracker swallows the change.
async function typeInto(input: HTMLInputElement, value: string) {
    const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value',
    )!.set!;
    await act(async () => {
        setter.call(input, value);
        input.dispatchEvent(new Event('input', { bubbles: true }));
    });
}

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    h.numListMap = {};
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
});

describe('genBibleKeyXMLInput', () => {
    test('flags a key that is already taken, whatever its case', async () => {
        const onChange = vi.fn();
        await act(async () => {
            root.render(genBibleKeyXMLInput('NEW', onChange, ['KJV', 'KSV']));
        });
        expect(container.textContent).toContain('Define a Bible key');
        expect(getInput().value).toBe('NEW');
        expect(getInput().className).not.toContain('is-invalid');

        await typeInto(getInput(), 'kjv');

        expect(onChange).toHaveBeenLastCalledWith('kjv');
        expect(getInput().className).toContain('is-invalid');
        expect(
            container.querySelector('.input-group')!.getAttribute('title'),
        ).toBe('Key is already taken');

        await typeInto(getInput(), 'KJV2');

        expect(onChange).toHaveBeenLastCalledWith('KJV2');
        expect(getInput().className).not.toContain('is-invalid');
        expect(
            container.querySelector('.input-group')!.getAttribute('title'),
        ).toBe('');
    });

    test('offers only the guessed keys that are free and not already typed', async () => {
        const onChange = vi.fn();
        await act(async () => {
            root.render(
                genBibleKeyXMLInput(
                    'KM',
                    onChange,
                    ['ksv'],
                    ['KM', 'KSV', 'KH'],
                ),
            );
        });
        expect(container.textContent).toContain('Guessing keys:');
        const offered = Array.from(
            container.querySelectorAll('button.btn-outline-info'),
        ).map((button) => {
            return button.textContent;
        });
        expect(offered).toEqual(['KH']);

        await act(async () => findButton('KH')!.click());

        expect(onChange).toHaveBeenCalledWith('KH');
        expect(getInput().value).toBe('KH');
        // The key just taken from the list is no longer offered, and the one
        // left behind is.
        expect(findButton('KH')).toBeNull();
        expect(findButton('KM')).not.toBeNull();
    });

    test('has no guessing section when there is nothing to guess', async () => {
        await act(async () => {
            root.render(genBibleKeyXMLInput('KJV', vi.fn(), [], []));
        });
        expect(container.textContent).not.toContain('Guessing keys:');
        await act(async () => {
            root.render(genBibleKeyXMLInput('KJV', vi.fn(), []));
        });
        expect(container.textContent).not.toContain('Guessing keys:');
    });
});

describe('genBibleNumbersMapXMLInput', () => {
    test('offers the language pack digits and applies them all ten', async () => {
        h.numListMap['km-KH'] = KHMER_DIGITS;
        const onChange = vi.fn();
        await act(async () => {
            root.render(
                genBibleNumbersMapXMLInput(
                    '0 1 2 3 4 5 6 7 8 9'.split(' '),
                    'km-KH' as any,
                    onChange,
                ),
            );
        });
        expect(container.textContent).toContain('Define numbers map for km');
        expect(getInput().value).toBe('0 1 2 3 4 5 6 7 8 9');
        const link = container.querySelector('a') as HTMLAnchorElement;
        expect(link.href).toContain('tl=km&');
        expect(link.textContent).toBe('Translate (km)');

        const useButton = findButton('Use ១ ២ ៣');
        expect(useButton).not.toBeNull();
        await act(async () => useButton!.click());

        expect(onChange).toHaveBeenCalledWith(KHMER_DIGITS);
        expect(getInput().value).toBe(KHMER_DIGITS.join(' '));
        expect(getInput().className).not.toContain('is-invalid');
    });

    test('marks a map without exactly ten numbers invalid', async () => {
        const onChange = vi.fn();
        await act(async () => {
            root.render(
                genBibleNumbersMapXMLInput(
                    ['0', '1'],
                    'en-US' as any,
                    onChange,
                ),
            );
        });

        await typeInto(getInput(), '0 1 2');

        expect(onChange).toHaveBeenLastCalledWith(['0', '1', '2']);
        expect(getInput().className).toContain('is-invalid');
        expect(
            container.querySelector('.input-group')!.getAttribute('title'),
        ).toBe('Must have 10 numbers');

        await typeInto(getInput(), 'a b c d e f g h i j');

        expect(onChange).toHaveBeenLastCalledWith('abcdefghij'.split(''));
        expect(getInput().className).not.toContain('is-invalid');
    });

    test('offers no digits for a locale with no language pack', async () => {
        await act(async () => {
            root.render(
                genBibleNumbersMapXMLInput([], 'xx-XX' as any, vi.fn()),
            );
        });
        // An unknown locale falls back to the default language code.
        expect(container.textContent).toContain('Define numbers map for en');
        expect(
            Array.from(container.querySelectorAll('button')).filter(
                (button) => {
                    return button.textContent?.startsWith('Use ');
                },
            ),
        ).toEqual([]);
    });

    test('leaves the map alone when the pack is gone by the time it is used', async () => {
        h.numListMap['km-KH'] = KHMER_DIGITS;
        const onChange = vi.fn();
        await act(async () => {
            root.render(
                genBibleNumbersMapXMLInput(['x'], 'km-KH' as any, onChange),
            );
        });
        delete h.numListMap['km-KH'];

        await act(async () => findButton('Use ១ ២ ៣')!.click());

        expect(onChange).not.toHaveBeenCalled();
        expect(getInput().value).toBe('x');
    });
});

test('the XML format example documents the keys an import reads', () => {
    for (const attribute of ['key="EBTV"', 'locale="en"', '<book-map']) {
        expect(xmlFormatExample).toContain(attribute);
    }
});
