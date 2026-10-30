// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const state = vi.hoisted(() => ({
    settings: new Map<string, string>(),
    writes: [] as string[],
}));

vi.mock('../helper/appHooks', async () => {
    const { useEffect, useRef } = await import('react');
    return {
        useAppEffect: useEffect,
        useAppCurrentRef: <T,>(value: T) => {
            const ref = useRef(value);
            ref.current = value;
            return ref;
        },
    };
});
vi.mock('../app-document-list/appDocumentTypeHelpers', () => ({
    THUMBNAIL_WIDTH_SETTING_NAME: 'presenter-item-thumbnail-size',
    DEFAULT_THUMBNAIL_SCALE: 30,
}));
// The real setting hook, minus the storage: read with parseFloat, fall back to
// the default getter, and write the number back on every set.
vi.mock('../helper/settingHelpers', async () => {
    const { useState } = await import('react');
    return {
        getSetting: (key: string) => state.settings.get(key) ?? null,
        useStateSettingNumber: (
            settingName: string,
            defaultNumber: number | (() => number),
        ) => {
            let initial = Number.parseFloat(
                state.settings.get(settingName) ?? '',
            );
            if (!Number.isFinite(initial)) {
                initial =
                    typeof defaultNumber === 'function'
                        ? defaultNumber()
                        : defaultNumber;
            }
            const [value, setValue] = useState(initial);
            return [
                value,
                (newValue: number) => {
                    setValue(newValue);
                    state.settings.set(settingName, `${newValue}`);
                    state.writes.push(`${settingName}=${newValue}`);
                },
            ];
        },
    };
});

import AppDocumentListEventListener, {
    useVarySlideSelecting,
    useVarySlideThumbnailSizeScale,
} from './VaryAppDocumentEventListener';

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    state.settings.clear();
    state.writes = [];
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
});

afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
});

async function flushEvents() {
    await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
    });
}

function SelectingProbeComp({
    listener,
}: Readonly<{ listener: (data: any) => void }>) {
    useVarySlideSelecting(listener);
    return null;
}

describe('useVarySlideSelecting', () => {
    test('hears each selected slide, through the latest listener, until unmounted', async () => {
        const first = vi.fn();
        await act(async () =>
            root.render(<SelectingProbeComp listener={first} />),
        );
        const slide = { id: 3 } as any;
        AppDocumentListEventListener.selectVarySlide(slide);
        await flushEvents();
        expect(first).toHaveBeenCalledExactlyOnceWith(
            slide,
            expect.any(Number),
        );

        // A new listener on re-render replaces the old one without
        // re-registering.
        const second = vi.fn();
        await act(async () =>
            root.render(<SelectingProbeComp listener={second} />),
        );
        AppDocumentListEventListener.selectVarySlide(null);
        await flushEvents();
        expect(second).toHaveBeenCalledExactlyOnceWith(
            null,
            expect.any(Number),
        );
        expect(first).toHaveBeenCalledOnce();

        await act(async () => root.render(<></>));
        AppDocumentListEventListener.selectVarySlide(slide);
        await flushEvents();
        expect(second).toHaveBeenCalledOnce();
    });

    test('a sizing event is not a selection', async () => {
        const listener = vi.fn();
        await act(async () =>
            root.render(<SelectingProbeComp listener={listener} />),
        );
        AppDocumentListEventListener.fireEventVarySlideSizing();
        await flushEvents();
        expect(listener).not.toHaveBeenCalled();
    });
});

let appliers: Record<string, (size: number) => void> = {};

function ScaleProbeComp({
    name,
    settingName,
    defaultSize,
}: Readonly<{ name: string; settingName?: string; defaultSize?: number }>) {
    const [scale, applyScale] = useVarySlideThumbnailSizeScale(
        settingName === undefined && defaultSize === undefined
            ? undefined
            : { settingName, defaultSize },
    );
    appliers[name] = applyScale;
    return <span data-name={name}>{scale}</span>;
}

function readScale(name: string) {
    return host.querySelector(`[data-name="${name}"]`)!.textContent;
}

describe('useVarySlideThumbnailSizeScale', () => {
    beforeEach(() => {
        appliers = {};
    });

    test('starts from the default, or from what was saved', async () => {
        await act(async () => root.render(<ScaleProbeComp name="a" />));
        expect(readScale('a')).toBe('30');

        await act(async () => root.render(<></>));
        state.settings.set('presenter-item-thumbnail-size', '55');
        await act(async () => root.render(<ScaleProbeComp name="a" />));
        expect(readScale('a')).toBe('55');
    });

    test('an unreadable saved size falls back to the default given', async () => {
        state.settings.set('flow-thumb', 'wide');
        await act(async () =>
            root.render(
                <ScaleProbeComp
                    name="a"
                    settingName="flow-thumb"
                    defaultSize={44}
                />,
            ),
        );
        expect(readScale('a')).toBe('44');
    });

    test('applying a size saves it and every view of that setting follows', async () => {
        await act(async () =>
            root.render(
                <>
                    <ScaleProbeComp name="a" />
                    <ScaleProbeComp name="b" />
                    <ScaleProbeComp
                        name="other"
                        settingName="flow-thumb"
                        defaultSize={44}
                    />
                </>,
            ),
        );
        await act(async () => appliers.a(80));
        await flushEvents();
        expect(state.settings.get('presenter-item-thumbnail-size')).toBe('80');
        expect(readScale('a')).toBe('80');
        expect(readScale('b')).toBe('80');
        // A view of another setting re-reads its OWN setting: unchanged.
        expect(readScale('other')).toBe('44');
    });

    test('a sizing event with nothing saved resets to the default', async () => {
        await act(async () =>
            root.render(
                <ScaleProbeComp
                    name="a"
                    settingName="flow-thumb"
                    defaultSize={44}
                />,
            ),
        );
        await act(async () => appliers.a(90));
        expect(readScale('a')).toBe('90');
        state.settings.delete('flow-thumb');
        AppDocumentListEventListener.fireEventVarySlideSizing();
        await flushEvents();
        expect(readScale('a')).toBe('44');
    });

    test('an unmounted view stops listening', async () => {
        await act(async () =>
            root.render(
                <>
                    <ScaleProbeComp name="a" />
                    <ScaleProbeComp name="b" />
                </>,
            ),
        );
        // Mounted, each view re-reads (and so re-writes) on a sizing event.
        await act(async () => appliers.a(60));
        await flushEvents();
        expect(state.writes).toEqual([
            'presenter-item-thumbnail-size=60',
            'presenter-item-thumbnail-size=60',
            'presenter-item-thumbnail-size=60',
        ]);

        state.writes = [];
        await act(async () => root.render(<ScaleProbeComp name="a" />));
        await act(async () => appliers.a(120));
        await flushEvents();
        expect(readScale('a')).toBe('120');
        // The apply, then view a's own re-read: view b no longer answers.
        expect(state.writes).toEqual([
            'presenter-item-thumbnail-size=120',
            'presenter-item-thumbnail-size=120',
        ]);
    });
});
