// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// The sibling `layoutHelpers.test.tsx` pins `AppDocument.checkIsThisType` to
// false, so nothing there can reach an EDITABLE slide document: the slide
// editor's own selection (Ctrl/Shift holding), the first-slide pick on a
// switch and the file-update refresh. This surface makes that type check and
// the history-movement check controllable instead.

type FakeSlideType = {
    id: number;
    text: string;
    checkIsSame: (other: FakeSlideType | null) => boolean;
    toJson: () => { id: number; text: string };
};

const state = vi.hoisted(() => ({
    appProvider: {
        isPagePresenter: false,
        isPageAppDocumentEditor: true,
        isPageScreenMirror: false,
        presenterHomePage: '/presenter',
        readerHomePage: '/reader',
        experimentHomePage: '/experiment',
        appDocumentEditorHomePage: '/slide-editor',
        screenMirrorHomePage: '/screen-mirror',
        systemUtils: { isDev: false },
    },
    getSelectedVaryAppDocument: vi.fn(),
    getSelectedEditingSlide: vi.fn(),
    setSelectedVaryAppDocument: vi.fn(),
    setSelectedEditingSlide: vi.fn(),
    preloadAttachedBackground: vi.fn(),
    checkIsVaryAppDocumentSwitchRefused: vi.fn(),
    forceUnpinVaryAppDocument: vi.fn(),
    onSlideItemsKeyboardEvent: vi.fn(),
    historyMovementTypes: ['undo', 'redo'],
    fileEvents: [] as {
        events: string[];
        callback: (data?: any) => any;
        filePath?: string;
    }[],
}));

vi.mock('../server/appProvider', () => ({ default: state.appProvider }));
vi.mock('../lang/langHelpers', () => ({ tran: (value: string) => value }));
vi.mock('../others/labelIconHelpers', () => ({ genLabelIcon: () => null }));
vi.mock('../helper/domHelpers', () => ({ openPopupWindow: vi.fn() }));
vi.mock('./routeHelpers', () => ({
    toTitleExternal: (value: string) => value,
}));
vi.mock('../slide-editor/slideEditingKeyboardEventHelpers', () => ({
    onSlideItemsKeyboardEvent: state.onSlideItemsKeyboardEvent,
}));
vi.mock('../editing-manager/EditingHistoryManager', () => ({
    checkIsHistoryMovementEventType: (eventType?: string) =>
        eventType !== undefined &&
        state.historyMovementTypes.includes(eventType),
}));
vi.mock('../app-document-list/AppDocument', () => ({
    default: {
        checkIsThisType: (item: any) => item?.isSlideDocument === true,
    },
    checkIsAppDocumentSelected: vi.fn(),
    openAppDocumentEditorExternal: vi.fn(),
}));
vi.mock('../app-document-list/appDocumentHelpers', () => ({
    getSelectedVaryAppDocument: state.getSelectedVaryAppDocument,
    getSelectedEditingSlide: state.getSelectedEditingSlide,
    setSelectedVaryAppDocument: state.setSelectedVaryAppDocument,
    setSelectedEditingSlide: state.setSelectedEditingSlide,
    preloadAttachedBackground: state.preloadAttachedBackground,
}));
vi.mock('../app-document-list/varyAppDocumentLockHelpers', () => ({
    checkIsVaryAppDocumentSwitchRefused:
        state.checkIsVaryAppDocumentSwitchRefused,
    forceUnpinVaryAppDocument: state.forceUnpinVaryAppDocument,
}));
vi.mock('../helper/dirSourceHelpers', () => ({
    useFileSourceEvents: (
        events: string[],
        callback: (data?: any) => any,
        _deps: unknown[],
        filePath?: string,
    ) => {
        state.fileEvents.push({ events, callback, filePath });
    },
}));
vi.mock('../helper/appHooks', async () => {
    const { useEffect } = await import('react');
    return {
        useAppEffectAsync: (
            effectMethod: (methods: any) => Promise<any>,
            deps: any[],
            methods: any,
        ) => {
            useEffect(() => {
                effectMethod({ ...methods });
                // eslint-disable-next-line react-hooks/exhaustive-deps
            }, deps);
        },
    };
});

