// @vitest-environment jsdom

import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => {
    class AppDocumentMock {
        fixSlidesDimensionForDisplay = vi.fn();
        static checkIsThisType(value: unknown) {
            return value instanceof AppDocumentMock;
        }
        static toWrongDimensionString({
            slide,
            display,
        }: {
            slide: { width: number; height: number };
            display: { width: number; height: number };
        }) {
            return `${slide.width}x${slide.height} on ${display.width}x${display.height}`;
        }
    }
    return {
        AppDocumentMock,
        varyAppDocument: null as unknown,
        wrongDimension: null as unknown,
        screenDisplay: {
            id: 2,
            bounds: { x: 0, y: 0, width: 1280, height: 720 },
        },
        menuProps: null as null | Record<string, any>,
        getPresentingScreenDisplayMock: vi.fn(),
        useSlideWrongDimensionMock: vi.fn(),
    };
});

vi.mock('../../helper/appHooks', async () => {
    const { useRef } = await import('react');
    return {
        useAppCurrentRef: (current: unknown) => {
            const ref = useRef(current);
            ref.current = current;
            return ref;
        },
    };
});
vi.mock('../../lang/langHelpers', () => ({ tran: (text: string) => text }));
vi.mock('../../_screen/managers/screenHelpers', () => ({
    getPresentingScreenDisplay: mocks.getPresentingScreenDisplayMock,
}));
vi.mock('../../app-document-list/appDocumentHelpers', () => ({
    useSlideWrongDimension: mocks.useSlideWrongDimensionMock,
    useVaryAppDocumentContext: () => mocks.varyAppDocument,
}));
vi.mock('../../app-document-list/AppDocument', () => ({
    default: mocks.AppDocumentMock,
}));
vi.mock('../../editing-manager/editingHelpers', () => ({
    FileEditingMenuComp: (
        props: Record<string, any> & { extraChildren: ReactNode },
    ) => {
        mocks.menuProps = props;
        return <div className="editing-menu">{props.extraChildren}</div>;
    },
}));

import SlidesMenuComp from './SlidesMenuComp';

let container: HTMLDivElement;
let root: Root;

async function render() {
    await act(async () => {
        root.render(<SlidesMenuComp />);
    });
}

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    mocks.varyAppDocument = new mocks.AppDocumentMock();
    mocks.wrongDimension = null;
    mocks.menuProps = null;
    mocks.getPresentingScreenDisplayMock.mockReturnValue(mocks.screenDisplay);
    mocks.useSlideWrongDimensionMock.mockImplementation(
        () => mocks.wrongDimension,
    );
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
});

afterEach(() => {
    act(() => {
        root.unmount();
    });
    container.remove();
    vi.unstubAllGlobals();
});

describe('SlidesMenuComp', () => {
    test('offers nothing for a document that is not an Open Worship slide document', async () => {
        mocks.varyAppDocument = { filePath: '/docs/a.pdf' };

        await render();

        expect(container.innerHTML).toBe('');
        expect(mocks.menuProps).toBeNull();
    });

    test('is the editing menu of the document, with a window-wide Save', async () => {
        await render();

        expect(mocks.menuProps).toMatchObject({
            editableDocument: mocks.varyAppDocument,
            isSaveShortcutGlobal: true,
            extraChildren: null,
        });
        expect(mocks.useSlideWrongDimensionMock).toHaveBeenCalledWith(
            mocks.varyAppDocument,
            mocks.screenDisplay,
        );
        expect(container.querySelector('button')).toBeNull();
    });

    test('a slide that does not fit the screen gets a fix button for that screen', async () => {
        mocks.wrongDimension = {
            slide: { width: 1920, height: 1080 },
            display: { width: 1280, height: 720 },
        };

        await render();
        await render();

        const button = container.querySelector('button')!;
        expect(button.getAttribute('aria-label')).toBe(
            'Fix slide dimension: 1920x1080 on 1280x720',
        );
        expect(button.title).toBe(button.getAttribute('aria-label'));

        await act(async () => {
            button.click();
        });

        expect(
            (
                mocks.varyAppDocument as InstanceType<
                    typeof mocks.AppDocumentMock
                >
            ).fixSlidesDimensionForDisplay,
        ).toHaveBeenCalledExactlyOnceWith(mocks.screenDisplay);
        // Read once and shared by the check and the fix (no IPC per render).
        expect(mocks.getPresentingScreenDisplayMock).toHaveBeenCalledOnce();
    });
});
