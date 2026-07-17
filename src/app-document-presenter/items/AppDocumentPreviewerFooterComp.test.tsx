// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const {
    selectSlideMock,
    useSelectedAppDocumentSetterContextMock,
    useVaryAppDocumentContextMock,
    toKeyByFilePathMock,
    useVarySlideThumbnailSizeScaleMock,
    showAppAlertMock,
    appProviderMock,
    setThumbnailSizeScaleMock,
    renderSlideIndexMock,
    appRangeRenderMock,
    pathPreviewerRenderMock,
} = vi.hoisted(() => ({
    selectSlideMock: vi.fn(),
    useSelectedAppDocumentSetterContextMock: vi.fn(),
    useVaryAppDocumentContextMock: vi.fn(),
    toKeyByFilePathMock: vi.fn(
        (filePath: string, id: number) => `${filePath}<id>${id}`,
    ),
    useVarySlideThumbnailSizeScaleMock: vi.fn(),
    showAppAlertMock: vi.fn(),
    appProviderMock: {
        isPagePresenter: false,
    },
    setThumbnailSizeScaleMock: vi.fn(),
    renderSlideIndexMock: vi.fn(),
    appRangeRenderMock: vi.fn(),
    pathPreviewerRenderMock: vi.fn(),
}));

vi.mock('../../app-document-list/appDocumentHelpers', () => ({
    selectSlide: selectSlideMock,
    useSelectedAppDocumentSetterContext:
        useSelectedAppDocumentSetterContextMock,
    toKeyByFilePath: toKeyByFilePathMock,
    useVaryAppDocumentContext: useVaryAppDocumentContextMock,
    isInjectedAppDocumentFilePath: false,
}));

vi.mock('../../others/AppRangeComp', () => ({
    default: (props: any) => {
        appRangeRenderMock(props);
        return (
            <button
                data-testid="thumbnail-range"
                type="button"
                onClick={() => props.setValue(90)}
            >
                {props.value}
            </button>
        );
    },
}));

vi.mock('../../others/PathPreviewerComp', () => ({
    PathPreviewerComp: (props: any) => {
        pathPreviewerRenderMock(props);
        return (
            <button
                data-testid="path-previewer"
                type="button"
                disabled={props.onClick === undefined}
                onClick={props.onClick}
            >
                {props.dirPath}
            </button>
        );
    },
}));

vi.mock('../../event/VaryAppDocumentEventListener', () => ({
    useVarySlideThumbnailSizeScale: useVarySlideThumbnailSizeScaleMock,
}));

vi.mock('../../helper/appHooks', async () => {
    const { useEffect, useRef } = await import('react');

    return {
        useAppEffect: useEffect,
        useAppCurrentRef: (target: any) => {
            const ref = useRef(target);
            ref.current = target;
            return ref;
        },
    };
});

vi.mock('../../server/appProvider', () => ({
    default: appProviderMock,
}));

vi.mock('../../popup-widget/popupWidgetHelpers', () => ({
    showAppAlert: showAppAlertMock,
}));

vi.mock('./RenderSlideIndexComp', () => ({
    default: (props: any) => {
        renderSlideIndexMock(props);
        return (
            <div data-testid="history-index">
                {props.viewIndex}:{props.title}
            </div>
        );
    },
}));

async function flushAsyncEvents() {
    await Promise.resolve();
    await Promise.resolve();
}

