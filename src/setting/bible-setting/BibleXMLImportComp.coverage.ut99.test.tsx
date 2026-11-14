// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// Import XML File: a chosen file, every way the read can come back empty or
// broken, the example, and leaving the review either way.
const { state, mocks } = vi.hoisted(() => ({
    state: {
        reviewProps: null as any,
    },
    mocks: {
        toast: vi.fn(),
        readFromFile: vi.fn(),
        readFromUrl: vi.fn(),
        toJson: vi.fn(),
        loadBibleKeys: vi.fn(),
    },
}));

vi.mock('../../lang/langHelpers', () => ({ tran: (text: string) => text }));
vi.mock('../../toast/toastHelpers', () => ({ showSimpleToast: mocks.toast }));
vi.mock('../../others/LoadingComp', () => ({
    default: ({ message }: { message?: string | null }) => (
        <div className="loading">{message ?? 'Loading'}</div>
    ),
}));
vi.mock('./bibleXMLHelpers', () => ({
    checkIsValidUrl: (url: string) => url.startsWith('https://'),
    getInputByName: (form: HTMLFormElement, name: string) =>
        form.elements.namedItem(name),
    readFromFile: mocks.readFromFile,
    readFromUrl: mocks.readFromUrl,
}));
vi.mock('./BibleImportReviewComp', () => ({
    default: (props: any) => {
        state.reviewProps = props;
        return <div className="review">review {props.data.info.key}</div>;
    },
}));
vi.mock('./bibleXMLAttributesGuessing', () => ({
    xmlFormatExample: '<bible key="EBTV"/>',
}));
vi.mock('./bibleImportRequestHelpers', () => ({
    takeBibleImportRequest: () => null,
}));
vi.mock('./bibleXMLJsonDataHelpers', () => ({ xmlTextToJson: mocks.toJson }));
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

import BibleXMLImportComp from './BibleXMLImportComp';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

async function wait() {
    await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
    });
}

async function chooseFile(name: string) {
    const input = container.querySelector(
        'input[type="file"]',
    ) as HTMLInputElement;
    Object.defineProperty(input, 'files', {
        configurable: true,
        value: [new File(['<bible/>'], name, { type: 'text/xml' })],
    });
    await act(async () => {
        input.dispatchEvent(new Event('change', { bubbles: true }));
    });
}

async function typeUrl(value: string) {
    const input = container.querySelector(
        'input[name="url"]',
    ) as HTMLInputElement;
    await act(async () => {
        Object.getOwnPropertyDescriptor(
            HTMLInputElement.prototype,
            'value',
        )!.set!.call(input, value);
        input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    return input;
}

async function submit() {
    const form = container.querySelector('form') as HTMLFormElement;
    await act(async () => {
        form.dispatchEvent(
            new Event('submit', { bubbles: true, cancelable: true }),
        );
    });
    await wait();
    await wait();
}

beforeEach(async () => {
    state.reviewProps = null;
    mocks.readFromFile.mockResolvedValue('<bible>✝</bible>');
    mocks.readFromUrl.mockResolvedValue('<bible/>');
    mocks.toJson.mockResolvedValue({ info: { key: 'XX' }, books: {} });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
        root.render(<BibleXMLImportComp loadBibleKeys={mocks.loadBibleKeys} />);
    });
});

afterEach(async () => {
    await act(async () => {
        root.unmount();
    });
    container.remove();
});

