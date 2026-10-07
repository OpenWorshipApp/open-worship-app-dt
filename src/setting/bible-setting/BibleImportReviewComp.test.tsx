// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, expect, test, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ save: vi.fn(), read: vi.fn() }));
vi.mock('../../lang/langHelpers', () => ({
    tran: (text: string) => text,
    allLocalesMap: { 'km-KH': 'km', 'fr-FR': 'fr', 'en-US': 'en' },
}));
vi.mock('../../helper/appHooks', async () => {
    const React = await import('react');
    return {
        useAppEffect: React.useEffect,
        useAppCurrentRef: (value: unknown) => {
            const ref = React.useRef(value);
            ref.current = value;
            return ref;
        },
    };
});
vi.mock('./bibleXMLJsonDataHelpers', () => ({
    getAllXMLFileKeys: async () => ({ KJV: '/existing.xml' }),
}));
vi.mock('../../helper/bible-helpers/bibleDownloadHelpers', () => ({
    getDownloadedBibleInfoList: async () => [],
}));
vi.mock('./bibleImportSaveHelpers', () => ({ saveNewBibleImport: mocks.save }));
vi.mock('../../chatbot/mcpClient', () => ({
    callTool: mocks.read,
    parseToolJson: JSON.parse,
}));
import BibleImportReviewComp from './BibleImportReviewComp';
let root: Root;
let host: HTMLDivElement;
const data = {
    info: {
        key: '',
        locale: 'km-KH',
        title: 'Khmer Bible 1954',
        numbersMap: {},
        keyBookMap: { GEN: 'Genesis' },
    },
} as any;
const importButton = () =>
    Array.from(host.querySelectorAll('button')).find(
        (x) => x.textContent === 'Import',
    )!;
beforeEach(async () => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    mocks.save.mockReset().mockResolvedValue(true);
    mocks.read.mockReset().mockRejectedValue(new Error('offline'));
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
    await act(async () => {
        root.render(
            <BibleImportReviewComp
                data={data}
                keyChoices={[]}
                onCancel={vi.fn()}
                onImported={vi.fn()}
            />,
        );
    });
    await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 30));
    });
});
afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
});
test('offers built-in choices offline, requires a key, and saves the selected names and digits only on Import', async () => {
    expect(importButton().disabled).toBe(true);
    expect(mocks.save).not.toHaveBeenCalled();
    const key = Array.from(host.querySelectorAll('button')).find(
        (x) => x.textContent === 'KM1954',
    )!;
    await act(async () => key.click());
    const select = host.querySelector(
        '[aria-label="Book name mapping"]',
    ) as HTMLSelectElement;
    expect(select.options.length).toBeGreaterThan(1);
    await act(async () => {
        select.value = '1';
        select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await act(async () => importButton().click());
    expect(mocks.save).toHaveBeenCalledWith(
        expect.objectContaining({
            info: expect.objectContaining({
                key: 'KM1954',
                locale: 'km-KH',
                numbersMap: expect.objectContaining({ '0': '០', '9': '៩' }),
                keyBookMap: expect.objectContaining({ GEN: 'លោកុប្បត្តិ' }),
            }),
        }),
    );
    expect(data.info.key).toBe('');
});
test('Cancel does not write the preview', async () => {
    const cancel = Array.from(host.querySelectorAll('button')).find(
        (x) => x.textContent === 'Cancel',
    )!;
    await act(async () => cancel.click());
    expect(mocks.save).not.toHaveBeenCalled();
});

test('a late online result preserves the selected built-in list and adds its source', async () => {
    let finish!: (text: string) => void;
    mocks.read.mockImplementationOnce(
        () =>
            new Promise<string>((resolve) => {
                finish = resolve;
            }),
    );
    await act(async () => {
        root.render(
            <BibleImportReviewComp
                key="online"
                data={data}
                keyChoices={[]}
                onCancel={vi.fn()}
                onImported={vi.fn()}
            />,
        );
    });
    const select = host.querySelector(
        '[aria-label="Book name mapping"]',
    ) as HTMLSelectElement;
    await act(async () => {
        select.value = '1';
        select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    const sets = (await import('../../lang/data/km/bibleBooks.json')).default;
    await act(async () =>
        finish(
            JSON.stringify({
                bookNames: [
                    sets[1].books,
                    Array.from({ length: 66 }, (_, index) => `Online ${index}`),
                ],
                sources: [
                    {
                        label: 'Publisher',
                        url: 'https://www.bible.com/versions/1270',
                    },
                    {
                        label: 'Another edition',
                        url: 'https://www.bible.com/versions/85',
                    },
                ],
                warnings: [],
                searchUrl: '',
                moreAvailable: false,
                nextOffset: 3,
            }),
        ),
    );
    expect(select.value).toBe('1');
    expect(select.options).toHaveLength(5);
    expect(
        host.querySelector('a[href="https://www.bible.com/versions/1270"]'),
    ).not.toBeNull();
});

test('preserves a custom digit map and keeps the selected books when the locale is unchanged', async () => {
    const digits = Array.from({ length: 10 }, (_, index) => `d${index}`);
    await act(async () => {
        root.render(
            <BibleImportReviewComp
                key="custom"
                data={{
                    ...data,
                    info: {
                        ...data.info,
                        key: 'CUSTOM',
                        numbersMap: Object.fromEntries(
                            digits.map((digit, index) => [index, digit]),
                        ),
                    },
                }}
                keyChoices={[]}
                onCancel={vi.fn()}
                onImported={vi.fn()}
            />,
        );
    });
    const select = host.querySelector(
        '[aria-label="Book name mapping"]',
    ) as HTMLSelectElement;
    await act(async () => {
        select.value = '1';
        select.dispatchEvent(new Event('change', { bubbles: true }));
        host.querySelector('[aria-label="Locale"]')!.dispatchEvent(
            new FocusEvent('focusout', { bubbles: true }),
        );
    });
    expect(select.value).toBe('1');
    await act(async () => importButton().click());
    expect(mocks.save.mock.calls[0][0].info.numbersMap['9']).toBe('d9');
});
