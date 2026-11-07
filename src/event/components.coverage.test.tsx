// @vitest-environment jsdom

// The app's event listeners over the REAL `EventHandler`: a hook registers, a
// static or instance call fires, the listener runs once the dispatch's
// microtasks settle -- and never again once its component is gone.

import { act, useEffect, useRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    settings: new Map<string, string>(),
    provider: {
        systemUtils: {
            isWindows: true,
            isMac: false,
            isLinux: false,
            isDev: false,
        },
    },
}));

vi.mock('../server/appProvider', () => ({ default: mocks.provider }));
vi.mock('../helper/appHooks', () => ({
    useAppEffect: useEffect,
    useAppCurrentRef: (value: unknown) => {
        const ref = useRef(value);
        ref.current = value;
        return ref;
    },
}));
vi.mock('../helper/helpers', () => ({
    cloneJson: <T,>(value: T) => structuredClone(value),
}));
vi.mock('../app-document-list/appDocumentTypeHelpers', () => ({
    THUMBNAIL_WIDTH_SETTING_NAME: 'presenter-item-thumbnail-size',
    DEFAULT_THUMBNAIL_SCALE: 30,
}));
vi.mock('../helper/settingHelpers', async () => {
    const { useState } = await import('react');
    return {
        getSetting: (key: string) => mocks.settings.get(key) ?? null,
        // As the real hook: the stored number first, else the default; the
        // setter writes the setting.
        useStateSettingNumber: (
            settingName: string,
            defaultNumber: number | (() => number),
        ) => {
            const [data, setData] = useState(() => {
                const stored = Number.parseFloat(
                    mocks.settings.get(settingName) ?? '',
                );
                if (Number.isFinite(stored)) {
                    return stored;
                }
                return typeof defaultNumber === 'function'
                    ? defaultNumber()
                    : defaultNumber;
            });
            return [
                data,
                (value: number) => {
                    mocks.settings.set(settingName, `${value}`);
                    setData(value);
                },
            ];
        },
    };
});

import AppDocumentListEventListener, {
    useVarySlideSelecting,
    useVarySlideThumbnailSizeScale,
} from './VaryAppDocumentEventListener';
import PreviewingEventListener, {
    previewingEventListener,
    useBibleItemShowing,
    useVaryAppDocumentSelecting,
    useVaryAppDocumentUpdating,
} from './PreviewingEventListener';
import ProgressBarEventListener, {
    useHideProgressBar,
    useShowProgressBar,
} from './ProgressBarEventListener';
import WindowEventListener, { useWindowEvent } from './WindowEventListener';
import KeyboardEventListener from './KeyboardEventListener';
import {
    checkIsKeyboardLayerClaimed,
    useKeyboardLayerClaim,
} from './keyboardLayerHelpers';
import { KEY_LABEL_MAP } from './keyboardKeyLabelHelpers';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
    mocks.settings.clear();
    (KeyboardEventListener as any)._layers.length = 0;
    (KeyboardEventListener as any)._layers.push('root');
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(() => {
    act(() => {
        root.unmount();
    });
    container.remove();
});

// Dispatch awaits `checkShouldNext` before each listener: a real macrotask
// lets every queued microtask run.
async function settle(fire: () => void) {
    await act(async () => {
        fire();
        await new Promise((resolve) => setTimeout(resolve, 0));
    });
}

function mount(element: React.ReactElement) {
    act(() => {
        root.render(element);
    });
}

function unmount() {
    act(() => {
        root.render(<div />);
    });
}

