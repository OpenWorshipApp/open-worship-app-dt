// @vitest-environment jsdom

import { act, createElement, use, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
    item: null as any,
    controller: null as any,
    timerQueue: [] as Array<() => void>,
    flusher: null as null | (() => void),
    controllerEvent: null as null | (() => void),
    itemEdit: null as null | (() => void),
    edit: vi.fn(),
    applyBoxData: vi.fn(),
    applyProps: vi.fn(),
    register: vi.fn(),
}));

vi.mock('../../../lang/langHelpers', () => ({ tran: (key: string) => key }));
vi.mock('./useExpandToggle', async () => {
    const react = await import('react');
    return {
        useExpandToggle: (initial: boolean) => {
            const [isExpanded, setExpanded] = react.useState(initial);
            return {
                isExpanded,
                headerProps: { onClick: () => setExpanded((value) => !value) },
            };
        },
        ExpandChevronComp: ({ isExpanded }: { isExpanded: boolean }) =>
            createElement('span', {}, isExpanded ? 'Expanded' : 'Collapsed'),
    };
});
vi.mock('./SlideEditorToolsTextComp', () => ({
    default: ({
        isAlignmentEnabled,
        isTextContentEnabled,
    }: {
        isAlignmentEnabled: boolean;
        isTextContentEnabled: boolean;
    }) =>
        createElement(
            'span',
            {},
            `Text ${isAlignmentEnabled}/${isTextContentEnabled}`,
        ),
}));
vi.mock('./SlideEditorToolsBoxComp', async () => {
    const { CanvasItemPropsSetterContext } = await import('../CanvasItem');
    return {
        default: () => {
            const { props, setProps } = use(CanvasItemPropsSetterContext)!;
            return createElement(
                'div',
                {},
                createElement('span', {}, `Width ${props.width}`),
                createElement(
                    'button',
                    { onClick: () => setProps({ width: 200 }) },
                    'Set width',
                ),
                createElement(
                    'button',
                    { onClick: () => setProps({ left: 30 }) },
                    'Set left',
                ),
            );
        },
    };
});
vi.mock('./SlideEditorToolsCameraComp', () => ({
    default: () => createElement('span', {}, 'Camera tools'),
}));
vi.mock('./CanvasItemPreviewComp', () => ({
    default: () => createElement('span', {}, 'Item preview'),
}));
vi.mock('../CanvasItem', async () => {
    const react = await import('react');
    return {
        CanvasItemContext: react.createContext(null),
        CanvasItemPropsSetterContext: react.createContext(null),
        useCanvasItemEditEvent: (_item: unknown, callback: () => void) => {
            h.itemEdit = callback;
        },
    };
});
vi.mock('../CanvasController', () => ({
    useCanvasControllerContext: () => h.controller,
}));
vi.mock('../../../helper/helpers', () => ({
    cloneJson: <T,>(value: T): T => JSON.parse(JSON.stringify(value)),
}));
vi.mock('../../../helper/timeoutHelpers', () => ({
    genTimeoutAttempt: () => (callback: () => void, force?: boolean) => {
        if (force) callback();
        else h.timerQueue.push(callback);
    },
}));
vi.mock('../../../helper/appHooks', async () => {
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
vi.mock('../../../editing-manager/pendingEditFlushHelpers', () => ({
    registerPendingEditFlusher: (path: string, callback: () => void) => {
        h.register(path);
        h.flusher = callback;
        return () => {
            h.flusher = null;
        };
    },
}));
vi.mock('../canvasEventHelpers', () => ({
    useCanvasControllerEvents: (_events: unknown, callback: () => void) => {
        h.controllerEvent = callback;
    },
}));
vi.mock('./CanvasItemTransitionComp', () => ({
    default: () => createElement('span', {}, 'Transition tools'),
}));
vi.mock('./SlideEditorToolTitleComp', () => ({
    default: ({ title, children }: { title: string; children: ReactNode }) =>
        createElement('section', {}, createElement('h3', {}, title), children),
}));

import CanvasItemPropsEditorComp from './CanvasItemPropsEditorComp';

let root: Root;
let container: HTMLDivElement;

async function renderEditor() {
    await act(async () =>
        root.render(
            createElement(CanvasItemPropsEditorComp, { canvasItem: h.item }),
        ),
    );
}

async function clickButton(label: string) {
    const button = Array.from(
        container.querySelectorAll<HTMLButtonElement>('button'),
    ).find((element) => element.textContent === label)!;
    await act(async () => button.click());
}

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    for (const value of Object.values(h)) {
        if (vi.isMockFunction(value)) value.mockReset();
    }
    h.timerQueue = [];
    h.flusher = null;
    h.controllerEvent = null;
    h.itemEdit = null;
    h.item = {
        id: 7,
        type: 'text',
        props: { width: 100, left: 10, locked: false },
        isLocked: false,
        applyBoxData: h.applyBoxData,
        applyProps: h.applyProps,
    };
    h.applyBoxData.mockImplementation((_bounds, patch) =>
        Object.assign(h.item.props, patch),
    );
    h.applyProps.mockImplementation((patch) =>
        Object.assign(h.item.props, patch),
    );
    h.edit.mockImplementation((_id, edit: (item: any) => void) => edit(h.item));
    h.controller = {
        canvas: { width: 800, height: 600, canvasItems: [h.item] },
        appDocument: { filePath: 'C:/documents/service.owa' },
        editCanvasItemById: h.edit,
    };
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
});

