// @vitest-environment jsdom

import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const { appProviderMock, sendDataMock, sendDataSyncMock, matchMediaState } =
    vi.hoisted(() => ({
        appProviderMock: {
            isPageScreen: false,
            messageUtils: {
                sendData: vi.fn(),
                sendDataSync: vi.fn(() => 'light'),
            },
        },
        sendDataMock: vi.fn(),
        sendDataSyncMock: vi.fn(() => 'light'),
        matchMediaState: {
            matches: false,
            listener: null as ((event: Event) => void) | null,
        },
    }));

appProviderMock.messageUtils.sendData = sendDataMock;
appProviderMock.messageUtils.sendDataSync = sendDataSyncMock;

vi.mock('../server/appProvider', () => ({
    default: appProviderMock,
}));

vi.mock('../helper/appHooks', async () => {
    const React = (await vi.importActual('react')) as any;
    return {
        useAppEffect: React.useEffect,
        useAppCurrentRef: (target: any) => {
            const ref = React.useRef(target);
            ref.current = target;
            return ref;
        },
    };
});

vi.mock('./color/colorHelpers', () => ({
    HEX_COLOR_BLACK: '#000000',
    HEX_COLOR_WHITE: '#FFFFFF',
    checkIsColorDark: (color: string) => {
        return color.toLowerCase() === '#000000';
    },
}));

async function loadModule() {
    vi.resetModules();
    Object.defineProperty(globalThis, 'matchMedia', {
        configurable: true,
        value: vi.fn(() => ({
            get matches() {
                return matchMediaState.matches;
            },
            addEventListener: vi.fn(
                (_eventName: string, listener: (event: Event) => void) => {
                    matchMediaState.listener = listener;
                },
            ),
            removeEventListener: vi.fn(),
        })),
    });
    return await import('./themeHelpers');
}

describe('initHelpers', () => {
    let container: HTMLDivElement | null = null;
    let root: Root | null = null;

    beforeEach(() => {
        vi.clearAllMocks();
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
        appProviderMock.isPageScreen = false;
        sendDataSyncMock.mockReturnValue('light');
        matchMediaState.matches = false;
        matchMediaState.listener = null;
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    afterEach(async () => {
        const currentRoot = root;
        if (currentRoot) {
            await act(async () => {
                currentRoot.unmount();
            });
            root = null;
        }
        container?.remove();
        container = null;
    });

    test('reads theme settings and computes dark mode and color parts', async () => {
        const initHelpers = await loadModule();

        sendDataSyncMock.mockReturnValue('dark');
        expect(initHelpers.getThemeSourceSetting()).toBe('dark');
        expect(initHelpers.checkIsDarkMode('dark')).toBe(true);
        expect(initHelpers.checkIsDarkMode('light')).toBe(false);

        matchMediaState.matches = true;
        expect(initHelpers.checkIsDarkMode('system')).toBe(true);

        appProviderMock.isPageScreen = true;
        expect(initHelpers.checkIsDarkMode()).toBe(true);

        expect(initHelpers.getColorParts('#000000')).toEqual({
            colorPart: '#000000',
            invertColorPart: '#FFFFFF',
        });
        expect(initHelpers.getColorParts('#FFFFFF')).toEqual({
            colorPart: '#FFFFFF',
            invertColorPart: '#000000',
        });
    });

    test('tracks theme state changes from setters and global theme events', async () => {
        const initHelpers = await loadModule();
        const EventHandler = (await import('../event/EventHandler')).default;
        const snapshots: Array<{ theme: string; themeSource: string }> = [];
        let setThemeSource:
            | ((themeSource: 'light' | 'dark' | 'system') => void)
            | null = null;

        function Probe() {
            const current = initHelpers.useThemeSource();
            useEffect(() => {
                snapshots.push({
                    theme: current.theme,
                    themeSource: current.themeSource,
                });
                setThemeSource = current.setThemeSource;
            }, [current.theme, current.themeSource, current.setThemeSource]);
            return (
                <div
                    data-theme={current.theme}
                    data-theme-source={current.themeSource}
                />
            );
        }

        await act(async () => {
            if (!container) {
                throw new Error('Missing test container');
            }
            root = createRoot(container);
            root.render(<Probe />);
        });

        expect(
            (container?.firstElementChild as HTMLElement | null)?.dataset.theme,
        ).toBe('light');
        expect(
            (container?.firstElementChild as HTMLElement | null)?.dataset
                .themeSource,
        ).toBe('light');

        await act(async () => {
            setThemeSource?.('dark');
        });

        expect(sendDataMock).toHaveBeenCalledWith('main:app:set-theme', 'dark');
        expect(
            (container?.firstElementChild as HTMLElement | null)?.dataset.theme,
        ).toBe('dark');
        expect(
            (container?.firstElementChild as HTMLElement | null)?.dataset
                .themeSource,
        ).toBe('dark');

        await act(async () => {
            EventHandler.addPropEvent('app:theme-changed', 'light');
            await Promise.resolve();
        });

        expect(
            (container?.firstElementChild as HTMLElement | null)?.dataset
                .themeSource,
        ).toBe('light');
        expect(snapshots).toEqual(
            expect.arrayContaining([
                { theme: 'light', themeSource: 'light' },
                { theme: 'dark', themeSource: 'dark' },
            ]),
        );
    });

    test('reacts to system matcher change events', async () => {
        sendDataSyncMock.mockReturnValue('system');
        matchMediaState.matches = false;
        const initHelpers = await loadModule();

        let latestTheme = '';

        function Probe() {
            const current = initHelpers.useThemeSource();
            useEffect(() => {
                latestTheme = current.theme;
            }, [current.theme]);
            return null;
        }

        await act(async () => {
            if (!container) {
                throw new Error('Missing test container');
            }
            root = createRoot(container);
            root.render(<Probe />);
        });

        expect(latestTheme).toBe('light');

        await act(async () => {
            matchMediaState.matches = true;
            matchMediaState.listener?.(new Event('change'));
            await Promise.resolve();
        });

        expect(latestTheme).toBe('dark');
    });
});
