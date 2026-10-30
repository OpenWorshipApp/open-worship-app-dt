// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    initReceiveCount: 0,
    toggleKeyHookCount: 0,
    settingNames: [] as string[],
    zoomOptions: null as any,
    zoomRef: null as any,
    mirror: null as any,
    allScreenManagers: [] as any[],
    setMirrorPanelShowing: vi.fn(),
    openMiniScreenContextMenu: vi.fn(),
    pressElementLikeButton: vi.fn(),
}));

vi.mock('./MiniScreen.scss', () => ({}));
vi.mock('./MiniScreenFooterComp', () => ({
    defaultRangeSize: { size: 9, min: 1, max: 30, step: 1 },
    default: ({
        previewSizeScale,
        setPreviewSizeScale,
    }: {
        previewSizeScale: number;
        setPreviewSizeScale: (size: number) => void;
    }) => (
        <button
            type="button"
            data-stub="footer"
            data-scale={previewSizeScale}
            onClick={() => {
                setPreviewSizeScale(previewSizeScale + 1);
            }}
        />
    ),
}));
vi.mock('../../helper/settingHelpers', async () => {
    const { useState } = await import('react');
    return {
        useStateSettingNumber: (name: string, initial: number) => {
            h.settingNames.push(name);
            return useState(initial);
        },
    };
});
vi.mock('../../others/AppRangeComp', () => ({
    useZoomingRegistering: (ref: any, options: any) => {
        h.zoomRef = ref;
        h.zoomOptions = options;
    },
}));
vi.mock('../managers/screenManagerHelpers', () => ({
    getAllScreenManagers: () => h.allScreenManagers,
}));
vi.mock('../managers/ScreenManager', () => ({
    default: {
        initReceiveScreenMessage: () => {
            h.initReceiveCount += 1;
        },
    },
}));
vi.mock('./MiniScreenBodyComp', () => ({
    default: ({ previewScale }: { previewScale: number }) => (
        <div data-stub="body" data-scale={previewScale} />
    ),
    openMiniScreenContextMenu: h.openMiniScreenContextMenu,
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
vi.mock('../../helper/helpers', () => ({
    pressElementLikeButton: h.pressElementLikeButton,
}));
vi.mock('../../lang/langHelpers', () => ({ tran: (text: string) => text }));
vi.mock('../../screen-mirror/ScreenMirrorFloatingComp', () => ({
    default: () => <div data-stub="mirror-floating" />,
}));
vi.mock('../../screen-mirror/mirrorConnectionHelpers', () => ({
    useMirrorState: () => h.mirror,
    setMirrorPanelShowing: h.setMirrorPanelShowing,
}));
vi.mock('./ShowHideScreen', () => ({
    useToggleScreensShowingKey: () => {
        h.toggleKeyHookCount += 1;
    },
}));

import MiniScreenComp from './MiniScreenComp';

// Taken at import, before any `beforeEach` resets the counter.
const initReceiveCountAtImport = h.initReceiveCount;

let container: HTMLDivElement;
let root: Root;

async function renderComp() {
    await act(async () => {
        root.render(<MiniScreenComp />);
    });
}

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    h.toggleKeyHookCount = 0;
    h.settingNames.length = 0;
    h.zoomOptions = null;
    h.mirror = null;
    h.allScreenManagers = [];
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

describe('MiniScreenComp', () => {
    test('listens for screen messages once, when the module loads', () => {
        expect(initReceiveCountAtImport).toBe(1);
    });

    test('mounts the F5 key and the persisted preview scale', async () => {
        await renderComp();
        expect(h.toggleKeyHookCount).toBeGreaterThan(0);
        expect(h.settingNames).toContain('mini-screen-previewer');
        expect(
            container.querySelector<HTMLElement>('[data-stub="body"]')!.dataset
                .scale,
        ).toBe('9');
        expect(
            container.querySelector('[data-stub="mirror-floating"]'),
        ).not.toBe(null);
        // The zoom gesture works on the whole card.
        expect(h.zoomRef.current).toBe(container.querySelector('.card'));
        expect(h.zoomOptions.value).toBe(9);
        expect(h.zoomOptions.defaultSize).toEqual({
            size: 9,
            min: 1,
            max: 30,
            step: 1,
        });
    });

    test('a new scale is stored and every screen rescales', async () => {
        const first = { fireScaleEvent: vi.fn() };
        const second = { fireScaleEvent: vi.fn() };
        h.allScreenManagers = [first, second];
        await renderComp();

        await act(async () => {
            container
                .querySelector<HTMLElement>('[data-stub="footer"]')!
                .click();
        });
        expect(
            container.querySelector<HTMLElement>('[data-stub="body"]')!.dataset
                .scale,
        ).toBe('10');
        expect(first.fireScaleEvent).toHaveBeenCalledTimes(1);
        expect(second.fireScaleEvent).toHaveBeenCalledTimes(1);

        // The zoom gesture goes through the same path.
        await act(async () => {
            h.zoomOptions.setValue(4);
        });
        expect(
            container.querySelector<HTMLElement>('[data-stub="body"]')!.dataset
                .scale,
        ).toBe('4');
        expect(first.fireScaleEvent).toHaveBeenCalledTimes(2);
    });

    test('no guests, no guest row', async () => {
        h.mirror = { guests: [] };
        await renderComp();
        expect(container.querySelector('[aria-label="Connected guests"]')).toBe(
            null,
        );
    });

    test('lists every guest, one from the internet marked apart', async () => {
        h.mirror = {
            guests: [
                { id: 'a', prefix: 'V1', name: 'Lobby', network: 'lan' },
                { id: 'b', prefix: 'V2', name: 'Remote', network: 'internet' },
            ],
        };
        await renderComp();
        const row = container.querySelector('[aria-label="Connected guests"]')!;
        const buttons = [...row.querySelectorAll('button')];
        expect(
            buttons.map((button) => {
                return [button.textContent, button.title];
            }),
        ).toEqual([
            ['V1: Lobby', 'Connected from this network'],
            ['V2: Remote', 'Connected from the internet'],
        ]);
        expect(buttons[0].className).toContain('btn-outline-info');
        expect(buttons[1].className).toContain('btn-outline-warning');
        expect(buttons[1].querySelector('.bi-globe2')).not.toBe(null);
        expect(buttons[0].querySelector('.bi-pc-display')).not.toBe(null);

        await act(async () => {
            buttons[1].click();
        });
        expect(h.setMirrorPanelShowing).toHaveBeenCalledWith(true);
    });

    test('the options icon opens the panel menu by mouse and by key', async () => {
        await renderComp();
        const options = container.querySelector<HTMLElement>(
            '[aria-label="Mini Screen Options"]',
        )!;
        expect(options.getAttribute('aria-haspopup')).toBe('menu');
        await act(async () => {
            options.click();
        });
        expect(h.openMiniScreenContextMenu).toHaveBeenCalledTimes(1);
        await act(async () => {
            options.dispatchEvent(
                new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
            );
        });
        expect(h.pressElementLikeButton).toHaveBeenCalledTimes(1);
    });
});
