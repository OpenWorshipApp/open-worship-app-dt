// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    getJsonData: vi.fn(),
    changeSlidesFont: vi.fn(),
    fileEvents: vi.fn(),
    filePath: '/docs/a.ows',
}));
vi.mock('../../../app-document-list/AppDocument', () => ({
    default: { getInstance: () => mocks },
}));
vi.mock('../../../app-document-list/appDocumentHelpers', () => ({
    useSelectedEditingSlideContext: () => ({ filePath: mocks.filePath }),
}));
vi.mock('../../../helper/dirSourceHelpers', () => ({
    useFileSourceEvents: (...args: unknown[]) => mocks.fileEvents(...args),
}));
vi.mock('../../../helper/errorHelpers', () => ({ handleError: vi.fn() }));
vi.mock('../../../helper/loggerHelpers', () => ({ appWarning: vi.fn() }));
vi.mock('../../../server/appProvider', () => ({
    default: { systemUtils: { isDev: false }, envUtils: {} },
}));
vi.mock('../../../helper/settingHelpers', () => ({
    getSetting: () => null,
    setSetting: vi.fn(),
}));
vi.mock('../../../lang/langHelpers', () => ({ tran: (key: string) => key }));
vi.mock('../../../server/fontHelpers', () => ({
    useFontList: () => ({ Arial: ['400', '700'], Verdana: ['400'] }),
    toCleanFontWeight: (weight: string) => weight,
    genFontWeightOptions: () => [
        ['400', 'Regular'],
        ['700', 'Bold'],
    ],
}));

import DocumentFontEditorComp from './DocumentFontEditorComp';

let host: HTMLDivElement;
let root: Root;
const button = (text: string) =>
    Array.from(
        host.querySelectorAll<HTMLElement>('button,[role="button"]'),
    ).find((node) => node.textContent?.includes(text))!;
const checkbox = (text: string) =>
    Array.from(host.querySelectorAll('label'))
        .find((node) => node.textContent?.includes(text))!
        .querySelector<HTMLInputElement>('input')!;
const click = async (element: HTMLElement) => {
    await act(async () => element.click());
};
const select = async (label: string, value: string) => {
    await act(async () => {
        const element = host.querySelector<HTMLSelectElement>(
            `select[aria-label="${label}"]`,
        )!;
        element.value = value;
        element.dispatchEvent(new Event('change', { bubbles: true }));
    });
};

beforeEach(async () => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    mocks.filePath = '/docs/a.ows';
    mocks.changeSlidesFont.mockResolvedValue(2);
    mocks.getJsonData.mockResolvedValue({
        items: [
            {
                id: 10,
                name: 'First',
                canvasItems: [
                    { id: 1, type: 'text', text: 'Title' },
                    { id: 2, type: 'text', text: 'Body' },
                    { id: 3, type: 'text', text: 'Locked', locked: true },
                    { id: 4, type: 'image' },
                ],
            },
            { id: 20, name: 'Second', canvasItems: [{ id: 1, type: 'html' }] },
        ],
    });
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
    await act(async () => root.render(<DocumentFontEditorComp />));
    await click(button('Bulk Font'));
});
afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
});

test('all slides applies one property at a time, without reading the target list or offering weight', async () => {
    expect(mocks.getJsonData).not.toHaveBeenCalled();
    expect(host.querySelector('[aria-label="Font Weight"]')).toBeNull();
    await click(button('Apply Font Size'));
    expect(mocks.changeSlidesFont).toHaveBeenLastCalledWith(
        { fontSize: 60 },
        { includeLocked: false, targets: undefined },
    );
    await select('Font Family', 'Verdana');
    await click(button('Apply Font Family'));
    expect(mocks.changeSlidesFont).toHaveBeenLastCalledWith(
        { fontFamily: 'Verdana' },
        { includeLocked: false, targets: undefined },
    );
    expect(host.querySelector('[role="status"]')?.textContent).toBe(
        'Updated items: 2',
    );
});

test('custom scope selects a slide, narrows to an item and adds an item on another slide', async () => {
    await select('Apply to', 'choose');
    expect((button('Apply Font Size') as HTMLButtonElement).disabled).toBe(
        true,
    );
    expect(checkbox('Item ID: 3').disabled).toBe(true);
    expect(host.textContent).not.toContain('Item ID: 4');
    await click(checkbox('Slide 1: First'));
    expect(checkbox('Item ID: 1').checked).toBe(true);
    await click(checkbox('Item ID: 2'));
    expect(checkbox('Slide 1: First').indeterminate).toBe(true);
    await click(checkbox('Slide 2: Second'));
    await click(button('Apply Font Size'));
    expect(mocks.changeSlidesFont).toHaveBeenLastCalledWith(
        { fontSize: 60 },
        {
            includeLocked: false,
            targets: [
                { slideId: 10, itemIds: [1] },
                { slideId: 20, itemIds: [1] },
            ],
        },
    );
    await click(checkbox('Include locked items'));
    await click(checkbox('Item ID: 3'));
    await click(button('Apply Font Family'));
    expect(mocks.changeSlidesFont).toHaveBeenLastCalledWith(
        { fontFamily: '' },
        {
            includeLocked: true,
            targets: [
                { slideId: 20, itemIds: [1] },
                { slideId: 10, itemIds: [1, 3] },
            ],
        },
    );
});

