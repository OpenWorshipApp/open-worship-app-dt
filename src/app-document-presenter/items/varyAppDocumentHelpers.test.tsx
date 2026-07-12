// @vitest-environment jsdom

import { beforeEach, afterEach, describe, expect, test, vi } from 'vitest';

const {
    handleSlideSelectingMock,
    appProviderMock,
    getScreenManagerByScreenIdMock,
    slideItemSelectedMock,
    bringDomToTopViewMock,
    notifyElementHighlightMock,
    slideCheckIsThisTypeMock,
    pptxCheckIsThisTypeMock,
} = vi.hoisted(() => ({
    handleSlideSelectingMock: vi.fn(),
    appProviderMock: {
        isPageAppDocumentEditor: false,
        presenterHomePage: true,
    },
    getScreenManagerByScreenIdMock: vi.fn(),
    slideItemSelectedMock: vi.fn(),
    bringDomToTopViewMock: vi.fn(),
    notifyElementHighlightMock: vi.fn(),
    slideCheckIsThisTypeMock: vi.fn(),
    pptxCheckIsThisTypeMock: vi.fn(),
}));

vi.mock('../../_screen/managers/ScreenVaryAppDocumentManager', () => ({
    default: {
        handleSlideSelecting: handleSlideSelectingMock,
    },
}));

vi.mock('../../server/appProvider', () => ({
    default: appProviderMock,
}));

vi.mock('../../_screen/managers/screenManagerHelpers', () => ({
    getScreenManagerByScreenId: getScreenManagerByScreenIdMock,
}));

vi.mock('./AppDocumentPreviewerFooterComp', () => ({
    slidePreviewerMethods: {
        handleSlideItemSelected: slideItemSelectedMock,
    },
}));

vi.mock('../../helper/helpers', () => ({
    bringDomToTopView: bringDomToTopViewMock,
    HIGHLIGHT_SELECTED_CLASSNAME: 'app-highlight-selected',
}));

vi.mock('./appDocumentHelpers', () => ({
    APP_DOCUMENT_ITEM_CLASS: 'data-vary-app-document-item',
}));

vi.mock('../../helper/domHelpers', () => ({
    notifyElementHighlight: notifyElementHighlightMock,
}));

vi.mock('../../app-document-list/Slide', () => ({
    default: class SlideMock {
        static checkIsThisType(value: unknown) {
            return slideCheckIsThisTypeMock(value);
        }
    },
}));

vi.mock('../../app-document-list/PptxSlide', () => ({
    default: class PptxSlideMock {
        static checkIsThisType(value: unknown) {
            return pptxCheckIsThisTypeMock(value);
        }
    },
}));

function createVarySlide(id: number, overrides: Record<string, unknown> = {}) {
    return {
        id,
        filePath: '/docs/main.ows',
        isDisabled: false,
        isSlide: true,
        isPptx: false,
        uuid: `slide-${id}`,
        subSlides: [],
        toJson() {
            return { id: this.id, filePath: this.filePath };
        },
        ...overrides,
    } as any;
}

