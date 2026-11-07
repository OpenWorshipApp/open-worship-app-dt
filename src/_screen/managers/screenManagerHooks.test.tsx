// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const fakes = vi.hoisted(() => {
    class FakeScreenManagerBase {
        readonly screenId: number;
        constructor(screenId: number) {
            this.screenId = screenId;
        }
    }
    class FakeScreenManager extends FakeScreenManagerBase {
        screenBackgroundManager: { backgroundSrc: any } = {
            backgroundSrc: null,
        };
    }
    // Every event hook call this module makes, with what it was handed.
    const hookCalls: { name: string; args: any[] }[] = [];
    const genHook = (name: string) => {
        return (...args: any[]) => {
            hookCalls.push({ name, args });
        };
    };
    return { FakeScreenManagerBase, FakeScreenManager, hookCalls, genHook };
});

vi.mock('./ScreenManagerBase', () => ({
    default: fakes.FakeScreenManagerBase,
}));
vi.mock('./ScreenManager', () => ({
    default: fakes.FakeScreenManager,
}));
vi.mock('./screenEventHelpers', () => ({
    useScreenEvents: fakes.genHook('useScreenEvents'),
    useScreenBackgroundManagerEvents: fakes.genHook(
        'useScreenBackgroundManagerEvents',
    ),
    useScreenVaryAppDocumentManagerEvents: fakes.genHook(
        'useScreenVaryAppDocumentManagerEvents',
    ),
    useScreenLongTextManagerEvents: fakes.genHook(
        'useScreenLongTextManagerEvents',
    ),
    useScreenForegroundManagerEvents: fakes.genHook(
        'useScreenForegroundManagerEvents',
    ),
    useScreenDrawManagerEvents: fakes.genHook('useScreenDrawManagerEvents'),
    useScreenFocusManagerEvents: fakes.genHook('useScreenFocusManagerEvents'),
}));
vi.mock('../screenHelpers', () => ({
    genVideoIDFromSrc: (src: string) => `video-${src.length}`,
}));

import {
    ScreenManagerBaseContext,
    useOptionalScreenManagerBaseContext,
    useScreenManagerBaseContext,
    useScreenManagerContext,
    useScreenManagerEvents,
    useScreenUpdateEvents,
    useScreenVideoSources,
} from './screenManagerHooks';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

// Runs `useHook` in a component and reports what it returned or threw.
function genProbe(useHook: () => any) {
    const results: { value?: any; error?: any }[] = [];
    function HookProbeComp() {
        try {
            results.push({ value: useHook() });
        } catch (error) {
            results.push({ error });
        }
        return null;
    }
    return { results, HookProbeComp };
}

async function renderWith(base: any, Probe: () => null) {
    await act(async () => {
        root.render(
            base === undefined ? (
                <Probe />
            ) : (
                <ScreenManagerBaseContext value={base}>
                    <Probe />
                </ScreenManagerBaseContext>
            ),
        );
    });
}

