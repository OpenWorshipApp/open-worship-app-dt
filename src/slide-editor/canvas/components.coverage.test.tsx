// @vitest-environment jsdom

import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
    controller: null as any,
    boxRenders: [] as number[],
}));

vi.mock('../../server/appProvider', () => ({
    default: {
        systemUtils: { isDev: false },
        envUtils: { isFEUseEffectWarning: false },
    },
}));
vi.mock('../../lang/langHelpers', () => ({
    tran: (key: string) => key,
}));
vi.mock('./CanvasController', () => ({
    useCanvasControllerContext: () => h.controller,
}));
vi.mock('./CanvasItem', async () => {
    const { createContext } = await import('react');
    return { CanvasItemContext: createContext(null) };
});
vi.mock('./box/BoxEditorComp', async () => {
    const { use } = await import('react');
    const { CanvasItemContext } = await import('./CanvasItem');
    return {
        BoxEditorComp: function BoxEditorMockComp() {
            const canvasItem = use(CanvasItemContext as any) as any;
            h.boxRenders.push(canvasItem.id);
            return <i className="box" data-item={canvasItem.id} />;
        },
    };
});

import {
    useCanvasControllerEvents,
    useCanvasControllerRefreshEvents,
    useSlideCanvasScale,
} from './canvasEventHelpers';
import {
    CanvasGuideLineComp,
    CanvasSnapLinesComp,
} from './CanvasGuideLineComp';
import {
    CanvasSnapContext,
    useCanvasSnapContext,
} from './canvasSnapGuideHelpers';
import { CanvasItemsListComp } from './canvas-container/CanvasItemsListComp';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

type RegistrationType = {
    types: string[];
    listener: (data: unknown, time: number) => void;
};

function genController(scale = 1) {
    const registrations: RegistrationType[] = [];
    const unregistered: RegistrationType[] = [];
    return {
        scale,
        registrations,
        unregistered,
        itemRegisterEventListener(
            types: string[],
            listener: RegistrationType['listener'],
        ) {
            const registration = { types, listener };
            registrations.push(registration);
            return registration;
        },
        unregisterEventListener(registration: RegistrationType) {
            unregistered.push(registration);
        },
        fire(type: string, data: unknown, time: number) {
            for (const registration of registrations) {
                if (
                    !unregistered.includes(registration) &&
                    registration.types.includes(type)
                ) {
                    registration.listener(data, time);
                }
            }
        },
    };
}

let container: HTMLDivElement;
let root: Root;

async function render(node: ReactNode) {
    await act(async () => {
        root.render(node);
    });
}

