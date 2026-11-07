// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// The presenter's slides menu: the document's own editing menu, plus a "fix
// slide dimension" button only while the slides do not match the screen
// they are presented on.

const { state, mocks, AppDocumentMock } = vi.hoisted(() => {
    class AppDocumentMock {
        constructor(public filePath: string) {}
        fixSlidesDimensionForDisplay(display: unknown) {
            mocks.fix(this.filePath, display);
        }
        static checkIsThisType(value: unknown) {
            return value instanceof this;
        }
        static toWrongDimensionString({ slide, display }: any) {
            return `${slide.width}x${slide.height} -> ${display.width}x${display.height}`;
        }
    }
    const mocks = {
        fix: vi.fn(),
        getDisplay: vi.fn(),
        checkWrongDimension: vi.fn(),
    };
    return {
        AppDocumentMock,
        mocks,
        state: {
            document: null as any,
            wrongDimension: null as any,
        },
    };
});

vi.mock('../../_screen/managers/screenHelpers', () => ({
    getPresentingScreenDisplay: mocks.getDisplay,
}));
vi.mock('../../app-document-list/appDocumentHelpers', () => ({
    useVaryAppDocumentContext: () => state.document,
    useSlideWrongDimension: (varyAppDocument: unknown, display: unknown) => {
        mocks.checkWrongDimension(varyAppDocument, display);
        return state.wrongDimension;
    },
}));
vi.mock('../../app-document-list/AppDocument', () => ({
    default: AppDocumentMock,
}));
vi.mock('../../editing-manager/editingHelpers', () => ({
    FileEditingMenuComp: ({
        editableDocument,
        isSaveShortcutGlobal,
        extraChildren,
    }: any) => (
        <div
            data-testid="menu"
            data-document={editableDocument.filePath}
            data-global={String(isSaveShortcutGlobal)}
        >
            {extraChildren}
        </div>
    ),
}));
vi.mock('../../helper/appHooks', async () => {
    const { useRef } = await import('react');
    return {
        useAppCurrentRef: (value: unknown) => {
            const ref = useRef(value);
            ref.current = value;
            return ref;
        },
    };
});
vi.mock('../../lang/langHelpers', () => ({ tran: (key: string) => key }));

import SlidesMenuComp from './SlidesMenuComp';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const display = { id: 1, bounds: { width: 1920, height: 1080 } };
let container: HTMLDivElement;
let root: Root;

async function render() {
    await act(async () => {
        root.render(<SlidesMenuComp />);
    });
}

beforeEach(() => {
    state.document = new AppDocumentMock('/docs/sermon.ows');
    state.wrongDimension = null;
    mocks.getDisplay.mockReturnValue(display);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(() => {
    act(() => {
        root.unmount();
    });
    container.remove();
});

describe('SlidesMenuComp', () => {
    test('shows the editing menu of an editable document, with nothing to fix', async () => {
        await render();
        const menu = container.querySelector<HTMLElement>(
            '[data-testid="menu"]',
        )!;
        expect(menu.dataset.document).toBe('/docs/sermon.ows');
        expect(menu.dataset.global).toBe('true');
        expect(menu.querySelector('button')).toBeNull();
        expect(mocks.checkWrongDimension).toHaveBeenCalledWith(
            state.document,
            display,
        );
    });

    test('offers to fix slides that do not match the presenting screen', async () => {
        state.wrongDimension = {
            slide: { width: 800, height: 600 },
            display: { width: 1920, height: 1080 },
        };
        await render();
        const button = container.querySelector<HTMLButtonElement>(
            '[data-testid="menu"] button',
        )!;
        const label = 'Fix slide dimension: 800x600 -> 1920x1080';
        expect(button.title).toBe(label);
        expect(button.getAttribute('aria-label')).toBe(label);

        await act(async () => button.click());
        // Fixed for the very display the check was made against.
        expect(mocks.fix).toHaveBeenCalledExactlyOnceWith(
            '/docs/sermon.ows',
            display,
        );
    });

    test('reads the presenting display once, not on every render', async () => {
        await render();
        await render();
        await render();
        expect(mocks.getDisplay).toHaveBeenCalledOnce();
        expect(mocks.checkWrongDimension).toHaveBeenCalledTimes(3);
    });

    test('draws nothing for a document that is not an editable slide document', async () => {
        state.document = { filePath: '/docs/hymn.pdf' };
        state.wrongDimension = {
            slide: { width: 1, height: 1 },
            display: { width: 2, height: 2 },
        };
        await render();
        expect(container.innerHTML).toBe('');
        expect(mocks.checkWrongDimension).toHaveBeenCalledWith(
            state.document,
            display,
        );
    });
});
