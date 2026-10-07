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
vi.mock('./bibleImportRequestHelpers', () => ({
    takeBibleImportRequest: () => null,
}));

vi.mock('./bibleXMLJsonDataHelpers', () => ({
    xmlTextToJson: vi.fn(),
}));

const openChatbotAsking = vi.fn(async () => true);
vi.mock('../../helper/ai/chatbotHandoffHelpers', () => ({
    openChatbotAsking,
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

    test('the assistant button starts an import in the chat, with the typed link', async () => {
        await render();
        const button = Array.from(container.querySelectorAll('button')).find(
            (one) => {
                return one.textContent?.includes(
                    'translated:Let the assistant import a Bible for me',
                );
            },
        ) as HTMLButtonElement;
        expect(container.textContent).toContain(
            'translated:It finds Bibles in your language',
        );
        await act(async () => button.click());
        expect(openChatbotAsking).toHaveBeenLastCalledWith('Import bible');

        const urlInput = container.querySelector(
            'input[name="url"]',
        ) as HTMLInputElement;
        const setter = Object.getOwnPropertyDescriptor(
            HTMLInputElement.prototype,
            'value',
        )?.set;
        await act(async () => {
            setter?.call(urlInput, 'https://example.com/KhmerBible.xml');
            urlInput.dispatchEvent(new Event('input', { bubbles: true }));
        });
        expect(container.textContent).toContain(
            'translated:It will use the link you typed below.',
        );
        await act(async () => button.click());
        expect(openChatbotAsking).toHaveBeenLastCalledWith(
            'Import bible from https://example.com/KhmerBible.xml',
        );
    });
});
