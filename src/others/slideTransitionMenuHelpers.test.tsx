// @vitest-environment jsdom

import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const state = vi.hoisted(() => ({
    isPagePresenter: true,
    sidecars: new Map<string, Record<string, string>>(),
    getAllTransitions: vi.fn(),
    setTransition: vi.fn(),
    getCommonEffectType: vi.fn(),
    showAppInput: vi.fn(),
    fileEvents: [] as {
        events: string[];
        callback: () => void;
        filePath?: string;
    }[],
}));

vi.mock('../server/appProvider', () => ({
    default: {
        get isPagePresenter() {
            return state.isPagePresenter;
        },
        systemUtils: { isDev: false },
        envUtils: { isFEUseEffectWarning: false },
        appUtils: { handleError: vi.fn() },
    },
}));
vi.mock('../lang/langHelpers', () => ({ tran: (text: string) => text }));
vi.mock('../popup-widget/popupWidgetHelpers', () => ({
    showAppInput: state.showAppInput,
}));
vi.mock('../helper/dirSourceHelpers', () => ({
    useFileSourceEvents: (
        events: string[],
        callback: () => void,
        _deps: unknown[],
        filePath?: string,
    ) => {
        state.fileEvents.push({ events, callback, filePath });
    },
}));
vi.mock('../_screen/managers/ScreenEffectManager', () => ({
    default: { getCommonEffectType: state.getCommonEffectType },
}));
vi.mock('./SlideTransitionManager', () => ({
    default: {
        genMetaDataFilePath: (filePath: string) =>
            `${filePath}.transition.json`,
    },
    slideTransitionManager: {
        toKey: (id?: string | number) =>
            typeof id === 'number' ? id.toString() : (id ?? 'self'),
        getAllTransitions: state.getAllTransitions,
        setTransition: state.setTransition,
    },
}));

import {
    DocumentTransitionIconComp,
    genDocumentTransitionMenuItems,
    genSlideInherited,
    genSlideTransitionMenuItems,
    genSlidesPreviewInherited,
    openSlideTransitionDialog,
    SlideTransitionIconComp,
    useSlideTransition,
    useSlideTransitionMap,
} from './slideTransitionMenuHelpers';

const DOC = '/docs/Song.ows';

let host: HTMLDivElement;
let root: Root;
let resolveInput: (isOk: boolean) => void;
let dialogBody: ReactElement | null;

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    state.isPagePresenter = true;
    state.sidecars.clear();
    state.fileEvents = [];
    state.getAllTransitions.mockImplementation(async (filePath: string) => ({
        ...(state.sidecars.get(filePath) ?? {}),
    }));
    state.setTransition.mockResolvedValue(undefined);
    state.getCommonEffectType.mockReturnValue('fade');
    resolveInput = () => {};
    dialogBody = null;
    state.showAppInput.mockImplementation(
        (_title: string, body: ReactElement) => {
            dialogBody = body;
            return new Promise<boolean>((resolve) => {
                resolveInput = resolve;
            });
        },
    );
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
});

afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
});

async function flush() {
    await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
    });
}

describe('what a slide falls back to', () => {
    test('a slides preview follows the screen Slide: effect', () => {
        state.getCommonEffectType.mockReturnValue('zoom');
        expect(genSlidesPreviewInherited()).toEqual({
            effect: 'zoom',
            sourceLabel: 'Screen setting',
        });
        expect(state.getCommonEffectType).toHaveBeenCalledWith(
            'vary-app-document',
        );
    });

    test('a slide follows its slides preview when that has its own', () => {
        expect(genSlideInherited('move')).toEqual({
            effect: 'move',
            sourceLabel: 'Slides preview',
        });
        expect(state.getCommonEffectType).not.toHaveBeenCalled();
    });

    test('a slide follows the screen when its slides preview has none', () => {
        state.getCommonEffectType.mockReturnValue(null);
        expect(genSlideInherited(undefined)).toEqual({
            effect: null,
            sourceLabel: 'Screen setting',
        });
    });
});