test('changing documents clears custom targets and failed writes report failure', async () => {
    await select('Apply to', 'choose');
    await click(checkbox('Slide 1: First'));
    mocks.filePath = '/docs/b.ows';
    await act(async () => root.render(<DocumentFontEditorComp />));
    expect(
        host.querySelector<HTMLSelectElement>('[aria-label="Apply to"]')?.value,
    ).toBe('all');
    await select('Apply to', 'choose');
    expect(checkbox('Slide 1: First').checked).toBe(false);
    await click(checkbox('Slide 1: First'));
    mocks.changeSlidesFont.mockRejectedValueOnce(new Error('Disk full'));
    await click(button('Apply Font Size'));
    expect(host.querySelector('[role="status"]')?.textContent).toBe(
        'Failed to apply font changes',
    );
    expect(host.querySelector('fieldset')?.disabled).toBe(false);
});

const typeFontSize = async (value: string) => {
    await act(async () => {
        const input = host.querySelector<HTMLInputElement>(
            'input[aria-label="Font Size"]',
        )!;
        // React tracks the last value it rendered; only the native setter
        // makes the following input event count as a change.
        Object.getOwnPropertyDescriptor(
            HTMLInputElement.prototype,
            'value',
        )!.set!.call(input, value);
        input.dispatchEvent(new Event('input', { bubbles: true }));
    });
};

test('a typed font size is what gets applied, and a size that is not positive cannot be applied', async () => {
    const apply = button('Apply Font Size') as HTMLButtonElement;
    await typeFontSize('72.5');
    expect(apply.disabled).toBe(false);
    await click(apply);
    expect(mocks.changeSlidesFont).toHaveBeenLastCalledWith(
        { fontSize: 72.5 },
        { includeLocked: false, targets: undefined },
    );
    await typeFontSize('0');
    expect(apply.disabled).toBe(true);
    await typeFontSize('');
    expect(apply.disabled).toBe(true);
    expect(mocks.changeSlidesFont).toHaveBeenCalledOnce();
});

test('a second press while the first change is still being written is ignored, and the next one after it goes through', async () => {
    let finish!: (count: number) => void;
    mocks.changeSlidesFont.mockImplementationOnce(
        () =>
            new Promise<number>((resolve) => {
                finish = resolve;
            }),
    );
    const apply = button('Apply Font Size');
    // Both presses land before React re-renders the fieldset as disabled.
    await act(async () => {
        apply.click();
        apply.click();
    });
    expect(mocks.changeSlidesFont).toHaveBeenCalledOnce();
    expect(host.querySelector('fieldset')?.disabled).toBe(true);
    await act(async () => finish(0));
    expect(host.querySelector('fieldset')?.disabled).toBe(false);
    expect(host.querySelector('[role="status"]')?.textContent).toBe(
        'No items needed updating',
    );
    mocks.changeSlidesFont.mockResolvedValueOnce(5);
    await click(button('Apply Font Size'));
    expect(mocks.changeSlidesFont).toHaveBeenCalledTimes(2);
    expect(host.querySelector('[role="status"]')?.textContent).toBe(
        'Updated items: 5',
    );
});

test('a burst of document updates re-reads the target list once, after the burst settles', async () => {
    const listeners: Array<{
        events: string[];
        callback: () => void;
        filePath: string;
    }> = [];
    mocks.fileEvents.mockImplementation(
        (
            events: string[],
            callback: () => void,
            _deps: unknown[],
            filePath: string,
        ) => {
            listeners.push({ events, callback, filePath });
        },
    );
    await select('Apply to', 'choose');
    expect(mocks.getJsonData).toHaveBeenCalledOnce();
    expect(host.textContent).toContain('Slide 1: First');
    const listener = listeners.at(-1)!;
    expect(listener.events).toEqual(['update']);
    expect(listener.filePath).toBe('/docs/a.ows');
    mocks.getJsonData.mockResolvedValue({
        items: [
            {
                id: 30,
                name: 'Renamed',
                canvasItems: [
                    {
                        id: 5,
                        type: 'bible',
                        bibleRenderingList: [{ title: 'John  3:16\n' }],
                    },
                ],
            },
        ],
    });
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
        listener.callback();
        listener.callback();
        listener.callback();
        await act(async () => vi.advanceTimersByTime(499));
        expect(mocks.getJsonData).toHaveBeenCalledOnce();
        await act(async () => vi.advanceTimersByTime(1));
    } finally {
        vi.useRealTimers();
    }
    await act(async () => {});
    expect(mocks.getJsonData).toHaveBeenCalledTimes(2);
    expect(host.textContent).toContain('Slide 1: Renamed');
    expect(host.textContent).not.toContain('Slide 1: First');
    expect(host.textContent).toContain('Item ID: 5 — John 3:16');
});
