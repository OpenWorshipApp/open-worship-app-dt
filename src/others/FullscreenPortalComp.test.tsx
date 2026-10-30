// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import FullscreenPortalComp from './FullscreenPortalComp';

let host: HTMLDivElement;
let root: Root;
let fullscreenElement: Element | null;

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    fullscreenElement = null;
    Object.defineProperty(document, 'fullscreenElement', {
        configurable: true,
        get: () => fullscreenElement,
    });
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
});

afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    delete (document as any).fullscreenElement;
    vi.unstubAllGlobals();
});

async function changeFullscreen(element: Element | null) {
    fullscreenElement = element;
    await act(async () => {
        document.dispatchEvent(new Event('fullscreenchange'));
    });
}

describe('FullscreenPortalComp', () => {
    test('renders in place, moves into the fullscreen element and back', async () => {
        await act(async () =>
            root.render(
                <FullscreenPortalComp>
                    <div className="overlay-menu">menu</div>
                </FullscreenPortalComp>,
            ),
        );
        expect(host.querySelector('.overlay-menu')).not.toBeNull();

        const stage = document.createElement('div');
        document.body.append(stage);
        await changeFullscreen(stage);
        expect(host.querySelector('.overlay-menu')).toBeNull();
        expect(stage.querySelector('.overlay-menu')!.textContent).toBe('menu');

        await changeFullscreen(null);
        expect(stage.querySelector('.overlay-menu')).toBeNull();
        expect(host.querySelector('.overlay-menu')).not.toBeNull();
        stage.remove();
    });

    test('stops following fullscreen changes once unmounted', async () => {
        const removeSpy = vi.spyOn(document, 'removeEventListener');
        await act(async () =>
            root.render(
                <FullscreenPortalComp>
                    <span>x</span>
                </FullscreenPortalComp>,
            ),
        );
        await act(async () => root.render(<></>));
        expect(removeSpy).toHaveBeenCalledWith(
            'fullscreenchange',
            expect.any(Function),
        );
    });
});