import { useAppDocumentContextValues } from './layoutHelpers';

function genSlide(id: number, text = `slide ${id}`): FakeSlideType {
    return {
        id,
        text,
        checkIsSame(other) {
            return other !== null && other.id === id;
        },
        toJson() {
            return { id, text: this.text };
        },
    };
}

function genDocument(slides: FakeSlideType[], filePath = '/docs/a.slides') {
    return {
        filePath,
        isEditable: true,
        isSlideDocument: true,
        slides,
        getSlides: vi.fn(async function (this: { slides: FakeSlideType[] }) {
            return this.slides;
        }),
        getSlideIndex: vi.fn(async function (
            this: { slides: FakeSlideType[] },
            slide: FakeSlideType,
        ) {
            return this.slides.findIndex((item) => item.id === slide.id);
        }),
    };
}

let host: HTMLDivElement;
let root: Root;
let values: ReturnType<typeof useAppDocumentContextValues>;

function HostComp() {
    values = useAppDocumentContextValues();
    return null;
}

async function flush() {
    await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
    });
}

async function renderHost(document: unknown, slide: FakeSlideType | null) {
    state.getSelectedVaryAppDocument.mockResolvedValue(document);
    state.getSelectedEditingSlide.mockResolvedValue(slide);
    await act(async () => root.render(<HostComp />));
    await flush();
}

function editing() {
    return values.editingSlideContextValue;
}

async function select(
    slide: FakeSlideType | null,
    controlType?: 'Ctrl' | 'Shift',
) {
    await act(async () => {
        await editing().setSelectedSlide(slide as any, controlType);
    });
}

function holdingIds() {
    return editing().holdingSlides.map((slide: any) => slide.id);
}

function getUpdateListener() {
    return state.fileEvents
        .filter((item) => item.events.includes('update'))
        .at(-1)!;
}

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    state.appProvider.isPageAppDocumentEditor = true;
    state.historyMovementTypes = ['undo', 'redo'];
    state.fileEvents = [];
    state.checkIsVaryAppDocumentSwitchRefused.mockReturnValue(false);
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
});

afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
});

describe('switching documents', () => {
    test('an editable slide document opens on its first slide', async () => {
        await renderHost(null, null);
        const slides = [genSlide(1), genSlide(2)];
        const document = genDocument(slides);
        let isApplied = false;
        await act(async () => {
            isApplied =
                await values.varyAppDocumentContextValue.setSelectedVaryAppDocument(
                    document as any,
                );
        });
        expect(isApplied).toBe(true);
        expect(editing().selectedSlideEditing).toBe(slides[0]);
        expect(state.setSelectedEditingSlide).toHaveBeenLastCalledWith(
            slides[0],
        );
        expect(state.setSelectedVaryAppDocument).toHaveBeenCalledWith(document);
    });

    test('an editable document with no slides leaves no editing slide', async () => {
        await renderHost(null, null);
        await act(async () => {
            await values.varyAppDocumentContextValue.setSelectedVaryAppDocument(
                genDocument([]) as any,
            );
        });
        expect(editing().selectedSlideEditing).toBeNull();
        expect(state.setSelectedEditingSlide).toHaveBeenLastCalledWith(null);
    });

    test('a read-only document is never asked for its slides', async () => {
        await renderHost(null, null);
        const document = { ...genDocument([genSlide(1)]), isEditable: false };
        await act(async () => {
            await values.varyAppDocumentContextValue.setSelectedVaryAppDocument(
                document as any,
            );
        });
        expect(document.getSlides).not.toHaveBeenCalled();
        expect(editing().selectedSlideEditing).toBeNull();
    });

    test('clearing the selection clears the editing slide', async () => {
        const slides = [genSlide(1)];
        await renderHost(genDocument(slides), slides[0]);
        expect(editing().selectedSlideEditing).toBe(slides[0]);
        await act(async () => {
            await values.varyAppDocumentContextValue.setSelectedVaryAppDocument(
                null,
            );
        });
        expect(values.varyAppDocumentContextValue.selectedVaryAppDocument).toBe(
            null,
        );
        expect(editing().selectedSlideEditing).toBeNull();
        expect(state.preloadAttachedBackground).toHaveBeenCalledTimes(1);
    });
});