beforeEach(() => {
    fakes.hookCalls.length = 0;
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

describe('screen manager contexts', () => {
    test('the optional reader is null outside a provider', async () => {
        const { results, HookProbeComp } = genProbe(
            useOptionalScreenManagerBaseContext,
        );
        await renderWith(undefined, HookProbeComp);
        expect(results.at(-1)).toEqual({ value: null });

        const base = new fakes.FakeScreenManagerBase(1);
        await renderWith(base, HookProbeComp);
        expect(results.at(-1)?.value).toBe(base);
    });

    test('the required reader throws outside a provider', async () => {
        const { results, HookProbeComp } = genProbe(
            useScreenManagerBaseContext,
        );
        await renderWith(undefined, HookProbeComp);
        expect(results.at(-1)?.error?.message).toBe(
            'useScreenManager must be used within a ScreenManagerBase ' +
                'Context Provider',
        );

        const base = new fakes.FakeScreenManagerBase(2);
        await renderWith(base, HookProbeComp);
        expect(results.at(-1)?.value).toBe(base);
    });

    test('a screen manager reader refuses a bare base', async () => {
        const { results, HookProbeComp } = genProbe(useScreenManagerContext);
        await renderWith(new fakes.FakeScreenManagerBase(3), HookProbeComp);
        expect(results.at(-1)?.error?.message).toBe(
            'screenManagerBase is not found.',
        );

        const screenManager = new fakes.FakeScreenManager(4);
        await renderWith(screenManager, HookProbeComp);
        expect(results.at(-1)?.value).toBe(screenManager);
    });
});

describe('event hooks', () => {
    test('screen manager events are read off the base class', async () => {
        const base = new fakes.FakeScreenManagerBase(5);
        const callback = () => {};
        const { HookProbeComp } = genProbe(() => {
            useScreenManagerEvents(
                ['update', 'refresh'] as any,
                base as any,
                callback,
            );
        });
        await renderWith(undefined, HookProbeComp);

        expect(fakes.hookCalls).toEqual([
            {
                name: 'useScreenEvents',
                args: [
                    ['update', 'refresh'],
                    fakes.FakeScreenManagerBase,
                    base,
                    callback,
                ],
            },
        ]);
    });

    test('an update anywhere on a screen tells the callback which layer', async () => {
        const base = new fakes.FakeScreenManagerBase(6);
        const heard: string[] = [];
        const { HookProbeComp } = genProbe(() => {
            useScreenUpdateEvents(base as any, (eventType) => {
                heard.push(eventType);
            });
        });
        await renderWith(undefined, HookProbeComp);

        const [screenCall, ...layerCalls] = fakes.hookCalls;
        expect(screenCall.name).toBe('useScreenEvents');
        expect(screenCall.args.slice(0, 3)).toEqual([
            ['update'],
            fakes.FakeScreenManagerBase,
            base,
        ]);
        expect(layerCalls.map(({ name }) => name)).toEqual([
            'useScreenBackgroundManagerEvents',
            'useScreenVaryAppDocumentManagerEvents',
            'useScreenLongTextManagerEvents',
            'useScreenForegroundManagerEvents',
            'useScreenDrawManagerEvents',
            'useScreenFocusManagerEvents',
        ]);
        for (const { args } of layerCalls) {
            // Every layer's static events, not one manager's.
            expect(args.slice(0, 2)).toEqual([['update'], undefined]);
            args[2]();
        }
        expect(heard).toEqual([
            'background',
            'varyAppDocument',
            'bible',
            'foreground',
            'draw',
            'focus',
        ]);
    });

    test('with no callback nothing is bound', async () => {
        const { HookProbeComp } = genProbe(() => {
            useScreenUpdateEvents();
        });
        await renderWith(undefined, HookProbeComp);

        expect(fakes.hookCalls).toHaveLength(7);
        expect(fakes.hookCalls[0].args).toEqual([
            ['update'],
            fakes.FakeScreenManagerBase,
            undefined,
            undefined,
        ]);
        for (const { args } of fakes.hookCalls.slice(1)) {
            expect(args[2]).toBeUndefined();
        }
    });
});

describe('useScreenVideoSources', () => {
    test('lists the background video and follows a background change', async () => {
        const screenManager = new fakes.FakeScreenManager(7);
        screenManager.screenBackgroundManager.backgroundSrc = {
            type: 'video',
            src: 'file://a.mp4',
        };
        const { results, HookProbeComp } = genProbe(useScreenVideoSources);
        await renderWith(screenManager, HookProbeComp);
        expect(results.at(-1)?.value).toEqual([['file://a.mp4', 'video-12']]);

        const backgroundCall = fakes.hookCalls.find(({ name }) => {
            return name === 'useScreenBackgroundManagerEvents';
        })!;
        expect(backgroundCall.args.slice(0, 2)).toEqual([
            ['update'],
            undefined,
        ]);
        const update = backgroundCall.args[2];

        screenManager.screenBackgroundManager.backgroundSrc = {
            type: 'image',
            src: 'file://a.png',
        };
        await act(async () => {
            update();
        });
        expect(results.at(-1)?.value).toEqual([]);

        screenManager.screenBackgroundManager.backgroundSrc = {
            type: 'video',
            src: 'file://long-name.mp4',
        };
        await act(async () => {
            update();
        });
        expect(results.at(-1)?.value).toEqual([
            ['file://long-name.mp4', 'video-20'],
        ]);
    });

    test('a video with no source, or no background, lists nothing', async () => {
        const screenManager = new fakes.FakeScreenManager(8);
        screenManager.screenBackgroundManager.backgroundSrc = {
            type: 'video',
            src: '',
        };
        const { results, HookProbeComp } = genProbe(useScreenVideoSources);
        await renderWith(screenManager, HookProbeComp);
        expect(results.at(-1)?.value).toEqual([]);

        screenManager.screenBackgroundManager.backgroundSrc = null;
        const { results: emptyResults, HookProbeComp: EmptyProbeComp } =
            genProbe(useScreenVideoSources);
        await renderWith(screenManager, EmptyProbeComp);
        expect(emptyResults.at(-1)?.value).toEqual([]);
    });
});