describe('varyAppDocumentHelpers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        document.body.innerHTML = '';
        appProviderMock.isPageAppDocumentEditor = false;
        appProviderMock.presenterHomePage = true;
        slideCheckIsThisTypeMock.mockImplementation(
            (value: any) => value?.isSlide === true,
        );
        pptxCheckIsThisTypeMock.mockImplementation(
            (value: any) => value?.isPptx === true,
        );
    });

    afterEach(() => {
        vi.useRealTimers();
        document.body.innerHTML = '';
    });

    test('focuses matching note editors for slides and PPTX slides only', async () => {
        const { focusNoteEditor } = await import('./varyAppDocumentHelpers');
        const noteEditor = document.createElement('div');
        noteEditor.dataset.noteEditorUuid = 'slide-note-editor-slide-1';
        document.body.appendChild(noteEditor);

        focusNoteEditor(createVarySlide(1));

        expect(notifyElementHighlightMock).toHaveBeenCalledWith(
            expect.any(Function),
            {
                moveToView: bringDomToTopViewMock,
                shouldSkipHighlighting: true,
            },
        );
        const getter = notifyElementHighlightMock.mock.calls[0]?.[0] as
            | (() => Element | null)
            | undefined;
        expect(getter?.()).toBe(noteEditor);

        focusNoteEditor(createVarySlide(2, { isSlide: false, isPptx: true }));
        expect(notifyElementHighlightMock).toHaveBeenCalledTimes(2);

        focusNoteEditor(createVarySlide(3, { isSlide: false, isPptx: false }));
        expect(notifyElementHighlightMock).toHaveBeenCalledTimes(2);
    });

    test('handles selection differently in editor mode and presenter mode', async () => {
        const { handleVarySlideSelecting } =
            await import('./varyAppDocumentHelpers');
        const varySlide = createVarySlide(4);
        const selectSelectedSlide = vi.fn();
        const event = { type: 'click' };

        appProviderMock.isPageAppDocumentEditor = true;
        handleVarySlideSelecting(event, 2, varySlide, selectSelectedSlide);

        expect(selectSelectedSlide).toHaveBeenCalledWith(varySlide);
        expect(slideItemSelectedMock).not.toHaveBeenCalled();
        expect(handleSlideSelectingMock).not.toHaveBeenCalled();

        appProviderMock.isPageAppDocumentEditor = false;
        handleVarySlideSelecting(event, 2, varySlide, selectSelectedSlide);

        expect(slideItemSelectedMock).toHaveBeenCalledWith(2, varySlide);
        expect(handleSlideSelectingMock).toHaveBeenCalledWith(
            event,
            '/docs/main.ows',
            { id: 4, filePath: '/docs/main.ows' },
        );
        expect(notifyElementHighlightMock).toHaveBeenCalled();
    });

    test('returns slide ids, finds the container, and scrolls a selected item into view', async () => {
        const {
            DATA_QUERY_KEY,
            genSlideIds,
            getContainerDiv,
            handleArrowing,
            showVarySlideInViewport,
            SLIDE_ITEMS_CONTAINER_CLASS_NAME,
        } = await import('./varyAppDocumentHelpers');

        expect(genSlideIds([createVarySlide(1), createVarySlide(2)])).toEqual([
            1, 2,
        ]);

        const container = document.createElement('div');
        container.className = SLIDE_ITEMS_CONTAINER_CLASS_NAME;
        container.tabIndex = 0;
        const focusSpy = vi.spyOn(container, 'focus');
        const selected = document.createElement('div');
        selected.setAttribute(DATA_QUERY_KEY, '1');
        selected.className = 'app-highlight-selected';
        const screenMarker = document.createElement('span');
        screenMarker.dataset.screenId = '10';
        selected.appendChild(screenMarker);
        container.appendChild(selected);
        document.body.appendChild(container);

        const target = document.createElement('div');
        target.setAttribute(DATA_QUERY_KEY, '2');
        const scrollIntoViewMock = vi.fn();
        (target as any).scrollIntoView = scrollIntoViewMock;
        document.body.appendChild(target);

        expect(getContainerDiv()).toBe(container);

        showVarySlideInViewport(2);
        vi.runAllTimers();

        expect(scrollIntoViewMock).toHaveBeenCalledWith({
            behavior: 'smooth',
            block: 'center',
            inline: 'center',
        });

        const originalActiveElement = document.activeElement;
        Object.defineProperty(document, 'activeElement', {
            configurable: true,
            get: () => null,
        });

        const focusEvent = {
            key: 'ArrowRight',
            shiftKey: false,
            preventDefault: vi.fn(),
        };
        handleArrowing(focusEvent as any, [createVarySlide(1)]);
        expect(focusSpy).toHaveBeenCalled();

        Object.defineProperty(document, 'activeElement', {
            configurable: true,
            get: () => originalActiveElement,
        });
    });

    test('moves highlighted slides across screens and responds to arrow navigation', async () => {
        const {
            DATA_QUERY_KEY,
            handleArrowing,
            handleNextItemSelecting,
            SLIDE_ITEMS_CONTAINER_CLASS_NAME,
        } = await import('./varyAppDocumentHelpers');
        const screenManager = {
            screenVaryAppDocumentManager: {
                varySlideData: null,
                toSlideData: vi.fn((filePath: string, json: any) => ({
                    filePath,
                    json,
                })),
            },
        };
        getScreenManagerByScreenIdMock.mockImplementation(
            (screenId: number) => {
                return screenId === 10 ? screenManager : null;
            },
        );

        const slide1 = createVarySlide(1);
        const slide2 = createVarySlide(2, { isDisabled: true });
        const slide3 = createVarySlide(3);
        const pptxParent = createVarySlide(4, {
            isSlide: false,
            isPptx: true,
            subSlides: [createVarySlide(5, { isSlide: false, isPptx: true })],
        });
        const container = document.createElement('div');
        container.className = SLIDE_ITEMS_CONTAINER_CLASS_NAME;
        container.tabIndex = 0;
        const selected = document.createElement('div');
        selected.setAttribute(DATA_QUERY_KEY, '1');
        selected.className = 'app-highlight-selected';
        const screenMarker = document.createElement('span');
        screenMarker.dataset.screenId = '10';
        selected.appendChild(screenMarker);
        container.appendChild(selected);
        document.body.appendChild(container);

        handleNextItemSelecting({
            container,
            varySlides: [slide1, slide2, slide3, pptxParent],
            isNext: true,
        });
        vi.runAllTimers();

        expect(
            screenManager.screenVaryAppDocumentManager.toSlideData,
        ).toHaveBeenCalledWith('/docs/main.ows', {
            id: 3,
            filePath: '/docs/main.ows',
        });
        expect(
            screenManager.screenVaryAppDocumentManager.varySlideData,
        ).toEqual({
            filePath: '/docs/main.ows',
            json: { id: 3, filePath: '/docs/main.ows' },
        });

        handleNextItemSelecting({
            container,
            varySlides: [slide1, slide2, slide3, pptxParent],
            isNext: false,
        });
        vi.runAllTimers();

        expect(
            screenManager.screenVaryAppDocumentManager.toSlideData,
        ).toHaveBeenCalledWith('/docs/main.ows', {
            id: 5,
            filePath: '/docs/main.ows',
        });

        Object.defineProperty(document, 'activeElement', {
            configurable: true,
            get: () => container,
        });
        const arrowEvent = {
            key: 'ArrowRight',
            shiftKey: false,
            preventDefault: vi.fn(),
        };
        handleArrowing(arrowEvent as any, [slide1, slide2, slide3, pptxParent]);
        vi.runAllTimers();

        expect(arrowEvent.preventDefault).toHaveBeenCalledTimes(1);

        const reverseEvent = {
            key: ' ',
            shiftKey: true,
            preventDefault: vi.fn(),
        };
        handleArrowing(reverseEvent as any, [
            slide1,
            slide2,
            slide3,
            pptxParent,
        ]);
        vi.runAllTimers();

        expect(reverseEvent.preventDefault).toHaveBeenCalledTimes(1);

        Object.defineProperty(document, 'activeElement', {
            configurable: true,
            get: () => document.body,
        });

        appProviderMock.presenterHomePage = false;
        const ignoredEvent = {
            key: 'ArrowRight',
            shiftKey: false,
            preventDefault: vi.fn(),
        };
        handleArrowing(ignoredEvent as any, [slide1, slide3]);
        expect(ignoredEvent.preventDefault).not.toHaveBeenCalled();
    });
});
