// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    isSoundHere: true,
    screenManager: null as any,
    eventCalls: [] as any[][],
    handleAudioPlaying: vi.fn(),
    handleAudioPausing: vi.fn(),
    handleAudioEnding: vi.fn(),
    pressElementLikeButton: vi.fn(),
}));

vi.mock('../../lang/langHelpers', () => ({ tran: (text: string) => text }));
vi.mock('../../helper/mediaControlHelpers', () => ({
    handleAudioPlaying: h.handleAudioPlaying,
    handleAudioPausing: h.handleAudioPausing,
    handleAudioEnding: h.handleAudioEnding,
}));
vi.mock('../managers/screenManagerHooks', () => ({
    useScreenManagerContext: () => h.screenManager,
    useScreenManagerEvents: (...args: any[]) => {
        h.eventCalls.push(args);
    },
}));
vi.mock('../../helper/appHooks', async () => {
    const { useEffect, useRef } = await import('react');
    return {
        useAppEffect: useEffect,
        useAppCurrentRef: (current: unknown) => {
            const ref = useRef(current);
            ref.current = current;
            return ref;
        },
    };
});
vi.mock('../screenSoundHelpers', () => ({
    checkIsSoundHere: () => h.isSoundHere,
}));
vi.mock('../../helper/helpers', () => ({
    pressElementLikeButton: h.pressElementLikeButton,
}));

import MiniScreenAudioHandlersComp from './MiniScreenAudioHandlersComp';

let container: HTMLDivElement;
let root: Root;

async function renderComp(src = '/media/Amazing%20Grace.mp4') {
    await act(async () => {
        root.render(
            <MiniScreenAudioHandlersComp src={src} videoId="video-1" />,
        );
    });
    return container.querySelector('audio')!;
}

function getRepeatButton() {
    return container.querySelector<HTMLElement>('[role="button"]')!;
}

function setPlaying(audio: HTMLAudioElement, isPlaying: boolean) {
    Object.defineProperty(audio, 'paused', {
        configurable: true,
        value: !isPlaying,
    });
}

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    h.isSoundHere = true;
    h.eventCalls.length = 0;
    h.screenManager = {
        screenBackgroundManager: {
            sendSyncVideoSound: vi.fn(),
            setBackgroundVideoCurrentTimeForce: vi.fn(),
        },
    };
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(() => {
    act(() => {
        root.unmount();
    });
    container.remove();
    vi.unstubAllGlobals();
});

describe('MiniScreenAudioHandlersComp', () => {
    test('names the track by its decoded file name', async () => {
        const audio = await renderComp();
        expect(container.querySelector('bdi')!.textContent).toBe(
            'Amazing Grace.mp4',
        );
        expect(audio.dataset.videoId).toBe('video-1');
        expect(audio.querySelector('source')!.getAttribute('src')).toBe(
            '/media/Amazing%20Grace.mp4',
        );
        expect(getRepeatButton().getAttribute('aria-label')).toBe(
            'Repeat this audio: Amazing Grace.mp4',
        );
        expect(h.eventCalls[0]).toEqual([['display-id'], h.screenManager]);
    });

    test('a name with no path is shown whole', async () => {
        await renderComp('track.mp3');
        expect(container.querySelector('bdi')!.textContent).toBe('track.mp3');
    });

    test('repeat is on by default and toggles', async () => {
        await renderComp();
        expect(getRepeatButton().getAttribute('aria-pressed')).toBe('true');
        expect(getRepeatButton().style.color).toBe('green');

        await act(async () => {
            getRepeatButton().click();
        });
        expect(getRepeatButton().getAttribute('aria-pressed')).toBe('false');
        expect(getRepeatButton().style.opacity).toBe('0.5');

        // The ended handler is bound to the CURRENT repeat state.
        await act(async () => {
            container.querySelector('audio')!.dispatchEvent(new Event('ended'));
        });
        expect(h.handleAudioEnding).toHaveBeenCalledTimes(1);
        expect(h.handleAudioEnding.mock.calls[0][0]).toBe(false);

        await act(async () => {
            getRepeatButton().dispatchEvent(
                new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
            );
        });
        expect(h.pressElementLikeButton).toHaveBeenCalledTimes(1);
    });

    test('where the sound plays here it stays audible and sends nothing', async () => {
        const audio = await renderComp();
        expect(audio.muted).toBe(false);

        await act(async () => {
            audio.dispatchEvent(new Event('play'));
            audio.dispatchEvent(new Event('pause'));
            audio.dispatchEvent(new Event('volumechange'));
        });
        expect(h.handleAudioPlaying).toHaveBeenCalledTimes(1);
        expect(h.handleAudioPausing).toHaveBeenCalledTimes(1);
        expect(
            h.screenManager.screenBackgroundManager.sendSyncVideoSound,
        ).not.toHaveBeenCalled();
    });

    test('on a virtual display this copy is muted and reports the sound', async () => {
        h.isSoundHere = false;
        const audio = await renderComp();
        const { sendSyncVideoSound } = h.screenManager.screenBackgroundManager;
        expect(audio.muted).toBe(true);
        expect(sendSyncVideoSound).toHaveBeenLastCalledWith(
            'video-1',
            false,
            1,
        );

        setPlaying(audio, true);
        await act(async () => {
            audio.dispatchEvent(new Event('play'));
        });
        expect(h.handleAudioPlaying).toHaveBeenCalledTimes(1);
        expect(sendSyncVideoSound).toHaveBeenLastCalledWith('video-1', true, 1);

        // Unmuted by hand: muted again, the level passed on.
        audio.muted = false;
        audio.volume = 0.25;
        await act(async () => {
            audio.dispatchEvent(new Event('volumechange'));
        });
        expect(audio.muted).toBe(true);
        expect(sendSyncVideoSound).toHaveBeenLastCalledWith(
            'video-1',
            true,
            0.25,
        );

        setPlaying(audio, false);
        await act(async () => {
            audio.dispatchEvent(new Event('pause'));
        });
        expect(h.handleAudioPausing).toHaveBeenCalledTimes(1);
        expect(sendSyncVideoSound).toHaveBeenLastCalledWith(
            'video-1',
            false,
            0.25,
        );
    });

    test('every time tick syncs the background video, and the page learns the sound', async () => {
        h.isSoundHere = false;
        const audio = await renderComp();
        const { setBackgroundVideoCurrentTimeForce, sendSyncVideoSound } =
            h.screenManager.screenBackgroundManager;
        sendSyncVideoSound.mockClear();
        Object.defineProperty(audio, 'currentTime', {
            configurable: true,
            value: 12.5,
        });
        await act(async () => {
            audio.dispatchEvent(new Event('timeupdate'));
        });
        expect(setBackgroundVideoCurrentTimeForce).toHaveBeenCalledWith(
            'video-1',
            12.5,
            false,
        );
        expect(sendSyncVideoSound).toHaveBeenCalledTimes(1);
    });

    test('the time sync runs where the sound is local too', async () => {
        const audio = await renderComp();
        await act(async () => {
            audio.dispatchEvent(new Event('timeupdate'));
        });
        expect(
            h.screenManager.screenBackgroundManager
                .setBackgroundVideoCurrentTimeForce,
        ).toHaveBeenCalledWith('video-1', 0, false);
        expect(
            h.screenManager.screenBackgroundManager.sendSyncVideoSound,
        ).not.toHaveBeenCalled();
    });
});
