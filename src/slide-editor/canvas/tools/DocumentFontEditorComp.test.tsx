// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    getJsonData: vi.fn(),
    changeSlidesFont: vi.fn(),
    filePath: '/docs/a.ows',
}));
vi.mock('../../../app-document-list/AppDocument', () => ({
    default: { getInstance: () => mocks },
}));
vi.mock('../../../app-document-list/appDocumentHelpers', () => ({
    useSelectedEditingSlideContext: () => ({ filePath: mocks.filePath }),
}));
vi.mock('../../../helper/dirSourceHelpers', () => ({
    useFileSourceEvents: vi.fn(),
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