describe('openSlideTransitionDialog', () => {
    test('a slide opens with its own value and saves what was chosen', async () => {
        state.sidecars.set(DOC, { self: 'zoom', '3': 'move' });
        const promise = openSlideTransitionDialog(DOC, 3);
        await flush();
        expect(state.showAppInput).toHaveBeenCalledWith(
            'Slide transition',
            expect.anything(),
            { escToCancel: true, enterToOk: true },
        );
        await act(async () => root.render(dialogBody!));
        // It has its own, so the box is ticked on "Slide In".
        expect(
            host.querySelector<HTMLInputElement>('input[type="checkbox"]')!
                .checked,
        ).toBe(true);
        expect(
            host.querySelector('button[aria-pressed="true"]')!.ariaLabel,
        ).toBe('Slide In');
        // A slide carries no description line.
        expect(host.querySelector('small')).toBeNull();
        await act(async () =>
            host
                .querySelector<HTMLButtonElement>('button[aria-label="Fade"]')!
                .click(),
        );
        resolveInput(true);
        await promise;
        expect(state.setTransition).toHaveBeenCalledExactlyOnceWith(
            DOC,
            3,
            'fade',
        );
    });

    test('a slide with none follows its slides preview in the dialog', async () => {
        state.sidecars.set(DOC, { self: 'zoom' });
        const promise = openSlideTransitionDialog(DOC, 'slide-7');
        await flush();
        await act(async () => root.render(dialogBody!));
        expect(
            host.querySelector('[role="group"]')!.getAttribute('title'),
        ).toBe('Follows: Slides preview (Zoom)');
        resolveInput(true);
        await promise;
        // Left unticked: the entry is removed rather than written.
        expect(state.setTransition).toHaveBeenCalledExactlyOnceWith(
            DOC,
            'slide-7',
            undefined,
        );
    });

    test('the whole slides preview says every slide comes in with it', async () => {
        state.getCommonEffectType.mockReturnValue('move');
        const promise = openSlideTransitionDialog(DOC);
        await flush();
        expect(state.showAppInput.mock.calls[0][0]).toBe(
            'Slides preview transition',
        );
        await act(async () => root.render(dialogBody!));
        expect(host.querySelector('small')!.textContent).toBe(
            'Every slide of this document comes in with it, unless the slide has its own.',
        );
        await act(async () =>
            host
                .querySelector<HTMLInputElement>('input[type="checkbox"]')!
                .click(),
        );
        resolveInput(true);
        await promise;
        // Ticking starts from what the screen does.
        expect(state.setTransition).toHaveBeenCalledExactlyOnceWith(
            DOC,
            undefined,
            'move',
        );
    });

    test('Cancel writes nothing', async () => {
        const promise = openSlideTransitionDialog(DOC, 1);
        await flush();
        resolveInput(false);
        await promise;
        expect(state.setTransition).not.toHaveBeenCalled();
    });
});

function MapProbeComp({
    filePath,
    isEnabled,
}: Readonly<{ filePath: string; isEnabled?: boolean }>) {
    const data = useSlideTransitionMap(filePath, isEnabled);
    return <pre>{data === undefined ? 'none' : JSON.stringify(data)}</pre>;
}

function SlideProbeComp({ id }: Readonly<{ id: string | number }>) {
    const { own, documentOwn } = useSlideTransition(DOC, id);
    return <pre>{`${own ?? '-'}|${documentOwn ?? '-'}`}</pre>;
}

describe('useSlideTransitionMap', () => {
    test('the presenter reads the sidecar and re-reads it when it changes', async () => {
        state.sidecars.set(DOC, { self: 'zoom' });
        await act(async () => root.render(<MapProbeComp filePath={DOC} />));
        await flush();
        expect(host.textContent).toBe('{"self":"zoom"}');
        const lastEvent = state.fileEvents.at(-1)!;
        expect(lastEvent.events).toEqual(['update']);
        expect(lastEvent.filePath).toBe(`${DOC}.transition.json`);

        state.sidecars.set(DOC, { self: 'zoom', '2': 'none' });
        await act(async () => lastEvent.callback());
        await flush();
        // (Integer-like keys come first in a JS object.)
        expect(host.textContent).toBe('{"2":"none","self":"zoom"}');
        expect(state.getAllTransitions).toHaveBeenCalledTimes(2);
    });

    test('outside the presenter nothing is read, not even on a change', async () => {
        state.isPagePresenter = false;
        state.sidecars.set(DOC, { self: 'zoom' });
        await act(async () => root.render(<MapProbeComp filePath={DOC} />));
        await flush();
        await act(async () => state.fileEvents.at(-1)!.callback());
        await flush();
        expect(host.textContent).toBe('none');
        expect(state.getAllTransitions).not.toHaveBeenCalled();
    });

    test('an explicit isEnabled wins over the page', async () => {
        state.isPagePresenter = false;
        state.sidecars.set(DOC, { '1': 'fade' });
        await act(async () =>
            root.render(<MapProbeComp filePath={DOC} isEnabled />),
        );
        await flush();
        expect(host.textContent).toBe('{"1":"fade"}');
    });

    test('one slide reads its own and its document entries', async () => {
        state.sidecars.set(DOC, { self: 'zoom', '4': 'move' });
        await act(async () => root.render(<SlideProbeComp id={4} />));
        await flush();
        expect(host.textContent).toBe('move|zoom');
        await act(async () => root.render(<SlideProbeComp id={5} />));
        await flush();
        expect(host.textContent).toBe('-|zoom');
    });
});

