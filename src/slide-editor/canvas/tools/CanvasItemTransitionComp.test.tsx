// @vitest-environment jsdom

import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import EventHandler from '../../../event/EventHandler';

const h = vi.hoisted(() => ({
    props: null as any,
    setProps: vi.fn(),
    transitionMap: null as null | Record<string, string>,
    mapCalls: [] as unknown[][],
    getCommonEffectType: vi.fn(),
    override: null as any,
}));

vi.mock('../../../lang/langHelpers', () => ({
    tran: (text: string) => text,
}));

vi.mock('../../../helper/appHooks', async () => {
    const react = await import('react');
    return {
        useAppEffect: react.useEffect,
        useAppCurrentRef: <T,>(value: T) => {
            const ref = react.useRef(value);
            ref.current = value;
            return ref;
        },
    };
});

vi.mock('../CanvasController', () => ({
    useCanvasControllerContext: () => ({
        canvas: { slide: { id: 4, filePath: '/docs/service.slides' } },
    }),
}));

vi.mock('../CanvasItem', () => ({
    useCanvasItemPropsSetterContext: () => [h.props, h.setProps],
}));

vi.mock('../../../_screen/managers/ScreenEffectManager', () => ({
    default: { getCommonEffectType: h.getCommonEffectType },
    SCREEN_EFFECT_CHANGED_EVENT: 'screen-effect-changed',
}));

vi.mock('../../../others/slideTransitionMenuHelpers', () => ({
    useSlideTransitionMap: (...args: unknown[]) => {
        h.mapCalls.push(args);
        return h.transitionMap;
    },
}));

// The real manager reads and writes `.transition.json` files; only its key
// naming is used here.
vi.mock('../../../others/SlideTransitionManager', () => ({
    slideTransitionManager: {
        toKey: (id?: number | string) =>
            typeof id === 'number' ? id.toString() : (id ?? 'self'),
    },
}));

vi.mock('../../../others/TransitionOverrideComp', () => ({
    default: (props: any) => {
        h.override = props;
        return (
            <div data-override="">
                {`${props.value ?? 'none-set'}|${props.inherited.effect}|` +
                    props.inherited.sourceLabel}
            </div>
        );
    },
}));

vi.mock('./SlideEditorToolTitleComp', () => ({
    default: ({ title, children }: { title: string; children: ReactNode }) => (
        <section data-title={title}>{children}</section>
    ),
}));

import CanvasItemTransitionComp from './CanvasItemTransitionComp';

let container: HTMLDivElement;
let root: Root;

async function render() {
    await act(async () => root.render(<CanvasItemTransitionComp />));
}

function shown() {
    return container.querySelector('[data-override]')?.textContent;
}

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    h.setProps.mockReset();
    h.getCommonEffectType.mockReset();
    h.getCommonEffectType.mockReturnValue('fade');
    h.props = { id: 1, transitionEffect: undefined };
    h.transitionMap = null;
    h.mapCalls = [];
    h.override = null;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
});

describe('CanvasItemTransitionComp', () => {
    test("reads the slide's transition map and explains when it is used", async () => {
        await render();

        expect(h.mapCalls[0]).toEqual(['/docs/service.slides', true]);
        expect(
            container.querySelector('section')?.getAttribute('data-title'),
        ).toBe('Canvas item transition');
        expect(container.textContent).toContain('Used when changing slides.');
        expect(h.override.choicesClassName).toBe('w-100');
    });

    test('inherits the transition of its own slide first', async () => {
        h.transitionMap = { '4': 'zoom', self: 'move' };
        await render();

        expect(shown()).toBe('none-set|zoom|Slide transition');
    });

    test("falls back to the whole document's transition", async () => {
        h.transitionMap = { '9': 'zoom', self: 'move' };
        await render();

        expect(shown()).toBe('none-set|move|Slides preview');
    });

    test('falls back to the screen setting, and follows changes to it', async () => {
        await render();
        expect(h.getCommonEffectType).toHaveBeenCalledWith('vary-app-document');
        expect(shown()).toBe('none-set|fade|Screen setting');

        h.getCommonEffectType.mockReturnValue('zoom');
        await act(async () => {
            EventHandler.addPropEvent('screen-effect-changed');
            await new Promise((resolve) => setTimeout(resolve, 0));
        });

        expect(shown()).toBe('none-set|zoom|Screen setting');
    });

    test("shows the item's own valid override only", async () => {
        h.props = { id: 1, transitionEffect: 'move' };
        await render();
        expect(shown()).toBe('move|fade|Screen setting');

        h.props = { id: 1, transitionEffect: 'spin' };
        await render();
        expect(shown()).toBe('none-set|fade|Screen setting');
    });

    test('stores a chosen override, and clears it back to inheriting', async () => {
        await render();

        await act(async () => h.override.onChange('zoom'));
        expect(h.setProps).toHaveBeenLastCalledWith({
            transitionEffect: 'zoom',
        });

        // `null` rather than a missing key, so the item drops the field.
        await act(async () => h.override.onChange(undefined));
        expect(h.setProps).toHaveBeenLastCalledWith({ transitionEffect: null });
    });

    test('stops listening for screen setting changes once unmounted', async () => {
        const register = vi.spyOn(EventHandler, 'registerEventListener');
        const unregister = vi.spyOn(EventHandler, 'unregisterEventListener');
        await render();
        expect(register).toHaveBeenCalledOnce();
        const registered = register.mock.results[0].value;
        expect(registered).toEqual([
            {
                eventName: 'screen-effect-changed',
                listener: expect.any(Function),
            },
        ]);

        await act(async () => root.unmount());
        root = createRoot(container);

        expect(unregister).toHaveBeenCalledExactlyOnceWith(registered);
    });
});
