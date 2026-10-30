// @vitest-environment jsdom

// The import form's paths BibleXMLImportComp.test.tsx does not take: a file
// chosen on disk, the three ways a submit can fail, the format example, the
// URL's clear button, and leaving the review either way.

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    reviewProps: null as any,
    showSimpleToastMock: vi.fn(),
    readFromFileMock: vi.fn(),
    readFromUrlMock: vi.fn(),
    xmlTextToJsonMock: vi.fn(),
}));

vi.mock('../../lang/langHelpers', () => ({
    tran: (text: string) => text,
}));
vi.mock('../../toast/toastHelpers', () => ({
    showSimpleToast: h.showSimpleToastMock,
}));
vi.mock('../../others/LoadingComp', () => ({
    default: ({ message }: { message?: string | null }) => (
        <div data-testid="loading">{message}</div>
    ),
}));
vi.mock('./bibleXMLHelpers', () => ({
    checkIsValidUrl: (url: string) => url.startsWith('https://'),
    getInputByName: (form: HTMLFormElement, name: string) => {
        return form.querySelector(`input[name="${name}"]`);
    },
    readFromFile: h.readFromFileMock,
    readFromUrl: h.readFromUrlMock,
}));
vi.mock('./BibleImportReviewComp', () => ({
    default: (props: any) => {
        h.reviewProps = props;
        return (
            <div data-testid="review">
                <button onClick={props.onCancel}>review-cancel</button>
                <button onClick={props.onImported}>review-imported</button>
            </div>
        );
    },
}));
vi.mock('./bibleXMLAttributesGuessing', () => ({
    xmlFormatExample: '<bible key="EXAMPLE" />',
}));
vi.mock('./bibleImportRequestHelpers', () => ({
    takeBibleImportRequest: () => null,
}));
vi.mock('./bibleXMLJsonDataHelpers', () => ({
    xmlTextToJson: h.xmlTextToJsonMock,
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

import BibleXMLImportComp from './BibleXMLImportComp';

const XML_TEXT = '<bible key="KM" />';
const XML_JSON = { info: { key: 'KM' }, books: {} };

let container: HTMLDivElement;
let root: Root;

function findButton(text: string) {
    return (
        Array.from(container.querySelectorAll('button')).find((button) => {
            return button.textContent === text;
        }) ?? null
    );
}

function getUrlInput() {
    return container.querySelector('input[name="url"]') as HTMLInputElement;
}

function getSubmit() {
    return container.querySelector('input[type="submit"]') as HTMLInputElement;
}

function getReview() {
    return container.querySelector('[data-testid="review"]');
}

async function settle() {
    for (let tick = 0; tick < 5; tick++) {
        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 5));
        });
    }
}

async function typeUrl(value: string) {
    const setter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value',
    )!.set!;
    await act(async () => {
        setter.call(getUrlInput(), value);
        getUrlInput().dispatchEvent(new Event('input', { bubbles: true }));
    });
}

async function chooseFile(name: string) {
    const input = container.querySelector(
        'input[type="file"]',
    ) as HTMLInputElement;
    Object.defineProperty(input, 'files', {
        configurable: true,
        value: [new File([XML_TEXT], name, { type: 'text/xml' })],
    });
    await act(async () => {
        input.dispatchEvent(new Event('change', { bubbles: true }));
    });
}

async function submit() {
    await act(async () => {
        container
            .querySelector('form')!
            .dispatchEvent(
                new Event('submit', { bubbles: true, cancelable: true }),
            );
    });
    await settle();
}

async function renderForm() {
    const loadBibleKeys = vi.fn();
    await act(async () => {
        root.render(<BibleXMLImportComp loadBibleKeys={loadBibleKeys} />);
    });
    return loadBibleKeys;
}

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    h.reviewProps = null;
    h.readFromFileMock.mockResolvedValue(XML_TEXT);
    h.readFromUrlMock.mockResolvedValue(XML_TEXT);
    h.xmlTextToJsonMock.mockImplementation(
        async (_text: string, options: any) => {
            options.onKeyChoices(['KM', 'KHM']);
            return XML_JSON;
        },
    );
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
});

