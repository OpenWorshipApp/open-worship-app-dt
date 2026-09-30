// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('../../lang/langHelpers', () => ({
    tran: (text: string) => `translated:${text}`,
}));

vi.mock('../../toast/toastHelpers', () => ({
    showSimpleToast: vi.fn(),
}));

vi.mock('../../others/LoadingComp', () => ({
    default: ({ message }: { message: string | null }) => <div>{message}</div>,
}));

vi.mock('./bibleXMLHelpers', () => ({
    checkIsValidUrl: (url: string) => url.startsWith('https://'),
    getInputByName: (form: HTMLFormElement, name: string) =>
        form.elements.namedItem(name),
    readFromFile: vi.fn(),
    readFromUrl: vi.fn(),
    saveJsonDataToXMLfile: vi.fn(),
}));

vi.mock('./bibleXMLAttributesGuessing', () => ({
    xmlFormatExample: '<bible />',
}));

vi.mock('./bibleXMLJsonDataHelpers', () => ({
    xmlTextToJson: vi.fn(),
}));

vi.mock('../../helper/appHooks', async () => {
    const React = await import('react');
    return {
        useAppCurrentRef: (value: unknown) => {
            const ref = React.useRef(value);
            ref.current = value;
            return ref;
        },
    };
});

import BibleXMLImportComp from './BibleXMLImportComp';

let container: HTMLDivElement;
let root: Root | null = null;

async function render() {
    await act(async () => {
        root = createRoot(container);
        root.render(<BibleXMLImportComp loadBibleKeys={vi.fn()} />);
    });
}

describe('BibleXMLImportComp', () => {
    beforeEach(() => {
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    afterEach(async () => {
        if (root !== null) {
            await act(async () => root?.unmount());
            root = null;
        }
        container.remove();
    });

    test('renders a localized file chooser and URL alternative', async () => {
        await render();

        const input = container.querySelector(
            'input[type="file"]',
        ) as HTMLInputElement;
        const label = container.querySelector(
            'label[for="bible-xml-file-input"]',
        );
        expect(input.classList.contains('visually-hidden')).toBe(true);
        expect(label?.textContent).toBe('translated:Choose File');
        expect(container.textContent).toContain('translated:No file chosen');
        expect(container.textContent).toContain('translated:Or');
        expect(container.textContent).toContain('translated:URL:');
    });

    test('shows the selected file name and restores the empty state', async () => {
        await render();

        const input = container.querySelector(
            'input[type="file"]',
        ) as HTMLInputElement;
        Object.defineProperty(input, 'files', {
            configurable: true,
            value: [new File(['<bible />'], 'khmer.xml', { type: 'text/xml' })],
        });
        await act(async () => {
            input.dispatchEvent(new Event('change', { bubbles: true }));
        });
        expect(container.textContent).toContain('khmer.xml');

        const cancelButton = container.querySelector(
            'button[title="translated:Cancel selection"]',
        ) as HTMLButtonElement;
        await act(async () => cancelButton.click());
        expect(container.textContent).toContain('translated:No file chosen');
        expect(container.textContent).not.toContain('khmer.xml');
    });
});