describe('menu rows', () => {
    test('a slide card offers no row outside the presenter', () => {
        state.isPagePresenter = false;
        expect(
            genSlideTransitionMenuItems(DOC, 1, {
                own: 'move',
                documentOwn: undefined,
            }),
        ).toEqual([]);
    });

    test("a slide card's row names its own effect and opens its dialog", async () => {
        const [item] = genSlideTransitionMenuItems(DOC, 1, {
            own: 'move',
            documentOwn: 'zoom',
        });
        expect(item.menuElement).toBe('Transition: Slide In');
        item.onSelect!(new MouseEvent('click') as any);
        await flush();
        expect(state.showAppInput.mock.calls[0][0]).toBe('Slide transition');
        resolveInput(false);
    });

    test("a slide card's row says it follows its slides preview", () => {
        const [item] = genSlideTransitionMenuItems(DOC, 1, {
            own: undefined,
            documentOwn: 'zoom',
        });
        expect(item.menuElement).toBe('Transition: Zoom (Slides preview)');
    });

    test('the slides preview row is empty outside the presenter', async () => {
        state.isPagePresenter = false;
        await expect(genDocumentTransitionMenuItems(DOC)).resolves.toEqual([]);
        expect(state.getAllTransitions).not.toHaveBeenCalled();
    });

    test('the slides preview row reads the sidecar now and opens its dialog', async () => {
        state.sidecars.set(DOC, { self: 'none' });
        const [item] = await genDocumentTransitionMenuItems(DOC);
        expect(item.menuElement).toBe('Transition: No Transition');
        item.onSelect!(new MouseEvent('click') as any);
        await flush();
        expect(state.showAppInput.mock.calls[0][0]).toBe(
            'Slides preview transition',
        );
        resolveInput(false);
    });

    test('the slides preview row follows the screen when it has none', async () => {
        state.getCommonEffectType.mockReturnValue('zoom');
        const [item] = await genDocumentTransitionMenuItems(DOC);
        expect(item.menuElement).toBe('Transition: Zoom (Screen setting)');
    });
});

describe('transition badges', () => {
    test("the document badge shows the slides preview's own effect", async () => {
        state.sidecars.set(DOC, { self: 'zoom' });
        await act(async () =>
            root.render(<DocumentTransitionIconComp filePath={DOC} />),
        );
        await flush();
        const button = host.querySelector('button')!;
        expect(button.title).toBe('Slides preview transition: Zoom');
        expect(button.getAttribute('aria-label')).toBe(
            'Slides preview transition: Zoom',
        );
        expect(button.querySelector('i')!.className).toBe(
            'bi bi-arrows-fullscreen',
        );
        await act(async () => button.click());
        await flush();
        expect(state.showAppInput.mock.calls[0][0]).toBe(
            'Slides preview transition',
        );
        resolveInput(false);
    });

    test('no own effect, no document badge', async () => {
        state.sidecars.set(DOC, { '1': 'zoom' });
        await act(async () =>
            root.render(<DocumentTransitionIconComp filePath={DOC} />),
        );
        await flush();
        expect(host.querySelector('button')).toBeNull();
    });

    test('the document badge is not drawn outside the presenter', async () => {
        state.isPagePresenter = false;
        state.sidecars.set(DOC, { self: 'zoom' });
        await act(async () =>
            root.render(<DocumentTransitionIconComp filePath={DOC} />),
        );
        await flush();
        expect(host.innerHTML).toBe('');
    });

    test("a slide badge opens the slide's dialog without presenting the card", async () => {
        const onCardClick = vi.fn();
        const onCardContextMenu = vi.fn();
        await act(async () =>
            root.render(
                <div onClick={onCardClick} onContextMenu={onCardContextMenu}>
                    <SlideTransitionIconComp
                        filePath={DOC}
                        id={9}
                        effect="move"
                    />
                </div>,
            ),
        );
        const button = host.querySelector('button')!;
        expect(button.title).toBe('Slide transition: Slide In');
        await act(async () => button.click());
        await flush();
        expect(onCardClick).not.toHaveBeenCalled();
        expect(state.showAppInput.mock.calls[0][0]).toBe('Slide transition');
        resolveInput(true);
        await flush();
        expect(state.setTransition).toHaveBeenCalledWith(DOC, 9, undefined);

        const contextMenuEvent = new MouseEvent('contextmenu', {
            bubbles: true,
            cancelable: true,
        });
        await act(async () => button.dispatchEvent(contextMenuEvent));
        await flush();
        expect(contextMenuEvent.defaultPrevented).toBe(true);
        expect(onCardContextMenu).not.toHaveBeenCalled();
        expect(state.showAppInput).toHaveBeenCalledTimes(2);
        resolveInput(false);
    });

    test('a slide with no own effect has no badge', async () => {
        await act(async () =>
            root.render(
                <SlideTransitionIconComp
                    filePath={DOC}
                    id={1}
                    effect={undefined}
                />,
            ),
        );
        expect(host.innerHTML).toBe('');
    });
});