describe('BibleXMLImportComp from a file', () => {
    test('reviews a chosen file with its name, size and key choices', async () => {
        await renderForm();
        expect(getSubmit().disabled).toBe(true);
        await chooseFile('khmer.xml');
        expect(getSubmit().disabled).toBe(false);
        const form = container.querySelector('form');

        await submit();

        expect(h.readFromFileMock).toHaveBeenCalledOnce();
        expect(h.readFromFileMock).toHaveBeenCalledWith(
            form,
            expect.any(Function),
        );
        expect(h.readFromUrlMock).not.toHaveBeenCalled();
        expect(h.xmlTextToJsonMock).toHaveBeenCalledWith(XML_TEXT, {
            isImportPreview: true,
            sourceName: 'khmer.xml',
            onKeyChoices: expect.any(Function),
        });
        expect(getReview()).not.toBeNull();
        expect(h.reviewProps).toMatchObject({
            data: XML_JSON,
            keyChoices: ['KM', 'KHM'],
            origin: { by: 'settings', fileName: 'khmer.xml', bytes: 18 },
        });
    });

    test('cancelling the review goes back to an empty form', async () => {
        await renderForm();
        await chooseFile('khmer.xml');
        await submit();

        await act(async () => findButton('review-cancel')!.click());

        expect(getReview()).toBeNull();
        expect(
            container.querySelector('#bible-xml-file-name')!.textContent,
        ).toBe('No file chosen');
    });
});

describe('BibleXMLImportComp from a link', () => {
    test('an import done reloads the Bible list and empties the form', async () => {
        const loadBibleKeys = await renderForm();
        await typeUrl('https://example.org/km.xml');
        await submit();
        expect(h.readFromUrlMock).toHaveBeenCalledOnce();
        expect(h.reviewProps.origin).toMatchObject({
            url: 'https://example.org/km.xml',
            fileName: 'km.xml',
            isLinkFromChatbot: false,
        });

        await act(async () => findButton('review-imported')!.click());

        expect(loadBibleKeys).toHaveBeenCalledOnce();
        expect(getReview()).toBeNull();
        expect(getUrlInput().value).toBe('');
    });

    test('the clear button empties the link and disables Import', async () => {
        await renderForm();
        await typeUrl('https://example.org/km.xml');
        expect(getSubmit().disabled).toBe(false);

        await act(async () => {
            (
                container.querySelector(
                    'button[title="Clear url"]',
                ) as HTMLButtonElement
            ).click();
        });

        expect(getUrlInput().value).toBe('');
        expect(getSubmit().disabled).toBe(true);
        expect(container.querySelector('button[title="Clear url"]')).toBeNull();
    });

    test('nothing read means nothing to review', async () => {
        h.readFromUrlMock.mockResolvedValue(null);
        await renderForm();
        await typeUrl('https://example.org/km.xml');

        await submit();

        expect(h.showSimpleToastMock).toHaveBeenCalledWith(
            'No Data',
            'No data to process',
        );
        expect(h.xmlTextToJsonMock).not.toHaveBeenCalled();
        expect(getReview()).toBeNull();
    });

    test('a text that does not parse as a Bible says so', async () => {
        h.xmlTextToJsonMock.mockResolvedValue(null);
        await renderForm();
        await typeUrl('https://example.org/km.xml');

        await submit();

        expect(h.showSimpleToastMock).toHaveBeenCalledWith(
            'Parsing XML',
            'Failed to parse XML data',
        );
        expect(getReview()).toBeNull();
    });

    test('a read that throws is reported', async () => {
        h.readFromUrlMock.mockRejectedValue(new Error('socket hang up'));
        await renderForm();
        await typeUrl('https://example.org/km.xml');

        await submit();

        expect(h.showSimpleToastMock).toHaveBeenCalledWith(
            'Format Submit Error',
            'Error: Error: socket hang up',
        );
        expect(getReview()).toBeNull();
        // The form is usable again.
        expect(getSubmit().disabled).toBe(false);
    });
});

test('the format example opens and closes from its question mark', async () => {
    await renderForm();
    const toggle = container.querySelector(
        'button[title="XML format example"]',
    ) as HTMLButtonElement;
    expect(container.querySelector('textarea')).toBeNull();
    expect(toggle.className).toContain('btn-outline-info');

    await act(async () => toggle.click());

    expect(container.querySelector('textarea')!.value).toBe(
        '<bible key="EXAMPLE" />',
    );
    expect(toggle.className).not.toContain('btn-outline-info');

    await act(async () => toggle.click());

    expect(container.querySelector('textarea')).toBeNull();
});