describe('the editing slide outside the slide editor', () => {
    test('is inert and forwards keys with no holding', async () => {
        state.appProvider.isPageAppDocumentEditor = false;
        const slides = [genSlide(1)];
        const document = genDocument(slides);
        await renderHost(document, slides[0]);
        expect(editing().selectedSlideEditing).toBeNull();
        expect(editing().holdingSlides).toEqual([]);
        await editing().setSelectedSlide(slides[0] as any);
        expect(editing().selectedSlideEditing).toBeNull();
        const event = { key: 'ArrowDown' };
        editing().onSlideItemsKeyboardEvent(event as any);
        expect(state.onSlideItemsKeyboardEvent).toHaveBeenCalledExactlyOnceWith(
            expect.objectContaining({
                holdingSlides: [],
                varyAppDocument: document,
                selectedSlideEditing: null,
            }),
            event,
        );
    });
});

describe('selecting slides in the slide editor', () => {
    test('a plain pick replaces the editing slide and drops the holding', async () => {
        const slides = [genSlide(1), genSlide(2), genSlide(3)];
        await renderHost(genDocument(slides), slides[0]);
        await select(slides[2], 'Ctrl');
        expect(holdingIds()).toEqual([3]);
        await select(slides[1]);
        expect(editing().selectedSlideEditing).toBe(slides[1]);
        expect(holdingIds()).toEqual([]);
        expect(state.setSelectedEditingSlide).toHaveBeenLastCalledWith(
            slides[1],
        );
    });

    test('Ctrl toggles a slide in and out of the holding', async () => {
        const slides = [genSlide(1), genSlide(2), genSlide(3)];
        await renderHost(genDocument(slides), slides[0]);
        await select(slides[1], 'Ctrl');
        await select(slides[2], 'Ctrl');
        expect(holdingIds()).toEqual([2, 3]);
        await select(slides[1], 'Ctrl');
        expect(holdingIds()).toEqual([3]);
        // The editing slide itself is held: Ctrl on it again keeps it.
        await select(slides[0], 'Ctrl');
        expect(holdingIds()).toEqual([3, 1]);
        await select(slides[0], 'Ctrl');
        expect(holdingIds()).toEqual([3, 1]);
        // Holding never changes which slide is being edited.
        expect(editing().selectedSlideEditing).toBe(slides[0]);
    });

    test('Shift holds the whole range from the editing slide, either way', async () => {
        const slides = [1, 2, 3, 4, 5].map((id) => genSlide(id));
        await renderHost(genDocument(slides), slides[1]);
        await select(slides[3], 'Shift');
        expect(holdingIds()).toEqual([2, 3, 4]);
        await select(slides[0], 'Shift');
        expect(holdingIds()).toEqual([1, 2]);
    });

    test('Shift on a slide the document no longer has keeps the holding', async () => {
        const slides = [genSlide(1), genSlide(2), genSlide(3)];
        await renderHost(genDocument(slides), slides[0]);
        await select(slides[2], 'Shift');
        expect(holdingIds()).toEqual([1, 2, 3]);
        await select(genSlide(99), 'Shift');
        expect(holdingIds()).toEqual([1, 2, 3]);
    });

    test('Shift from an editing slide the document lost keeps the holding', async () => {
        const slides = [genSlide(1), genSlide(2)];
        await renderHost(genDocument(slides), genSlide(42));
        await select(slides[1], 'Shift');
        expect(holdingIds()).toEqual([]);
    });

    test('Shift with no editing slide holds just the picked one', async () => {
        const slides = [genSlide(1), genSlide(2)];
        await renderHost(genDocument(slides), null);
        await select(slides[1], 'Shift');
        expect(holdingIds()).toEqual([2]);
    });

    test('a held pick of nothing, or outside a slide document, does nothing', async () => {
        const slides = [genSlide(1), genSlide(2)];
        await renderHost(genDocument(slides), slides[0]);
        await select(null, 'Ctrl');
        expect(holdingIds()).toEqual([]);
        expect(editing().selectedSlideEditing).toBe(slides[0]);

        await act(async () => root.unmount());
        root = createRoot(host);
        const pdfLike = { filePath: '/docs/a.pdf', isEditable: false };
        await renderHost(pdfLike, slides[0]);
        await select(slides[1], 'Ctrl');
        expect(holdingIds()).toEqual([]);
    });

    test('keys are handed the live selection and holding', async () => {
        const slides = [genSlide(1), genSlide(2)];
        const document = genDocument(slides);
        await renderHost(document, slides[0]);
        await select(slides[1], 'Ctrl');
        const event = { key: 'Delete' };
        editing().onSlideItemsKeyboardEvent(event as any);
        const [context, passedEvent] =
            state.onSlideItemsKeyboardEvent.mock.calls[0];
        expect(passedEvent).toBe(event);
        expect(context.varyAppDocument).toBe(document);
        expect(context.selectedSlideEditing).toBe(slides[0]);
        expect(context.holdingSlides.map((slide: any) => slide.id)).toEqual([
            2,
        ]);
        // The handler can change the holding through what it was given.
        await act(async () => context.setHoldingSlides([]));
        expect(holdingIds()).toEqual([]);
    });
});

