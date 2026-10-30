// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    notifyElementHighlight: vi.fn(),
    bringDomToCenterView: vi.fn(),
}));

vi.mock('../helper/domHelpers', () => ({
    notifyElementHighlight: h.notifyElementHighlight,
}));
vi.mock('../helper/helpers', () => ({
    bringDomToCenterView: h.bringDomToCenterView,
}));

import LyricManager, {
    LyricManagerContext,
    useLyricManagerContext,
} from './LyricManager';

// What open-lyric renders: a song view holding one section element per verse.
function genSongView(sectionCount: number) {
    const songView = document.createElement('div');
    const sections = document.createElement('div');
    sections.className = 'ol-song-view__sections';
    for (let index = 0; index < sectionCount; index++) {
        const section = document.createElement('section');
        const line = document.createElement('span');
        line.textContent = `verse ${index}`;
        section.append(line);
        sections.append(section);
    }
    songView.append(sections);
    return { songView, sections };
}

// The previewer's `value` is a setter that re-parses the whole song, so the
// writes to it are counted.
function genOpenLyric(value = 'v1: old') {
    const valueWrites: string[] = [];
    let currentValue = value;
    return {
        container: null as HTMLElement | null,
        valueWrites,
        get value() {
            return currentValue;
        },
        set value(newValue: string) {
            valueWrites.push(newValue);
            currentValue = newValue;
        },
    };
}

function genLyric(content = 'v1: old') {
    return {
        filePath: '/songs/grace.owl',
        fileSource: { name: 'grace.owl' },
        getContent: vi.fn(async () => content),
    };
}

let lyric: ReturnType<typeof genLyric>;
let openLyric: ReturnType<typeof genOpenLyric>;
let manager: LyricManager;

function mountPreviewer(sectionCount = 3) {
    const container = document.createElement('div');
    const { songView, sections } = genSongView(sectionCount);
    const slidePane = document.createElement('div');
    container.append(songView, slidePane);
    document.body.append(container);
    openLyric.container = songView;
    manager.containerElement = container;
    manager.initLyricPreviewEvent();
    return { container, sections, slidePane };
}

beforeEach(() => {
    document.body.innerHTML = '';
    lyric = genLyric();
    openLyric = genOpenLyric();
    manager = new LyricManager(lyric as any, openLyric as any);
});

describe('LyricManager', () => {
    test('exposes the song it manages', () => {
        expect(manager.lyric).toBe(lyric);
        expect(manager.openLyricPreviewer).toBe(openLyric);
        expect(manager.filePath).toBe('/songs/grace.owl');
        expect(manager.fileSource).toBe(lyric.fileSource);
        // Constructed before the component has an element to give it.
        expect(manager.containerElement).toBeNull();
    });

    test('finds the rendered sections only once the song is mounted', () => {
        expect(manager.previewPanel).toBeNull();
        const { sections } = mountPreviewer();
        expect(manager.previewPanel).toBe(sections);
    });
});

describe('song → slide click delegation', () => {
    test('a click in a verse reports that verse', () => {
        const onSectionSelected = vi.fn();
        manager.onSectionSelected = onSectionSelected;
        const { sections } = mountPreviewer();

        (sections.children[2].firstChild as HTMLElement).click();
        expect(onSectionSelected).toHaveBeenCalledExactlyOnceWith(2);
    });

    test('clicks that are not on a verse are left alone', () => {
        const onSectionSelected = vi.fn();
        manager.onSectionSelected = onSectionSelected;
        const { sections, slidePane } = mountPreviewer();

        // The slide panes share the container.
        slidePane.click();
        // The sections box itself, between verses.
        sections.click();
        expect(onSectionSelected).not.toHaveBeenCalled();

        // No song rendered at all (open-lyric replaced its markup).
        openLyric.container = null;
        slidePane.click();
        expect(onSectionSelected).not.toHaveBeenCalled();
    });

    test('survives a re-render that replaces the panel markup', () => {
        const onSectionSelected = vi.fn();
        manager.onSectionSelected = onSectionSelected;
        mountPreviewer();
        // open-lyric swaps its whole song view on every render.
        const { songView, sections } = genSongView(4);
        manager.containerElement!.prepend(songView);
        openLyric.container = songView;

        (sections.children[3] as HTMLElement).click();
        expect(onSectionSelected).toHaveBeenCalledWith(3);
    });

    test('destroy releases the delegation, and init restores it', () => {
        const onSectionSelected = vi.fn();
        manager.onSectionSelected = onSectionSelected;
        const { container, sections } = mountPreviewer();

        manager.destroy();
        expect(container.onclick).toBeNull();
        expect(manager.onSectionSelected).toBeNull();
        expect(manager.containerElement).toBeNull();
        (sections.children[0] as HTMLElement).click();
        expect(onSectionSelected).not.toHaveBeenCalled();
        // Without an element, re-installing is a no-op rather than a throw.
        manager.initLyricPreviewEvent();
        manager.destroy();

        // StrictMode's remount: the component hands the element back.
        manager.onSectionSelected = onSectionSelected;
        manager.containerElement = container;
        manager.initLyricPreviewEvent();
        (sections.children[1] as HTMLElement).click();
        expect(onSectionSelected).toHaveBeenCalledWith(1);
    });
});

describe('notifyLyricElement', () => {
    test('scrolls to and flashes the verse at that index', () => {
        const { sections } = mountPreviewer();
        manager.notifyLyricElement(1);

        expect(h.notifyElementHighlight).toHaveBeenCalledTimes(1);
        const [getElement, options] = h.notifyElementHighlight.mock.calls[0];
        expect(getElement()).toBe(sections.children[1]);
        expect(options.moveToView).toBe(h.bringDomToCenterView);
    });

    test('an index no verse answers to does nothing', () => {
        manager.notifyLyricElement(0);
        mountPreviewer(2);
        manager.notifyLyricElement(-1);
        manager.notifyLyricElement(5);
        expect(h.notifyElementHighlight).not.toHaveBeenCalled();
    });
});

describe('refreshOpenLyricContent', () => {
    test('re-feeds the previewer only when the text on disk moved', async () => {
        await manager.refreshOpenLyricContent();
        expect(openLyric.valueWrites).toEqual([]);

        lyric.getContent.mockResolvedValue('v1: new');
        await manager.refreshOpenLyricContent();
        expect(openLyric.valueWrites).toEqual(['v1: new']);
        expect(openLyric.value).toBe('v1: new');
    });
});

describe('useLyricManagerContext', () => {
    let container: HTMLDivElement;
    let root: Root;

    beforeEach(() => {
        vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
        container = document.createElement('div');
        document.body.append(container);
        root = createRoot(container);
    });

    afterEach(() => {
        act(() => {
            root.unmount();
        });
        vi.unstubAllGlobals();
    });

    test('hands the provided manager to the subtree', async () => {
        let seen: LyricManager | null = null;
        function ConsumerComp() {
            seen = useLyricManagerContext();
            return null;
        }
        await act(async () => {
            root.render(
                createElement(
                    LyricManagerContext,
                    { value: manager },
                    createElement(ConsumerComp),
                ),
            );
        });
        expect(seen).toBe(manager);
    });

    test('refuses to be read outside a provider', () => {
        function ConsumerComp() {
            useLyricManagerContext();
            return null;
        }
        // React logs the uncaught render error before rethrowing it.
        const consoleError = vi
            .spyOn(console, 'error')
            .mockImplementation(() => {});
        expect(() => {
            act(() => {
                root.render(createElement(ConsumerComp));
            });
        }).toThrow('useLyricManagerContext must be used within a');
        consoleError.mockRestore();
    });
});