describe('AppDocumentListEventListener', () => {
    test('a slide selection reaches the hook with its time, through the latest listener', async () => {
        const first = vi.fn();
        const second = vi.fn();
        function SelectingComp({ listener }: { listener: typeof first }) {
            useVarySlideSelecting(listener);
            return null;
        }
        mount(<SelectingComp listener={first} />);
        const slide = { id: 3 } as any;
        await settle(() => AppDocumentListEventListener.selectVarySlide(slide));
        expect(first).toHaveBeenCalledExactlyOnceWith(
            slide,
            expect.any(Number),
        );

        mount(<SelectingComp listener={second} />);
        await settle(() => AppDocumentListEventListener.selectVarySlide(null));
        expect(first).toHaveBeenCalledOnce();
        expect(second).toHaveBeenCalledExactlyOnceWith(
            null,
            expect.any(Number),
        );

        unmount();
        await settle(() => AppDocumentListEventListener.selectVarySlide(slide));
        expect(second).toHaveBeenCalledOnce();
    });

    test('the thumbnail scale starts from the setting, else the default', () => {
        const scales: number[] = [];
        function ScaleComp({ settingName }: { settingName?: string }) {
            const [scale] = useVarySlideThumbnailSizeScale(
                settingName === undefined
                    ? undefined
                    : { settingName, defaultSize: 12 },
            );
            scales.push(scale);
            return null;
        }
        mount(<ScaleComp />);
        expect(scales.at(-1)).toBe(30);
        unmount();
        mocks.settings.set('presenter-item-thumbnail-size', '45');
        mount(<ScaleComp />);
        expect(scales.at(-1)).toBe(45);
        unmount();
        mocks.settings.set('custom-size', 'wide');
        mount(<ScaleComp settingName="custom-size" />);
        expect(scales.at(-1)).toBe(12);
    });

    test('a new scale is stored and every other list on that setting follows it', async () => {
        const applied: Record<string, (size: number) => void> = {};
        const seen: Record<string, number> = {};
        function ScaleComp({ name }: { name: string }) {
            const [scale, applyScale] = useVarySlideThumbnailSizeScale();
            applied[name] = applyScale;
            seen[name] = scale;
            return null;
        }
        mount(
            <>
                <ScaleComp name="first" />
                <ScaleComp name="second" />
            </>,
        );
        await settle(() => applied['first'](60));
        expect(mocks.settings.get('presenter-item-thumbnail-size')).toBe('60');
        expect(seen).toEqual({ first: 60, second: 60 });

        // A stored value that is not a whole number reads as the default.
        mocks.settings.set('presenter-item-thumbnail-size', 'oops');
        await settle(() =>
            AppDocumentListEventListener.fireEventVarySlideSizing(),
        );
        expect(seen).toEqual({ first: 30, second: 30 });

        mount(<ScaleComp name="first" />);
        mocks.settings.set('presenter-item-thumbnail-size', '70');
        seen['second'] = -1;
        await settle(() =>
            AppDocumentListEventListener.fireEventVarySlideSizing(),
        );
        expect(seen).toEqual({ first: 70, second: -1 });
    });
});

describe('PreviewingEventListener', () => {
    test('each previewing event reaches only its own hook, until unmounted', async () => {
        const bibleListener = vi.fn();
        const selectListener = vi.fn();
        const updateListener = vi.fn();
        function PreviewingComp() {
            useBibleItemShowing(bibleListener, []);
            useVaryAppDocumentSelecting(selectListener);
            useVaryAppDocumentUpdating(updateListener);
            return null;
        }
        mount(<PreviewingComp />);
        const bibleItem = { id: 'bible' } as any;
        const document = { filePath: '/a.ows' } as any;
        await settle(() => previewingEventListener.showBibleItem(bibleItem));
        await settle(() =>
            previewingEventListener.showVaryAppDocument(document),
        );
        await settle(() => previewingEventListener.showVaryAppDocument(null));
        await settle(() =>
            previewingEventListener.updateVaryAppDocument(document),
        );
        expect(bibleListener).toHaveBeenCalledExactlyOnceWith(
            bibleItem,
            expect.any(Number),
        );
        expect(selectListener.mock.calls.map(([data]) => data)).toEqual([
            document,
            null,
        ]);
        expect(updateListener).toHaveBeenCalledExactlyOnceWith(
            document,
            expect.any(Number),
        );

        unmount();
        await settle(() => previewingEventListener.showBibleItem(bibleItem));
        await settle(() => previewingEventListener.showVaryAppDocument(null));
        await settle(() =>
            previewingEventListener.updateVaryAppDocument(document),
        );
        expect(bibleListener).toHaveBeenCalledOnce();
        expect(selectListener).toHaveBeenCalledTimes(2);
        expect(updateListener).toHaveBeenCalledOnce();
    });

    test('a Bible-item listener with new deps replaces the old one', async () => {
        const calls: string[] = [];
        function ShowingComp({ tag }: { tag: string }) {
            useBibleItemShowing(() => {
                calls.push(tag);
            }, [tag]);
            return null;
        }
        mount(<ShowingComp tag="old" />);
        mount(<ShowingComp tag="new" />);
        await settle(() => previewingEventListener.showBibleItem({} as any));
        expect(calls).toEqual(['new']);
    });

    test('a separate instance keeps its own listeners', async () => {
        const other = new PreviewingEventListener();
        const listener = vi.fn();
        other.registerEventListener(['update-app-document'], listener);
        await settle(() =>
            previewingEventListener.updateVaryAppDocument({} as any),
        );
        expect(listener).not.toHaveBeenCalled();
        await settle(() => other.updateVaryAppDocument({ id: 1 } as any));
        expect(listener).toHaveBeenCalledWith({ id: 1 }, expect.any(Number));
    });
});

