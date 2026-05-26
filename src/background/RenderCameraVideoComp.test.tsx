// @vitest-environment jsdom

import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const { effectModeState, getCameraAndShowMediaMock } = vi.hoisted(() => ({
    effectModeState: { value: 'effect' as 'effect' | 'immediate' },
    getCameraAndShowMediaMock: vi.fn(),
}));

vi.mock('../helper/debuggerHelpers', () => ({
    useAppEffectAsync: (
        effectMethod: (methods: Record<string, unknown>) => Promise<unknown>,
        deps: readonly unknown[],
    ) => {
        if (effectModeState.value === 'immediate') {
            void effectMethod({});
        }
        useEffect(() => {
            if (effectModeState.value === 'immediate') {
                return;
            }
            void effectMethod({});
        }, deps);
    },
}));

vi.mock('../helper/cameraHelpers', () => ({
    getCameraAndShowMedia: getCameraAndShowMediaMock,
}));

vi.mock('../others/LoadingComp', () => ({
    default: () => <div data-testid="loading">Loading</div>,
}));

import RenderCameraVideoComp from './RenderCameraVideoComp';

describe('RenderCameraVideoComp', () => {
    let container: HTMLDivElement | null = null;
    let root: Root | null = null;

    beforeEach(() => {
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
        effectModeState.value = 'effect';
        vi.clearAllMocks();
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    afterEach(async () => {
        if (root) {
            await act(async () => {
                root?.unmount();
            });
            root = null;
        }
        container?.remove();
        container = null;
    });

    test('renders the loading state when the container ref is still null', async () => {
        effectModeState.value = 'immediate';

        await act(async () => {
            if (!container) {
                throw new Error('Missing test container');
            }
            root = createRoot(container);
            root.render(
                <RenderCameraVideoComp deviceId="camera-1" width={320} />,
            );
        });

        expect(
            container?.querySelector('[data-testid="loading"]'),
        ).not.toBeNull();
        expect(getCameraAndShowMediaMock).not.toHaveBeenCalled();
    });

    test('requests camera media with the rendered container when mounted', async () => {
        getCameraAndShowMediaMock.mockResolvedValue(undefined);

        await act(async () => {
            if (!container) {
                throw new Error('Missing test container');
            }
            root = createRoot(container);
            root.render(
                <RenderCameraVideoComp deviceId="camera-2" width={480} />,
            );
        });
        await act(async () => {
            await Promise.resolve();
        });

        const host = container?.firstElementChild as HTMLDivElement | null;

        expect(
            container?.querySelector('[data-testid="loading"]'),
        ).not.toBeNull();
        expect(getCameraAndShowMediaMock).toHaveBeenCalledWith({
            id: 'camera-2',
            parentContainer: host,
            width: 480,
            extraStyle: {
                borderBottomLeftRadius: 'var(--bs-border-radius)',
                borderBottomRightRadius: 'var(--bs-border-radius)',
            },
        });
    });
});
