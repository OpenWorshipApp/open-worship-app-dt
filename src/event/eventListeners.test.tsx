// @vitest-environment jsdom

import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const { addLayerMock, removeLayerMock, settingState } = vi.hoisted(() => ({
    addLayerMock: vi.fn(),
    removeLayerMock: vi.fn(),
    settingState: {
        values: {} as Record<string, string>,
    },
}));

vi.mock('../helper/debuggerHelpers', async () => {
    const React = (await vi.importActual('react')) as any;
    return {
        useAppEffect: React.useEffect,
    };
});

vi.mock('../helper/settingHelpers', async () => {
    const React = (await vi.importActual('react')) as any;
    return {
        getSetting: (key: string) => {
            return settingState.values[key] ?? null;
        },
        useStateSettingNumber: (
            settingName: string,
            defaultNumber: number | (() => number),
        ) => {
            let initial = Number.parseInt(
                settingState.values[settingName] ?? '',
                10,
            );
            if (Number.isNaN(initial)) {
                initial =
                    typeof defaultNumber === 'function'
                        ? defaultNumber()
                        : defaultNumber;
            }
            const [value, setValue] = React.useState(initial);
            const setValueSetting = (
                next: number | ((prev: number) => number),
            ) => {
                setValue((prev: number) => {
                    const resolved =
                        typeof next === 'function' ? next(prev) : next;
                    settingState.values[settingName] = `${resolved}`;
                    return resolved;
                });
            };
            return [value, setValueSetting] as const;
        },
    };
});

vi.mock('./KeyboardEventListener', () => ({
    default: {
        addLayer: addLayerMock,
        removeLayer: removeLayerMock,
    },
}));

import {
    DEFAULT_THUMBNAIL_SIZE_FACTOR,
    THUMBNAIL_WIDTH_SETTING_NAME,
} from '../app-document-list/appDocumentTypeHelpers';
import ProgressBarEventListener, {
    useHideProgressBar,
    useShowProgressBar,
} from './ProgressBarEventListener';
import ToastEventListener, {
    useToastSimpleShowing,
} from './ToastEventListener';
import AppDocumentListEventListener, {
    useVarySlideSelecting,
    useVarySlideThumbnailSizeScale,
} from './VaryAppDocumentEventListener';
import WindowEventListener, { useWindowEvent } from './WindowEventListener';
import {
    previewingEventListener,
    useBibleItemShowing,
    useLyricSelecting,
    useLyricUpdating,
    useVaryAppDocumentSelecting,
    useVaryAppDocumentUpdating,
} from './PreviewingEventListener';

async function flushAsyncEvents() {
    await Promise.resolve();
    await Promise.resolve();
}

