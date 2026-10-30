// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    controlArgs: null as any,
    widgetProps: null as any,
    controllers: [] as any[],
    getEditingResult: vi.fn(),
    keyHandlers: new Map<string, () => unknown>(),
    ctrlEnter: { label: 'Ctrl+Enter' },
    ctrlShiftEnter: { label: 'Ctrl+Shift+Enter' },
}));

vi.mock('../../app-modal/FloatingWidgetComp', () => ({
    default: (props: any) => {
        h.widgetProps = props;
        return (
            <section className="floating">
                <button
                    type="button"
                    className="widget-close"
                    onClick={props.onClose}
                >
                    x
                </button>
                {props.children}
            </section>
        );
    },
}));
vi.mock('./bibleNoteHelpers1', () => ({
    useBibleNoteControl: (args: any) => {
        h.controlArgs = args;
    },
}));
vi.mock('../../bible-reader/BibleItemsViewController', async () => {
    const { createContext } = await import('react');
    return { BibleItemsViewControllerContext: createContext(null) };
});
vi.mock('../../bible-lookup/RenderBibleLookupComp', async () => {
    const { use } = await import('react');
    const { BibleItemsViewControllerContext } =
        await import('../../bible-reader/BibleItemsViewController');
    return {
        default: () => {
            const controller: any = use(BibleItemsViewControllerContext);
            return (
                <div className="lookup" data-suffix={controller.suffix}>
                    {controller.extraEditingActionButtons}
                </div>
            );
        },
    };
});
vi.mock('../../bible-reader/LookupBibleItemController', () => ({
    default: class {
        suffix: string;
        isMinimized = false;
        extraEditingActionButtons: unknown = null;
        constructor(suffix: string) {
            this.suffix = suffix;
            h.controllers.push(this);
        }
        getEditingResult() {
            return h.getEditingResult();
        }
    },
}));
vi.mock('../../lang/langHelpers', () => ({ tran: (key: string) => key }));
vi.mock('../../bible-lookup/bibleActionHelpers', () => ({
    ctrlEnterEventMapper: h.ctrlEnter,
    ctrlShiftEnterEventMapper: h.ctrlShiftEnter,
}));
vi.mock('../../event/KeyboardEventListener', () => ({
    toShortcutKey: (mapper: { label: string }) => mapper.label,
    useKeyboardRegistering: (
        mappers: { label: string }[],
        handler: () => unknown,
    ) => {
        h.keyHandlers.set(mappers[0].label, handler);
    },
}));

import NoteItemEditorPopupComp from './NoteItemEditorPopupComp';

let host: HTMLDivElement;
let root: Root;
let bibleNote: any;
let note: any;
let noteItem: any;
let toFullText: ReturnType<typeof vi.fn>;

async function renderPopup(isReadOnly?: boolean) {
    await act(async () => {
        root.render(
            <NoteItemEditorPopupComp
                bibleNote={bibleNote}
                note={note}
                noteItem={noteItem}
                isReadOnly={isReadOnly}
            />,
        );
    });
}

async function showLookup() {
    await act(async () => h.controlArgs.setIsShowingBibleLookup(true));
}

function getButton(label: string) {
    return host.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`)!;
}

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    h.controlArgs = null;
    h.widgetProps = null;
    h.controllers = [];
    h.keyHandlers.clear();
    toFullText = vi.fn(async () => 'John 3:16 For God so loved the world');
    h.getEditingResult.mockResolvedValue({
        result: { bibleItem: { toFullText } },
    });
    bibleNote = { addText: vi.fn() };
    note = { filePath: '/notes/Default.own' };
    noteItem = { id: 2 };
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
});

afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
});

describe('the note item editor popup', () => {
    test('hands the editor its footer controls and shows nothing more until asked', async () => {
        await renderPopup();
        expect(host.innerHTML).toBe('');
        expect(h.controlArgs).toMatchObject({
            bibleNote,
            note,
            noteItem,
            isReadOnly: false,
        });
    });

    test('Open Bible Lookup shows a minimized note lookup in a floating panel', async () => {
        await renderPopup();
        await showLookup();
        const lookup = host.querySelector<HTMLElement>('.lookup')!;
        expect(lookup.dataset.suffix).toBe('bible-note');
        expect(h.controllers).toHaveLength(1);
        expect(h.controllers[0].isMinimized).toBe(true);
        expect(h.widgetProps.options).toEqual({
            width: 550,
            height: 700,
            minWidth: 300,
            minHeight: 200,
        });
        expect(h.widgetProps.collapsedChildren.props.children).toBe(
            'Bible Lookup',
        );
        expect(getButton('Insert Collapse Bible Text').title).toBe(
            'Insert Collapse Bible Text [Ctrl+Enter]',
        );
        expect(getButton('Insert Bible Text').title).toBe(
            'Insert Bible Text [Ctrl+Shift+Enter]',
        );
        await act(async () =>
            host.querySelector<HTMLButtonElement>('.widget-close')!.click(),
        );
        expect(host.querySelector('.lookup')).toBeNull();
    });

    test('the collapse button inserts the passage text as it is', async () => {
        await renderPopup();
        await showLookup();
        await act(async () => getButton('Insert Collapse Bible Text').click());
        expect(bibleNote.addText.mock.calls).toEqual([
            ['John 3:16 For God so loved the world'],
        ]);
    });

    test('the insert button opens a block before the passage text', async () => {
        await renderPopup();
        await showLookup();
        await act(async () => getButton('Insert Bible Text').click());
        expect(bibleNote.addText.mock.calls).toEqual([
            ['^'],
            ['John 3:16 For God so loved the world'],
        ]);
    });

    test('the shortcuts insert the same way the buttons do', async () => {
        await renderPopup();
        await showLookup();
        await act(async () => {
            await h.keyHandlers.get('Ctrl+Enter')!();
        });
        expect(bibleNote.addText.mock.calls).toEqual([
            ['John 3:16 For God so loved the world'],
        ]);
        bibleNote.addText.mockClear();
        await act(async () => {
            await h.keyHandlers.get('Ctrl+Shift+Enter')!();
        });
        expect(bibleNote.addText.mock.calls).toEqual([
            ['^'],
            ['John 3:16 For God so loved the world'],
        ]);
    });

    test('nothing is inserted when the lookup holds no passage', async () => {
        h.getEditingResult.mockResolvedValue({ result: { bibleItem: null } });
        await renderPopup();
        await showLookup();
        await act(async () => getButton('Insert Bible Text').click());
        await act(async () => getButton('Insert Collapse Bible Text').click());
        expect(bibleNote.addText).not.toHaveBeenCalled();
        expect(toFullText).not.toHaveBeenCalled();
    });

    test('a read-only note never shows the lookup', async () => {
        await renderPopup(true);
        expect(h.controlArgs.isReadOnly).toBe(true);
        await showLookup();
        expect(host.innerHTML).toBe('');
    });
});
