// @vitest-environment jsdom

import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    // The `delete` listener the host registered, as FileSource would call it.
    onFileDeleted: null as null | ((filePath: unknown) => void),
}));

vi.mock('../server/appProvider', () => ({
    default: { systemUtils: { isMac: false } },
}));
vi.mock('../context-menu/contextMenuIconHelpers', () => ({
    genContextMenuItemIcon: (name: string) => name,
}));
vi.mock('../lang/langHelpers', () => ({ tran: (text: string) => text }));
vi.mock('../helper/settingHelpers', () => ({
    toFilePathSettingName: (prefix: string, filePath: string) =>
        `${prefix}:${filePath}`,
}));
vi.mock('../helper/appHooks', async () => {
    const { useEffect, useRef } = await import('react');
    return {
        useAppEffect: useEffect,
        useAppCurrentRef: (current: unknown) => {
            const ref = useRef(current);
            ref.current = current;
            return ref;
        },
    };
});
vi.mock('../helper/dirSourceHelpers', () => ({
    useFileSourceEvents: (
        events: string[],
        callback: (filePath: unknown) => void,
    ) => {
        if (events.includes('delete')) {
            mocks.onFileDeleted = callback;
        }
    },
}));
vi.mock('../others/AppSuspenseComp', async () => {
    const { Suspense } = await import('react');
    return {
        default: ({ children }: { children: ReactNode }) => (
            <Suspense fallback={<div className="loading" />}>
                {children}
            </Suspense>
        ),
    };
});
vi.mock('./appDocumentHelpers', async () => {
    const { createContext } = await import('react');
    return { SelectedVaryAppDocumentContext: createContext<any>(null) };
});
vi.mock('./AppDocumentPreviewFloatingItemComp', () => ({
    default: ({ filePath, index }: { filePath: string; index: number }) => (
        <div
            className="floating-item"
            data-file-path={filePath}
            data-index={index}
        />
    ),
}));

import AppDocumentPreviewFloatingComp from './AppDocumentPreviewFloatingComp';
import { SelectedVaryAppDocumentContext } from './appDocumentHelpers';
import {
    checkIsAppDocumentPreviewOpened,
    closeAppDocumentPreviewFloating,
    openAppDocumentPreviewFloating,
} from './appDocumentPreviewFloatingHelpers';

const FIRST = '/docs/first.ows';
const SECOND = '/docs/second.pdf';

let container: HTMLDivElement;
let root: Root;

async function render(node: ReactNode) {
    await act(async () => {
        root.render(node);
    });
    // Let the lazily imported widget module resolve.
    await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
    });
}

function readItems() {
    return Array.from(container.querySelectorAll('.floating-item')).map(
        (element) => {
            return [
                element.getAttribute('data-file-path'),
                element.getAttribute('data-index'),
            ];
        },
    );
}

function withSelected(filePath: string | null) {
    return (
        <SelectedVaryAppDocumentContext
            value={
                {
                    selectedVaryAppDocument:
                        filePath === null ? null : { filePath },
                } as any
            }
        >
            <AppDocumentPreviewFloatingComp />
        </SelectedVaryAppDocumentContext>
    );
}

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    closeAppDocumentPreviewFloating(FIRST);
    closeAppDocumentPreviewFloating(SECOND);
    mocks.onFileDeleted = null;
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
});

afterEach(() => {
    act(() => {
        root.unmount();
    });
    container.remove();
    closeAppDocumentPreviewFloating(FIRST);
    closeAppDocumentPreviewFloating(SECOND);
    vi.unstubAllGlobals();
});

describe('AppDocumentPreviewFloatingComp', () => {
    test('hosts nothing until a preview is opened', async () => {
        await render(<AppDocumentPreviewFloatingComp />);

        expect(container.innerHTML).toBe('');
    });

    test('hosts one widget per opened document, in the order opened', async () => {
        openAppDocumentPreviewFloating(SECOND);
        openAppDocumentPreviewFloating(FIRST);

        await render(<AppDocumentPreviewFloatingComp />);

        expect(readItems()).toEqual([
            [SECOND, '0'],
            [FIRST, '1'],
        ]);

        await act(async () => {
            closeAppDocumentPreviewFloating(SECOND);
        });
        expect(readItems()).toEqual([[FIRST, '0']]);
    });

    test('the document shown in the main previewer loses its widget', async () => {
        openAppDocumentPreviewFloating(FIRST);
        openAppDocumentPreviewFloating(SECOND);

        await render(withSelected(null));
        expect(readItems()).toHaveLength(2);

        await render(withSelected(FIRST));

        expect(checkIsAppDocumentPreviewOpened(FIRST)).toBe(false);
        expect(readItems()).toEqual([[SECOND, '0']]);
    });

    test('a deleted file closes its widget, and other deletes change nothing', async () => {
        openAppDocumentPreviewFloating(FIRST);
        openAppDocumentPreviewFloating(SECOND);
        await render(<AppDocumentPreviewFloatingComp />);

        await act(async () => {
            mocks.onFileDeleted?.('/docs/unrelated.ows');
            mocks.onFileDeleted?.({ filePath: FIRST });
        });
        expect(readItems()).toHaveLength(2);

        await act(async () => {
            mocks.onFileDeleted?.(FIRST);
        });

        expect(checkIsAppDocumentPreviewOpened(FIRST)).toBe(false);
        expect(readItems()).toEqual([[SECOND, '0']]);
    });
});