describe('canvas item properties editor', () => {
    it('shows text controls and registers a flush for its document', async () => {
        await renderEditor();
        expect(container.textContent).toContain('Item ID: 7');
        expect(container.textContent).toContain('Text true/true');
        expect(container.textContent).toContain('Item preview');
        expect(container.textContent).toContain('Transition tools');
        expect(h.register).toHaveBeenCalledWith('C:/documents/service.owa');
    });

    it('keeps every rapid patch and applies them in order to the latest item', async () => {
        await renderEditor();
        await clickButton('Set width');
        await clickButton('Set left');
        expect(container.textContent).toContain('Width 200');
        expect(h.edit).not.toHaveBeenCalled();
        h.item.props.top = 99;
        await act(async () => h.timerQueue[0]());
        expect(h.edit).toHaveBeenCalledTimes(1);
        expect(h.applyBoxData.mock.calls.map(([, patch]) => patch)).toEqual([
            { width: 200 },
            { left: 30 },
        ]);
        expect(h.item.props).toMatchObject({ width: 200, left: 30, top: 99 });
        expect(h.applyBoxData.mock.calls[0][0]).toEqual({
            parentHeight: 600,
            parentWidth: 800,
        });
        await act(async () => h.timerQueue[1]());
        expect(h.edit).toHaveBeenCalledTimes(1);
    });

    it('flushes a pending change before Save and skips changes after locking', async () => {
        await renderEditor();
        await clickButton('Set width');
        await act(async () => h.flusher!());
        expect(h.edit).toHaveBeenCalledTimes(1);
        await clickButton('Set left');
        h.item.isLocked = true;
        await act(async () => h.timerQueue.at(-1)!());
        expect(h.edit).toHaveBeenCalledTimes(1);
        expect(h.item.props.left).toBe(10);
    });

    it('unlocks a locked item and hides its editing controls', async () => {
        h.item.props.locked = true;
        await renderEditor();
        expect(container.textContent).toContain('This item is locked');
        expect(container.textContent).not.toContain('Set width');
        await clickButton('Unlock');
        expect(h.applyProps).toHaveBeenCalledWith({ locked: false });
    });

    it('refreshes its fields after an external controller update', async () => {
        await renderEditor();
        h.item.props.width = 450;
        await act(async () => h.controllerEvent!());
        expect(container.textContent).toContain('Width 450');
        h.item.props.width = 475;
        await act(async () => h.itemEdit!());
        expect(container.textContent).toContain('Width 475');
    });

    it('shows camera tools only for a camera and skips preview for an error item', async () => {
        h.item.type = 'camera';
        await renderEditor();
        expect(container.textContent).toContain('Camera tools');
        expect(container.textContent).not.toContain('Text true/true');
        await act(async () => root.unmount());
        root = createRoot(container);
        h.item.type = 'error';
        await renderEditor();
        expect(container.textContent).not.toContain('Item preview');
    });
});
