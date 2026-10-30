// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    appProvider: { isPageReader: true },
    getAIIsAutoPlay: vi.fn(),
    playMediaElement: vi.fn(),
    showAppContextMenu: vi.fn(),
    isVisible: true,
}));

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
vi.mock('../../lang/langHelpers', () => ({ tran: (key: string) => key }));
vi.mock('../../others/LoadingComp', () => ({
    default: () => <div className="test-loading" />,
}));
vi.mock('../../helper/ai/aiHelpers', () => ({
    getAIIsAutoPlay: h.getAIIsAutoPlay,
}));
vi.mock('../../helper/mediaHelpers', () => ({
    playMediaElement: h.playMediaElement,
}));
vi.mock('../../server/appProvider', () => ({ default: h.appProvider }));
vi.mock('../../context-menu/appContextMenuHelpers', () => ({
    showAppContextMenu: h.showAppContextMenu,
}));
vi.mock('../../context-menu/contextMenuIconHelpers', () => ({
    genContextMenuItemIcon: (name: string) => `icon:${name}`,
}));

import AudioPlayerComp from './AudioPlayerComp';

let host: HTMLDivElement;
let root: Root;
let pauseSpy: ReturnType<typeof vi.spyOn>;
const onStart = vi.fn();
const onEnd = vi.fn();
const refreshAudio = vi.fn();

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    h.appProvider.isPageReader = true;
    h.isVisible = true;
    h.getAIIsAutoPlay.mockReturnValue(false);
    // jsdom has no layout, so no `checkVisibility`, and no media playback.
    Object.defineProperty(HTMLElement.prototype, 'checkVisibility', {
        configurable: true,
        value: () => h.isVisible,
    });
    pauseSpy = vi
        .spyOn(HTMLMediaElement.prototype, 'pause')
        .mockImplementation(() => {});
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
});

afterEach(() => {
    act(() => {
        root.unmount();
    });
    host.remove();
    delete (HTMLElement.prototype as any).checkVisibility;
    vi.unstubAllGlobals();
});

async function render(src: string | undefined | null) {
    await act(async () => {
        root.render(
            <AudioPlayerComp
                src={src}
                onStart={onStart}
                onEnd={onEnd}
                refreshAudio={refreshAudio}
            />,
        );
    });
    return host.querySelector<HTMLAudioElement>('audio');
}

describe('what is drawn', () => {
    test('a verse still loading its audio shows a small loader', async () => {
        await render(undefined);
        const box = host.querySelector<HTMLDivElement>('div.verse-audio')!;
        expect(box.style.width).toBe('40px');
        expect(box.style.height).toBe('40px');
        expect(box.querySelector('.test-loading')).not.toBeNull();
        expect(host.querySelector('audio')).toBeNull();
    });

    test('a verse with no audio draws nothing', async () => {
        await render(null);
        expect(host.innerHTML).toBe('');
    });

    test('a verse with audio gets a player and its menu button', async () => {
        const audio = (await render('src://GEN-1-1.mp3'))!;
        expect(audio.className).toBe('verse-audio');
        expect(audio.controls).toBe(true);
        expect(audio.querySelector('source')!.getAttribute('src')).toBe(
            'src://GEN-1-1.mp3',
        );
        expect(audio.querySelector('track')!.getAttribute('kind')).toBe(
            'captions',
        );
        expect(audio.textContent).toBe('Browser does not support audio.');
        // Beside the player: an `<audio>` takes no children of ours.
        const dots = audio.nextElementSibling!;
        expect(dots.classList.contains('app-context-menu-dots')).toBe(true);
        expect(h.playMediaElement).not.toHaveBeenCalled();
    });
});

describe('auto play', () => {
    test('the reader plays a visible verse at once and says so', async () => {
        h.getAIIsAutoPlay.mockReturnValue(true);
        // jsdom never focuses an `<audio>`; what matters is that it is asked.
        const focusSpy = vi.spyOn(HTMLElement.prototype, 'focus');
        const audio = (await render('src://a.mp3'))!;
        expect(h.playMediaElement).toHaveBeenCalledWith(audio);
        expect(onStart).toHaveBeenCalledWith(audio);
        expect(focusSpy.mock.contexts).toContain(audio);
    });

    test('nothing plays by itself without auto play', async () => {
        await render('src://a.mp3');
        expect(h.playMediaElement).not.toHaveBeenCalled();
        expect(onStart).not.toHaveBeenCalled();
    });

    test('nothing plays by itself outside the reader', async () => {
        h.getAIIsAutoPlay.mockReturnValue(true);
        h.appProvider.isPageReader = false;
        await render('src://a.mp3');
        expect(h.playMediaElement).not.toHaveBeenCalled();
    });

    test('a verse out of sight does not start playing', async () => {
        h.getAIIsAutoPlay.mockReturnValue(true);
        h.isVisible = false;
        await render('src://a.mp3');
        expect(h.playMediaElement).not.toHaveBeenCalled();
        expect(onStart).not.toHaveBeenCalled();
    });
});

describe('playing and ending', () => {
    test('playing one verse pauses every other player on the page', async () => {
        const otherAudio = document.createElement('audio');
        document.body.appendChild(otherAudio);
        try {
            const audio = (await render('src://a.mp3'))!;
            await act(async () => {
                audio.dispatchEvent(new Event('play'));
            });
            expect(pauseSpy).toHaveBeenCalledOnce();
            expect(pauseSpy.mock.contexts[0]).toBe(otherAudio);
        } finally {
            otherAudio.remove();
        }
    });

    test('a verse that ends in sight hands over to the next', async () => {
        const audio = (await render('src://a.mp3'))!;
        await act(async () => {
            audio.dispatchEvent(new Event('ended'));
        });
        expect(onEnd).toHaveBeenCalledWith(audio);
    });

    test('a verse that ends out of sight hands over nothing', async () => {
        const audio = (await render('src://a.mp3'))!;
        h.isVisible = false;
        await act(async () => {
            audio.dispatchEvent(new Event('ended'));
        });
        expect(onEnd).not.toHaveBeenCalled();
    });
});

describe('the menu', () => {
    test('a right-click on the player offers to refresh its audio', async () => {
        const audio = (await render('src://a.mp3'))!;
        await act(async () => {
            audio.dispatchEvent(
                new MouseEvent('contextmenu', {
                    bubbles: true,
                    cancelable: true,
                }),
            );
        });
        expect(h.showAppContextMenu).toHaveBeenCalledOnce();
        const [, items] = h.showAppContextMenu.mock.calls[0];
        expect(items).toEqual([
            {
                childBefore: 'icon:arrow-clockwise',
                menuElement: 'Refresh',
                onSelect: refreshAudio,
            },
        ]);
    });

    test('the menu button opens the same menu', async () => {
        await render('src://a.mp3');
        const dots = host.querySelector<HTMLButtonElement>(
            '.app-context-menu-dots',
        )!;
        await act(async () => {
            dots.click();
        });
        expect(h.showAppContextMenu).toHaveBeenCalledOnce();
        const [, items] = h.showAppContextMenu.mock.calls[0];
        items[0].onSelect();
        expect(refreshAudio).toHaveBeenCalledOnce();
    });
});