beforeEach(() => {
    h.controller = genController();
    h.boxRenders.length = 0;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(async () => {
    await act(async () => {
        root.unmount();
    });
    container.remove();
});

describe('useCanvasControllerEvents', () => {
    function EventsProbeComp({
        types,
        onEvent,
    }: Readonly<{
        types: any[];
        onEvent?: (data: unknown, time: number) => void;
    }>) {
        useCanvasControllerEvents(types, onEvent);
        return null;
    }

    it('calls the latest callback and re-registers only for new event types', async () => {
        const first = vi.fn();
        const latest = vi.fn();
        await render(<EventsProbeComp types={['update']} onEvent={first} />);
        await render(<EventsProbeComp types={['update']} onEvent={latest} />);
        expect(h.controller.registrations).toHaveLength(1);
        expect(h.controller.registrations[0].types).toEqual(['update']);
        h.controller.fire('update', { id: 1 }, 42);
        expect(first).not.toHaveBeenCalled();
        expect(latest).toHaveBeenCalledWith({ id: 1 }, 42);

        await render(
            <EventsProbeComp types={['update', 'reload']} onEvent={latest} />,
        );
        expect(h.controller.registrations).toHaveLength(2);
        expect(h.controller.unregistered).toEqual([
            h.controller.registrations[0],
        ]);
        await act(async () => {
            root.unmount();
        });
        expect(h.controller.unregistered).toHaveLength(2);
        root = createRoot(container);
    });

    it('tolerates an event with no callback', async () => {
        await render(<EventsProbeComp types={['scale']} />);
        expect(() => h.controller.fire('scale', null, 1)).not.toThrow();
    });
});

describe('useSlideCanvasScale', () => {
    function ScaleProbeComp() {
        const scale = useSlideCanvasScale(h.controller);
        return <output>{scale}</output>;
    }

    it('follows the controller scale on its scale events', async () => {
        h.controller = genController(0.5);
        await render(<ScaleProbeComp />);
        expect(container.textContent).toBe('0.5');
        expect(h.controller.registrations[0].types).toEqual(['scale']);
        h.controller.scale = 0.75;
        await act(async () => {
            h.controller.fire('scale', null, 1);
        });
        expect(container.textContent).toBe('0.75');
        await act(async () => {
            root.unmount();
        });
        expect(h.controller.unregistered).toEqual([
            h.controller.registrations[0],
        ]);
        root = createRoot(container);
    });
});

describe('useCanvasControllerRefreshEvents', () => {
    let renders: number;
    function RefreshProbeComp({ types }: Readonly<{ types?: any[] }>) {
        useCanvasControllerRefreshEvents(types);
        renders++;
        return null;
    }

    beforeEach(() => {
        renders = 0;
    });

    it('re-renders on update and scale events by default', async () => {
        await render(<RefreshProbeComp />);
        expect(h.controller.registrations[0].types).toEqual([
            'update',
            'scale',
        ]);
        const before = renders;
        await act(async () => {
            h.controller.fire('update', null, Date.now() + 1000);
        });
        expect(renders).toBe(before + 1);
        await act(async () => {
            h.controller.fire('reload', null, Date.now() + 2000);
        });
        expect(renders).toBe(before + 1);
    });

    it('re-renders only on the events it is given', async () => {
        await render(<RefreshProbeComp types={['reload']} />);
        expect(h.controller.registrations[0].types).toEqual(['reload']);
        const before = renders;
        await act(async () => {
            h.controller.fire('reload', null, Date.now() + 3000);
        });
        expect(renders).toBe(before + 1);
    });
});

describe('CanvasGuideLineComp', () => {
    it('draws a horizontal guide across the canvas and reports drag and removal', async () => {
        const onPointerDown = vi.fn();
        const onRemove = vi.fn();
        await render(
            <CanvasGuideLineComp
                guide={{ id: 1, axis: 'h', pos: 120 }}
                onPointerDown={onPointerDown}
                onRemove={onRemove}
            />,
        );
        const guide = container.firstElementChild as HTMLElement;
        expect(guide.title).toBe('Drag to move, double-click to remove');
        expect(guide.style.left).toBe('0px');
        expect(guide.style.top).toBe('117px');
        expect(guide.style.width).toBe('100%');
        expect(guide.style.height).toBe('6px');
        expect(guide.style.cursor).toBe('row-resize');
        expect(guide.style.touchAction).toBe('none');
        const line = guide.firstElementChild as HTMLElement;
        expect(line.style.top).toBe('3px');
        expect(line.style.height).toBe('1px');
        await act(async () => {
            guide.dispatchEvent(
                new MouseEvent('pointerdown', { bubbles: true }),
            );
        });
        expect(onPointerDown).toHaveBeenCalledTimes(1);
        expect(onRemove).not.toHaveBeenCalled();
        await act(async () => {
            guide.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
        });
        expect(onRemove).toHaveBeenCalledTimes(1);
    });

    it('draws a vertical guide down the canvas', async () => {
        await render(
            <CanvasGuideLineComp
                guide={{ id: 2, axis: 'v', pos: 40 }}
                onPointerDown={() => {}}
                onRemove={() => {}}
            />,
        );
        const guide = container.firstElementChild as HTMLElement;
        expect(guide.style.left).toBe('37px');
        expect(guide.style.top).toBe('0px');
        expect(guide.style.width).toBe('6px');
        expect(guide.style.height).toBe('100%');
        expect(guide.style.cursor).toBe('col-resize');
        expect((guide.firstElementChild as HTMLElement).style.left).toBe('3px');
    });

    it('draws one snap line per position on each axis', async () => {
        await render(
            <CanvasSnapLinesComp vertical={[10, 20]} horizontal={[5]} />,
        );
        const lines = Array.from(container.children) as HTMLElement[];
        expect(
            lines.map((line) => [
                line.style.left,
                line.style.top,
                line.style.width,
                line.style.height,
            ]),
        ).toEqual([
            ['10px', '0px', '1px', '100%'],
            ['20px', '0px', '1px', '100%'],
            ['0px', '5px', '100%', '1px'],
        ]);
    });
});

describe('useCanvasSnapContext', () => {
    function SnapProbeComp() {
        const context = useCanvasSnapContext();
        return (
            <output>{context.getSnapTargets([1]).vertical.join(',')}</output>
        );
    }

    it('throws outside a snap context and returns the provided one inside', () => {
        expect(() => renderToStaticMarkup(<SnapProbeComp />)).toThrow(
            'useCanvasSnapContext must be used inside a CanvasSnapContext',
        );
        const value = {
            getSnapTargets: () => ({ vertical: [0, 960], horizontal: [] }),
            setSnapLines: () => {},
        };
        expect(
            renderToStaticMarkup(
                <CanvasSnapContext value={value}>
                    <SnapProbeComp />
                </CanvasSnapContext>,
            ),
        ).toBe('<output>0,960</output>');
    });
});

describe('CanvasItemsListComp', () => {
    it('renders one box per item and skips the boxes when the list is unchanged', async () => {
        const items = [{ id: 1 }, { id: 2 }] as any[];
        await render(<CanvasItemsListComp canvasItems={items} />);
        expect(
            Array.from(container.querySelectorAll('.box')).map((box) =>
                box.getAttribute('data-item'),
            ),
        ).toEqual(['1', '2']);
        expect(h.boxRenders).toEqual([1, 2]);
        await render(<CanvasItemsListComp canvasItems={items} />);
        expect(h.boxRenders).toEqual([1, 2]);
        await render(<CanvasItemsListComp canvasItems={[items[1]]} />);
        expect(h.boxRenders).toEqual([1, 2, 2]);
        expect(container.querySelectorAll('.box')).toHaveLength(1);
    });
});
