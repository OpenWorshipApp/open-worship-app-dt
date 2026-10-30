// @vitest-environment jsdom

import { act, use, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    widgetProps: null as null | Record<string, any>,
    cardProps: null as null | Record<string, any>,
    // What the card could read from the contexts the widget provides.
    cardContexts: null as null | { scale: any; editing: any },
    onFileUpdated: null as null | (() => void),
    resolvedCount: 0,
    closeAppDocumentPreviewFloatingMock: vi.fn(),
    onSlideItemsKeyboardEventMock: vi.fn(),
}));

vi.mock('../app-modal/FloatingWidgetComp', () => ({
    default: (props: Record<string, any> & { children: ReactNode }) => {
        mocks.widgetProps = props;
        return <div className="floating-widget">{props.children}</div>;
    },
}));
vi.mock(
    '../app-document-presenter/items/AppDocumentPreviewerComp',
    async () => {
        const { ThumbnailScaleSettingContext } =
            await import('../app-document-presenter/items/slidesPreviewerScopeHelpers');
        const { SelectedEditingSlideContext } =
            await import('./appDocumentHelpers');
        return {
            VaryAppDocumentPreviewerCardComp: (props: Record<string, any>) => {
                mocks.cardProps = props;
                mocks.cardContexts = {
                    scale: use(ThumbnailScaleSettingContext),
                    editing: use(SelectedEditingSlideContext),
                };
                return <div className="previewer-card" />;
            },
        };
    },
);
vi.mock('../helper/FileSource', () => ({
    default: {
        getInstance: (filePath: string) => ({
            filePath,
            name: filePath.split('/').at(-1)?.split('.')[0],
        }),
    },
}));
vi.mock('../helper/dirSourceHelpers', () => ({
    useFileSourceEvents: (events: string[], callback: () => void) => {
        if (events.includes('update')) {
            mocks.onFileUpdated = callback;
        }
    },
}));
vi.mock('../lang/langHelpers', () => ({ tran: (text: string) => text }));
vi.mock('../others/themeHelpers', () => ({
    useThemeSource: () => ({ theme: 'dark' }),
}));
vi.mock('../slide-editor/slideEditingKeyboardEventHelpers', () => ({
    onSlideItemsKeyboardEvent: mocks.onSlideItemsKeyboardEventMock,
}));
vi.mock('./appDocumentHelpers', async () => {
    const { createContext } = await import('react');
    return {
        SelectedEditingSlideContext: createContext<any>(null),
        // A fresh document object per resolve, as a reload would give.
        varyAppDocumentFromFilePath: (filePath: string) => {
            mocks.resolvedCount += 1;
            return { filePath, resolved: mocks.resolvedCount };
        },
    };
});
vi.mock('./appDocumentPreviewFloatingHelpers', () => ({
    closeAppDocumentPreviewFloating: mocks.closeAppDocumentPreviewFloatingMock,
    DEFAULT_PREVIEW_THUMBNAIL_SCALE: 30,
    toAppDocumentPreviewRectSettingName: (filePath: string) =>
        `rect:${filePath}`,
    toAppDocumentPreviewScaleSettingName: (filePath: string) =>
        `scale:${filePath}`,
}));

import AppDocumentPreviewFloatingItemComp from './AppDocumentPreviewFloatingItemComp';

const FILE_PATH = '/docs/Sunday.ows';

let container: HTMLDivElement;
let root: Root;

async function render(index = 0) {
    await act(async () => {
        root.render(
            <AppDocumentPreviewFloatingItemComp
                filePath={FILE_PATH}
                index={index}
            />,
        );
    });
}

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    mocks.widgetProps = null;
    mocks.cardProps = null;
    mocks.cardContexts = null;
    mocks.onFileUpdated = null;
    mocks.resolvedCount = 0;
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

describe('AppDocumentPreviewFloatingItemComp', () => {
    test('is a themed widget on the page body, named after the file, remembering its rect', async () => {
        await render(0);

        const portal = document.body.querySelector(
            ':scope > .app-floating-widget-portal',
        );
        expect(portal?.getAttribute('data-bs-theme')).toBe('dark');
        expect(portal?.querySelector('.previewer-card')).not.toBeNull();
        expect(container.innerHTML).toBe('');
        expect(mocks.widgetProps).toMatchObject({
            title: 'Slides: Sunday',
            persistKey: `rect:${FILE_PATH}`,
            options: {
                width: 620,
                height: 520,
                minWidth: 280,
                minHeight: 220,
                initialOffset: 0,
                extraClassName: 'app-document-preview-floating',
            },
        });
    });

    test.each([
        [1, 24],
        [5, 120],
        [6, 0],
        [8, 48],
    ])(
        'widget %i is staggered by %ipx so it does not sit on the others',
        async (index, offset) => {
            await render(index);

            expect(mocks.widgetProps?.options.initialOffset).toBe(offset);
        },
    );

    test('shows the document as a label-only card with its own zoom key', async () => {
        await render();

        expect(mocks.cardProps).toEqual({
            varyAppDocument: { filePath: FILE_PATH, resolved: 1 },
            isDisableChanging: true,
            shouldShowHistory: false,
            flexSizeNamePrefix: 'floating-preview-',
        });
        expect(mocks.cardContexts?.scale).toEqual({
            settingName: `scale:${FILE_PATH}`,
            defaultSize: 30,
        });
    });

    test('closing the widget closes this file only', async () => {
        await render();

        mocks.widgetProps?.onClose();

        expect(
            mocks.closeAppDocumentPreviewFloatingMock,
        ).toHaveBeenCalledExactlyOnceWith(FILE_PATH);
    });

    test('a file update swaps in a freshly resolved document', async () => {
        await render();
        expect(mocks.cardProps?.varyAppDocument.resolved).toBe(1);

        await act(async () => {
            mocks.onFileUpdated?.();
        });

        expect(mocks.cardProps?.varyAppDocument).toEqual({
            filePath: FILE_PATH,
            resolved: 2,
        });
    });

    test('keyboard editing inside the widget is bound to its own document', async () => {
        await render();
        const editing = mocks.cardContexts?.editing;
        expect(editing.selectedSlideEditing).toBeNull();
        expect(editing.holdingSlides).toEqual([]);
        expect(editing.setSelectedSlide()).toBeUndefined();
        const event = { key: 'v', ctrlKey: true };

        editing.onSlideItemsKeyboardEvent(event);

        expect(mocks.onSlideItemsKeyboardEventMock).toHaveBeenCalledWith(
            {
                holdingSlides: [],
                setHoldingSlides: expect.any(Function),
                varyAppDocument: mocks.cardProps?.varyAppDocument,
                selectedSlideEditing: null,
            },
            event,
        );
        const [{ setHoldingSlides }] = mocks.onSlideItemsKeyboardEventMock.mock
            .lastCall as [{ setHoldingSlides: () => void }];
        expect(setHoldingSlides()).toBeUndefined();
    });
});
