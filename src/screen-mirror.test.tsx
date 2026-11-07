import {
    Children,
    Fragment,
    isValidElement,
    type ReactElement,
    type ReactNode,
} from 'react';
import { expect, test, vi } from 'vitest';

// The Screen Mirror guest page's entry: the app is booted first, then the
// connection console runs with the window tools and none of the app layout.
const h = vi.hoisted(() => ({
    order: [] as string[],
    finishInit: null as null | (() => void),
    ran: null as unknown,
}));

vi.mock('./bootstrapCss', () => ({}));
vi.mock('./boot', () => ({
    init: () => {
        h.order.push('init');
        return new Promise<void>((resolve) => {
            h.finishInit = () => {
                h.order.push('init done');
                resolve();
            };
        });
    },
}));
vi.mock('./others/main', () => ({
    run: (node: unknown) => {
        h.order.push('run');
        h.ran = node;
    },
}));
vi.mock('./others/AppWindowToolsComp', () => ({
    default: function AppWindowToolsComp() {
        return null;
    },
}));
vi.mock('./screen-mirror/ScreenMirrorGuestComp', () => ({
    default: function ScreenMirrorGuestComp() {
        return null;
    },
}));

test('boots the app, then runs the guest console and the window tools alone', async () => {
    const loading = import('./screen-mirror');
    await vi.waitFor(() => expect(h.finishInit).not.toBeNull());
    // Nothing runs while the app is still booting.
    expect(h.order).toEqual(['init']);
    h.finishInit!();
    await loading;
    expect(h.order).toEqual(['init', 'init done', 'run']);

    const ran = h.ran as ReactElement<{ children: ReactNode }>;
    expect(isValidElement(ran)).toBe(true);
    expect(ran.type).toBe(Fragment);
    const parts = Children.toArray(ran.props.children) as ReactElement[];
    expect(parts.map((part) => (part.type as { name: string }).name)).toEqual([
        'ScreenMirrorGuestComp',
        'AppWindowToolsComp',
    ]);
});
