// @vitest-environment jsdom

import { act, createElement, use } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// The previewer BODY for a song: it builds the `LyricManager` (real, here)
// once the song's `OpenLyric` is ready and wires the two directions of
// navigation between the rendered song and its slide cards. The open-lyric
// init, the pane layout and the slide class are stood in for.
const h = vi.hoisted(() => ({
    resizeProps: null as any,
    contextManager: null as any,
    initOpenLyric: vi.fn(),
    applyOpenLyricTheme: vi.fn(),
    notifyLyricElement: vi.fn(),
    notifyElementHighlight: vi.fn(),
    isDarkMode: false,
    lyric: null as any,
}));

vi.mock('../lang/langHelpers', () => ({ tran: (text: string) => text }));
vi.mock('../others/labelIconHelpers', () => ({
    toWidgetLabel: (name: string) => ({ widgetName: name }),
}));
vi.mock('../resize-actor/ResizeActorComp', async () => {
    const { Suspense } = await import('react');
    const { LyricManagerContext } = await import('./LyricManager');
    return {
        default: (props: any) => {
            h.resizeProps = props;
            h.contextManager = use(LyricManagerContext);
            return createElement(
                'div',
                { id: 'panes' },
                props.dataInput.map((input: any) =>
                    createElement(
                        Suspense,
                        { key: input.key, fallback: null },
                        createElement(input.children),
                    ),
                ),
            );
        },
    };
});
vi.mock('./LyricRenderPreviewBodyComp', () => ({
    default: () => createElement('div', { id: 'song-body' }),
}));
vi.mock('./LyricSlidesPreviewerComp', () => ({
    default: () => createElement('div', { id: 'slides-body' }),
}));
vi.mock('./Lyric', () => ({
    default: { getInstance: () => h.lyric },
}));
vi.mock('./lyricHelpers', () => ({
    applyOpenLyricTheme: h.applyOpenLyricTheme,
    initOpenLyric: h.initOpenLyric,
}));
vi.mock('../helper/appHooks', async () => {
    const { useEffect, useState } = await import('react');
    return {
        useAppEffect: useEffect,
        useAppStateAsync: (callee: () => Promise<any>, deps: any[] = []) => {
            const [value, setValue] = useState<any>(undefined);
            useEffect(() => {
                let isAlive = true;
                callee().then((newValue) => {
                    if (isAlive) {
                        setValue(newValue);
                    }
                });
                return () => {
                    isAlive = false;
                };
                // eslint-disable-next-line react-hooks/exhaustive-deps
            }, deps);
            return [value, setValue] as const;
        },
    };
});
vi.mock('../others/themeHelpers', () => ({
    useIsDarkMode: () => h.isDarkMode,
}));
vi.mock('./LyricSlide', () => ({
    INDEX_CLASSNAME_PREFIX: 'ol-slide--lyric-index',
    default: { notifyLyricElement: h.notifyLyricElement },
}));
vi.mock('../app-document-presenter/items/varyAppDocumentHelpers', () => ({
    ON_SLIDE_ITEM_SELECTED_EVENT: 'on-slide-item-selected',
}));
vi.mock('../helper/domHelpers', () => ({
    notifyElementHighlight: h.notifyElementHighlight,
}));
vi.mock('../helper/helpers', () => ({ bringDomToCenterView: vi.fn() }));

import EventHandler from '../event/EventHandler';
import LyricHandlerComp from './LyricHandlerComp';
import LyricManager from './LyricManager';

function genLyric() {
    const listeners = new Set<() => Promise<void>>();
    return {
        filePath: '/songs/grace.owl',
        content: 'v1: first',
        getContent: vi.fn(async function (this: any) {
            return h.lyric.content;
        }),
        fileSource: {
            registerEventListener: vi.fn(
                (_events: string[], listener: () => Promise<void>) => {
                    listeners.add(listener);
                    return [listener];
                },
            ),
            unregisterEventListener: vi.fn(
                ([listener]: [() => Promise<void>]) => {
                    listeners.delete(listener);
                },
            ),
            fireUpdate: async () => {
                for (const listener of listeners) {
                    await listener();
                }
            },
            listenerCount: () => listeners.size,
        },
    };
}

function genOpenLyric() {
    return { container: null as HTMLElement | null, value: 'v1: first' };
}

// What open-lyric renders inside the body: one section per verse.
function renderSong(manager: LyricManager, sectionCount = 3) {
    const songView = document.createElement('div');
    const sections = document.createElement('div');
    sections.className = 'ol-song-view__sections';
    for (let index = 0; index < sectionCount; index++) {
        sections.append(document.createElement('section'));
    }
    songView.append(sections);
    manager.containerElement!.append(songView);
    manager.openLyricPreviewer.container = songView;
    return sections;
}

function genSlideCard(className: string, parent: Element) {
    const card = document.createElement('div');
    card.className = className;
    parent.append(card);
    return card;
}

async function fireSlideSelected(target: Element) {
    await act(async () => {
        EventHandler.addPropEvent('on-slide-item-selected', { target });
        await new Promise((resolve) => {
            setTimeout(resolve, 0);
        });
    });
}

let container: HTMLDivElement;
let root: Root;
let openLyric: ReturnType<typeof genOpenLyric>;

async function renderBody(flexSizeNamePrefix?: string) {
    await act(async () => {
        root.render(
            createElement(LyricHandlerComp, {
                filePath: '/songs/grace.owl',
                flexSizeNamePrefix,
            }),
        );
    });
}

