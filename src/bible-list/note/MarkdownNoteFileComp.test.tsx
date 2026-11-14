// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    openMarkdownPreview: vi.fn(),
    openFile: vi.fn(),
    rowProps: null as any,
    isAiEnabled: true,
    openChatbotWithFile: vi.fn(),
}));

vi.mock('../../lang/langHelpers', () => ({ tran: (key: string) => key }));
vi.mock('../../context-menu/contextMenuIconHelpers', () => ({
    genContextMenuItemIcon: (name: string) => `icon:${name}`,
}));
vi.mock('../../helper/FileSource', () => ({
    default: {
        getInstance: (filePath: string) => ({
            name: filePath
                .split('/')
                .pop()
                ?.replace(/\.[^.]+$/, ''),
        }),
    },
}));
// The base class's own imports (the editing history, the background
// manager) are nothing this row uses.
vi.mock('../../helper/AppEditableDocumentSourceAbs', () => ({
    AppDocumentSourceAbs: class {
        filePath: string;
        constructor(filePath: string) {
            this.filePath = filePath;
        }
    },
}));
vi.mock('../../server/appProvider', () => ({
    default: { systemUtils: { openFile: h.openFile } },
}));
vi.mock('../../resources/resourcePreviewOpenHelpers', () => ({
    openMarkdownPreview: h.openMarkdownPreview,
}));
vi.mock('../../others/FileItemHandlerComp', () => ({
    default: (props: any) => {
        h.rowProps = props;
        return <li>{props.renderChild(props.fileData)}</li>;
    },
}));
// Open in Chatbot is the real menu item, over the AI switch and the help
// window's own open (its two questions, then `beforeOpening`).
vi.mock('../../helper/ai/aiHelpers', () => ({
    getIsAIEnabled: () => h.isAiEnabled,
}));
vi.mock('../../helper/ai/chatbotHandoffHelpers', () => ({
    openChatbotWithFile: h.openChatbotWithFile,
}));
vi.mock('../../helper/errorHelpers', () => ({ handleError: vi.fn() }));

import MarkdownNoteFileComp from './MarkdownNoteFileComp';

const FILE_PATH = '/notes/Easter Study.md';

let host: HTMLDivElement;
let root: Root;

async function flushImports() {
    // The opener is imported at the press.
    await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 25));
    });
}

beforeEach(async () => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    h.openMarkdownPreview.mockReset();
    h.openFile.mockReset();
    h.rowProps = null;
    h.isAiEnabled = true;
    h.openChatbotWithFile.mockReset().mockResolvedValue(true);
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
    await act(async () => {
        root.render(<MarkdownNoteFileComp index={2} filePath={FILE_PATH} />);
    });
});

afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
});

describe('MarkdownNoteFileComp', () => {
    test('a row of the notes list for a file the list does not read', () => {
        expect(h.rowProps).toMatchObject({
            index: 2,
            filePath: FILE_PATH,
            className: 'note-file markdown-note-file',
            isDisabledColorNote: true,
            isSelected: false,
        });
        // What the shared menu's trash and Reload act on, read off nothing.
        expect(h.rowProps.fileData.filePath).toBe(FILE_PATH);
        expect(h.rowProps.onDrop).toBeUndefined();
        h.rowProps.reload();
        const button = host.querySelector<HTMLElement>('[role="button"]')!;
        expect(button.getAttribute('aria-label')).toBe('Easter Study');
        expect(button.tabIndex).toBe(0);
        expect(button.textContent).toBe('Easter Study');
        expect(button.querySelector('.bi-markdown')).not.toBeNull();
    });

    test('a press, Enter or Space opens one more preview window on it', async () => {
        const button = host.querySelector<HTMLElement>('[role="button"]')!;
        await act(async () => button.click());
        await flushImports();
        const press = async (key: string) => {
            const event = new KeyboardEvent('keydown', {
                key,
                bubbles: true,
                cancelable: true,
            });
            await act(async () => {
                button.dispatchEvent(event);
            });
            await flushImports();
            return event;
        };
        expect((await press('Enter')).defaultPrevented).toBe(true);
        // Space would scroll the panel out from under the row.
        expect((await press(' ')).defaultPrevented).toBe(true);
        expect((await press('a')).defaultPrevented).toBe(false);
        expect(h.openMarkdownPreview.mock.calls).toEqual([
            [FILE_PATH, { isAnother: true }],
            [FILE_PATH, { isAnother: true }],
            [FILE_PATH, { isAnother: true }],
        ]);
    });

    test('its menu previews it, opens it in the chatbot, or opens it in the default app', async () => {
        const items = h.rowProps.contextMenuItems;
        expect(
            items.map((item: any) => [item.childBefore, item.menuElement]),
        ).toEqual([
            ['icon:eye', 'Preview'],
            ['icon:robot', 'Open in Chatbot'],
            ['icon:box-arrow-up-right', 'Open in Default App'],
        ]);
        items[0].onSelect();
        await flushImports();
        expect(h.openMarkdownPreview).toHaveBeenCalledExactlyOnceWith(
            FILE_PATH,
            { isAnother: true },
        );
        expect(h.openFile).not.toHaveBeenCalled();
        items[2].onSelect();
        expect(h.openFile).toHaveBeenCalledExactlyOnceWith(FILE_PATH);
        expect(h.openMarkdownPreview).toHaveBeenCalledTimes(1);
        expect(h.openChatbotWithFile).not.toHaveBeenCalled();
    });

    // 2026-11-13, the user, with this menu open: _markdown file in
    // bible-note should have open in chatbot context menu as well_.
    test('Open in Chatbot hands the file over, its preview window brought forward once asked', async () => {
        h.rowProps.contextMenuItems[1].onSelect();
        await flushImports();
        expect(h.openChatbotWithFile).toHaveBeenCalledTimes(1);
        const [filePath, reading, noteId, beforeOpening] =
            h.openChatbotWithFile.mock.calls[0];
        // The file itself, not a note in it, and no Resources reading.
        expect([filePath, reading, noteId]).toEqual([FILE_PATH, null, null]);
        // Nothing opens before the assistant's two questions are answered.
        expect(h.openMarkdownPreview).not.toHaveBeenCalled();
        await act(async () => {
            await beforeOpening();
        });
        // The window already open on it, not one more: the chat works there.
        expect(h.openMarkdownPreview).toHaveBeenCalledExactlyOnceWith(
            FILE_PATH,
            { isAnother: false },
        );
        expect(h.openFile).not.toHaveBeenCalled();
    });

    test('with AI off its menu offers no Open in Chatbot', async () => {
        h.isAiEnabled = false;
        await act(async () => {
            root.render(
                <MarkdownNoteFileComp index={2} filePath={FILE_PATH} />,
            );
        });
        expect(
            h.rowProps.contextMenuItems.map((item: any) => item.menuElement),
        ).toEqual(['Preview', 'Open in Default App']);
    });
});