describe('the selected document changing on disk', () => {
    test('listens on the selected document path', async () => {
        const slides = [genSlide(1)];
        await renderHost(genDocument(slides, '/docs/x.slides'), slides[0]);
        expect(getUpdateListener().filePath).toBe('/docs/x.slides');
    });

    test('a read-only selection ignores the update', async () => {
        const document = { ...genDocument([genSlide(1)]), isEditable: false };
        await renderHost(document, null);
        await act(async () => getUpdateListener().callback());
        expect(document.getSlides).not.toHaveBeenCalled();
    });

    test('its own editing echo is ignored, so the live edit survives', async () => {
        const slides = [genSlide(1)];
        const document = genDocument(slides);
        await renderHost(document, slides[0]);
        await act(async () =>
            getUpdateListener().callback({
                isHistoryEditing: true,
                eventType: 'edit',
            }),
        );
        expect(document.getSlides).not.toHaveBeenCalled();
    });

    test('a removed editing slide falls back to the first slide', async () => {
        const slides = [genSlide(1), genSlide(2)];
        const document = genDocument(slides);
        await renderHost(document, slides[1]);
        document.slides = [genSlide(7), genSlide(8)];
        await act(async () => getUpdateListener().callback());
        expect(editing().selectedSlideEditing).toBe(document.slides[0]);
        expect(state.setSelectedEditingSlide).toHaveBeenLastCalledWith(
            document.slides[0],
        );
    });

    test('a slide saved with what the editor holds keeps the live slide', async () => {
        const slides = [genSlide(1), genSlide(2)];
        const document = genDocument(slides);
        await renderHost(document, slides[1]);
        state.setSelectedEditingSlide.mockClear();
        document.slides = [genSlide(1), genSlide(2)];
        await act(async () => getUpdateListener().callback());
        expect(editing().selectedSlideEditing).toBe(slides[1]);
        expect(state.setSelectedEditingSlide).not.toHaveBeenCalled();
    });

    test('a slide changed by someone else replaces the editing slide', async () => {
        const slides = [genSlide(1), genSlide(2)];
        const document = genDocument(slides);
        await renderHost(document, slides[1]);
        const changed = genSlide(2, 'edited elsewhere');
        document.slides = [genSlide(1), changed];
        await act(async () => getUpdateListener().callback());
        expect(editing().selectedSlideEditing).toBe(changed);
    });

    test('undo refreshes the editor even when the values match', async () => {
        const slides = [genSlide(1)];
        const document = genDocument(slides);
        await renderHost(document, slides[0]);
        const restored = genSlide(1);
        document.slides = [restored];
        await act(async () =>
            getUpdateListener().callback({
                isHistoryEditing: true,
                eventType: 'undo',
            }),
        );
        expect(editing().selectedSlideEditing).toBe(restored);
    });

    test('with no editing slide an update picks the first slide', async () => {
        const slides = [genSlide(1), genSlide(2)];
        const document = genDocument(slides);
        await renderHost(document, null);
        await act(async () => getUpdateListener().callback());
        expect(editing().selectedSlideEditing).toBe(slides[0]);
    });
});