function getManager(): LyricManager {
    return h.contextManager;
}

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    h.resizeProps = null;
    h.contextManager = null;
    h.isDarkMode = false;
    h.lyric = genLyric();
    openLyric = genOpenLyric();
    h.initOpenLyric.mockResolvedValue(openLyric);
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

describe('loading', () => {
    test('shows Loading until the song is ready', async () => {
        let resolveInit: (value: unknown) => void = () => {};
        h.initOpenLyric.mockReturnValue(
            new Promise((resolve) => {
                resolveInit = resolve;
            }),
        );
        await renderBody();
        expect(container.textContent).toBe('Loading...');
        // Nothing to theme yet.
        expect(h.applyOpenLyricTheme).toHaveBeenLastCalledWith(null, false);

        await act(async () => {
            resolveInit(openLyric);
        });
        expect(container.textContent).toBe('');
        expect(container.querySelector('#panes')).not.toBeNull();
        expect(h.initOpenLyric).toHaveBeenCalledWith('/songs/grace.owl');
        // Both bodies are lazy chunks.
        await act(async () => {
            await new Promise((resolve) => {
                setTimeout(resolve, 0);
            });
        });
        const panes = container.querySelector('#panes')!;
        expect(Array.from(panes.children).map((pane) => pane.id)).toEqual([
            'song-body',
            'slides-body',
        ]);
    });

    test('lays out the song and its slides, sharing one manager', async () => {
        h.isDarkMode = true;
        await renderBody('floating-');

        expect(h.resizeProps.flexSizeName).toBe('floating-lyric-previewer');
        expect(h.resizeProps.isHorizontal).toBe(false);
        expect(
            h.resizeProps.dataInput.map((input: any) => {
                return [input.key, input.widgetName];
            }),
        ).toEqual([
            ['v1', 'Previewer'],
            ['v2', 'Slides'],
        ]);
        const manager = getManager();
        expect(manager).toBeInstanceOf(LyricManager);
        expect(manager.lyric).toBe(h.lyric);
        expect(manager.openLyricPreviewer).toBe(openLyric);
        expect(h.applyOpenLyricTheme).toHaveBeenLastCalledWith(openLyric, true);
        // The manager is scoped to THIS previewer's own element.
        expect(manager.containerElement).toBe(container.firstElementChild);
    });

    test('defaults to the main panel pane sizes', async () => {
        await renderBody();
        expect(h.resizeProps.flexSizeName).toBe('lyric-previewer');
    });
});

describe('song → slides', () => {
    test('a click on a verse brings its card into view in this previewer', async () => {
        await renderBody();
        const manager = getManager();
        const sections = renderSong(manager);

        (sections.children[1] as HTMLElement).click();
        expect(h.notifyLyricElement).toHaveBeenCalledExactlyOnceWith(
            1,
            manager.containerElement,
        );
    });
});

describe('slides → song', () => {
    test('a card of OURS scrolls the song to its verse', async () => {
        await renderBody();
        const manager = getManager();
        const sections = renderSong(manager);
        const card = genSlideCard(
            'card ol-slide--lyric-stage-0 ol-slide--lyric-index-2',
            manager.containerElement!,
        );

        await fireSlideSelected(card);
        expect(h.notifyElementHighlight).toHaveBeenCalledTimes(1);
        const [getElement] = h.notifyElementHighlight.mock.calls[0];
        expect(getElement()).toBe(sections.children[2]);
    });

    test('cards elsewhere, extra slides and other slide kinds are ignored', async () => {
        await renderBody();
        const manager = getManager();
        renderSong(manager);
        const elsewhere = document.createElement('div');
        document.body.append(elsewhere);

        // Another previewer's card, with an index of its own.
        await fireSlideSelected(
            genSlideCard('ol-slide--lyric-index-1', elsewhere),
        );
        // The First / Info / None slides carry `-1` — not verse 1.
        await fireSlideSelected(
            genSlideCard('ol-slide--lyric-index--1', manager.containerElement!),
        );
        // A slide that is not a lyric one.
        await fireSlideSelected(
            genSlideCard('slide-card', manager.containerElement!),
        );
        expect(h.notifyElementHighlight).not.toHaveBeenCalled();
        elsewhere.remove();
    });
});

describe('the file on disk', () => {
    test('an update re-feeds the previewer the new text', async () => {
        await renderBody();
        h.lyric.content = 'v1: edited';
        await act(async () => {
            await h.lyric.fileSource.fireUpdate();
        });
        expect(openLyric.value).toBe('v1: edited');
    });
});

describe('unmounting', () => {
    test('releases every listener and the manager', async () => {
        await renderBody();
        const manager = getManager();
        const containerElement = manager.containerElement!;
        const sections = renderSong(manager);
        expect(h.lyric.fileSource.listenerCount()).toBe(1);

        act(() => {
            root.unmount();
        });
        root = createRoot(container);

        expect(h.lyric.fileSource.unregisterEventListener).toHaveBeenCalled();
        expect(h.lyric.fileSource.listenerCount()).toBe(0);
        expect(containerElement.onclick).toBeNull();
        expect(manager.containerElement).toBeNull();

        // A card selected after the previewer is gone reaches nothing.
        await fireSlideSelected(
            genSlideCard('ol-slide--lyric-index-0', document.body),
        );
        (sections.children[0] as HTMLElement).click();
        expect(h.notifyElementHighlight).not.toHaveBeenCalled();
        expect(h.notifyLyricElement).not.toHaveBeenCalled();
    });
});