describe('AppDocumentPreviewerFooterComp', () => {
    let container: HTMLDivElement;
    let root: Root;
    let setSelectedAppDocumentMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
        vi.clearAllMocks();
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
        setSelectedAppDocumentMock = vi.fn();
        useSelectedAppDocumentSetterContextMock.mockReturnValue(
            setSelectedAppDocumentMock,
        );
        useVaryAppDocumentContextMock.mockReturnValue({
            filePath: '/docs/main.ows',
        });
        useVarySlideThumbnailSizeScaleMock.mockReturnValue([
            75,
            setThumbnailSizeScaleMock,
        ]);
        appProviderMock.isPagePresenter = false;
    });

    afterEach(async () => {
        await act(async () => {
            root.unmount();
            await flushAsyncEvents();
        });
        container.remove();
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = false;
    });

    test('updates thumbnail size and selects slides or shows an alert when none are available', async () => {
        const { default: AppDocumentPreviewerFooterComp, defaultRangeSize } =
            await import('./AppDocumentPreviewerFooterComp');
        const selectedSlide = {
            id: 8,
            filePath: '/docs/main.ows',
        };

        selectSlideMock
            .mockResolvedValueOnce(selectedSlide)
            .mockResolvedValueOnce(null);

        await act(async () => {
            root.render(<AppDocumentPreviewerFooterComp />);
            await flushAsyncEvents();
        });

        expect(appRangeRenderMock).toHaveBeenCalledWith(
            expect.objectContaining({
                value: 75,
                title: 'Slide Thumbnail Size Scale',
                defaultSize: defaultRangeSize,
            }),
        );
        expect(pathPreviewerRenderMock).toHaveBeenCalledWith(
            expect.objectContaining({
                dirPath: '/docs/main.ows',
                isShowingNameOnly: true,
                shouldNotValidate: true,
                canOpenFileExplorer: true,
            }),
        );

        await act(async () => {
            container
                .querySelector('[data-testid="thumbnail-range"]')
                ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        });
        expect(setThumbnailSizeScaleMock).toHaveBeenCalledWith(90);

        await act(async () => {
            container
                .querySelector('[data-testid="path-previewer"]')
                ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            await flushAsyncEvents();
        });

        expect(selectSlideMock).toHaveBeenCalledWith(
            expect.any(Object),
            '/docs/main.ows',
        );
        expect(setSelectedAppDocumentMock).toHaveBeenCalledWith(selectedSlide);
        expect(showAppAlertMock).not.toHaveBeenCalled();

        await act(async () => {
            container
                .querySelector('[data-testid="path-previewer"]')
                ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            await flushAsyncEvents();
        });

        expect(showAppAlertMock).toHaveBeenCalledWith(
            'No Slide Available',
            'No other slide found in the slide directory',
        );
    });

    test('disables slide changing when requested', async () => {
        const { default: AppDocumentPreviewerFooterComp } =
            await import('./AppDocumentPreviewerFooterComp');

        await act(async () => {
            root.render(<AppDocumentPreviewerFooterComp isDisableChanging />);
        });

        const button = container.querySelector(
            '[data-testid="path-previewer"]',
        ) as HTMLButtonElement | null;
        expect(button?.disabled).toBe(true);

        await act(async () => {
            button?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            await flushAsyncEvents();
        });

        expect(selectSlideMock).not.toHaveBeenCalled();
    });

    test('shows the presenter history badges and keeps only the latest three selections', async () => {
        const {
            default: AppDocumentPreviewerFooterComp,
            slidePreviewerMethods,
        } = await import('./AppDocumentPreviewerFooterComp');

        appProviderMock.isPagePresenter = true;

        await act(async () => {
            root.render(<AppDocumentPreviewerFooterComp />);
            await flushAsyncEvents();
        });

        await act(async () => {
            slidePreviewerMethods.handleSlideItemSelected(1, {
                filePath: '/docs/main.ows',
                id: 1,
            } as any);
            slidePreviewerMethods.handleSlideItemSelected(2, {
                filePath: '/docs/main.ows',
                id: 2,
            } as any);
            slidePreviewerMethods.handleSlideItemSelected(3, {
                filePath: '/docs/main.ows',
                id: 3,
            } as any);
            slidePreviewerMethods.handleSlideItemSelected(4, {
                filePath: '/docs/main.ows',
                id: 4,
            } as any);
            await flushAsyncEvents();
        });

        const historyItems = Array.from(
            container.querySelectorAll('[data-testid="history-index"]'),
        );
        expect(historyItems).toHaveLength(3);
        expect(historyItems.map((item) => item.textContent)).toEqual([
            '2:/docs/main.ows<id>2',
            '3:/docs/main.ows<id>3',
            '4:/docs/main.ows<id>4',
        ]);

        const renderCount = renderSlideIndexMock.mock.calls.length;
        await act(async () => {
            root.unmount();
            await flushAsyncEvents();
        });
        await act(async () => {
            slidePreviewerMethods.handleSlideItemSelected(5, {
                filePath: '/docs/main.ows',
                id: 5,
            } as any);
            await flushAsyncEvents();
        });

        expect(renderSlideIndexMock.mock.calls).toHaveLength(renderCount);
    });
});
