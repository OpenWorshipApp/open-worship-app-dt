// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => {
    return {
        appProvider: { isPageReader: true },
        isAutoPlay: true,
        isVisible: true,
        playMediaElement: vi.fn(),
        showAppContextMenu: vi.fn(),
    };
});

vi.mock('../../server/appProvider', () => ({ default: h.appProvider }));
vi.mock('../../helper/ai/aiHelpers', () => ({
    getAIIsAutoPlay: () => h.isAutoPlay,
}));
vi.mock('../../helper/mediaHelpers', () => ({
    playMediaElement: h.playMediaElement,
}));
vi.mock('../../context-menu/appContextMenuHelpers', () => ({
    showAppContextMenu: h.showAppContextMenu,
}));
vi.mock('../../context-menu/contextMenuIconHelpers', () => ({
    genContextMenuItemIcon: (name: string) => name,
}));
vi.mock('../../context-menu/ContextMenuDotsButtonComp', () => ({
    default: () => <button type="button" className="dots" />,
}));
vi.mock('../../others/LoadingComp', () => ({
    default: () => <span className="loading" />,
}));
vi.mock('../../lang/langHelpers', () => ({ tran: (key: string) => key }));
vi.mock('../../helper/appHooks', async () => {
    const React = await import('react');
    return {
        useAppCurrentRef: (value: unknown) => {
            const ref = React.useRef(value);
            ref.current = value;
            return ref;
        },
    };
});

import AudioPlayerComp from './AudioPlayerComp';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

async function renderPlayer(
    src: string | undefined | null,
    onStart: (audio: HTMLAudioElement) => void,
    onEnd: (audio: HTMLAudioElement) => void = () => {},
) {
    await act(async () => {
        root.render(
            <AudioPlayerComp
                src={src}
                onStart={onStart}
                onEnd={onEnd}
                refreshAudio={() => {}}
            />,
        );
    });
}

beforeEach(() => {
    h.appProvider.isPageReader = true;
    h.isAutoPlay = true;
    h.isVisible = true;
    (HTMLElement.prototype as any).checkVisibility = () => h.isVisible;
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
});

describe('AudioPlayerComp auto-play', () => {
    // Found by UT-79 (2026-11-03): the auto-play ran from an INLINE ref, a new
    // function on every render, and React calls a new ref callback again on
    // every commit -- so each time anything drew the player again, the verse
    // was played over, took the focus, and the next verse's speech was asked
    // for again.
    test('starts a verse once, however often the player is drawn again', async () => {
        const firstOnStart = vi.fn();
        await renderPlayer('/speech/a.mp3', firstOnStart);
        const audio = host.querySelector('audio')!;
        expect(h.playMediaElement.mock.calls).toEqual([[audio]]);
        expect(firstOnStart.mock.calls).toEqual([[audio]]);

        const laterOnStart = vi.fn();
        await renderPlayer('/speech/a.mp3', laterOnStart);
        await renderPlayer('/speech/a.mp3', laterOnStart);
        expect(host.querySelector('audio')).toBe(audio);
        expect(h.playMediaElement).toHaveBeenCalledTimes(1);
        expect(firstOnStart).toHaveBeenCalledTimes(1);
        expect(laterOnStart).not.toHaveBeenCalled();
    });

    test('a verse whose speech has just arrived starts as its player appears', async () => {
        const onStart = vi.fn();
        await renderPlayer(undefined, onStart);
        expect(host.querySelector('.loading')).not.toBeNull();
        expect(host.querySelector('audio')).toBeNull();
        expect(h.playMediaElement).not.toHaveBeenCalled();

        await renderPlayer('/speech/b.mp3', onStart);
        const audio = host.querySelector('audio')!;
        expect(audio.querySelector('source')!.getAttribute('src')).toBe(
            '/speech/b.mp3',
        );
        expect(h.playMediaElement.mock.calls).toEqual([[audio]]);
        expect(onStart.mock.calls).toEqual([[audio]]);
        expect(document.activeElement === audio || audio.tabIndex < 0).toBe(
            true,
        );
    });

    test.each([
        ['outside the Reader', () => (h.appProvider.isPageReader = false)],
        ['with auto-play off', () => (h.isAutoPlay = false)],
        ['for a player out of sight', () => (h.isVisible = false)],
    ])('nothing starts by itself %s', async (_label, arrange) => {
        arrange();
        const onStart = vi.fn();
        await renderPlayer('/speech/c.mp3', onStart);
        expect(host.querySelector('audio')).not.toBeNull();
        expect(h.playMediaElement).not.toHaveBeenCalled();
        expect(onStart).not.toHaveBeenCalled();
    });

    test('no speech for the verse draws no player at all', async () => {
        await renderPlayer(null, vi.fn());
        expect(host.innerHTML).toBe('');
    });
});
