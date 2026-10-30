// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    audioState: { isAudioEnabled: false, isAvailable: true },
    useIsAudioAIEnabled: vi.fn(),
    checkIsAIAudioAvailableForBible: vi.fn(),
    applyTargetOrBibleKey: vi.fn(),
    pressElementLikeButton: vi.fn(),
}));

vi.mock('../helper/ai/openAIAudioHelpers', () => ({
    checkIsAIAudioAvailableForBible: h.checkIsAIAudioAvailableForBible,
    useIsAudioAIEnabled: h.useIsAudioAIEnabled,
}));
vi.mock('./BibleItemsViewController', () => ({
    useBibleItemsViewControllerContext: () => ({
        applyTargetOrBibleKey: h.applyTargetOrBibleKey,
    }),
}));
vi.mock('../helper/helpers', () => ({
    pressElementLikeButton: h.pressElementLikeButton,
}));
vi.mock('../lang/langHelpers', () => ({ tran: (key: string) => key }));

import { AudioAIEnablingComp } from './AudioAIEnablingComp';

const BIBLE_ITEM = { id: 1, bibleKey: 'KJV' } as any;

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    h.audioState = { isAudioEnabled: false, isAvailable: true };
    h.useIsAudioAIEnabled.mockImplementation(() => h.audioState);
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
});

afterEach(() => {
    act(() => {
        root.unmount();
    });
    host.remove();
    vi.unstubAllGlobals();
});

async function render() {
    await act(async () => {
        root.render(<AudioAIEnablingComp bibleItem={BIBLE_ITEM} />);
    });
    return host.querySelector<HTMLElement>('i.bi-soundwave');
}

describe('AudioAIEnablingComp', () => {
    test('no toggle where audio cannot be made', async () => {
        h.audioState = { isAudioEnabled: false, isAvailable: false };
        expect(await render()).toBeNull();
        expect(h.useIsAudioAIEnabled).toHaveBeenCalledWith(BIBLE_ITEM);
    });

    test('an off toggle is a named, unpressed button', async () => {
        const icon = (await render())!;
        expect(icon.getAttribute('role')).toBe('button');
        expect(icon.tabIndex).toBe(0);
        expect(icon.getAttribute('aria-label')).toBe('Toggle Bible Audio');
        expect(icon.getAttribute('aria-pressed')).toBe('false');
        expect(icon.style.color).toBe('');
    });

    test('an on toggle is pressed and green', async () => {
        h.audioState = { isAudioEnabled: true, isAvailable: true };
        const icon = (await render())!;
        expect(icon.getAttribute('aria-pressed')).toBe('true');
        expect(icon.style.color).toBe('green');
    });

    test('a press flips audio for this passage from what is stored', async () => {
        h.checkIsAIAudioAvailableForBible.mockResolvedValue(true);
        const icon = (await render())!;
        await act(async () => {
            icon.click();
        });
        expect(h.checkIsAIAudioAvailableForBible).toHaveBeenCalledWith(
            BIBLE_ITEM,
        );
        expect(h.applyTargetOrBibleKey).toHaveBeenCalledWith(BIBLE_ITEM, {
            isAudioEnabled: false,
        });

        h.checkIsAIAudioAvailableForBible.mockResolvedValue(false);
        await act(async () => {
            icon.click();
        });
        expect(h.applyTargetOrBibleKey).toHaveBeenLastCalledWith(BIBLE_ITEM, {
            isAudioEnabled: true,
        });
    });

    test('the keyboard reaches it like a button', async () => {
        const icon = (await render())!;
        await act(async () => {
            icon.dispatchEvent(
                new KeyboardEvent('keydown', { key: ' ', bubbles: true }),
            );
        });
        expect(h.pressElementLikeButton).toHaveBeenCalledOnce();
        expect(h.pressElementLikeButton.mock.calls[0][0].key).toBe(' ');
    });
});