describe('importing a chosen file', () => {
    test('reads the file and opens the review with its name and size', async () => {
        await chooseFile('Symbols.xml');
        await submit();
        expect(mocks.readFromFile).toHaveBeenCalledOnce();
        expect(mocks.readFromUrl).not.toHaveBeenCalled();
        expect(mocks.toJson).toHaveBeenCalledWith(
            '<bible>✝</bible>',
            expect.objectContaining({
                isImportPreview: true,
                sourceName: 'Symbols.xml',
            }),
        );
        expect(container.textContent).toBe('review XX');
        expect(state.reviewProps.origin).toEqual({
            by: 'settings',
            fileName: 'Symbols.xml',
            // `<bible>` and `</bible>` plus one 3-byte symbol.
            bytes: 18,
        });
    });

    test('the key choices the parser found reach the review', async () => {
        mocks.toJson.mockImplementation(async (_text: string, options: any) => {
            options.onKeyChoices(['XX1954', 'XXSV']);
            return { info: { key: 'XX' }, books: {} };
        });
        await chooseFile('Symbols.xml');
        await submit();
        expect(state.reviewProps.keyChoices).toEqual(['XX1954', 'XXSV']);
    });

    test('nothing read says there was no data', async () => {
        mocks.readFromFile.mockResolvedValue(null);
        await chooseFile('Empty.xml');
        await submit();
        expect(mocks.toast).toHaveBeenCalledWith(
            'No Data',
            'No data to process',
        );
        expect(mocks.toJson).not.toHaveBeenCalled();
        expect(container.querySelector('.review')).toBeNull();
    });

    test('text that is not a Bible says it could not be parsed', async () => {
        mocks.toJson.mockResolvedValue(null);
        await chooseFile('Song.xml');
        await submit();
        expect(mocks.toast).toHaveBeenCalledWith(
            'Parsing XML',
            'Failed to parse XML data',
        );
        expect(container.querySelector('.review')).toBeNull();
    });

    test('a read that throws is reported with its reason', async () => {
        mocks.readFromFile.mockRejectedValue(
            new Error('locked by another app'),
        );
        await chooseFile('Locked.xml');
        await submit();
        expect(mocks.toast).toHaveBeenCalledWith(
            'Format Submit Error',
            'Error: Error: locked by another app',
        );
    });

    test('with neither a file nor a valid link nothing is read', async () => {
        await typeUrl('not a link');
        await submit();
        expect(mocks.readFromFile).not.toHaveBeenCalled();
        expect(mocks.readFromUrl).not.toHaveBeenCalled();
        expect(mocks.toast).toHaveBeenCalledWith(
            'No Data',
            'No data to process',
        );
    });
});

describe('leaving the review', () => {
    test('Cancel goes back to an empty form and reloads nothing', async () => {
        await chooseFile('Symbols.xml');
        await submit();
        await act(async () => {
            state.reviewProps.onCancel();
        });
        expect(container.querySelector('.review')).toBeNull();
        expect(container.textContent).toContain('No file chosen');
        expect(mocks.loadBibleKeys).not.toHaveBeenCalled();
    });

    test('an import clears the link and reloads the Bible list', async () => {
        await typeUrl('https://example.org/Symbols.xml');
        await submit();
        expect(mocks.readFromUrl).toHaveBeenCalledOnce();
        await act(async () => {
            state.reviewProps.onImported();
        });
        expect(mocks.loadBibleKeys).toHaveBeenCalledOnce();
        const input = container.querySelector(
            'input[name="url"]',
        ) as HTMLInputElement;
        expect(input.value).toBe('');
    });
});

describe('the rest of the form', () => {
    test('the example toggles in and out', async () => {
        const toggle = container.querySelector(
            'button[title="XML format example"]',
        ) as HTMLButtonElement;
        expect(container.querySelector('textarea')).toBeNull();
        expect(toggle.className).toContain('btn-outline-info');
        await act(async () => toggle.click());
        expect(container.querySelector('textarea')!.value).toBe(
            '<bible key="EBTV"/>',
        );
        expect(toggle.className).not.toContain('btn-outline-info');
        await act(async () => toggle.click());
        expect(container.querySelector('textarea')).toBeNull();
    });

    test('a valid link can be cleared, an invalid one is marked', async () => {
        const input = await typeUrl('example.org');
        expect(input.className).toContain('is-invalid');
        expect(input.title).toBe('Invalid URL');
        expect(container.querySelector('button[title="Clear url"]')).toBeNull();

        await typeUrl('https://example.org/Symbols.xml');
        expect(input.className).not.toContain('is-invalid');
        const clear = container.querySelector(
            'button[title="Clear url"]',
        ) as HTMLButtonElement;
        await act(async () => clear.click());
        expect(input.value).toBe('');
        expect(
            (
                container.querySelector(
                    'input[type="submit"]',
                ) as HTMLInputElement
            ).disabled,
        ).toBe(true);
    });
});