describe('ProgressBarEventListener', () => {
    test('show and hide reach their own hooks by key, and stop once unmounted', async () => {
        const shown = vi.fn();
        const hidden = vi.fn();
        function ProgressComp() {
            useShowProgressBar(shown);
            useHideProgressBar(hidden);
            return null;
        }
        mount(<ProgressComp />);
        await settle(() =>
            ProgressBarEventListener.showProgressBar('download'),
        );
        await settle(() =>
            ProgressBarEventListener.hideProgressBar('download'),
        );
        expect(shown).toHaveBeenCalledExactlyOnceWith(
            'download',
            expect.any(Number),
        );
        expect(hidden).toHaveBeenCalledExactlyOnceWith(
            'download',
            expect.any(Number),
        );
        unmount();
        await settle(() => ProgressBarEventListener.showProgressBar('again'));
        await settle(() => ProgressBarEventListener.hideProgressBar('again'));
        expect(shown).toHaveBeenCalledOnce();
        expect(hidden).toHaveBeenCalledOnce();
    });
});

describe('WindowEventListener', () => {
    test('opening a widget puts its keyboard layer on top and tells its listeners', async () => {
        const opened = vi.fn();
        const closed = vi.fn();
        function WindowComp() {
            useWindowEvent({ widget: 'setting', state: 'open' }, opened);
            useWindowEvent({ widget: 'setting', state: 'close' }, closed);
            return null;
        }
        mount(<WindowComp />);
        await settle(() =>
            WindowEventListener.fireEvent(
                { widget: 'setting', state: 'open' },
                { from: 'menu' },
            ),
        );
        expect(KeyboardEventListener.getLastLayer()).toBe('setting');
        expect(opened).toHaveBeenCalledExactlyOnceWith(
            { from: 'menu' },
            expect.any(Number),
        );
        expect(closed).not.toHaveBeenCalled();

        await settle(() =>
            WindowEventListener.fireEvent({
                widget: 'setting',
                state: 'close',
            }),
        );
        expect(KeyboardEventListener.getLastLayer()).toBe('root');
        expect(closed).toHaveBeenCalledExactlyOnceWith(
            undefined,
            expect.any(Number),
        );

        unmount();
        await settle(() =>
            WindowEventListener.fireEvent({ widget: 'setting', state: 'open' }),
        );
        expect(opened).toHaveBeenCalledOnce();
        WindowEventListener.fireEvent({ widget: 'setting', state: 'close' });
    });

    test('names its events after the widget and the state', () => {
        expect(
            WindowEventListener.toEventMapperKey({
                widget: 'context-menu',
                state: 'close',
            }),
        ).toBe('context-menu-close');
    });
});

describe('keyboard layer claims and key labels', () => {
    test('a layer counts as claimed only while a holder is mounted', () => {
        function ClaimComp() {
            useKeyboardLayerClaim('presenting-control');
            return null;
        }
        expect(checkIsKeyboardLayerClaimed('presenting-control')).toBe(false);
        mount(<ClaimComp />);
        expect(checkIsKeyboardLayerClaimed('presenting-control')).toBe(true);
        expect(KeyboardEventListener.getLastLayer()).toBe('presenting-control');
        unmount();
        expect(checkIsKeyboardLayerClaimed('presenting-control')).toBe(false);
        expect(KeyboardEventListener.getLastLayer()).toBe('root');
    });

    test('keys a person cannot read as-is are named', () => {
        expect(
            [
                'ArrowUp',
                'ArrowDown',
                'ArrowLeft',
                'ArrowRight',
                ' ',
                'Escape',
            ].map((key) => KEY_LABEL_MAP[key]),
        ).toEqual(['↑', '↓', '←', '→', 'Space', 'Esc']);
        expect(KEY_LABEL_MAP['Delete']).toBe('Del');
        expect(KEY_LABEL_MAP['PageUp']).toBe('Page Up');
        expect(KEY_LABEL_MAP['PageDown']).toBe('Page Down');
        expect(KEY_LABEL_MAP['a']).toBeUndefined();
    });
});