describe('event listeners', () => {
    let container: HTMLDivElement | null = null;
    let root: Root | null = null;

    beforeEach(() => {
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
        vi.clearAllMocks();
        settingState.values = {};
        (ProgressBarEventListener as any).eventHandler = null;
        (ToastEventListener as any).eventHandler = null;
        (AppDocumentListEventListener as any).eventHandler = null;
        (WindowEventListener as any).eventHandler = null;
        previewingEventListener.destroy();
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

    test('emits and subscribes to progress-bar and toast events', async () => {
        const events: string[] = [];

        function Probe() {
            useShowProgressBar((key) => {
                events.push(`show:${key}`);
            });
            useHideProgressBar((key) => {
                events.push(`hide:${key}`);
            });
            useToastSimpleShowing((toast) => {
                events.push(`toast:${toast.title}`);
            });
            return null;
        }

        await act(async () => {
            if (!container) {
                throw new Error('Missing test container');
            }
            root = createRoot(container);
            root.render(<Probe />);
        });

        ProgressBarEventListener.showProgressBar('syncing');
        ProgressBarEventListener.hideProgressBar('syncing');
        ToastEventListener.showSimpleToast({
            title: 'Saved',
            message: 'ok',
        } as any);
        await flushAsyncEvents();

        expect(events).toEqual(['show:syncing', 'hide:syncing', 'toast:Saved']);

        await act(async () => {
            root?.unmount();
        });
        root = null;

        ProgressBarEventListener.showProgressBar('later');
        await flushAsyncEvents();
        expect(events).toEqual(['show:syncing', 'hide:syncing', 'toast:Saved']);
    });

    test('emits window open/close events and updates keyboard layers', async () => {
        const events: string[] = [];

        function Probe() {
            useWindowEvent<{ id: number }>(
                { widget: 'context-menu', state: 'open' },
                (payload) => {
                    events.push(`open:${payload.id}`);
                },
            );
            return null;
        }

        await act(async () => {
            if (!container) {
                throw new Error('Missing test container');
            }
            root = createRoot(container);
            root.render(<Probe />);
        });

        expect(
            WindowEventListener.toEventMapperKey({
                widget: 'context-menu',
                state: 'open',
            }),
        ).toBe('context-menu-open');

        WindowEventListener.fireEvent(
            { widget: 'context-menu', state: 'open' },
            { id: 1 },
        );
        WindowEventListener.fireEvent({
            widget: 'context-menu',
            state: 'close',
        });
        await flushAsyncEvents();

        expect(addLayerMock).toHaveBeenCalledWith('context-menu');
        expect(removeLayerMock).toHaveBeenCalledWith('context-menu');
        expect(events).toEqual(['open:1']);
    });

    test('emits vary-slide selection and manages thumbnail size scale from settings', async () => {
        const selected: unknown[] = [];
        const scales: number[] = [];
        let applyScale: ((size: number) => void) | null = null;

        settingState.values[THUMBNAIL_WIDTH_SETTING_NAME] = '75';

        function Probe() {
            useVarySlideSelecting((varySlide) => {
                selected.push(varySlide);
            });
            const [scale, setScale] = useVarySlideThumbnailSizeScale();
            useEffect(() => {
                scales.push(scale);
                applyScale = setScale;
            }, [scale, setScale]);
            return null;
        }

        await act(async () => {
            if (!container) {
                throw new Error('Missing test container');
            }
            root = createRoot(container);
            root.render(<Probe />);
        });

        AppDocumentListEventListener.selectVarySlide({ id: 1 } as any);
        await flushAsyncEvents();
        expect(selected).toEqual([{ id: 1 }]);
        expect(scales).toContain(75);

        await act(async () => {
            applyScale?.(82);
            await flushAsyncEvents();
        });
        expect(settingState.values[THUMBNAIL_WIDTH_SETTING_NAME]).toBe('82');
        expect(scales).toContain(82);

        settingState.values[THUMBNAIL_WIDTH_SETTING_NAME] = '90';
        await act(async () => {
            AppDocumentListEventListener.fireEventVarySlideSizing();
            await flushAsyncEvents();
        });
        expect(scales).toContain(90);
    });

    test('falls back to the provided thumbnail default when the setting is missing or invalid', async () => {
        const customSettingName = 'custom-thumbnail';
        const scales: number[] = [];

        settingState.values[customSettingName] = 'invalid';

        function Probe() {
            const [scale] = useVarySlideThumbnailSizeScale({
                settingName: customSettingName,
                defaultSize: Math.fround(DEFAULT_THUMBNAIL_SIZE_FACTOR / 40),
            });
            useEffect(() => {
                scales.push(scale);
            }, [scale]);
            return null;
        }

        await act(async () => {
            if (!container) {
                throw new Error('Missing test container');
            }
            root = createRoot(container);
            root.render(<Probe />);
        });

        expect(scales[0]).toBe(Math.fround(DEFAULT_THUMBNAIL_SIZE_FACTOR / 40));
    });

    test('emits previewing events through the exported instance and hook helpers', async () => {
        const events: string[] = [];

        function Probe() {
            useLyricSelecting((lyric) => {
                events.push(
                    `select-lyric:${lyric === null ? 'null' : 'value'}`,
                );
            }, []);
            useBibleItemShowing(() => {
                events.push('show-bible');
            }, []);
            useLyricUpdating(() => {
                events.push('update-lyric');
            });
            useVaryAppDocumentSelecting(() => {
                events.push('select-doc');
            });
            useVaryAppDocumentUpdating(() => {
                events.push('update-doc');
            });
            return null;
        }

        await act(async () => {
            if (!container) {
                throw new Error('Missing test container');
            }
            root = createRoot(container);
            root.render(<Probe />);
        });

        previewingEventListener.showLyric(null as any);
        previewingEventListener.showBibleItem({ id: 'bible' } as any);
        previewingEventListener.updateLyric({ id: 'lyric' } as any);
        previewingEventListener.showVaryAppDocument({ id: 'doc' } as any);
        previewingEventListener.updateVaryAppDocument({ id: 'doc' } as any);
        await flushAsyncEvents();

        expect(events).toEqual([
            'select-lyric:null',
            'show-bible',
            'update-lyric',
            'select-doc',
            'update-doc',
        ]);
    });

    test('keeps registrations stable while dispatching to the latest listener', async () => {
        const progressRegisterSpy = vi.spyOn(
            ProgressBarEventListener,
            'registerEventListener',
        );
        const toastRegisterSpy = vi.spyOn(
            ToastEventListener,
            'registerEventListener',
        );
        const windowRegisterSpy = vi.spyOn(
            WindowEventListener,
            'registerEventListener',
        );
        const varySlideRegisterSpy = vi.spyOn(
            AppDocumentListEventListener,
            'registerEventListener',
        );
        const previewingRegisterSpy = vi.spyOn(
            previewingEventListener,
            'registerEventListener',
        );
        const events: string[] = [];

        function Probe({ tag }: Readonly<{ tag: string }>) {
            useShowProgressBar((key) => {
                events.push(`${tag}-show:${key}`);
            });
            useToastSimpleShowing((toast) => {
                events.push(`${tag}-toast:${toast.title}`);
            });
            useWindowEvent(
                { widget: 'context-menu', state: 'open' },
                (payload: any) => {
                    events.push(`${tag}-open:${payload.id}`);
                },
            );
            useVarySlideSelecting(() => {
                events.push(`${tag}-select-slide`);
            });
            useLyricUpdating(() => {
                events.push(`${tag}-update-lyric`);
            });
            useVaryAppDocumentSelecting(() => {
                events.push(`${tag}-select-doc`);
            });
            useVaryAppDocumentUpdating(() => {
                events.push(`${tag}-update-doc`);
            });
            return null;
        }

        await act(async () => {
            if (!container) {
                throw new Error('Missing test container');
            }
            root = createRoot(container);
            root.render(<Probe tag="first" />);
        });
        const registerCounts = () => [
            progressRegisterSpy.mock.calls.length,
            toastRegisterSpy.mock.calls.length,
            windowRegisterSpy.mock.calls.length,
            varySlideRegisterSpy.mock.calls.length,
            previewingRegisterSpy.mock.calls.length,
        ];
        const initialCounts = registerCounts();

        await act(async () => {
            root?.render(<Probe tag="second" />);
        });
        expect(registerCounts()).toEqual(initialCounts);

        ProgressBarEventListener.showProgressBar('syncing');
        ToastEventListener.showSimpleToast({
            title: 'Saved',
            message: 'ok',
        } as any);
        WindowEventListener.fireEvent(
            { widget: 'context-menu', state: 'open' },
            { id: 7 },
        );
        AppDocumentListEventListener.selectVarySlide({ id: 1 } as any);
        previewingEventListener.updateLyric({ id: 'lyric' } as any);
        previewingEventListener.showVaryAppDocument({ id: 'doc' } as any);
        previewingEventListener.updateVaryAppDocument({ id: 'doc' } as any);
        await flushAsyncEvents();

        expect(events).toEqual([
            'second-show:syncing',
            'second-toast:Saved',
            'second-open:7',
            'second-select-slide',
            'second-update-lyric',
            'second-select-doc',
            'second-update-doc',
        ]);
    });
});
